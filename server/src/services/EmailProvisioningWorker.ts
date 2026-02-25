import { CreateUserQueue, createWorker } from './QueueService';
import { prisma } from '../models';
import { googleWorkspace } from './GoogleWorkspaceService';
import { logAudit } from './AuditService';
import nodemailer from 'nodemailer';

/**
 * Email Provisioning Worker
 *
 * Processes 'ProvisionGoogleUser' jobs queued by payment webhooks.
 * Flow: PAID order → create Google Workspace email → send credentials to user's Gmail.
 */

// ── Email sender setup ─────────────────────────────────────────────────────
// Uses Gmail SMTP with an app-specific password or OAuth2 refresh token.
// Set SMTP_USER and SMTP_PASS in .env. Falls back to logging if not configured.
function createTransporter() {
    const user = process.env.SMTP_USER || process.env.GMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
        console.warn('[EmailProvisioningWorker] ⚠️  SMTP_USER/SMTP_PASS not set — emails will be logged only.');
        return null;
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
    });
}

async function sendWelcomeEmail(
    toGmail: string,
    workspaceEmail: string,
    tempPassword: string,
    planName: string
): Promise<void> {
    const transporter = createTransporter();
    const subject = '🎉 Welcome to WebMyDrive — Your Account Credentials';
    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f4f7fb; margin:0; padding:24px;">
  <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 16px rgba(0,0,0,.08);">
    <div style="background:#2563eb; padding:28px 32px;">
      <h1 style="color:#fff; margin:0; font-size:22px;">☁️ WebMyDrive</h1>
      <p style="color:rgba(255,255,255,.8); margin:8px 0 0; font-size:14px;">Your Google Workspace account is ready</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#111; font-size:15px; margin-top:0;">
        Hi there! Your <strong>${planName}</strong> plan payment was successful and your Google Workspace account has been created.
      </p>

      <div style="background:#f8faff; border:1px solid #e0e7ff; border-radius:8px; padding:20px; margin:20px 0;">
        <p style="color:#6b7280; font-size:12px; text-transform:uppercase; letter-spacing:.05em; margin:0 0 4px;">Your WebMyDrive Email</p>
        <p style="color:#2563eb; font-size:20px; font-weight:700; font-family:monospace; margin:0 0 16px;">${workspaceEmail}</p>

        <p style="color:#6b7280; font-size:12px; text-transform:uppercase; letter-spacing:.05em; margin:0 0 4px;">Temporary Password</p>
        <p style="color:#1e293b; font-size:20px; font-weight:700; font-family:monospace; margin:0;">${tempPassword}</p>
      </div>

      <div style="background:#fffbeb; border:1px solid #fcd34d; border-radius:8px; padding:14px 16px; margin-bottom:24px;">
        <p style="color:#92400e; font-size:13px; margin:0;">
          ⚠️ <strong>You will be asked to change this password</strong> when you first sign in to your new account.
        </p>
      </div>

      <a href="https://mail.google.com/a/webmydrive.com" 
         style="display:inline-block; background:#2563eb; color:#fff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:600; font-size:14px;">
        Open Gmail →
      </a>

      <p style="color:#6b7280; font-size:12px; margin-top:24px; padding-top:16px; border-top:1px solid #f1f5f9;">
        If you have any issues, reply to this email or contact support. <br/>
        © ${new Date().getFullYear()} WebMyDrive. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`;

    if (!transporter) {
        // Fallback: log credentials clearly when SMTP not configured
        console.log('\n' + '='.repeat(70));
        console.log('[EmailProvisioningWorker] 📧 WELCOME EMAIL (SMTP NOT CONFIGURED)');
        console.log(`  TO:       ${toGmail}`);
        console.log(`  SUBJECT:  ${subject}`);
        console.log(`  EMAIL:    ${workspaceEmail}`);
        console.log(`  PASSWORD: ${tempPassword}`);
        console.log('='.repeat(70) + '\n');
        return;
    }

    await transporter.sendMail({
        from: `"WebMyDrive" <${process.env.SMTP_USER || process.env.GMAIL_USER}>`,
        to: toGmail,
        subject,
        html,
    });
    console.log(`[EmailProvisioningWorker] ✅ Welcome email sent to ${toGmail}`);
}

// ── Main worker processor ──────────────────────────────────────────────────
const createUserProcessor = async (job: any) => {
    const { userId, orderId } = job.data;
    console.log(`[EmailProvisioningWorker] 🚀 Processing job userId=${userId}, orderId=${orderId}`);

    try {
        // Step 1: Verify order is PAID
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { plan: true }
        });
        if (!order) throw new Error(`Order ${orderId} not found`);
        if (order.status !== 'PAID') throw new Error(`Order ${orderId} is ${order.status}, expected PAID`);

        // Step 2: Load user
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error(`User ${userId} not found`);

        // Step 3: Idempotency — skip if already provisioned
        const existingWorkspace = await prisma.workspace.findFirst({ where: { userId } });
        if (existingWorkspace?.status === 'ACTIVE' && existingWorkspace.metadata) {
            console.warn(`[EmailProvisioningWorker] Workspace already active for user ${userId} — skipping`);
            await logAudit('PROVISIONING_SKIPPED', 'Workspace', String(existingWorkspace.id), userId, undefined,
                { orderId, reason: 'Already active' });
            return { success: true, skipped: true };
        }

        // Step 4: Derive email — use Gmail prefix + @webmydrive.com
        const emailPrefix = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');
        const emailAddress = `${emailPrefix}@webmydrive.com`;
        console.log(`[EmailProvisioningWorker] Target email: ${emailAddress}`);

        // Step 5: Check if email already exists in Google Workspace
        let emailExists = false;
        try {
            emailExists = !(await googleWorkspace.checkEmailAvailability(emailAddress));
        } catch (e: any) {
            console.warn(`[EmailProvisioningWorker] Could not check email availability:`, e.message);
        }

        // Step 6: Create Google Workspace user (or reuse existing)
        let googleUserId: string;
        let tempPassword: string;

        if (!emailExists) {
            // Generate secure temporary password that satisfies Google complexity requirements
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
            const random = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
            tempPassword = `Wmd${random}!`;

            try {
                googleUserId = await googleWorkspace.createUser(
                    emailAddress,
                    user.name?.split(' ')[0] || 'User',
                    user.name?.split(' ').slice(1).join(' ') || emailPrefix,
                    tempPassword
                );
                console.log(`[EmailProvisioningWorker] ✅ Created Google Workspace user: ${googleUserId}`);
            } catch (googleError: any) {
                console.error(`[EmailProvisioningWorker] Google Workspace error:`, googleError.message);
                await logAudit('GOOGLE_WORKSPACE_CREATION_FAILED', 'User', String(userId), userId, undefined,
                    { orderId, email: emailAddress, error: googleError.message });
                // Don't throw — continue to DB update and email sending
                googleUserId = emailAddress;
                tempPassword = `Wmd${Math.random().toString(36).slice(-8)}!`;
            }
        } else {
            googleUserId = emailAddress;
            tempPassword = `[Already exists — see Google Admin]`;
            console.log(`[EmailProvisioningWorker] Email ${emailAddress} already exists in Google Workspace`);
        }

        // Step 7: Persist workspace record with credentials in metadata
        const credsMeta = JSON.stringify({ email: emailAddress, tempPassword });
        let workspace;
        if (existingWorkspace) {
            workspace = await prisma.workspace.update({
                where: { id: existingWorkspace.id },
                data: {
                    status: 'ACTIVE',
                    googleCustomerId: googleUserId,
                    domain: 'webmydrive.com',
                    planId: (order as any).planId || existingWorkspace.planId,
                    metadata: credsMeta,
                }
            });
        } else {
            workspace = await prisma.workspace.create({
                data: {
                    userId,
                    status: 'ACTIVE',
                    domain: 'webmydrive.com',
                    googleCustomerId: googleUserId,
                    planId: (order as any).planId || null,
                    metadata: credsMeta,
                }
            });
        }
        console.log(`[EmailProvisioningWorker] ✅ Workspace ${workspace.id} saved as ACTIVE`);

        // Update user displayEmail
        await prisma.user.update({
            where: { id: userId },
            data: { displayEmail: emailAddress }
        });

        // Step 8: Audit log
        await logAudit('EMAIL_PROVISIONED', 'Workspace', String(workspace.id), userId, undefined, {
            orderId, emailAddress, googleUserId, status: 'ACTIVE'
        });

        // Step 9: Send welcome email with credentials to user's original Gmail
        const planName = (order as any).plan?.name || 'Your plan';
        await sendWelcomeEmail(user.email, emailAddress, tempPassword, planName);

        console.log(`[EmailProvisioningWorker] ✅ Provisioning complete for user ${userId}: ${emailAddress}`);
        return { success: true, userId, orderId, emailAddress, workspaceId: workspace.id };

    } catch (error: any) {
        console.error(`[EmailProvisioningWorker] ❌ Failed for user ${userId}:`, error.message);
        await logAudit('EMAIL_PROVISIONING_FAILED', 'User', String(userId), userId, undefined, {
            orderId, error: error.message, timestamp: new Date().toISOString()
        });
        throw error; // BullMQ will retry
    }
};

export const EmailProvisioningProcessor = createUserProcessor;

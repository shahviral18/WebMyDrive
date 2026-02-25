import { Request, Response } from "express";
import { prisma } from "../models";
import bcrypt from "bcrypt";
import { generateToken } from "../utils/jwt";
import { logAudit } from "../services/AuditService";
import { googleWorkspace } from "../services/GoogleWorkspaceService";

// Name-based referral code: first word of name + year (e.g. "Priya Sharma" → PRIYA2026)
function generateReferralCode(name: string, email: string): string {
    const src = (name || '').trim() || email.split('@')[0];
    const firstWord = src.split(/\s+/)[0];
    const base = firstWord.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 12);
    return `${base}${new Date().getFullYear()}`;
}

export class AuthController {
    static async register(req: Request, res: Response) {
        const { name, email, password, distributorId } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
        if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

        try {
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) return res.status(400).json({ error: "Email already registered" });

            const passwordHash = await bcrypt.hash(password, 10);

            // Collision-safe referral code generation
            const baseCode = generateReferralCode(name || email.split('@')[0], email);
            let referralCode = baseCode;
            for (let attempt = 1; attempt <= 10; attempt++) {
                const conflict = await prisma.user.findUnique({ where: { referralCode } });
                if (!conflict) break;
                referralCode = `${baseCode}${attempt}`;
                if (attempt === 10) throw new Error('Could not generate unique referral code.');
            }

            const user = await prisma.user.create({
                data: {
                    name: name || email.split("@")[0],
                    email,
                    passwordHash,
                    role: "USER",
                    referralCode,
                    walletBalance: 0.0,
                    passwordResetRequired: true,
                    first_login: true,
                    distributorId: distributorId ? Number(distributorId) : null,
                }
            });

            await logAudit("REGISTER", "User", String(user.id), user.id, req.ip, { email });

            const token = generateToken(user.id, user.role);
            return res.status(201).json({
                token,
                requiresPasswordChange: true,
                first_login: true,
                user: { id: user.id, name: user.name, email: user.displayEmail || user.email, role: user.role, referralCode: user.referralCode }
            });
        } catch (err: any) {
            if (err.code === 'P2002') return res.status(400).json({ error: "Email already registered" });
            return res.status(500).json({ error: err.message });
        }
    }

    static async login(req: Request, res: Response) {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

        try {
            // Check if this is a distributor login first
            const distributor = await prisma.distributor.findUnique({ where: { email } });
            if (distributor && distributor.passwordHash) {
                const valid = await bcrypt.compare(password, distributor.passwordHash);
                if (!valid) return res.status(401).json({ error: "Invalid credentials" });

                await logAudit("LOGIN", "Distributor", String(distributor.id), undefined, req.ip, { email });
                const token = generateToken(-(distributor.id), "DISTRIBUTOR"); // Negative ID = distributor
                return res.json({
                    token,
                    requiresPasswordChange: distributor.passwordResetRequired,
                    user: {
                        id: distributor.id,
                        name: distributor.name,
                        email: distributor.displayEmail || distributor.email,
                        role: "DISTRIBUTOR",
                        distributorId: distributor.id,
                    }
                });
            }

            // Regular user login
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user || !user.passwordHash) return res.status(401).json({ error: "Invalid credentials" });

            const valid = await bcrypt.compare(password, user.passwordHash);
            if (!valid) return res.status(401).json({ error: "Invalid credentials" });

            // Block disabled accounts at login
            if ((user as any).isDisabled) {
                return res.status(403).json({ error: "Your account has been suspended. Please contact support." });
            }

            const src = (user.name || '').trim() || user.email.split('@')[0];
            const firstWord = src.split(/\s+/)[0];
            const basePass = firstWord.replace(/[^a-z0-9]/gi, '');
            const defaultPass = (basePass.charAt(0).toUpperCase() + basePass.slice(1).toLowerCase()) + new Date().getFullYear();
            const requiresPasswordChange = user.passwordResetRequired || password === defaultPass;

            await logAudit("LOGIN", "User", String(user.id), user.id, req.ip, { email });

            const token = generateToken(user.id, user.role);
            return res.json({
                token,
                requiresPasswordChange,
                first_login: (user as any).first_login,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.displayEmail || user.email,
                    role: user.role,
                    referralCode: user.referralCode,
                    walletBalance: user.walletBalance,
                }
            });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    static async forgotPassword(req: Request, res: Response) {
        const { email, newPassword, token } = req.body;
        if (!newPassword || (!email && !token)) return res.status(400).json({ error: "Email/token and new password are required" });
        if (newPassword.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

        try {
            // New logic: Look up by SecurityLink token
            if (token) {
                const link = await prisma.securityLink.findUnique({ where: { token } });
                if (!link || link.status !== 'ACTIVE' || new Date() > link.expiresAt) {
                    return res.status(400).json({ error: "Invalid or expired reset link" });
                }

                const newHash = await bcrypt.hash(newPassword, 10);
                if (link.role === 'USER') {
                    await prisma.user.update({ where: { id: link.userId }, data: { passwordHash: newHash, passwordResetRequired: false, first_login: false } });
                } else {
                    await prisma.distributor.update({ where: { id: link.userId }, data: { passwordHash: newHash, passwordResetRequired: false } });
                }

                await prisma.securityLink.update({ where: { id: link.id }, data: { status: 'USED', usedAt: new Date() } });
                return res.json({ success: true, message: "Password updated successfully via security link" });
            }

            // Legacy fallback (should ideally be deprecated)
            const emailToUse = email;
            if (!emailToUse) return res.status(400).json({ error: "Email or token required" });

            const user = await prisma.user.findUnique({ where: { email: emailToUse } });
            if (user) {
                const newHash = await bcrypt.hash(newPassword, 10);
                await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash, passwordResetRequired: false, first_login: false } });
                await logAudit("FORGOT_PASSWORD_RESET", "User", String(user.id), user.id, req.ip, { email: emailToUse });
                return res.json({ success: true, message: "Password updated successfully" });
            }

            const dist = await prisma.distributor.findUnique({ where: { email: emailToUse } });
            if (dist) {
                const newHash = await bcrypt.hash(newPassword, 10);
                await prisma.distributor.update({ where: { id: dist.id }, data: { passwordHash: newHash, passwordResetRequired: false } });
                await logAudit("FORGOT_PASSWORD_RESET", "Distributor", String(dist.id), undefined, req.ip, { email: emailToUse });
                return res.json({ success: true, message: "Password updated successfully" });
            }

            return res.status(404).json({ error: "Account not found" });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    static async me(req: Request, res: Response) {
        const reqUser = (req as any).user;
        if (!reqUser) return res.status(401).json({ error: "Unauthorized" });

        try {
            if (reqUser.role === "DISTRIBUTOR") {
                const dist = await prisma.distributor.findUnique({
                    where: { id: Math.abs(reqUser.userId) }
                });
                if (!dist) return res.status(404).json({ error: "Distributor not found" });
                return res.json({
                    user: {
                        id: dist.id, name: dist.name, email: dist.displayEmail || dist.email,
                        role: "DISTRIBUTOR", distributorId: dist.id, walletBalance: dist.walletBalance
                    }
                });
            }

            const user = await prisma.user.findUnique({
                where: { id: reqUser.userId },
                include: {
                    workspaces: {
                        select: { status: true, planId: true, metadata: true, plan: { select: { name: true } } },
                        take: 1,
                        orderBy: { createdAt: 'desc' }
                    }
                }
            });
            if (!user) return res.status(404).json({ error: "User not found" });

            return res.json({
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.displayEmail || user.email,
                    role: user.role,
                    referralCode: user.referralCode,
                    walletBalance: user.walletBalance,
                    isDisabled: (user as any).isDisabled,
                    workspace: user.workspaces[0] || null,
                }
            });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    static async changePassword(req: Request, res: Response) {
        const reqUser = (req as any).user;
        if (!reqUser) return res.status(401).json({ error: "Unauthorized" });
        const { currentPassword, newPassword } = req.body;

        try {
            const user = await prisma.user.findUnique({ where: { id: reqUser.userId } });
            if (!user || !user.passwordHash) return res.status(404).json({ error: "User not found" });

            const valid = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!valid) return res.status(400).json({ error: "Current password is incorrect" });

            const newHash = await bcrypt.hash(newPassword, 10);
            await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash, passwordResetRequired: false, first_login: false } });

            return res.json({ success: true });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    static async setupWorkspacePassword(req: Request, res: Response) {
        const reqUser = (req as any).user;
        if (!reqUser) return res.status(401).json({ error: "Unauthorized" });
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ error: "Password must be at least 8 characters long." });
        }

        try {
            const user = await prisma.user.findUnique({ where: { id: reqUser.userId } });
            if (!user) return res.status(404).json({ error: "User not found" });

            // Ensure they have an active workspace
            const workspace = await prisma.workspace.findFirst({
                where: { userId: user.id, status: 'ACTIVE' },
                orderBy: { createdAt: 'desc' }
            });

            if (!workspace || !workspace.metadata) {
                return res.status(400).json({ error: "Workspace not found or not fully provisioned yet." });
            }

            // Extract email from metadata (this is their username@webmydrive.com)
            let wsMeta: any = {};
            try { wsMeta = JSON.parse(workspace.metadata); } catch (e) { }
            const workspaceEmail = wsMeta.email || workspace.googleCustomerId;

            if (!workspaceEmail || workspaceEmail === "PENDING" || !workspaceEmail.includes("@")) {
                // Return success immediately if strictly a demo session to not block the UI
                if (workspaceEmail === "demo@webmydrive.com" || !workspaceEmail) {
                    return res.json({ success: true, message: "Demo Workspace password successfully configured." });
                }
                return res.status(400).json({ error: "Could not find a valid Workspace email to update." });
            }

            // Attempt to update password in Google Workspace Admin SDK.
            // This is BEST-EFFORT — if GW credentials are not configured, we still save locally.
            let googleWarning: string | null = null;
            if (workspaceEmail !== "demo@webmydrive.com") {
                try {
                    await googleWorkspace.changePassword(workspaceEmail, newPassword);
                } catch (googleError: any) {
                    const msg = googleError.message || String(googleError);
                    console.warn("[SetupPassword] Google Workspace API unavailable (credentials not configured?):", msg);
                    // Non-fatal: user can still log into the portal. GW sync can be done via admin later.
                    googleWarning = "Google Workspace password sync skipped — " + msg;
                }
            }

            // ALWAYS update user's DB password so they can log into the portal
            const newHash = await bcrypt.hash(newPassword, 10);
            await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash, passwordResetRequired: false, first_login: false } });

            // Clear the temporary password from metadata
            const updatedMeta = JSON.stringify({ ...wsMeta, tempPassword: null, passwordSet: true });
            await prisma.workspace.update({
                where: { id: workspace.id },
                data: { metadata: updatedMeta }
            });

            return res.json({
                success: true,
                message: "Password configured successfully. You can now log in.",
                ...(googleWarning ? { warning: googleWarning } : {})
            });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }


    static async googleLogin(req: Request, res: Response) {
        const { idToken, googleEmail, name: googleName, distributorId } = req.body;

        try {
            let email: string;
            let name: string;

            if (googleEmail) {
                // Direct path: frontend verified email via Google /userinfo
                email = googleEmail.toLowerCase().trim();
                name = googleName || email.split("@")[0];
            } else if (idToken) {
                // Legacy path: verify Google ID token on server
                const { OAuth2Client } = require('google-auth-library');
                const client = new OAuth2Client();
                const ticket = await client.verifyIdToken({
                    idToken,
                    audience: process.env.GOOGLE_CLIENT_ID || undefined
                });
                const payload = ticket.getPayload();
                if (!payload || !payload.email) return res.status(400).json({ error: "Invalid Google token" });
                email = payload.email.toLowerCase();
                name = payload.name || email.split("@")[0];
            } else {
                return res.status(400).json({ error: "Either idToken or googleEmail is required" });
            }

            // --- Admin check first ---
            const adminUser = await prisma.user.findFirst({
                where: { email, role: { in: ["ADMIN", "SUPERADMIN"] } }
            });
            if (adminUser) {
                if ((adminUser as any).isDisabled) return res.status(403).json({ error: "Your account has been suspended." });
                await logAudit("GOOGLE_LOGIN", "User", String(adminUser.id), adminUser.id, req.ip, { email });
                const token = generateToken(adminUser.id, adminUser.role);
                return res.json({ token, requiresPasswordChange: false, user: { id: adminUser.id, name: adminUser.name, email: adminUser.email, role: adminUser.role } });
            }

            // --- Distributor check ---
            const dist = await prisma.distributor.findUnique({ where: { email } });
            if (dist) {
                if (dist.status === "INACTIVE") return res.status(403).json({ error: "Your account has been suspended." });
                await logAudit("GOOGLE_LOGIN", "Distributor", String(dist.id), undefined, req.ip, { email });
                const token = generateToken(-(dist.id), "DISTRIBUTOR");
                return res.json({ token, requiresPasswordChange: false, user: { id: dist.id, name: dist.name, email: dist.displayEmail || dist.email, role: "DISTRIBUTOR", distributorId: dist.id } });
            }

            // --- Regular user: find or create ---
            let user = await prisma.user.findFirst({
                where: { OR: [{ email }, { displayEmail: email }] }
            });

            if (!user) {
                const tempPasswordHash = await bcrypt.hash(Math.random().toString(36).slice(-16) + "Gg1!", 10);
                const baseCode = generateReferralCode(name, email);
                let referralCode = baseCode;
                for (let attempt = 1; attempt <= 10; attempt++) {
                    const conflict = await prisma.user.findUnique({ where: { referralCode } });
                    if (!conflict) break;
                    referralCode = `${baseCode}${attempt}`;
                }
                user = await prisma.user.create({
                    data: {
                        name, email, passwordHash: tempPasswordHash, role: "USER",
                        referralCode, walletBalance: 0.0, passwordResetRequired: false, first_login: false,
                        distributorId: distributorId ? Number(distributorId) : null,
                    }
                });
                await logAudit("GOOGLE_REGISTER", "User", String(user.id), user.id, req.ip, { email });
            }

            if ((user as any).isDisabled) return res.status(403).json({ error: "Your account has been suspended. Please contact support." });

            await logAudit("GOOGLE_LOGIN", "User", String(user.id), user.id, req.ip, { email });
            const token = generateToken(user.id, user.role);
            return res.json({
                token, requiresPasswordChange: false, first_login: false,
                user: { id: user.id, name: user.name, email: user.displayEmail || user.email, role: user.role, referralCode: user.referralCode, walletBalance: user.walletBalance }
            });
        } catch (err: any) {
            console.error('[GoogleLogin] Error:', err.message);
            return res.status(500).json({ error: err.message });
        }
    }

    static async tempLogin(req: Request, res: Response) {
        const { email, distributorId } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required" });

        try {
            const normalizedEmail = email.toLowerCase().trim();
            const name = normalizedEmail.split("@")[0];

            let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

            if (!user) {
                // Register instantly
                const tempPassword = Math.random().toString(36).slice(-12) + 'Aa1!';
                const passwordHash = await bcrypt.hash(tempPassword, 10);

                const baseCode = generateReferralCode(name, normalizedEmail);
                let referralCode = baseCode;
                for (let attempt = 1; attempt <= 10; attempt++) {
                    const conflict = await prisma.user.findUnique({ where: { referralCode } });
                    if (!conflict) break;
                    referralCode = `${baseCode}${attempt}`;
                }

                user = await prisma.user.create({
                    data: {
                        name,
                        email: normalizedEmail,
                        passwordHash,
                        role: "USER",
                        referralCode,
                        walletBalance: 0.0,
                        first_login: true,
                        distributorId: distributorId ? Number(distributorId) : null,
                    }
                });

                await logAudit("TEMP_REGISTER", "User", String(user.id), user.id, req.ip, { email: normalizedEmail });
            }

            if ((user as any).isDisabled) {
                return res.status(403).json({ error: "Your account has been suspended." });
            }

            await logAudit("TEMP_LOGIN", "User", String(user.id), user.id, req.ip, { email: normalizedEmail });

            const token = generateToken(user.id, user.role);
            return res.json({
                token,
                requiresPasswordChange: (user as any).first_login || false,
                first_login: (user as any).first_login || false,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    referralCode: user.referralCode,
                    walletBalance: user.walletBalance,
                }
            });
        } catch (err: any) {
            console.error('[TempLogin] Error:', err.message);
            return res.status(500).json({ error: err.message });
        }
    }
}

import { Router, Request, Response } from 'express';
import { prisma } from '../models';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * GET /api/user/workspace
 * Returns the active workspace and plan for the authenticated user.
 */
router.get('/workspace', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId;
        const workspace = await prisma.workspace.findFirst({
            where: { userId },
            include: { plan: true },
            orderBy: { createdAt: 'desc' }
        });
        return res.json({ workspace });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

router.get('/check-username', async (req: Request, res: Response) => {
    try {
        const username = req.query.u as string;
        if (!username) return res.status(400).json({ error: 'Username required' });
        const emailToSearch = username.includes('@') ? username : `${username}@webmydrive.com`;
        const base = emailToSearch.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: emailToSearch },
                    { displayEmail: emailToSearch }
                ]
            }
        });

        if (existingUser) {
            // Generate and verify two unique suggestions
            const year = new Date().getFullYear();
            const candidates = [
                `${base}${year}`,
                `${base}${Math.floor(Math.random() * 900) + 100}`,
                `${base}_drive`,
                `${base}pro`,
                `${base}${Math.floor(Math.random() * 90) + 10}`,
            ];

            const suggestions: string[] = [];
            for (const candidate of candidates) {
                if (suggestions.length >= 2) break;
                const candidateEmail = `${candidate}@webmydrive.com`;
                const conflict = await prisma.user.findFirst({
                    where: { OR: [{ email: candidateEmail }, { displayEmail: candidateEmail }] }
                });
                if (!conflict) suggestions.push(candidateEmail);
            }

            // If still not enough suggestions, add timestamp-based one
            if (suggestions.length < 2) {
                suggestions.push(`${base}${Date.now().toString().slice(-4)}@webmydrive.com`);
            }

            return res.json({ available: false, suggestions });
        }

        return res.json({ available: true, email: emailToSearch });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/user/plans
 * Public — returns all active plans. No authentication required.
 * Authenticated users see the same list.
 */
router.get('/plans', async (req: Request, res: Response) => {
    try {
        const plans = await prisma.plan.findMany({
            where: { isActive: true },
            orderBy: { price: 'asc' }
        });
        const { ConfigService } = require('../services/ConfigService');
        const globalConfig = await ConfigService.getGlobalPlanConfig();
        const finalPlans = plans.map(p => {
            if (!p.hasOverride) {
                return {
                    ...p,
                    price: globalConfig.priceINR,
                    priceINR: globalConfig.priceINR,
                    storageGB: globalConfig.storageGB
                };
            }
            return p;
        });
        return res.json({ plans: finalPlans });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/user/plans/:id/purchase
 * Creates a PENDING order for the authenticated user and logs an audit event.
 */
router.post('/plans/:id/purchase', authenticate, async (req: Request, res: Response) => {
    try {
        const planId = Number(req.params.id);
        const userId = (req as any).user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) return res.status(404).json({ error: 'Plan not found' });

        const order = await prisma.order.create({
            data: {
                userId,
                amount: plan.price,
                currency: 'INR',
                status: 'PENDING',
            }
        });

        await prisma.auditLog.create({
            data: {
                actorId: userId,
                actionName: 'PLAN_PURCHASE_REQUEST',
                payloadJson: JSON.stringify({ planId, planName: plan.name, amount: plan.price, orderId: order.id }),
                ipAddress: req.ip,
            }
        });

        return res.json({ order, message: `Purchase request for "${plan.name}" created. Pending payment.` });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/user/orders
 * Returns orders for the authenticated user.
 */
router.get('/orders', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId;
        const orders = await prisma.order.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
        return res.json({ orders });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

/**
 * PUT /api/user/profile
 * Updates the user's profile information (e.g. chosen WebMyDrive ID).
 */
router.put('/profile', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { webMyDriveId } = req.body;

        const updateData: any = {};
        if (webMyDriveId) {
            // Check if the requested ID is available
            const conflict = await prisma.user.findFirst({
                where: {
                    id: { not: userId },
                    OR: [
                        { email: webMyDriveId },
                        { displayEmail: webMyDriveId }
                    ]
                }
            });
            if (conflict) {
                return res.status(400).json({ error: "That ID is no longer available" });
            }

            // We update their primary email to the WebMyDrive ID so that it becomes their login,
            // while preserving their original personal email (which they just registered with) as displayEmail.
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (user && !user.email.includes('@webmydrive.com')) {
                updateData.displayEmail = user.email; // Save personal email
            }
            updateData.email = webMyDriveId; // Set login email to WebMyDrive ID
        }

        if (Object.keys(updateData).length === 0) {
            return res.json({ success: true });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData
        });

        return res.json({ success: true, user: updatedUser });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;

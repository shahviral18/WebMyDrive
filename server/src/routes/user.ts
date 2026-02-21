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
        const userId = (req as any).user?.id;
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

/**
 * GET /api/user/plans
 * Returns all active plans for public/user view.
 */
router.get('/plans', authenticate, async (req: Request, res: Response) => {
    try {
        const plans = await prisma.plan.findMany({
            where: { isActive: true },
            orderBy: { price: 'asc' }
        });
        return res.json({ plans });
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
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) return res.status(404).json({ error: 'Plan not found' });

        // Create a pending order
        const order = await prisma.order.create({
            data: {
                userId,
                amount: plan.price,
                currency: 'INR',
                status: 'PENDING',
            }
        });

        // Log audit event so admin Alerts can pick it up
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
        const userId = (req as any).user?.id;
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

export default router;

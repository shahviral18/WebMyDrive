import { Request, Response } from 'express';
import { ReferralService } from '../services/ReferralService';
import { RazorpayService } from '../services/RazorpayService';
import { prisma } from '../models';
import { logAudit } from '../services/AuditService';

export class ReferralController {
    static async getDashboard(req: Request, res: Response) {
        try {
            const reqUser = req.user;
            if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

            const data = await ReferralService.getUserReferralDashboard(reqUser.userId);
            if (!data) return res.status(404).json({ error: 'User not found' });

            return res.json(data);
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    static async getMyOrders(req: Request, res: Response) {
        try {
            const reqUser = req.user;
            if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

            const orders = await prisma.order.findMany({
                where: { userId: reqUser.userId },
                orderBy: { createdAt: 'desc' }
            });
            return res.json({ orders });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    static async createCheckoutSession(req: Request, res: Response) {
        try {
            const reqUser = req.user;
            if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

            const { planId, promoCode } = req.body;
            if (!planId) return res.status(400).json({ error: 'planId is required' });

            const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
            if (!plan) return res.status(404).json({ error: 'Plan not found' });
            if (!plan.isActive) return res.status(400).json({ error: 'Plan is not available' });

            const amountINR = plan.price;

            // Validate promo code if provided (prevent self-referral at checkout creation)
            if (promoCode) {
                const referrer = await prisma.user.findUnique({ where: { referralCode: promoCode } });
                if (referrer && referrer.id === reqUser.userId) {
                    return res.status(400).json({ error: 'You cannot use your own referral code' });
                }
            }

            // Create a pending order with locked promoCode in metadata
            const order = await prisma.order.create({
                data: {
                    userId: reqUser.userId,
                    amount: amountINR,
                    currency: 'INR',
                    status: 'PENDING',
                }
            });

            // Store promoCode in audit log so it cannot be changed post-creation
            if (promoCode) {
                await logAudit('CHECKOUT_PROMO_CODE', 'Order', String(order.id), reqUser.userId, undefined, { promoCode });
            }

            // Create Razorpay Order
            const rzpOrder = await RazorpayService.createOrder(amountINR, String(order.id));

            return res.json({
                success: true,
                orderId: order.id,
                rzpOrderId: rzpOrder.id,
                amount: amountINR,
                razorpayKeyId: process.env.RAZORPAY_KEY_ID
            });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    static async verifyPayment(req: Request, res: Response) {
        try {
            const reqUser = req.user;
            if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

            const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
            if (!orderId || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
                return res.status(400).json({ error: 'Missing required payment verification fields' });
            }

            // Verify signature first — before any DB operations
            const isValid = RazorpayService.verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
            if (!isValid) {
                await logAudit('PAYMENT_SIGNATURE_INVALID', 'Order', String(orderId), reqUser.userId, undefined, { razorpay_payment_id });
                return res.status(400).json({ error: 'Invalid payment signature' });
            }

            const order = await prisma.order.findUnique({ where: { id: Number(orderId) } });
            if (!order) return res.status(404).json({ error: 'Order not found' });

            // Ownership check — prevent user A from verifying user B's order
            if (order.userId !== reqUser.userId) {
                return res.status(403).json({ error: 'Forbidden' });
            }

            // Idempotency: if already paid, return success (webhook may have processed it first)
            if (order.status === 'PAID') {
                return res.json({ success: true, message: 'Payment already recorded' });
            }

            if (order.status === 'FAILED' || order.status === 'REFUNDED') {
                return res.status(400).json({ error: `Order is in terminal state: ${order.status}` });
            }

            // Atomic: mark paid THEN retrieve the locked promo code from audit log
            // Use a transaction to prevent double-processing
            await prisma.$transaction(async (tx) => {
                const current = await tx.order.findUnique({ where: { id: order.id } });
                if (current?.status === 'PAID') return; // Double-call guard inside transaction

                await tx.order.update({
                    where: { id: order.id },
                    data: { status: 'PAID', gatewayTxId: razorpay_payment_id }
                });
            });

            await logAudit('PAYMENT_VERIFIED', 'Order', String(order.id), reqUser.userId, undefined, { razorpay_payment_id, razorpay_order_id });

            // Retrieve promoCode that was locked at checkout creation time
            const checkoutAudit = await prisma.auditLog.findFirst({
                where: {
                    actionName: { contains: 'CHECKOUT_PROMO_CODE' },
                    payloadJson: { contains: `"entityId":"${order.id}"` }
                },
                orderBy: { createdAt: 'asc' }
            });

            let lockedPromoCode: string | null = null;
            if (checkoutAudit?.payloadJson) {
                try {
                    const payload = JSON.parse(checkoutAudit.payloadJson);
                    lockedPromoCode = payload.promoCode || null;
                } catch { /* ignore */ }
            }

            // Process referral using the locked promo code, not the client-supplied one
            if (lockedPromoCode) {
                await ReferralService.processNewOrder(order.id, reqUser.userId, lockedPromoCode);
            }

            return res.json({ success: true, message: 'Payment verified successfully' });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    static async getHistory(req: Request, res: Response) {
        try {
            const reqUser = req.user;
            if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

            const history = await ReferralService.getUserReferralHistory(reqUser.userId);
            return res.json({ referrals: history });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // Process a purchase — admin/internal only. Requires PAID status.
    static async processPurchase(req: Request, res: Response) {
        try {
            const { orderId, promoCode } = req.body;
            const reqUser = req.user;
            if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

            // Only admin can call this directly
            if (!['ADMIN', 'SUPERADMIN'].includes(reqUser.role)) {
                return res.status(403).json({ error: 'Forbidden' });
            }

            const order = await prisma.order.findUnique({ where: { id: Number(orderId) } });
            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }

            if (order.status !== 'PAID') {
                return res.status(400).json({ error: 'Order must be PAID to process referral commission' });
            }

            // Check if referral was already processed for this order
            const existingReferral = await prisma.referralLog.findFirst({
                where: { orderId: order.id }
            });
            if (existingReferral) {
                return res.status(409).json({ error: 'Referral commission already processed for this order' });
            }

            await ReferralService.processNewOrder(order.id, order.userId, promoCode || null);

            return res.json({ success: true, message: 'Referral commission processed if applicable' });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }
}

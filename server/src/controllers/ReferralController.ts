import { Request, Response } from 'express';
import { ReferralService } from '../services/ReferralService';
import { DistributorService } from '../services/DistributorService';
import { RazorpayService } from '../services/RazorpayService';
import { ConfigService } from '../services/ConfigService';
import { prisma } from '../models';
import { logAudit } from '../services/AuditService';
import { CreateUserQueue } from '../services/QueueService';

/**
 * Server-side promo code store: orderId → promoCode
 * In-memory (fast) + audit log fallback (survives restarts).
 */
const pendingPromoCodes = new Map<number, string>();

export class ReferralController {

    // ── GET /referral/dashboard ────────────────────────────────────────────────
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

    // ── GET /referral/my-orders ────────────────────────────────────────────────
    static async getMyOrders(req: Request, res: Response) {
        try {
            const reqUser = req.user;
            if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });
            const orders = await prisma.order.findMany({
                where: { userId: reqUser.userId },
                include: { plan: { select: { name: true } } },
                orderBy: { createdAt: 'desc' }
            });
            return res.json({ orders });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // ── GET /referral/resolve ──────────────────────────────────────────────────
    static async resolveReferral(req: Request, res: Response) {
        try {
            const { uid, did } = req.query;
            if (did) {
                const dist = await prisma.distributor.findUnique({ where: { id: Number(did) } });
                if (dist && dist.status === 'APPROVED') {
                    const cfg = await ConfigService.getDistributorConfig();
                    return res.json({ success: true, role: 'DISTRIBUTOR', percent: (cfg.defaultCommissionRate ?? 0.08) * 100 });
                }
            } else if (uid) {
                const user = await prisma.user.findUnique({ where: { id: Number(uid) } });
                if (user && !(user as any).isDisabled) {
                    const cfg = await ConfigService.getGlobalPlanConfig();
                    return res.json({ success: true, role: 'USER', percent: cfg.customerDiscountRate * 100 });
                }
            }
            return res.status(404).json({ error: 'Referral link invalid or inactive' });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    static async validatePromoCode(req: Request, res: Response) {
        try {
            const { promoCode } = req.body;
            if (!promoCode) return res.status(400).json({ error: 'Promo code required' });

            const cleanCode = promoCode.trim();

            const userRefConfig = await ConfigService.getUserReferralConfig();
            const discountPct = 0; // We no longer provide upfront discount to the end user

            if (cleanCode.toUpperCase() === 'DEMO123') {
                return res.json({ success: true, discountPct: 0 });
            }

            // Check single-use active referral link
            const { ReferralLinkService } = require('../services/ReferralLinkService');
            const validLink = await ReferralLinkService.validateCode(cleanCode);

            if (!validLink) {
                // Check if it's an expired link
                const { prisma } = require('../models');
                const expiredLink = await prisma.referralLink.findFirst({
                    where: { code: cleanCode, status: { in: ['USED', 'EXPIRED'] } }
                });
                if (expiredLink) {
                    return res.status(400).json({ error: 'This referral link has expired.' });
                }
                console.log(`[ValidatePromoCode] Code "${cleanCode}" NOT FOUND as active link`);
                return res.status(400).json({ error: 'Code not valid' });
            }

            console.log(`[ValidatePromoCode] Code "${cleanCode}" IS VALID. Discount: ${discountPct}%`);
            return res.json({ success: true, discountPct });
        } catch (e: any) {
            console.error(`[ValidatePromoCode] ERROR for "${req.body?.promoCode}":`, e);
            return res.status(500).json({ error: e.message });
        }
    }

    // ── POST /referral/create-checkout ────────────────────────────────────────
    static async createCheckoutSession(req: Request, res: Response) {
        try {
            const reqUser = req.user;
            if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

            const { planId, promoCode, referralContext } = req.body;
            if (!planId) return res.status(400).json({ error: 'planId is required' });

            // Check account not disabled
            const buyer = await prisma.user.findUnique({ where: { id: reqUser.userId } });
            if (!buyer) return res.status(404).json({ error: 'User not found' });
            if ((buyer as any).isDisabled) return res.status(403).json({ error: 'Your account has been suspended. Contact support.' });

            const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
            if (!plan) return res.status(404).json({ error: 'Plan not found' });
            if (!plan.isActive) return res.status(400).json({ error: 'This plan is currently unavailable' });

            let globalConfig = await ConfigService.getGlobalPlanConfig();
            let amountINR = plan.hasOverride ? plan.price : globalConfig.priceINR;
            let discountedAmount = amountINR;
            let discountPct = 0;
            let finalReferralKey: string | null = null;
            let finalReferrerId: number | null = null;

            // ── 1. Handle Explicit Referral Link (did/uid) - NO DISCOUNT ────────
            if (referralContext && referralContext.id && referralContext.role) {
                const { ReferralLinkService } = require('../services/ReferralLinkService');
                const link = await ReferralLinkService.getActiveLink(Number(referralContext.id), referralContext.role);

                if (referralContext.role === 'DISTRIBUTOR') {
                    const dist = await prisma.distributor.findUnique({ where: { id: Number(referralContext.id) } });
                    if (dist) {
                        finalReferralKey = `DIST_${dist.id}:${link.code}`;
                        finalReferrerId = dist.id;
                        console.log(`[Checkout] Referral context applied: Distributor ${dist.id}. No discount.`);
                    }
                } else if (referralContext.role === 'USER') {
                    const usr = await prisma.user.findUnique({ where: { id: Number(referralContext.id) } });
                    if (usr) {
                        if (usr.id === reqUser.userId) {
                            return res.status(400).json({ error: 'You cannot use your own referral link.' });
                        }
                        finalReferralKey = link.code;
                        finalReferrerId = usr.id;
                        console.log(`[Checkout] Referral context applied: User ${usr.id}. No discount.`);
                    }
                }
            }
            // ── 2. Handle Promo Code Mapping - APPLIES DISCOUNT ──────────────
            else if (promoCode) {
                const cleanCode = promoCode.trim();

                // Buyer discount removed per user request
                const userRefConfig = await ConfigService.getUserReferralConfig();
                const buyerDiscountRate = 0;

                if (cleanCode.toUpperCase() === 'DEMO123') {
                    discountPct = buyerDiscountRate;
                    discountedAmount = amountINR;
                    console.log(`[Checkout] No discount applied for generic code DEMO123: ₹${amountINR}`);
                } else {
                    const { ReferralLinkService } = require('../services/ReferralLinkService');
                    const validLink = await ReferralLinkService.validateCode(cleanCode);

                    if (!validLink) {
                        const expiredLink = await prisma.referralLink.findFirst({
                            where: { code: cleanCode, status: { in: ['USED', 'EXPIRED'] } }
                        });
                        if (expiredLink) {
                            return res.status(400).json({ error: 'This referral link has expired.' });
                        }
                        return res.status(400).json({ error: `Referral code "${cleanCode}" is not valid.` });
                    }

                    if (validLink.role === 'DISTRIBUTOR') {
                        finalReferralKey = `DIST_${validLink.referrerId}:${validLink.code}`;
                    } else {
                        if (validLink.referrerId === reqUser.userId) {
                            return res.status(400).json({ error: 'You cannot use your own referral code.' });
                        }
                        finalReferralKey = validLink.code;
                    }

                    // Apply buyer discount logic (we now give 0% discount as requested)
                    discountPct = 0;
                    discountedAmount = amountINR;
                    console.log(`[Checkout] No buyer discount given for promo: ${cleanCode}`);
                }
            }

            // ── Create pending order ──────────────────────────────────────────
            const order = await prisma.order.create({
                data: {
                    userId: reqUser.userId,
                    planId: Number(planId),
                    amount: discountedAmount,
                    currency: 'INR',
                    status: 'PENDING',
                }
            });

            // ── Lock referral key in memory + audit log ───────────────────────
            if (finalReferralKey) {
                pendingPromoCodes.set(order.id, finalReferralKey);
                await logAudit('CHECKOUT_PROMO_CODE', 'Order', String(order.id), reqUser.userId, undefined, {
                    promoCode: finalReferralKey,
                    entityId: order.id,
                    isContextReferral: !!referralContext
                });
                console.log(`[Checkout] Order ${order.id} → referral assigned: "${finalReferralKey}"`);
            }

            // ── Create Razorpay / demo order ──────────────────────────────────
            const rzpOrder = await RazorpayService.createOrder(discountedAmount, String(order.id));

            return res.json({
                success: true,
                orderId: order.id,
                rzpOrderId: rzpOrder.id,
                amount: discountedAmount,
                originalAmount: amountINR,
                discountPct: Math.round(discountPct * 100),
                razorpayKeyId: process.env.RAZORPAY_KEY_ID,
                isDemoMode: RazorpayService.isDemoMode,
            });
        } catch (e: any) {
            console.error('[Checkout] Error:', e.message);
            return res.status(500).json({ error: e.message });
        }
    }

    // ── POST /referral/verify-payment ─────────────────────────────────────────
    static async verifyPayment(req: Request, res: Response) {
        try {
            const reqUser = req.user;
            if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

            const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
            if (!orderId || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
                return res.status(400).json({ error: 'Missing required payment verification fields' });
            }

            const orderIdNum = Number(orderId);

            // ── Verify signature ──────────────────────────────────────────────
            const isValid = RazorpayService.verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
            if (!isValid) {
                await logAudit('PAYMENT_SIGNATURE_INVALID', 'Order', String(orderId), reqUser.userId, undefined, { razorpay_payment_id });
                return res.status(400).json({ error: 'Invalid payment signature' });
            }

            const order = await prisma.order.findUnique({
                where: { id: orderIdNum },
                include: { plan: true }
            });
            if (!order) return res.status(404).json({ error: 'Order not found' });
            if (order.userId !== reqUser.userId) return res.status(403).json({ error: 'Forbidden' });

            if (order.status === 'PAID') return res.json({ success: true, message: 'Payment already recorded' });
            if (order.status === 'FAILED' || order.status === 'REFUNDED') {
                return res.status(400).json({ error: `Order is in terminal state: ${order.status}` });
            }

            // ── Prevent double payment via gatewayTxId ────────────────────────
            const dupPayment = await prisma.order.findFirst({ where: { gatewayTxId: razorpay_payment_id } });
            if (dupPayment && dupPayment.id !== orderIdNum) {
                return res.status(409).json({ error: 'This payment was already applied to another order.' });
            }

            // ── Atomically mark PAID ──────────────────────────────────────────
            await prisma.$transaction(async (tx: any) => {
                const current = await tx.order.findUnique({ where: { id: orderIdNum } });
                if (current?.status === 'PAID') return;
                await tx.order.update({
                    where: { id: orderIdNum },
                    data: { status: 'PAID', gatewayTxId: razorpay_payment_id }
                });
            });

            await logAudit('PAYMENT_VERIFIED', 'Order', String(orderId), reqUser.userId, undefined, {
                razorpay_payment_id, razorpay_order_id, planId: order.planId, amount: order.amount
            });
            console.log(`[Payment] Order ${orderIdNum} marked PAID by user ${reqUser.userId} for plan ${order.planId}`);

            // ── Provision workspace inline (no Redis/queue needed) ────────────
            if (order.planId) {
                try {
                    const userRecord = await prisma.user.findUnique({ where: { id: reqUser.userId } });
                    const workspaceEmail = userRecord?.email || `user${reqUser.userId}@webmydrive.com`;

                    const emailPrefix = workspaceEmail.split('@')[0];
                    const basePass = emailPrefix.replace(/[^a-z0-9]/gi, '');
                    const tempPassword = (basePass.charAt(0).toUpperCase() + basePass.slice(1).toLowerCase()) + new Date().getFullYear();

                    const existingWs = await prisma.workspace.findFirst({
                        where: { userId: reqUser.userId },
                        orderBy: { createdAt: 'desc' }
                    });

                    if (!existingWs) {
                        const renewalDate = new Date();
                        renewalDate.setFullYear(renewalDate.getFullYear() + 1);
                        await prisma.workspace.create({
                            data: {
                                userId: reqUser.userId,
                                planId: order.planId,
                                status: 'ACTIVE',
                                renewalDate,
                                googleCustomerId: workspaceEmail,
                                metadata: JSON.stringify({
                                    email: workspaceEmail,
                                    tempPassword,
                                    provisioned: 'demo',
                                    orderId: orderIdNum,
                                    provisionedAt: new Date().toISOString(),
                                }),
                            }
                        });
                        console.log(`[Payment] Temp workspace provisioned for user ${reqUser.userId} → ${workspaceEmail}`);
                    } else if (existingWs.status !== 'ACTIVE') {
                        await prisma.workspace.update({
                            where: { id: existingWs.id },
                            data: {
                                status: 'ACTIVE',
                                planId: order.planId,
                                googleCustomerId: workspaceEmail,
                                metadata: JSON.stringify({
                                    email: workspaceEmail,
                                    tempPassword,
                                    provisioned: 'demo',
                                    orderId: orderIdNum,
                                    provisionedAt: new Date().toISOString(),
                                }),
                            }
                        });
                        console.log(`[Payment] Existing workspace activated for user ${reqUser.userId}`);
                    }

                    // Also enqueue for real Google Workspace provision (no-op if Redis offline)
                    await CreateUserQueue.add('ProvisionGoogleUser', {
                        userId: reqUser.userId,
                        orderId: orderIdNum,
                        timestamp: new Date().toISOString()
                    });
                } catch (wsError: any) {
                    console.error('[Payment] Workspace provisioning error (non-fatal):', wsError.message);
                }
            }

            // ── Process commissions ───────────────────────────────────────────
            await ReferralController.processOrderCommission(orderIdNum, reqUser.userId);

            return res.json({ success: true, message: 'Payment verified and workspace activated' });
        } catch (e: any) {
            console.error('[verifyPayment] Error:', e.message);
            return res.status(500).json({ error: e.message });
        }
    }

    static async processOrderCommission(orderIdNum: number, userId: number, orderAmount?: number) {
        // Retrieve locked promo code
        let lockedPromoCode: string | null = pendingPromoCodes.get(orderIdNum) || null;

        if (!lockedPromoCode) {
            console.log(`[Commission] Promo not in memory for order ${orderIdNum} — checking audit log...`);
            try {
                const auditLogs = await prisma.auditLog.findMany({
                    where: { actorId: userId, actionName: 'CHECKOUT_PROMO_CODE' },
                    orderBy: { createdAt: 'desc' },
                    take: 50
                });
                for (const log of auditLogs) {
                    if (!log.payloadJson) continue;
                    try {
                        const p = JSON.parse(log.payloadJson);
                        if (String(p.entityId) === String(orderIdNum) && p.promoCode) {
                            lockedPromoCode = p.promoCode;
                            break;
                        }
                    } catch { /* skip */ }
                }
            } catch (auditErr: any) {
                console.warn('[Commission] Audit log read failed:', auditErr.message);
            }
        }

        // Process commissions
        if (lockedPromoCode) {
            console.log(`[Commission] Processing commission — order ${orderIdNum}, promo "${lockedPromoCode}"`);

            if (lockedPromoCode.startsWith('DIST_')) {
                // Distributor referral
                const parts = lockedPromoCode.split(':');
                const distributorIdStr = parts[0].replace('DIST_', '');
                const distributorId = parseInt(distributorIdStr, 10);
                const codeUsed = parts[1];
                if (!isNaN(distributorId)) {
                    let amt = orderAmount;
                    if (!amt) {
                        const order = await prisma.order.findUnique({ where: { id: orderIdNum } });
                        amt = order?.amount || 0;
                    }
                    await DistributorService.processSale(distributorId, userId, orderIdNum, amt);
                    console.log(`[Commission] Distributor commission processed for dist ${distributorId}`);
                }
            } else {
                // User referral
                await ReferralService.processNewOrder(orderIdNum, userId, lockedPromoCode);
            }
            pendingPromoCodes.delete(orderIdNum);
        } else {
            // Check for renewal
            const priorRef = await prisma.referralLog.findFirst({ where: { refereeUserId: userId } });
            if (priorRef) {
                console.log(`[Commission] Renewal detected for user ${userId} — processing renewal commission`);
                await ReferralService.processNewOrder(orderIdNum, userId, null);
            }
        }
    }

    // ── GET /referral/history ─────────────────────────────────────────────────
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

    // ── POST /referral/process-purchase (admin only) ──────────────────────────
    static async processPurchase(req: Request, res: Response) {
        try {
            const { orderId, promoCode } = req.body;
            const reqUser = req.user;
            if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });
            if (!['ADMIN', 'SUPERADMIN'].includes(reqUser.role)) return res.status(403).json({ error: 'Forbidden' });

            const order = await prisma.order.findUnique({ where: { id: Number(orderId) } });
            if (!order) return res.status(404).json({ error: 'Order not found' });
            if (order.status !== 'PAID') return res.status(400).json({ error: 'Order must be PAID to process referral commission' });

            const existing = await prisma.referralLog.findFirst({ where: { orderId: order.id } });
            if (existing) return res.status(409).json({ error: 'Referral commission already processed for this order' });

            await ReferralService.processNewOrder(order.id, order.userId, promoCode || null);
            return res.json({ success: true, message: 'Referral commission processed' });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }
}

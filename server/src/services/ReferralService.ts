import { PrismaClient } from '@prisma/client';
import { ConfigService } from './ConfigService';
import { logAudit } from './AuditService';

const prisma = new PrismaClient();

export class ReferralService {
    /**
     * Called after a payment is marked PAID.
     * Credits the referrer's wallet with commission.
     *
     * Logic:
     *  - If purchaser has NEVER been referred before (no referral log as referee):
     *      → Treat as INITIAL purchase. Credit referrer from promoCode.
     *  - If purchaser WAS referred before (has a referral log as referee):
     *      → Treat as RENEWAL. Credit original referrer with decaying rate.
     */
    static async processNewOrder(orderId: number, purchasingUserId: number, promoCode: string | null) {
        console.log(`[ReferralService] processNewOrder — orderId=${orderId}, userId=${purchasingUserId}, code=${promoCode}`);

        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (!order || order.status !== 'PAID') {
            console.warn(`[ReferralService] Order ${orderId} not found or not PAID — aborting`);
            return;
        }

        if (order.userId !== purchasingUserId) {
            console.error(`[ReferralService] Order ${orderId} userId mismatch — aborting`);
            return;
        }

        // Idempotency: check if referral already processed for this exact order
        const existingLog = await prisma.referralLog.findFirst({ where: { orderId } });
        if (existingLog) {
            console.warn(`[ReferralService] Referral already processed for order ${orderId}`);
            return;
        }

        const userReferralConfig = await ConfigService.getUserReferralConfig();
        if (!userReferralConfig.allowNewReferrals) {
            console.warn('[ReferralService] Referral program is disabled');
            return;
        }

        // ── Determine if this user has EVER been credited as a referee ─────────
        // (THIS is the correct check — not "prior PAID orders")
        const priorReferralAsReferee = await prisma.referralLog.findFirst({
            where: { refereeUserId: purchasingUserId },
            orderBy: { createdAt: 'asc' }
        });

        if (!priorReferralAsReferee) {
            // ── INITIAL PURCHASE — credit the referrer from promoCode ──────────
            if (!promoCode) {
                console.log(`[ReferralService] No promo code on initial purchase — no commission`);
                return;
            }

            const { ReferralLinkService } = require('./ReferralLinkService');
            // First check if promoCode is a single-use valid link
            let validLink = await ReferralLinkService.validateCode(promoCode);
            let referrer;
            if (validLink && validLink.role === 'USER') {
                referrer = await prisma.user.findUnique({ where: { id: validLink.referrerId } });
            } else {
                // Check if it's an old legacy string code mapped directly
                referrer = await prisma.user.findUnique({ where: { referralCode: promoCode } });
            }
            if (!referrer) {
                console.warn(`[ReferralService] Promo code "${promoCode}" not found — no commission`);
                return;
            }

            if (referrer.id === purchasingUserId) {
                console.warn(`[ReferralService] Self-referral blocked for user ${purchasingUserId}`);
                await logAudit('SELF_REFERRAL_BLOCKED', 'Referral', undefined, purchasingUserId, undefined, { promoCode });
                return;
            }

            // Guard: referral loop
            const reverseReferral = await prisma.referralLog.findFirst({
                where: { referrerUserId: purchasingUserId, refereeUserId: referrer.id }
            });
            if (reverseReferral) {
                console.warn(`[ReferralService] Referral loop blocked between ${referrer.id} and ${purchasingUserId}`);
                return;
            }

            const globalConfig = await ConfigService.getGlobalPlanConfig();
            const rate = globalConfig.referralCreditRate;

            // Commission is ALWAYS on full plan price, never on the discounted order amount
            const plan = order.planId ? await prisma.plan.findUnique({ where: { id: order.planId } }) : null;
            let baseAmount = order.amount;
            if (plan) {
                baseAmount = plan.hasOverride ? plan.price : globalConfig.priceINR;
            }
            const commission = parseFloat((baseAmount * rate).toFixed(2));

            console.log(`[ReferralService] Crediting referrer ${referrer.id} with ₹${commission} (${rate * 100}% of plan ₹${baseAmount})`);

            await prisma.$transaction(async (tx: any) => {
                await tx.referralLog.create({
                    data: {
                        referrerUserId: referrer.id,
                        refereeUserId: purchasingUserId,
                        orderId: order.id,
                        amount: commission,
                        referralYear: 1,
                        status: 'VESTED'
                    }
                });
                await tx.user.update({
                    where: { id: referrer.id },
                    data: { walletBalance: { increment: commission } }
                });
            });

            await logAudit('REFERRAL_COMMISSION_CREDITED', 'Referral', undefined, referrer.id, undefined, {
                orderId, purchasingUserId, commission, promoCode
            });

            console.log(`[ReferralService] ✅ Commission ₹${commission} credited to user ${referrer.id} (wallet+=${commission})`);

        } else {
            // ── RENEWAL — credit original referrer with decaying rate ──────────
            const decaySchedule = userReferralConfig.decaySchedule ?? [0.05, 0.04, 0.03, 0.02, 0.01, 0];

            if (
                userReferralConfig.disableReferralsFromDate &&
                new Date() >= new Date(userReferralConfig.disableReferralsFromDate) &&
                userReferralConfig.existingReferralsOnDisable === 'STOP_IMMEDIATELY'
            ) {
                console.log('[ReferralService] Program disabled for existing referrals');
                return;
            }

            const originalReferrerId = priorReferralAsReferee.referrerUserId;
            const prevLogsCount = await prisma.referralLog.count({
                where: { referrerUserId: originalReferrerId, refereeUserId: purchasingUserId }
            });

            const currentYear = prevLogsCount + 1;
            if (currentYear > decaySchedule.length) {
                console.log(`[ReferralService] Decay schedule exhausted at year ${currentYear} — no commission`);
                return;
            }

            const rate = decaySchedule[currentYear - 1];
            if (rate <= 0) {
                console.log(`[ReferralService] Rate is 0 at year ${currentYear} -- no commission`);
                return;
            }

            // Commission is ALWAYS on full plan price, never on the discounted order amount
            const renewalPlan = order.planId ? await prisma.plan.findUnique({ where: { id: order.planId } }) : null;
            const renewalBase = renewalPlan ? renewalPlan.price : order.amount;
            const commission = parseFloat((renewalBase * rate).toFixed(2));

            console.log(`[ReferralService] Renewal year ${currentYear}: crediting original referrer ${originalReferrerId} with ₹${commission}`);

            await prisma.$transaction(async (tx: any) => {
                await tx.referralLog.create({
                    data: {
                        referrerUserId: originalReferrerId,
                        refereeUserId: purchasingUserId,
                        orderId: order.id,
                        amount: commission,
                        referralYear: currentYear,
                        status: 'VESTED'
                    }
                });
                await tx.user.update({
                    where: { id: originalReferrerId },
                    data: { walletBalance: { increment: commission } }
                });
            });

            await logAudit('REFERRAL_RENEWAL_COMMISSION_CREDITED', 'Referral', undefined, originalReferrerId, undefined, {
                orderId, purchasingUserId, commission, year: currentYear
            });

            console.log(`[ReferralService] ✅ Renewal commission ₹${commission} credited to referrer ${originalReferrerId}`);
        }
    }

    static async getUserReferralDashboard(userId: number) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { referralsMade: true }
        });
        if (!user) return null;

        const uniqueReferredUsers = new Set(user.referralsMade.map((r: any) => r.refereeUserId));
        const totalReferrals = uniqueReferredUsers.size;

        const activeRefereesCount = await prisma.workspace.count({
            where: {
                userId: { in: Array.from(uniqueReferredUsers) as number[] },
                status: 'ACTIVE'
            }
        });

        const config = await ConfigService.getUserReferralConfig();
        const { ReferralLinkService } = require('./ReferralLinkService');
        const activeLink = await ReferralLinkService.getActiveLink(userId, 'USER');

        return {
            promoCode: activeLink.code,
            totalReferrals,
            activeReferrals: activeRefereesCount,
            creditBalance: user.walletBalance,
            isEligibleForDistributorNudge: totalReferrals >= config.nudgeThreshold
        };
    }

    static async getUserReferralHistory(userId: number) {
        const logs = await prisma.referralLog.findMany({
            where: { referrerUserId: userId },
            include: { refereeUser: true, order: true },
            orderBy: { createdAt: 'desc' }
        });

        return logs.map((log: any) => ({
            id: log.id,
            user: log.refereeUser?.name || log.refereeUser?.email || 'Unknown',
            plan: `₹${log.order?.amount ?? 0}`,
            date: new Date(log.createdAt).toLocaleDateString('en-IN'),
            commission: `₹${log.amount.toLocaleString('en-IN')}`,
            status: log.status
        }));
    }
}

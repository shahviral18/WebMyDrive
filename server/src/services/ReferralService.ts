import { PrismaClient } from '@prisma/client';
import { ConfigService } from './ConfigService';
import { logAudit } from './AuditService';

const prisma = new PrismaClient();

export class ReferralService {
    /**
     * Applies referral commission when an order is PAID.
     * Atomic wallet credit via prisma.$transaction.
     * Guards: self-referral, duplicate referral for same order, referral loops.
     */
    static async processNewOrder(orderId: number, purchasingUserId: number, promoCode: string | null) {
        if (!promoCode) return;

        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (!order || order.status !== 'PAID') return;

        // Guard: ensure order belongs to purchasingUserId
        if (order.userId !== purchasingUserId) {
            console.error(`[ReferralService] Order ${orderId} userId mismatch`);
            return;
        }

        // Guard: duplicate referral — check if this order already has a referral log
        const existingLog = await prisma.referralLog.findFirst({ where: { orderId } });
        if (existingLog) {
            console.warn(`[ReferralService] Referral already processed for order ${orderId}`);
            return;
        }

        const userReferralConfig = await ConfigService.getUserReferralConfig();

        if (!userReferralConfig.allowNewReferrals) return;
        if (
            userReferralConfig.disableReferralsFromDate &&
            new Date() >= new Date(userReferralConfig.disableReferralsFromDate)
        ) {
            if (userReferralConfig.existingReferralsOnDisable === 'STOP_IMMEDIATELY') return;
        }

        // Is this a renewal or initial purchase?
        const priorOrders = await prisma.order.count({
            where: { userId: purchasingUserId, id: { not: orderId }, status: 'PAID' }
        });
        const isRenewal = priorOrders > 0;

        if (!isRenewal) {
            // Initial purchase — validate promo code
            const referrer = await prisma.user.findUnique({ where: { referralCode: promoCode } });
            if (!referrer) return;

            // Guard: self-referral
            if (referrer.id === purchasingUserId) {
                console.warn(`[ReferralService] Self-referral attempt blocked for user ${purchasingUserId}`);
                await logAudit('SELF_REFERRAL_BLOCKED', 'Referral', undefined, purchasingUserId, undefined, { promoCode });
                return;
            }

            // Guard: referral loop — check if referrer was already referred by purchasingUserId
            const reverseReferral = await prisma.referralLog.findFirst({
                where: { referrerUserId: purchasingUserId, refereeUserId: referrer.id }
            });
            if (reverseReferral) {
                console.warn(`[ReferralService] Referral loop blocked between ${referrer.id} and ${purchasingUserId}`);
                await logAudit('REFERRAL_LOOP_BLOCKED', 'Referral', undefined, purchasingUserId, undefined, { referrerId: referrer.id });
                return;
            }

            const rate = userReferralConfig.referrerCreditRate;
            const commission = parseFloat((order.amount * rate).toFixed(2));

            // Atomic: create log + credit wallet in one transaction
            await prisma.$transaction(async (tx) => {
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

        } else {
            // Renewal — find original referrer
            const initialReferral = await prisma.referralLog.findFirst({
                where: { refereeUserId: purchasingUserId },
                orderBy: { createdAt: 'asc' }
            });

            if (!initialReferral) return;

            // Guard: stop if program disabled for existing referrals
            if (
                userReferralConfig.disableReferralsFromDate &&
                new Date() >= new Date(userReferralConfig.disableReferralsFromDate) &&
                userReferralConfig.existingReferralsOnDisable === 'STOP_IMMEDIATELY'
            ) {
                return;
            }

            const prevLogsCount = await prisma.referralLog.count({
                where: { referrerUserId: initialReferral.referrerUserId, refereeUserId: purchasingUserId }
            });

            const currentYear = prevLogsCount + 1;

            const decaySchedule = userReferralConfig.decaySchedule;
            if (currentYear > decaySchedule.length) return;

            const rate = decaySchedule[currentYear - 1];
            if (rate <= 0) return;

            const commission = parseFloat((order.amount * rate).toFixed(2));

            // Atomic: create log + credit wallet
            await prisma.$transaction(async (tx) => {
                await tx.referralLog.create({
                    data: {
                        referrerUserId: initialReferral.referrerUserId,
                        refereeUserId: purchasingUserId,
                        orderId: order.id,
                        amount: commission,
                        referralYear: currentYear,
                        status: 'VESTED'
                    }
                });

                await tx.user.update({
                    where: { id: initialReferral.referrerUserId },
                    data: { walletBalance: { increment: commission } }
                });
            });

            await logAudit('REFERRAL_RENEWAL_COMMISSION_CREDITED', 'Referral', undefined, initialReferral.referrerUserId, undefined, {
                orderId, purchasingUserId, commission, year: currentYear
            });
        }
    }

    static async getUserReferralDashboard(userId: number) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { referralsMade: true }
        });
        if (!user) return null;

        const uniqueReferredUsers = new Set(user.referralsMade.map(r => r.refereeUserId));
        const totalReferrals = uniqueReferredUsers.size;

        const activeRefereesCount = await prisma.workspace.count({
            where: {
                userId: { in: Array.from(uniqueReferredUsers) as number[] },
                status: 'ACTIVE'
            }
        });

        const config = await ConfigService.getUserReferralConfig();

        return {
            promoCode: user.referralCode,
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
            plan: 'Storage Plan',
            date: log.createdAt.toLocaleDateString(),
            commission: `Rs ${log.amount.toLocaleString()}`,
            status: log.status
        }));
    }
}

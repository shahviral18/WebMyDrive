import { prisma } from "../models";
import { logAudit } from "./AuditService";

export class ReferralEngine {

    /**
     * Nightly Cron job handler to scan for pending referral credits
     * that were created 30+ days ago and vest them into the user's wallet.
     */
    static async processVestingCron() {
        // 30 days ago calculated
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const pendingReferrals = await prisma.referralLog.findMany({
            where: {
                status: "PENDING",
                createdAt: {
                    lte: thirtyDaysAgo
                }
            },
            include: { referrerUser: true }
        });

        for (const referral of pendingReferrals) {
            await prisma.$transaction(async (tx) => {

                // 1. Double check the referee's order was never refunded
                const sourceOrder = await tx.order.findUnique({
                    where: { id: referral.orderId! }
                });

                if (sourceOrder?.status === "REFUNDED") {
                    // Cancel the referral
                    await tx.referralLog.update({
                        where: { id: referral.id },
                        data: { status: "CANCELLED" }
                    });
                    await logAudit("REFERRAL_CANCELLED", "Referral", String(referral.id), referral.referrerUserId, undefined, { reason: "Source order refunded" });
                } else {
                    // 2. Vest it
                    await tx.referralLog.update({
                        where: { id: referral.id },
                        data: { status: "VESTED" }
                    });

                    // 3. Move credit to User Wallet
                    await tx.user.update({
                        where: { id: referral.referrerUserId },
                        data: {
                            walletBalance: {
                                increment: referral.amount
                            }
                        }
                    });

                    await logAudit("REFERRAL_VESTED", "Referral", String(referral.id), referral.referrerUserId, undefined, { amount: referral.amount });
                }
            });
        }
    }
}

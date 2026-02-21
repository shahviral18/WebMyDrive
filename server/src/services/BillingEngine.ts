import { prisma } from "../models";

export class BillingEngine {

    /**
     * Calculates the pro-rata difference between an old plan and a new plan.
     */
    static calculateProRataUpgrade(
        oldPlanPrice: number,
        newPlanPrice: number,
        totalDaysInCycle: number,
        daysRemaining: number
    ): { cost: number, credit: number, balanceDue: number } {

        const credit = (oldPlanPrice / totalDaysInCycle) * daysRemaining;
        const cost = (newPlanPrice / totalDaysInCycle) * daysRemaining;
        const balanceDue = Math.max(0, cost - credit);

        return {
            cost: parseFloat(cost.toFixed(2)),
            credit: parseFloat(credit.toFixed(2)),
            balanceDue: parseFloat(balanceDue.toFixed(2))
        };
    }

    /**
     * Attempts to renew a subscription using the User's Wallet Balance.
     * Decrements the wallet balance if sufficient and logs the audit.
     */
    static async processRenewalWithWallet(userId: number, invoiceAmount: number): Promise<boolean> {
        return await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({ where: { id: userId } });

            if (!user) {
                throw new Error("User not found");
            }
            if (user.walletBalance < invoiceAmount) {
                return false; // Insufficient funds
            }

            const newBalance = user.walletBalance - invoiceAmount;

            // Deduct balance and create order
            await tx.user.update({
                where: { id: user.id },
                data: { walletBalance: newBalance }
            });

            await tx.order.create({
                data: {
                    userId: user.id,
                    amount: invoiceAmount,
                    status: "PAID",
                }
            });

            await tx.auditLog.create({
                data: {
                    actionName: "[Billing] Auto-Renewal via Wallet",
                    actorId: user.id,
                    payloadJson: JSON.stringify({ amount: invoiceAmount, newBalance })
                }
            });

            return true;
        });
    }
}

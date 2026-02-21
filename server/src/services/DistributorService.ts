import { PrismaClient } from '@prisma/client';
import { ConfigService, DEFAULT_DISTRIBUTOR_CONFIG, DEFAULT_WALLET_CONFIG } from './ConfigService';
import { logAudit } from './AuditService';

const prisma = new PrismaClient();

export class DistributorService {

    static getResetDate(joinDate: Date): Date {
        const day = joinDate.getDate();
        let resetMonth = joinDate.getMonth();
        let resetYear = joinDate.getFullYear() + 1;

        if (day >= 16) {
            resetMonth++;
            if (resetMonth > 11) {
                resetMonth = 0;
                resetYear++;
            }
        }
        return new Date(resetYear, resetMonth, 1);
    }

    static async onboard(userId: number, email: string) {
        const config = await ConfigService.getDistributorConfig();
        if (!config.allowNewSignups) throw new Error("Distributor signups are disabled.");

        // Guard: prevent duplicate distributor for same userId
        const existing = await prisma.distributor.findFirst({ where: { userId } });
        if (existing) throw new Error("User is already a distributor.");

        const now = new Date();
        const resetDate = this.getResetDate(now);

        const dist = await prisma.distributor.create({
            data: {
                userId,
                email,
                tier: config.tiers[0].name,
                joinDate: now,
                resetDate,
                status: "ACTIVE"
            }
        });

        await logAudit('DISTRIBUTOR_ONBOARDED', 'Distributor', String(dist.id), userId, undefined, { email });

        return dist;
    }

    /**
     * Drops distributor tier by 1 annually. Runs as a scheduled cron.
     */
    static async processSoftReset() {
        const now = new Date();
        const distributors = await prisma.distributor.findMany({
            where: { resetDate: { lte: now }, status: "ACTIVE" }
        });

        const config = await ConfigService.getDistributorConfig();
        const tiersDesc = [...config.tiers].sort((a, b) => b.threshold - a.threshold);

        for (const dist of distributors) {
            const currentTierIdx = tiersDesc.findIndex(t => t.name === dist.tier);
            let newTierIdx = currentTierIdx + config.tiersDroppedPerYear;
            if (newTierIdx >= tiersDesc.length) newTierIdx = tiersDesc.length - 1;

            const newTier = tiersDesc[newTierIdx]?.name ?? tiersDesc[tiersDesc.length - 1].name;

            const prevReset = dist.resetDate!;
            const nextResetDate = new Date(prevReset);
            nextResetDate.setFullYear(nextResetDate.getFullYear() + 1);

            await prisma.distributor.update({
                where: { id: dist.id },
                data: {
                    tier: newTier,
                    revenueThisYear: 0,
                    resetDate: nextResetDate,
                    status: "PENDING_FEE"
                }
            });

            await logAudit('DISTRIBUTOR_SOFT_RESET', 'Distributor', String(dist.id), undefined, undefined, {
                previousTier: dist.tier, newTier, resetDate: nextResetDate
            });
        }
    }

    /**
     * Process a sale made via a distributor referral.
     * ATOMIC: wallet increment + sale record + tier upgrade in one transaction.
     * Guard: duplicate sale prevention for same orderId.
     */
    static async processSale(
        distributorId: number,
        purchasingUserId: number,
        orderId: number,
        amount: number
    ) {
        const dist = await prisma.distributor.findUnique({ where: { id: distributorId } });
        if (!dist || dist.status !== "ACTIVE") {
            console.warn(`[DistributorService] Skipping sale — distributor ${distributorId} not active`);
            return;
        }

        // Guard: duplicate sale for same order
        const existingSale = await prisma.distributorSale.findFirst({ where: { orderId } });
        if (existingSale) {
            console.warn(`[DistributorService] Sale for order ${orderId} already recorded`);
            return;
        }

        const config = await ConfigService.getDistributorConfig();

        if (config.disableProgramFromDate && new Date() >= new Date(config.disableProgramFromDate)) {
            if (config.existingOnDisable === "TERMINATE" || config.existingOnDisable === "FREEZE") return;
        }

        // Determine sale year for this user under this distributor
        const existingSales = await prisma.distributorSale.findMany({
            where: { purchasingUserId, distributorId }
        });

        const currentYearOfSale = existingSales.length + 1;

        if (currentYearOfSale > config.decayMultipliers.length) return;
        const multiplier = config.decayMultipliers[currentYearOfSale - 1];
        if (multiplier <= 0) return;

        const currentTierConfig = config.tiers.find((t: any) => t.name === dist.tier);
        if (!currentTierConfig) return;

        const baseRate = currentTierConfig.rate;
        const finalRate = parseFloat((baseRate * multiplier).toFixed(6));
        const commission = parseFloat((amount * finalRate).toFixed(2));

        // Calculate new revenue and tier prospectively
        const newRevenue = dist.revenueThisYear + amount;
        const tiersDesc = [...config.tiers].sort((a: any, b: any) => b.threshold - a.threshold);
        let newTier = dist.tier;
        for (const t of tiersDesc) {
            if (newRevenue >= t.threshold) {
                newTier = t.name;
                break;
            }
        }

        const tierUpgraded = newTier !== dist.tier;
        const feeRefundNeeded = tierUpgraded && newTier === config.feeRefundTier;

        // Atomic transaction: save sale + credit wallet + update tier + optional fee refund
        await prisma.$transaction(async (tx) => {
            await tx.distributorSale.create({
                data: {
                    distributorId,
                    purchasingUserId,
                    orderId,
                    amount,
                    commissionRate: finalRate,
                    commissionEarned: commission,
                    saleYear: currentYearOfSale,
                }
            });

            const walletIncrement = feeRefundNeeded
                ? commission + config.annualFee
                : commission;

            const updateCount = await tx.distributor.updateMany({
                where: {
                    id: distributorId,
                    revenueThisYear: dist.revenueThisYear
                },
                data: {
                    walletBalance: { increment: walletIncrement },
                    revenueThisYear: { increment: amount },
                    tier: newTier,
                }
            });

            if (updateCount.count === 0) {
                throw new Error("Concurrent modification of distributor revenue detected. Please retry.");
            }

            await tx.distributorWalletTx.create({
                data: {
                    distributorId,
                    amount: commission,
                    type: "COMMISSION",
                    description: `Sale Year ${currentYearOfSale} for user #${purchasingUserId} | Order #${orderId}`
                }
            });

            if (feeRefundNeeded) {
                await tx.distributorWalletTx.create({
                    data: {
                        distributorId,
                        amount: config.annualFee,
                        type: "REFUND_FEE",
                        description: `Tier upgrade to ${newTier} — annual fee refund`
                    }
                });
            }
        });

        await logAudit('DISTRIBUTOR_COMMISSION_CREDITED', 'Distributor', String(distributorId), undefined, undefined, {
            orderId, purchasingUserId, commission, finalRate, saleYear: currentYearOfSale,
            tierUpgraded, newTier: newTier, feeRefundNeeded
        });
    }

    /**
     * Withdraw from distributor wallet.
     * ATOMIC: balance check + deduction in one transaction to prevent race conditions.
     */
    static async requestPayout(distributorId: number, reqAmount: number) {
        if (!reqAmount || reqAmount <= 0) throw new Error("Invalid payout amount.");

        const walletConfig = await ConfigService.getWalletConfig();

        return await prisma.$transaction(async (tx) => {
            // Lock the row for this distributor to prevent concurrent withdrawals
            const dist = await tx.distributor.findUnique({ where: { id: distributorId } });
            if (!dist || dist.status !== "ACTIVE") throw new Error("Invalid distributor.");

            const available = dist.walletBalance - walletConfig.distributorMinBalance;

            if (available < walletConfig.payoutThreshold) {
                throw new Error(
                    `Available payout (Rs ${available.toFixed(2)}) must be at least Rs ${walletConfig.payoutThreshold}. ` +
                    `Minimum balance of Rs ${walletConfig.distributorMinBalance} is retained.`
                );
            }

            if (reqAmount > available) {
                throw new Error(`Requested amount Rs ${reqAmount} exceeds available payout Rs ${available.toFixed(2)}.`);
            }

            const updateCount = await tx.distributor.updateMany({
                where: {
                    id: distributorId,
                    walletBalance: { gte: reqAmount + walletConfig.distributorMinBalance }
                },
                data: { walletBalance: { decrement: reqAmount } }
            });

            if (updateCount.count === 0) {
                throw new Error("Payout failed: insufficient balance or concurrent modification.");
            }

            const txRecord = await tx.distributorWalletTx.create({
                data: {
                    distributorId,
                    amount: -reqAmount,
                    type: "PAYOUT",
                    status: "PENDING", // PENDING until bank transfer confirmed
                    description: `Payout request — Rs ${reqAmount}`
                }
            });

            return { success: true, amountPaid: reqAmount, txId: txRecord.id };
        });
    }

    static async getSalesHistory(distributorId: number) {
        const sales = await prisma.distributorSale.findMany({
            where: { distributorId },
            include: { purchasingUser: true, order: true },
            orderBy: { createdAt: 'desc' }
        });

        return sales.map((sale: any) => ({
            id: sale.id,
            user: sale.purchasingUser?.name || sale.purchasingUser?.email || 'Unknown',
            date: sale.createdAt.toLocaleDateString(),
            amount: sale.amount,
            commission: sale.commissionEarned,
            rate: `${(sale.commissionRate * 100).toFixed(1)}%`
        }));
    }
}

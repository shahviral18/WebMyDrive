import { Request, Response } from 'express';
import { DistributorService } from '../services/DistributorService';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '../services/ConfigService';

const prisma = new PrismaClient();

export class DistributorController {

    static async onboard(req: Request, res: Response) {
        try {
            const reqUser = req.user;
            if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

            const user = await prisma.user.findUnique({ where: { id: reqUser.userId } });
            if (!user) return res.status(404).json({ error: 'User not found' });

            const dist = await DistributorService.onboard(user.id, user.email);

            // Link distributor to user
            await prisma.user.update({
                where: { id: user.id },
                data: { distributorId: dist.id }
            });

            return res.json({ success: true, distributor: dist });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    static async getDashboard(req: Request, res: Response) {
        try {
            const reqUser = req.user;
            if (!reqUser || reqUser.role !== 'DISTRIBUTOR') return res.status(403).json({ error: 'Forbidden' });

            const distributorId = Math.abs(reqUser.userId);
            const dist = await prisma.distributor.findUnique({
                where: { id: distributorId }
            });

            if (!dist) return res.status(404).json({ error: 'Distributor not found' });

            const config = await ConfigService.getDistributorConfig();
            const tiersDesc = [...config.tiers].sort((a: any, b: any) => b.threshold - a.threshold);

            let nextTier = null;
            for (let i = tiersDesc.length - 1; i >= 0; i--) {
                if (tiersDesc[i].threshold > dist.revenueThisYear) {
                    nextTier = tiersDesc[i];
                    break;
                }
            }

            return res.json({
                distributor: dist,
                nextTier,
            });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    static async getHistory(req: Request, res: Response) {
        try {
            const reqUser = req.user;
            if (!reqUser || reqUser.role !== 'DISTRIBUTOR') return res.status(403).json({ error: 'Forbidden' });

            const distributorId = Math.abs(reqUser.userId);
            const history = await DistributorService.getSalesHistory(distributorId);
            return res.json(history);
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // QA / Admin function to simulate a sale for testing tier upgrade logic
    static async simulateSale(req: Request, res: Response) {
        try {
            const { distributorId, purchasingUserId, amount } = req.body;

            const order = await prisma.order.create({
                data: {
                    userId: Number(purchasingUserId),
                    amount: Number(amount),
                    status: "PAID"
                }
            });

            await DistributorService.processSale(Number(distributorId), Number(purchasingUserId), order.id, Number(amount));
            return res.json({ success: true, orderId: order.id });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    static async requestPayout(req: Request, res: Response) {
        try {
            const reqUser = req.user;
            if (!reqUser || reqUser.role !== 'DISTRIBUTOR') return res.status(403).json({ error: 'Forbidden' });

            const distributorId = Math.abs(reqUser.userId);
            const { amount } = req.body;

            const result = await DistributorService.requestPayout(distributorId, Number(amount));
            return res.json(result);
        } catch (e: any) {
            return res.status(400).json({ error: e.message });
        }
    }

    static async getPayouts(req: Request, res: Response) {
        try {
            const reqUser = req.user;
            if (!reqUser || reqUser.role !== 'DISTRIBUTOR') return res.status(403).json({ error: 'Forbidden' });

            const distributorId = Math.abs(reqUser.userId);

            const payouts = await prisma.distributorWalletTx.findMany({
                where: { distributorId, type: "PAYOUT" },
                orderBy: { createdAt: "desc" }
            });

            return res.json(payouts.map((p: any) => ({
                id: `PAY-2026-00${p.id}`,
                date: p.createdAt.toLocaleDateString(),
                amount: `₹${Math.abs(p.amount).toLocaleString()}`,
                method: "Bank Transfer",
                status: "completed",
                txRef: `UTR${p.id}992211`
            })));
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    static async getWallet(req: Request, res: Response) {
        try {
            const reqUser = req.user;
            if (!reqUser || reqUser.role !== 'DISTRIBUTOR') return res.status(403).json({ error: 'Forbidden' });

            const distributorId = Math.abs(reqUser.userId);

            const txs = await prisma.distributorWalletTx.findMany({
                where: { distributorId },
                orderBy: { createdAt: "desc" }
            });

            return res.json({
                transactions: txs.map(t => ({
                    id: t.id,
                    type: t.amount > 0 ? "credit" : "debit",
                    description: t.description || (t.type === "COMMISSION" ? "Commission" : "Transaction"),
                    amount: t.amount,
                    date: t.createdAt.toLocaleDateString(),
                    status: t.status
                }))
            });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    static async getCustomers(req: Request, res: Response) {
        try {
            const reqUser = req.user;
            if (!reqUser || reqUser.role !== 'DISTRIBUTOR') return res.status(403).json({ error: 'Forbidden' });

            const distributorId = Math.abs(reqUser.userId);

            // Fetch users referred by this distributor
            const customers = await prisma.user.findMany({
                where: { referredById: distributorId },
                include: { Workspace: { include: { plan: true } } },
                orderBy: { createdAt: 'desc' }
            });

            const mapped = await Promise.all(customers.map(async (c: any) => {
                const totalCommission = await prisma.distributorSale.aggregate({
                    where: { distributorId, purchasingUserId: c.id },
                    _sum: { commissionEarned: true }
                });

                const planName = c.Workspace?.[0]?.plan?.name || "Free/None";

                return {
                    id: `C${c.id.toString().padStart(3, '0')}`,
                    name: c.name || "User",
                    email: c.email,
                    phone: c.phone || "—",
                    plan: planName,
                    status: c.Workspace?.[0]?.plan ? "active" : "trial",
                    joined: c.createdAt.toLocaleDateString(),
                    commission: `₹${totalCommission._sum.commissionEarned || 0}`,
                    level: "Direct"
                };
            }));

            return res.json(mapped);
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    static async getEarningsStats(req: Request, res: Response) {
        try {
            const reqUser = req.user;
            if (!reqUser || reqUser.role !== 'DISTRIBUTOR') return res.status(403).json({ error: 'Forbidden' });

            const distributorId = Math.abs(reqUser.userId);

            const dist = await prisma.distributor.findUnique({ where: { id: distributorId } });
            if (!dist) return res.status(404).json({ error: 'Not found' });

            // Stats
            const totalLifetime = await prisma.distributorWalletTx.aggregate({
                where: { distributorId, type: "COMMISSION" },
                _sum: { amount: true }
            });

            // This Month
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const thisMonth = await prisma.distributorWalletTx.aggregate({
                where: { distributorId, type: "COMMISSION", createdAt: { gte: firstDay } },
                _sum: { amount: true }
            });

            const txs = await prisma.distributorWalletTx.findMany({
                where: { distributorId },
                orderBy: { createdAt: "desc" },
                take: 10
            });

            return res.json({
                totalLifetime: totalLifetime._sum.amount || 0,
                thisMonth: thisMonth._sum.amount || 0,
                pendingPayout: dist.walletBalance,
                tier: dist.tier,
                revenueThisYear: dist.revenueThisYear,
                transactions: txs.map(t => ({
                    id: t.id,
                    type: t.amount > 0 ? "credit" : "debit",
                    description: t.description || (t.type === "COMMISSION" ? "Commission" : "Transaction"),
                    amount: `₹${Math.abs(t.amount).toLocaleString()}`,
                    date: t.createdAt.toLocaleDateString()
                }))
            });

        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }
}

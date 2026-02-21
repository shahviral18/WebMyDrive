import { Request, Response } from 'express';
import { ConfigService } from '../services/ConfigService';
import { prisma } from '../models';
import bcrypt from 'bcrypt';

export class AdminController {

    // ── Config ─────────────────────────────────────────────────────────────────
    static async getConfig(req: Request, res: Response) {
        try {
            const type = req.query.type as string;
            if (type === 'USER_REFERRAL_SETTINGS') return res.json(await ConfigService.getUserReferralConfig());
            if (type === 'DISTRIBUTOR_SETTINGS') return res.json(await ConfigService.getDistributorConfig());
            if (type === 'WALLET_SETTINGS') return res.json(await ConfigService.getWalletConfig());

            // Return all 3 configs if no type specified
            const [userRef, dist, wallet] = await Promise.all([
                ConfigService.getUserReferralConfig(),
                ConfigService.getDistributorConfig(),
                ConfigService.getWalletConfig(),
            ]);
            return res.json({ USER_REFERRAL_SETTINGS: userRef, DISTRIBUTOR_SETTINGS: dist, WALLET_SETTINGS: wallet });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    static async updateConfig(req: Request, res: Response) {
        try {
            const { type, data } = req.body;
            if (!type || !data) return res.status(400).json({ error: 'Missing type or data' });
            await ConfigService.setConfig(type, data);
            return res.json({ success: true, message: `${type} updated.` });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // ── KPIs ───────────────────────────────────────────────────────────────────
    static async getKpis(req: Request, res: Response) {
        try {
            const [userCount, distCount, paidOrders, pendingOrders, totalWallet] = await Promise.all([
                prisma.user.count({ where: { role: { not: 'SUPERADMIN' } } }),
                prisma.distributor.count({ where: { status: 'ACTIVE' } }),
                prisma.order.aggregate({ where: { status: 'PAID' }, _sum: { amount: true }, _count: true }),
                prisma.order.count({ where: { status: 'PENDING' } }),
                prisma.user.aggregate({ _sum: { walletBalance: true } }),
            ]);

            // Revenue this month
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            const monthRevenue = await prisma.order.aggregate({
                where: { status: 'PAID', createdAt: { gte: startOfMonth } },
                _sum: { amount: true }
            });

            return res.json({
                totalUsers: userCount,
                activeDistributors: distCount,
                totalRevenue: paidOrders._sum.amount || 0,
                totalOrders: paidOrders._count,
                pendingOrders,
                monthRevenue: monthRevenue._sum.amount || 0,
                totalWalletBalance: totalWallet._sum.walletBalance || 0,
            });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // ── Users ──────────────────────────────────────────────────────────────────
    static async getUsers(req: Request, res: Response) {
        try {
            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = Math.min(100, Number(req.query.limit) || 20);
            const search = (req.query.search as string) || '';
            const skip = (page - 1) * limit;

            const where: any = { role: { not: 'SUPERADMIN' } };
            if (search) {
                where.OR = [
                    { email: { contains: search } },
                    { name: { contains: search } },
                ];
            }

            const [users, total] = await Promise.all([
                prisma.user.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: { workspaces: { select: { status: true, plan: { select: { name: true } } } } }
                }),
                prisma.user.count({ where }),
            ]);

            return res.json({
                users: users.map(u => ({
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    role: u.role,
                    walletBalance: u.walletBalance,
                    referralCode: u.referralCode,
                    plan: u.workspaces[0]?.plan?.name || 'None',
                    status: u.workspaces[0]?.status || 'NO_WORKSPACE',
                    createdAt: u.createdAt,
                    distributorId: u.distributorId,
                })),
                total,
                page,
                totalPages: Math.ceil(total / limit),
            });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    static async getUser(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            const user = await prisma.user.findUnique({
                where: { id },
                include: {
                    workspaces: { include: { plan: true } },
                    orders: { orderBy: { createdAt: 'desc' }, take: 10 },
                    referralsMade: { include: { refereeUser: { select: { email: true } } } },
                }
            });
            if (!user) return res.status(404).json({ error: 'User not found' });
            return res.json(user);
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // ── Orders ─────────────────────────────────────────────────────────────────
    static async getOrders(req: Request, res: Response) {
        try {
            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = Math.min(100, Number(req.query.limit) || 20);
            const status = req.query.status as string;
            const skip = (page - 1) * limit;

            const where: any = {};
            if (status) where.status = status;

            const [orders, total] = await Promise.all([
                prisma.order.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: { user: { select: { id: true, name: true, email: true } } }
                }),
                prisma.order.count({ where }),
            ]);

            return res.json({
                orders: orders.map(o => ({
                    id: o.id,
                    amount: o.amount,
                    currency: o.currency,
                    status: o.status,
                    gatewayTxId: o.gatewayTxId,
                    createdAt: o.createdAt,
                    user: o.user,
                })),
                total,
                page,
                totalPages: Math.ceil(total / limit),
            });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // ── Distributors ───────────────────────────────────────────────────────────
    static async getDistributors(req: Request, res: Response) {
        try {
            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = Math.min(100, Number(req.query.limit) || 50);
            const skip = (page - 1) * limit;

            const [distributors, total] = await Promise.all([
                prisma.distributor.findMany({
                    skip, take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        _count: { select: { customers: true, sales: true } },
                        sales: { select: { commissionEarned: true } },
                        walletTxs: { where: { status: 'PENDING' }, select: { amount: true } },
                    }
                }),
                prisma.distributor.count(),
            ]);

            return res.json({
                distributors: distributors.map(d => {
                    const commissionTotal = d.sales.reduce((s, sale) => s + sale.commissionEarned, 0);
                    const pendingWithdrawal = d.walletTxs.reduce((s, tx) => s + Math.abs(tx.amount), 0);
                    return {
                        id: String(d.id),
                        name: d.name ?? d.email,
                        email: d.email,
                        status: d.status?.toLowerCase() as 'active' | 'pending' | 'suspended',
                        tier: d.tier,
                        commissionPct: 10, // default; can be tier-based
                        referralCode: null,

                        // Customer counts
                        totalCustomers: d._count.customers,
                        activeCustomers: d._count.customers,

                        // Financial fields — map to what frontend expects
                        walletBalanceINR: d.walletBalance,
                        revenueThisYearINR: d.revenueThisYear,
                        revenueGeneratedINR: d.revenueThisYear,
                        commissionEarnedINR: commissionTotal,
                        pendingWithdrawalINR: pendingWithdrawal,

                        joinedAt: d.joinDate ?? d.createdAt,
                        lastActiveAt: d.updatedAt,
                        monthlyBreakdown: [],
                        createdAt: d.createdAt,
                        updatedAt: d.updatedAt,
                    };
                }),
                total,
                page,
                totalPages: Math.ceil(total / limit),
            });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // ── Audit Logs ─────────────────────────────────────────────────────────────
    static async getAuditLogs(req: Request, res: Response) {
        try {
            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = Math.min(200, Number(req.query.limit) || 50);
            const skip = (page - 1) * limit;

            const [logs, total] = await Promise.all([
                prisma.auditLog.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
                prisma.auditLog.count(),
            ]);

            return res.json({ logs, total, page, totalPages: Math.ceil(total / limit) });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // ── Referral Analytics ─────────────────────────────────────────────────────
    static async getReferralAnalytics(req: Request, res: Response) {
        try {
            const [totalReferrals, totalCommission, vestedLogs] = await Promise.all([
                prisma.referralLog.count(),
                prisma.referralLog.aggregate({ _sum: { amount: true } }),
                prisma.referralLog.findMany({
                    where: { status: 'VESTED' },
                    include: {
                        referrerUser: { select: { email: true, name: true } },
                        refereeUser: { select: { email: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 50,
                }),
            ]);

            return res.json({
                totalReferrals,
                totalCommissionPaid: totalCommission._sum.amount || 0,
                recentLogs: vestedLogs.map(l => ({
                    id: l.id,
                    referrer: l.referrerUser.email,
                    referee: l.refereeUser?.email,
                    amount: l.amount,
                    year: l.referralYear,
                    status: l.status,
                    date: l.createdAt,
                })),
            });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // ── Plans ──────────────────────────────────────────────────────────────────
    static async getPlans(req: Request, res: Response) {
        try {
            const plans = await prisma.plan.findMany({ orderBy: { price: 'asc' } });
            return res.json(plans);
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    static async upsertPlan(req: Request, res: Response) {
        try {
            const { id, name, price, features, isActive } = req.body;
            const data: any = {
                name,
                price: Number(price),
                features: features ? JSON.stringify(Array.isArray(features) ? features : [features]) : null,
            };
            if (typeof isActive === 'boolean') data.isActive = isActive;
            const plan = id
                ? await prisma.plan.update({ where: { id: Number(id) }, data })
                : await prisma.plan.create({ data });
            return res.json(plan);
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    static async deletePlan(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            if (!id) return res.status(400).json({ error: 'Plan ID required' });
            await prisma.plan.delete({ where: { id } });
            return res.json({ success: true });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    static async togglePlan(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            if (!id) return res.status(400).json({ error: 'Plan ID required' });
            const existing = await prisma.plan.findUnique({ where: { id } });
            if (!existing) return res.status(404).json({ error: 'Plan not found' });
            const updated = await prisma.plan.update({
                where: { id },
                data: { isActive: !(existing as any).isActive },
            });
            return res.json(updated);
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // ── Create User ────────────────────────────────────────────────────────────
    static async createUser(req: Request, res: Response) {
        try {
            const { name, email, password, role } = req.body;
            if (!email) return res.status(400).json({ error: 'Email is required' });
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) return res.status(409).json({ error: 'User with this email already exists' });

            const plainPassword = password || `Wmd@${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
            const passwordHash = await bcrypt.hash(plainPassword, 10);
            const referralCode = `REF${Date.now().toString(36).toUpperCase()}`;

            const user = await prisma.user.create({
                data: { name, email, passwordHash, role: role || 'USER', referralCode, walletBalance: 0 }
            });
            return res.json({ user, plainPassword, message: 'User created. Save this password — it will not be shown again.' });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // ── Reset User Password ────────────────────────────────────────────────────
    static async resetUserPassword(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            const { password } = req.body;
            const plainPassword = password || `Wmd@${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
            const passwordHash = await bcrypt.hash(plainPassword, 10);
            await prisma.user.update({ where: { id }, data: { passwordHash } });
            return res.json({ plainPassword, message: 'Password reset. Save this password — it will not be shown again.' });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // ── Delete User ────────────────────────────────────────────────────────────
    static async deleteUser(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            if (!id) return res.status(400).json({ error: 'User ID required' });

            const user = await prisma.user.findUnique({ where: { id } });
            if (!user) return res.status(404).json({ error: 'User not found' });
            if (user.role === 'SUPERADMIN') return res.status(403).json({ error: 'Cannot delete a SUPERADMIN account' });

            // Delete FK-dependent records in correct order
            await prisma.distributorSale.deleteMany({ where: { purchasingUserId: id } });
            await prisma.workspace.deleteMany({ where: { userId: id } });
            await prisma.referralLog.deleteMany({ where: { OR: [{ referrerUserId: id }, { refereeUserId: id }] } });
            await prisma.order.deleteMany({ where: { userId: id } });
            await prisma.user.delete({ where: { id } });

            await prisma.auditLog.create({
                data: {
                    actionName: '[Admin] DELETE_USER',
                    actorId: req.user?.userId,
                    payloadJson: JSON.stringify({ deletedUserId: id, email: user.email })
                }
            });

            return res.json({ success: true });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // ── Create Distributor ─────────────────────────────────────────────────────
    static async createDistributor(req: Request, res: Response) {
        try {
            const { name, email, phone, password } = req.body;
            if (!email) return res.status(400).json({ error: 'Email is required' });
            const existing = await prisma.distributor.findUnique({ where: { email } });
            if (existing) return res.status(409).json({ error: 'Distributor with this email already exists' });

            const plainPassword = password || `Dist@${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
            const passwordHash = await bcrypt.hash(plainPassword, 10);

            // Generate unique referral code with collision-safe retry loop
            const baseCode = (name ?? email)
                .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6).padEnd(4, 'X');
            let referralCode = `${baseCode}001`;
            for (let attempt = 1; attempt <= 10; attempt++) {
                const conflict = await prisma.distributor.findUnique({ where: { referralCode } as any });
                if (!conflict) break;
                referralCode = `${baseCode}${Date.now().toString(36).toUpperCase().slice(-4)}`;
                if (attempt === 10) throw new Error('Could not generate unique referral code. Please try again.');
            }

            const distributor = await prisma.distributor.create({
                data: { name, email, passwordHash, tier: 'Starter', status: 'ACTIVE', walletBalance: 0, revenueThisYear: 0, referralCode } as any
            });
            return res.json({ distributor, plainPassword, message: 'Distributor created. Save this password — it will not be shown again.' });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // ── Reset Distributor Password ─────────────────────────────────────────────
    static async resetDistributorPassword(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            const { password } = req.body;
            const plainPassword = password || `Dist@${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
            const passwordHash = await bcrypt.hash(plainPassword, 10);
            await prisma.distributor.update({ where: { id }, data: { passwordHash } });
            return res.json({ plainPassword, message: 'Password reset. Save this password — it will not be shown again.' });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }
}

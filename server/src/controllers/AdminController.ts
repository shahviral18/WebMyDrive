import { Request, Response } from 'express';
import { ConfigService } from '../services/ConfigService';
import { prisma } from '../models';
import bcrypt from 'bcrypt';
import { logAudit } from '../services/AuditService';


export class AdminController {

    // ── Config ─────────────────────────────────────────────────────────────────
    static async getConfig(req: Request, res: Response) {
        try {
            const type = req.query.type as string;
            if (type === 'USER_REFERRAL_SETTINGS') return res.json(await ConfigService.getUserReferralConfig());
            if (type === 'DISTRIBUTOR_SETTINGS') return res.json(await ConfigService.getDistributorConfig());
            if (type === 'WALLET_SETTINGS') return res.json(await ConfigService.getWalletConfig());

            if (type === 'GLOBAL_PLAN_SETTINGS') return res.json(await ConfigService.getGlobalPlanConfig());

            const [userRef, dist, wallet, planConfig] = await Promise.all([
                ConfigService.getUserReferralConfig(),
                ConfigService.getDistributorConfig(),
                ConfigService.getWalletConfig(),
                ConfigService.getGlobalPlanConfig(),
            ]);
            return res.json({ USER_REFERRAL_SETTINGS: userRef, DISTRIBUTOR_SETTINGS: dist, WALLET_SETTINGS: wallet, GLOBAL_PLAN_SETTINGS: planConfig });
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

    static async getUsers(req: Request, res: Response) {
        try {
            const limit = Math.min(200, Number(req.query.limit) || 20);
            const search = (req.query.search as string) || '';

            const userWhere: any = { role: { not: 'SUPERADMIN' } };
            const distWhere: any = {};
            if (search) {
                userWhere.OR = [
                    { email: { contains: search } },
                    { name: { contains: search } },
                ];
                distWhere.OR = [
                    { email: { contains: search } },
                    { name: { contains: search } },
                ];
            }

            const [users, distributors] = await Promise.all([
                prisma.user.findMany({
                    where: userWhere, take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        workspaces: { select: { status: true, plan: { select: { name: true } } } },
                        referralsUsedBy: { select: { id: true }, take: 1 }
                    }
                }),
                prisma.distributor.findMany({
                    where: distWhere, take: limit,
                    orderBy: { createdAt: 'desc' }
                })
            ]);

            const combined = [
                ...users.map(u => ({
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
                    source: u.distributorId ? 'Distributor' : (u.referralsUsedBy && u.referralsUsedBy.length > 0 ? 'User Referral' : 'Direct'),
                })),
                ...distributors.map(d => ({
                    id: d.id + 1000000, // Safe unique ID
                    name: d.name,
                    email: d.email,
                    role: 'DISTRIBUTOR',
                    walletBalance: d.walletBalance,
                    referralCode: d.referralCode,
                    plan: d.tier,
                    status: d.status,
                    createdAt: d.createdAt,
                    distributorId: d.id,
                    source: 'Distributor', // distributor account itself
                }))
            ];

            combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            return res.json({
                users: combined.slice(0, limit),
                total: combined.length,
                page: 1,
                totalPages: 1,
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
                    where, skip, take: limit,
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
                        commissionPct: 10,
                        referralCode: d.referralCode,
                        totalCustomers: d._count.customers,
                        activeCustomers: d._count.customers,
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
                total, page,
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

            // Only show payment / transaction-related events. Excludes LOGIN, REGISTER, etc.
            const paymentKeywords = [
                'PAYMENT', 'CHECKOUT', 'COMMISSION', 'WALLET',
                'ORDER', 'PURCHASE', 'REFERRAL', 'RAZORPAY',
                'STRIPE', 'PLAN_PURCHASE', 'BILLING', 'PAYOUT'
            ];
            const where = {
                OR: paymentKeywords.map(kw => ({
                    actionName: { contains: kw }
                }))
            };

            const [logs, total] = await Promise.all([
                prisma.auditLog.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
                prisma.auditLog.count({ where }),
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
            const { id, name, price, priceINR, priceMonthlyINR, priceYearlyINR, features, isActive, storageGB, maxUsers, googleSKU, hasOverride } = req.body;
            if (!name || !name.trim()) return res.status(400).json({ error: 'Plan name is required' });
            if (Number(price) <= 0) return res.status(400).json({ error: 'Price must be greater than 0' });

            const data: any = {
                name: name.trim(),
                price: Number(price),
                priceINR: priceINR ? Number(priceINR) : Number(price),
                priceMonthlyINR: priceMonthlyINR ? Number(priceMonthlyINR) : null,
                priceYearlyINR: priceYearlyINR ? Number(priceYearlyINR) : null,
                storageGB: storageGB ? Number(storageGB) : 0,
                maxUsers: maxUsers ? Number(maxUsers) : 0,
                googleSKU: googleSKU || null,
                features: features ? (typeof features === 'string' ? features : JSON.stringify(features)) : null,
            };
            if (typeof isActive === 'boolean') data.isActive = isActive;
            if (typeof hasOverride === 'boolean') data.hasOverride = hasOverride;

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

            // 1. Confirm the plan exists
            const existing = await prisma.plan.findUnique({ where: { id } });
            if (!existing) return res.status(404).json({ error: 'Plan not found' });

            // 2. Check if any workspaces are using this plan
            const workspaceCount = await prisma.workspace.count({ where: { planId: id } });
            if (workspaceCount > 0) {
                // Instead of blocking, we unlink the workspaces from this plan
                await prisma.workspace.updateMany({
                    where: { planId: id },
                    data: { planId: null as any },
                });
            }

            // 3. Now safely delete the plan
            await prisma.plan.delete({ where: { id } });
            return res.json({ success: true, message: 'Plan deleted successfully' });
        } catch (e: any) {
            // Prisma error code P2025 = record not found
            if (e.code === 'P2025') {
                return res.status(404).json({ error: 'Plan not found or already deleted' });
            }
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

            const src = (name || '').trim() || email.split('@')[0];
            const firstWord = src.split(/\s+/)[0];
            const basePass = firstWord.replace(/[^a-z0-9]/gi, '');
            const defaultPass = (basePass.charAt(0).toUpperCase() + basePass.slice(1).toLowerCase()) + new Date().getFullYear();
            const plainPassword = password || defaultPass;
            const passwordHash = await bcrypt.hash(plainPassword, 10);

            // Name-based referral code: first word of name + year (e.g. "Priya Sharma" → PRIYA2026)
            const baseRef = basePass.toUpperCase().slice(0, 12);
            const referralCode = `${baseRef}${new Date().getFullYear()}`;

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
            const user = await prisma.user.findUnique({ where: { id } });
            if (!user) return res.status(404).json({ error: 'User not found' });

            const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);

            await prisma.securityLink.create({
                data: {
                    token,
                    userId: id,
                    role: 'USER',
                    type: 'PASSWORD_RESET',
                    status: 'ACTIVE',
                    expiresAt
                }
            });

            // Need to return it so the admin can copy it
            const resetLink = `https://webmydrive.com/reset-password?token=${token}`;
            return res.json({ plainPassword: resetLink, message: 'Security link generated. It will expire in 24 hours.' });
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
            const { name, email, password } = req.body;
            if (!email) return res.status(400).json({ error: 'Email is required' });
            const existing = await prisma.distributor.findUnique({ where: { email } });
            if (existing) return res.status(409).json({ error: 'Distributor with this email already exists' });

            const plainPassword = password || `Dist@${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
            const passwordHash = await bcrypt.hash(plainPassword, 10);

            const baseCode = (name || email)
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

            const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);

            await prisma.securityLink.create({
                data: {
                    token,
                    userId: id,
                    role: 'DISTRIBUTOR',
                    type: 'PASSWORD_RESET',
                    status: 'ACTIVE',
                    expiresAt
                }
            });

            const resetLink = `https://webmydrive.com/reset-password?token=${token}`;
            return res.json({ plainPassword: resetLink, message: 'Security link generated. It will expire in 24 hours.' });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // ── Adjust User Wallet Balance ─────────────────────────────────────────────
    // POST /admin/users/:id/adjust-wallet  { amount: number (can be negative), reason: string }
    static async adjustWallet(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            const { amount, reason } = req.body;
            if (typeof amount !== 'number') return res.status(400).json({ error: 'amount must be a number (positive to credit, negative to deduct)' });

            const user = await prisma.user.findUnique({ where: { id } });
            if (!user) return res.status(404).json({ error: 'User not found' });

            const newBalance = parseFloat((user.walletBalance + amount).toFixed(2));
            if (newBalance < 0) return res.status(400).json({ error: `Deduction of ₹${Math.abs(amount)} would result in negative balance (current: ₹${user.walletBalance})` });

            const updated = await prisma.user.update({
                where: { id },
                data: { walletBalance: newBalance }
            });

            await logAudit('ADMIN_WALLET_ADJUST', 'User', String(id), req.user?.userId, req.ip, {
                userId: id, email: user.email, amount, newBalance, reason: reason || 'Manual admin adjustment'
            });

            return res.json({ success: true, newBalance: updated.walletBalance, message: `Wallet ${amount >= 0 ? 'credited' : 'debited'} ₹${Math.abs(amount)}` });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // ── Toggle User Account Status ─────────────────────────────────────────────
    // POST /admin/users/:id/toggle-status
    static async toggleUserStatus(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            const user = await prisma.user.findUnique({ where: { id } });
            if (!user) return res.status(404).json({ error: 'User not found' });
            if (user.role === 'SUPERADMIN') return res.status(403).json({ error: 'Cannot disable a SUPERADMIN account' });

            const newStatus = !(user as any).isDisabled;
            await prisma.user.update({ where: { id }, data: { isDisabled: newStatus } as any });

            await logAudit(newStatus ? 'ADMIN_USER_DISABLED' : 'ADMIN_USER_ENABLED', 'User', String(id), req.user?.userId, req.ip, { email: user.email });

            return res.json({ success: true, isDisabled: newStatus, message: `Account ${newStatus ? 'disabled' : 'enabled'}` });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // ── Adjust Distributor Wallet ──────────────────────────────────────────────
    // POST /admin/distributors/:id/adjust-wallet  { amount: number, reason: string }
    static async adjustDistributorWallet(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            const { amount, reason } = req.body;
            if (typeof amount !== 'number') return res.status(400).json({ error: 'amount must be a number' });

            const dist = await prisma.distributor.findUnique({ where: { id } });
            if (!dist) return res.status(404).json({ error: 'Distributor not found' });

            const newBalance = parseFloat((dist.walletBalance + amount).toFixed(2));
            if (newBalance < 0) return res.status(400).json({ error: `Deduction would result in negative balance` });

            await prisma.distributor.update({ where: { id }, data: { walletBalance: newBalance } });
            await prisma.distributorWalletTx.create({
                data: {
                    distributorId: id,
                    amount,
                    type: amount >= 0 ? 'COMMISSION' : 'PAYOUT',
                    status: 'COMPLETED',
                    description: reason || 'Admin manual adjustment'
                }
            });

            await logAudit('ADMIN_DISTRIBUTOR_WALLET_ADJUST', 'Distributor', String(id), req.user?.userId, req.ip, {
                distributorId: id, amount, newBalance, reason: reason || 'Manual admin adjustment'
            });

            return res.json({ success: true, newBalance, message: `Wallet ${amount >= 0 ? 'credited' : 'debited'} ₹${Math.abs(amount)}` });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // ── Override Commission on a Referral Log ──────────────────────────────────
    // PATCH /admin/referrals/:id/override-commission  { newAmount: number, reason: string }
    static async overrideCommission(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            const { newAmount, reason } = req.body;
            if (typeof newAmount !== 'number' || newAmount < 0) return res.status(400).json({ error: 'newAmount must be a non-negative number' });

            const log = await prisma.referralLog.findUnique({ where: { id } });
            if (!log) return res.status(404).json({ error: 'Referral log not found' });

            const diff = newAmount - log.amount;

            await prisma.$transaction(async (tx: any) => {
                await tx.referralLog.update({ where: { id }, data: { amount: newAmount } });
                if (diff !== 0) {
                    await tx.user.update({
                        where: { id: log.referrerUserId },
                        data: { walletBalance: { increment: diff } }
                    });
                }
            });

            await logAudit('ADMIN_COMMISSION_OVERRIDE', 'ReferralLog', String(id), req.user?.userId, req.ip, {
                oldAmount: log.amount, newAmount, diff, reason: reason || 'Admin override'
            });

            return res.json({ success: true, message: `Commission updated from ₹${log.amount} to ₹${newAmount}. Wallet adjusted by ₹${diff.toFixed(2)}` });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // ── Get All Referral Logs (admin) ──────────────────────────────────────────
    static async getAllReferrals(req: Request, res: Response) {
        try {
            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = Math.min(100, Number(req.query.limit) || 50);
            const skip = (page - 1) * limit;

            const [logs, total] = await Promise.all([
                prisma.referralLog.findMany({
                    skip, take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        referrerUser: { select: { id: true, email: true, name: true, walletBalance: true } },
                        refereeUser: { select: { id: true, email: true } },
                        order: { select: { id: true, amount: true, status: true, plan: { select: { name: true } } } }
                    }
                }),
                prisma.referralLog.count()
            ]);

            return res.json({
                logs: logs.map(l => ({
                    id: l.id,
                    referrer: l.referrerUser,
                    referee: l.refereeUser,
                    order: l.order,
                    amount: l.amount,
                    status: l.status,
                    year: l.referralYear,
                    createdAt: l.createdAt
                })),
                total, page,
                totalPages: Math.ceil(total / limit)
            });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }
}


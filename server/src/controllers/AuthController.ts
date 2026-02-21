import { Request, Response } from "express";
import { prisma } from "../models";
import bcrypt from "bcrypt";
import { generateToken } from "../utils/jwt";
import { logAudit } from "../services/AuditService";

// Deterministic referral code: EMAIL_PREFIX + YEAR (e.g. john2026)
function generateReferralCode(email: string): string {
    const prefix = email.split("@")[0].replace(/[^a-z0-9]/gi, "").toUpperCase();
    return `${prefix}${new Date().getFullYear()}`;
}

export class AuthController {
    static async register(req: Request, res: Response) {
        const { name, email, password, distributorId } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
        if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

        try {
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) return res.status(400).json({ error: "Email already registered" });

            const passwordHash = await bcrypt.hash(password, 10);

            // Collision-safe referral code generation
            const baseCode = generateReferralCode(email);
            let referralCode = baseCode;
            for (let attempt = 1; attempt <= 10; attempt++) {
                const conflict = await prisma.user.findUnique({ where: { referralCode } });
                if (!conflict) break;
                referralCode = `${baseCode}${attempt}`;
                if (attempt === 10) throw new Error('Could not generate unique referral code.');
            }

            const user = await prisma.user.create({
                data: {
                    name: name || email.split("@")[0],
                    email,
                    passwordHash,
                    role: "USER",
                    referralCode,
                    walletBalance: 0.0,
                    distributorId: distributorId ? Number(distributorId) : null,
                }
            });

            await logAudit("REGISTER", "User", String(user.id), user.id, req.ip, { email });

            const token = generateToken(user.id, user.role);
            return res.status(201).json({
                token,
                user: { id: user.id, name: user.name, email: user.email, role: user.role, referralCode: user.referralCode }
            });
        } catch (err: any) {
            if (err.code === 'P2002') return res.status(400).json({ error: "Email already registered" });
            return res.status(500).json({ error: err.message });
        }
    }

    static async login(req: Request, res: Response) {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

        try {
            // Check if this is a distributor login first
            const distributor = await prisma.distributor.findUnique({ where: { email } });
            if (distributor && distributor.passwordHash) {
                const valid = await bcrypt.compare(password, distributor.passwordHash);
                if (!valid) return res.status(401).json({ error: "Invalid credentials" });

                await logAudit("LOGIN", "Distributor", String(distributor.id), undefined, req.ip, { email });
                const token = generateToken(-(distributor.id), "DISTRIBUTOR"); // Negative ID = distributor
                return res.json({
                    token,
                    user: {
                        id: distributor.id,
                        name: distributor.name,
                        email: distributor.email,
                        role: "DISTRIBUTOR",
                        distributorId: distributor.id,
                    }
                });
            }

            // Regular user login
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user || !user.passwordHash) return res.status(401).json({ error: "Invalid credentials" });

            const valid = await bcrypt.compare(password, user.passwordHash);
            if (!valid) return res.status(401).json({ error: "Invalid credentials" });

            await logAudit("LOGIN", "User", String(user.id), user.id, req.ip, { email });

            const token = generateToken(user.id, user.role);
            return res.json({
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    referralCode: user.referralCode,
                    walletBalance: user.walletBalance,
                }
            });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    static async me(req: Request, res: Response) {
        const reqUser = req.user;
        if (!reqUser) return res.status(401).json({ error: "Unauthorized" });

        try {
            if (reqUser.role === "DISTRIBUTOR") {
                const dist = await prisma.distributor.findUnique({
                    where: { id: Math.abs(reqUser.userId) }
                });
                if (!dist) return res.status(404).json({ error: "Distributor not found" });
                return res.json({
                    user: { id: dist.id, name: dist.name, email: dist.email, role: "DISTRIBUTOR", distributorId: dist.id, walletBalance: dist.walletBalance }
                });
            }

            const user = await prisma.user.findUnique({ where: { id: reqUser.userId } });
            if (!user) return res.status(404).json({ error: "User not found" });

            return res.json({
                user: {
                    id: user.id, name: user.name, email: user.email,
                    role: user.role, referralCode: user.referralCode, walletBalance: user.walletBalance
                }
            });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    static async changePassword(req: Request, res: Response) {
        const reqUser = req.user;
        if (!reqUser) return res.status(401).json({ error: "Unauthorized" });
        const { currentPassword, newPassword } = req.body;

        try {
            const user = await prisma.user.findUnique({ where: { id: reqUser.userId } });
            if (!user || !user.passwordHash) return res.status(404).json({ error: "User not found" });

            const valid = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!valid) return res.status(400).json({ error: "Current password is incorrect" });

            const newHash = await bcrypt.hash(newPassword, 10);
            await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });

            return res.json({ success: true });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }
}

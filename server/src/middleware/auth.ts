import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../models";

const getSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === "default_secret" || secret === "super_secret_key_change_me_in_prod") {
        if (process.env.NODE_ENV === "production") {
            throw new Error("JWT_SECRET is not set to a secure value in production");
        }
    }
    return secret || "default_secret";
};

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const payload = jwt.verify(token, getSecret()) as { userId: number; role: string };
        req.user = { userId: payload.userId, role: payload.role };

        // Check if the user account is disabled (not applicable for distributors — they have negative IDs)
        if (payload.role !== "DISTRIBUTOR" && payload.role !== "ADMIN" && payload.role !== "SUPERADMIN") {
            const user = await prisma.user.findUnique({
                where: { id: payload.userId },
                select: { isDisabled: true }
            });
            if (user && (user as any).isDisabled) {
                return res.status(403).json({ error: "Your account has been suspended. Please contact support." });
            }
        }

        next();
    } catch (error: any) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ error: "Session expired. Please log in again." });
        }
        return res.status(401).json({ error: "Invalid token" });
    }
};

export const authorize = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: "Forbidden" });
        }
        next();
    };
};

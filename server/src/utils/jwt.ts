import jwt from "jsonwebtoken";

export const generateToken = (userId: number, role: string): string => {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET || JWT_SECRET === "default_secret" || JWT_SECRET === "super_secret_key_change_me_in_prod") {
        if (process.env.NODE_ENV === "production") {
            throw new Error("JWT_SECRET is not set to a secure value. Refusing to issue tokens.");
        }
        console.warn("[JWT] Warning: JWT_SECRET is not set to a secure value.");
    }
    return jwt.sign({ userId, role }, JWT_SECRET || "default_secret", { expiresIn: "24h" });
};

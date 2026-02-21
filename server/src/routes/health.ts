// server/src/routes/health.ts
import { Router } from "express";
import { sequelize } from "../configs/db";

const router = Router();

router.get("/health", async (req, res) => {
    try {
        await sequelize.authenticate();
        res.json({ status: "OK", database: "CONNECTED" });
    } catch (error) {
        console.error("Database connection failed:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ status: "ERROR", database: "DISCONNECTED", error: message });
    }
});

export default router;

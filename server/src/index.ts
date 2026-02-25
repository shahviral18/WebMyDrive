import "dotenv/config";
import app from "./app";

const PORT = Number(process.env.PORT) || 4000;

// ── Prevent Redis / BullMQ unhandled rejections from crashing the server ──────
process.on("unhandledRejection", (reason: any) => {
    const msg = String(reason?.message || reason || "");
    // Swallow Redis connection errors silently — they are non-fatal
    if (msg.includes("ECONNREFUSED") || msg.includes("connect") || msg.includes("Redis")) {
        console.warn("[Server] Suppressed unhandled Redis rejection:", msg.slice(0, 120));
        return;
    }
    console.error("[Server] Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (err) => {
    const msg = String(err?.message || err || "");
    if (msg.includes("ECONNREFUSED") || msg.includes("connect") || msg.includes("Redis")) {
        console.warn("[Server] Suppressed uncaught Redis exception:", msg.slice(0, 120));
        return;
    }
    console.error("[Server] Uncaught exception — server will continue:", err);
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
});

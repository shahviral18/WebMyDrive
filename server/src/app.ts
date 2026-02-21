import express from "express";
import cors from "cors";
import helmet from "helmet";
import healthRoutes from "./routes/health";
import authRoutes from "./routes/auth";
import adminRoutes from "./routes/admin";
import userRoutes from "./routes/user";
import referralRoutes from "./routes/referral";
import distributorRoutes from "./routes/distributor";
import paymentRoutes from "./routes/payment";

const app = express();

// Security headers
app.use(helmet());

// CORS — restrict to known frontend origins in production
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(o => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, mobile apps)
        if (!origin) return callback(null, true);
        // In development, allow all origins
        if (process.env.NODE_ENV !== "production") return callback(null, true);
        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error("CORS: Origin not allowed"), false);
    },
    credentials: true,
}));

// Raw body needed for webhook signature verification
app.use("/api/payment/webhook/razorpay", express.raw({ type: "application/json" }));
app.use("/api/payment/webhook/stripe", express.raw({ type: "application/json" }));

app.use(express.json());

app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);
app.use("/api/referral", referralRoutes);
app.use("/api/distributor", distributorRoutes);
app.use("/api/payment", paymentRoutes);

export default app;

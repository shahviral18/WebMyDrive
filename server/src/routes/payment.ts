import { Router } from "express";
import { handleStripeWebhook, handleRazorpayWebhook } from "../services/PaymentWebhooks";

const router = Router();

// Webhooks receive raw body for HMAC verification
// Raw body middleware is applied in app.ts before json() for these routes
router.post("/webhook/stripe", handleStripeWebhook);
router.post("/webhook/razorpay", handleRazorpayWebhook);

export default router;

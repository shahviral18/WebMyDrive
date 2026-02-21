import Razorpay from 'razorpay';
import crypto from 'crypto';

const key_id = process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder";
const key_secret = process.env.RAZORPAY_KEY_SECRET || "secret_placeholder";

const razorpay = new Razorpay({
    key_id,
    key_secret
});

export class RazorpayService {
    static async createOrder(amountINR: number, receipt: string) {
        // amount is in paise
        const options = {
            amount: Math.round(amountINR * 100),
            currency: "INR",
            receipt,
        };
        const order = await razorpay.orders.create(options);
        return order;
    }

    static verifySignature(order_id: string, payment_id: string, signature: string) {
        const body = order_id + "|" + payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", key_secret)
            .update(body.toString())
            .digest("hex");

        return expectedSignature === signature;
    }
}

import Razorpay from 'razorpay';
import crypto from 'crypto';

const key_id = process.env.RAZORPAY_KEY_ID || '';
const key_secret = process.env.RAZORPAY_KEY_SECRET || '';

// Demo mode: true when keys are missing or contain placeholder values
const DEMO_MODE =
    !key_id ||
    !key_secret ||
    key_id.includes('...') ||
    key_id === 'rzp_test_placeholder' ||
    key_secret === 'secret' ||
    key_secret === 'secret_placeholder';

if (DEMO_MODE) {
    console.warn('[RazorpayService] ⚠️  Running in DEMO MODE — payments are simulated. Set real RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable live payments.');
}

const razorpay = DEMO_MODE
    ? null
    : new Razorpay({ key_id, key_secret });

export class RazorpayService {
    static get isDemoMode() { return DEMO_MODE; }

    static async createOrder(amountINR: number, receipt: string) {
        if (DEMO_MODE) {
            // Return a fake Razorpay order for demo/testing
            return {
                id: `demo_order_${receipt}_${Date.now()}`,
                amount: Math.round(amountINR * 100),
                currency: 'INR',
                receipt,
                status: 'created',
            };
        }
        const options = {
            amount: Math.round(amountINR * 100),
            currency: 'INR',
            receipt,
        };
        return await razorpay!.orders.create(options);
    }

    static verifySignature(order_id: string, payment_id: string, signature: string): boolean {
        if (DEMO_MODE) {
            // In demo mode, accept any "demo_pay_*" payment ID
            return payment_id.startsWith('demo_pay_');
        }
        const body = order_id + '|' + payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', key_secret)
            .update(body)
            .digest('hex');
        return expectedSignature === signature;
    }
}

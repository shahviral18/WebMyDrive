import Stripe from 'stripe';
import crypto from 'crypto';
import { prisma } from '../models';
import { logAudit } from './AuditService';
import { CreateUserQueue } from './QueueService';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2025-01-27.acacia' as any });

// ── Stripe Webhook ─────────────────────────────────────────────────────────────
export const handleStripeWebhook = async (req: any, res: any) => {
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET as string);
    } catch (err: any) {
        console.error('[Stripe Webhook] Signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as any;
        const orderId = Number(session.client_reference_id);
        if (!orderId) {
            console.error('[Stripe Webhook] Missing client_reference_id in session');
            return res.status(200).json({ received: true });
        }

        try {
            const order = await prisma.order.findUnique({ where: { id: orderId } });
            if (!order) {
                console.error(`[Stripe Webhook] Order ${orderId} not found`);
                return res.status(200).json({ received: true });
            }

            // Atomic update / idempotency lock
            const updated = await prisma.order.updateMany({
                where: { id: orderId, status: 'PENDING' },
                data: { status: 'PAID', gatewayTxId: session.id }
            });

            if (updated.count === 0) {
                console.warn(`[Stripe Webhook] Order ${orderId} already PAID or modified concurrently — skipping`);
                return res.status(200).json({ received: true });
            }

            await logAudit("PAYMENT_SUCCESS", "Order", String(orderId), order.userId, undefined, { gateway: 'Stripe', sessionId: session.id });

            // Push onto Queue to execute async workspace creation
            await CreateUserQueue.add('ProvisionGoogleUser', { userId: order.userId, orderId: order.id });
        } catch (err: any) {
            console.error('[Stripe Webhook] Processing error:', err.message);
            // Return 200 to Stripe to prevent retries for non-retryable errors
            return res.status(200).json({ received: true, warning: 'Internal processing error' });
        }
    }

    res.json({ received: true });
};

// ── Razorpay Webhook ───────────────────────────────────────────────────────────
export const handleRazorpayWebhook = async (req: any, res: any) => {
    // CRITICAL: Verify Razorpay webhook signature before processing
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (webhookSecret) {
        const shasum = crypto.createHmac('sha256', webhookSecret);
        shasum.update(JSON.stringify(req.body)); // req.body is raw buffer at this point
        const digest = shasum.digest('hex');
        const receivedSignature = req.headers['x-razorpay-signature'];

        if (digest !== receivedSignature) {
            console.error('[Razorpay Webhook] Signature mismatch — rejected');
            return res.status(400).json({ error: 'Invalid webhook signature' });
        }
    } else {
        console.warn('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET not set — signature verification skipped');
    }

    let body: any;
    try {
        body = typeof req.body === 'string' || Buffer.isBuffer(req.body)
            ? JSON.parse(req.body.toString())
            : req.body;
    } catch {
        return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { event, payload } = body;

    if (event === 'payment.captured') {
        const payment = payload?.payment?.entity;
        if (!payment) {
            console.error('[Razorpay Webhook] Missing payment entity');
            return res.status(200).json({ status: 'ok' });
        }

        const orderId = Number(payment.notes?.internal_order_id);
        if (!orderId) {
            console.error('[Razorpay Webhook] Missing internal_order_id in payment notes');
            return res.status(200).json({ status: 'ok' });
        }

        try {
            const order = await prisma.order.findUnique({ where: { id: orderId } });
            if (!order) {
                console.error(`[Razorpay Webhook] Order ${orderId} not found`);
                return res.status(200).json({ status: 'ok' });
            }

            // Validate amount matches (paise conversion)
            const expectedPaise = Math.round(order.amount * 100);
            if (payment.amount !== expectedPaise) {
                console.error(`[Razorpay Webhook] Amount mismatch for order ${orderId}: expected ${expectedPaise}, got ${payment.amount}`);
                await logAudit("PAYMENT_AMOUNT_MISMATCH", "Order", String(orderId), order.userId, undefined, {
                    expected: expectedPaise, received: payment.amount, paymentId: payment.id
                });
                return res.status(200).json({ status: 'ok', warning: 'Amount mismatch logged' });
            }

            // Atomic update / idempotency lock
            const updated = await prisma.order.updateMany({
                where: { id: orderId, status: 'PENDING' },
                data: { status: 'PAID', gatewayTxId: payment.id }
            });

            if (updated.count === 0) {
                console.warn(`[Razorpay Webhook] Order ${orderId} already PAID or modified concurrently — skipping`);
                return res.status(200).json({ status: 'ok' });
            }

            await logAudit("PAYMENT_SUCCESS", "Order", String(orderId), order.userId, undefined, { gateway: 'Razorpay', paymentId: payment.id });
            await CreateUserQueue.add('ProvisionGoogleUser', { userId: order.userId, orderId: order.id });
        } catch (err: any) {
            console.error('[Razorpay Webhook] Processing error:', err.message);
        }
    }

    res.json({ status: 'ok' });
};

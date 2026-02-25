import Stripe from 'stripe';
import crypto from 'crypto';
import { prisma } from '../models';
import { logAudit } from './AuditService';
import { CreateUserQueue } from './QueueService';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2025-01-27.acacia' as any });

/**
 * CRITICAL PATCH: Enhanced Error Handling for Payment Webhooks
 * 
 * This patch improves webhook resilience and error visibility:
 * - Better error logging for debugging
 * - Proper retry signals to payment gateways
 * - Atomic operations to prevent duplicate processing
 * - Comprehensive audit trail
 */

// ── Stripe Webhook ─────────────────────────────────────────────────────────────
export const handleStripeWebhook = async (req: any, res: any) => {
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET as string);
    } catch (err: any) {
        console.error('[Stripe Webhook] ❌ Signature verification failed:', err.message);
        await logAudit('STRIPE_WEBHOOK_SIG_FAILED', 'PaymentWebhook', undefined, undefined, req.ip, 
            { error: err.message, sig: sig?.substring(0, 10) });
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as any;
        const orderId = Number(session.client_reference_id);
        
        if (!orderId) {
            console.error('[Stripe Webhook] ❌ Missing client_reference_id in session');
            await logAudit('STRIPE_WEBHOOK_INVALID', 'PaymentWebhook', undefined, undefined, req.ip,
                { error: 'Missing client_reference_id', sessionId: session.id });
            // Return 200 to prevent Stripe retry for this non-retryable error
            return res.status(200).json({ received: true, error: 'Missing client_reference_id' });
        }

        try {
            // CRITICAL: Verify order exists BEFORE processing
            const order = await prisma.order.findUnique({ where: { id: orderId } });
            if (!order) {
                console.error(`[Stripe Webhook] ❌ Order ${orderId} not found in database`);
                await logAudit('STRIPE_WEBHOOK_ORDER_NOT_FOUND', 'Order', String(orderId), undefined, req.ip,
                    { sessionId: session.id, clientRefId: session.client_reference_id });
                
                // Return 500 to signal to Stripe to retry later (order might be created soon)
                return res.status(500).json({ 
                    received: false, 
                    error: `Order ${orderId} not found. Stripe will retry.`
                });
            }

            console.log(`[Stripe Webhook] Processing payment for order ${orderId}, user ${order.userId}`);

            // Atomic update / idempotency lock
            // Only marks as PAID if currently PENDING
            const updated = await prisma.order.updateMany({
                where: { id: orderId, status: 'PENDING' },
                data: { status: 'PAID', gatewayTxId: session.id }
            });

            if (updated.count === 0) {
                // Order was already processed or is in different state
                const currentOrder = await prisma.order.findUnique({ where: { id: orderId } });
                if (currentOrder?.status === 'PAID') {
                    console.warn(`[Stripe Webhook] ℹ️  Order ${orderId} already marked as PAID - idempotent`);
                    await logAudit('STRIPE_WEBHOOK_IDEMPOTENT', 'Order', String(orderId), order.userId, req.ip,
                        { sessionId: session.id, currentStatus: currentOrder.status });
                    return res.status(200).json({ received: true, idempotent: true });
                } else {
                    console.error(`[Stripe Webhook] ❌ Order ${orderId} is in unexpected state: ${currentOrder?.status}`);
                    await logAudit('STRIPE_WEBHOOK_UNEXPECTED_STATE', 'Order', String(orderId), order.userId, req.ip,
                        { sessionId: session.id, currentStatus: currentOrder?.status });
                    return res.status(500).json({
                        received: false,
                        error: `Order in unexpected state: ${currentOrder?.status}. Stripe will retry.`
                    });
                }
            }

            // Payment marked as PAID ✅
            await logAudit("STRIPE_PAYMENT_MARKED_PAID", "Order", String(orderId), order.userId, req.ip, 
                { gateway: 'Stripe', sessionId: session.id, amount: order.amount });

            // Queue async job to provision email and storage
            try {
                await CreateUserQueue.add('ProvisionGoogleUser', { 
                    userId: order.userId, 
                    orderId: order.id,
                    timestamp: new Date().toISOString()
                });
                console.log(`[Stripe Webhook] ✅ Queued ProvisionGoogleUser job for user ${order.userId}`);
                await logAudit("STRIPE_PROVISION_JOB_QUEUED", "Order", String(orderId), order.userId, req.ip,
                    { sessionId: session.id });
            } catch (queueError: any) {
                console.error('[Stripe Webhook] ❌ Failed to queue provisioning job:', queueError.message);
                await logAudit("STRIPE_QUEUE_FAILED", "Order", String(orderId), order.userId, req.ip,
                    { error: queueError.message, sessionId: session.id });
                
                // Return 500 to Stripe - it will retry and hopefully queue succeeds next time
                return res.status(500).json({
                    received: false,
                    error: `Failed to queue provisioning job. Stripe will retry.`,
                    details: queueError.message
                });
            }

            return res.status(200).json({ 
                received: true, 
                orderId,
                status: 'payment_processed_and_queued' 
            });

        } catch (err: any) {
            console.error('[Stripe Webhook] ❌ Processing error:', err.message, err.stack);
            await logAudit("STRIPE_WEBHOOK_PROCESSING_ERROR", "Order", String(orderId), undefined, req.ip,
                { error: err.message, stack: err.stack?.substring(0, 200) });
            
            // Return 500 to trigger Stripe retry for transient errors
            return res.status(500).json({ 
                received: false, 
                error: 'Internal processing error. Stripe will retry.',
                details: err.message 
            });
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
            console.error('[Razorpay Webhook] ❌ Signature mismatch — rejected');
            await logAudit('RAZORPAY_WEBHOOK_SIG_FAILED', 'PaymentWebhook', undefined, undefined, req.ip,
                { error: 'Signature mismatch' });
            return res.status(400).json({ error: 'Invalid webhook signature' });
        }
    } else {
        console.warn('[Razorpay Webhook] ⚠️  RAZORPAY_WEBHOOK_SECRET not set — signature verification skipped');
    }

    let body: any;
    try {
        body = typeof req.body === 'string' || Buffer.isBuffer(req.body)
            ? JSON.parse(req.body.toString())
            : req.body;
    } catch {
        console.error('[Razorpay Webhook] ❌ Invalid JSON body');
        await logAudit('RAZORPAY_WEBHOOK_INVALID_JSON', 'PaymentWebhook', undefined, undefined, req.ip,
            { error: 'Could not parse JSON body' });
        return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { event, payload } = body;

    if (event === 'payment.captured') {
        const payment = payload?.payment?.entity;
        if (!payment) {
            console.error('[Razorpay Webhook] ❌ Missing payment entity');
            await logAudit('RAZORPAY_WEBHOOK_NO_ENTITY', 'PaymentWebhook', undefined, undefined, req.ip,
                { error: 'Missing payment entity', event });
            return res.status(200).json({ status: 'ok' });
        }

        const orderId = Number(payment.notes?.internal_order_id);
        if (!orderId) {
            console.error('[Razorpay Webhook] ❌ Missing internal_order_id in payment notes');
            await logAudit('RAZORPAY_WEBHOOK_NO_ORDER_ID', 'PaymentWebhook', undefined, undefined, req.ip,
                { error: 'Missing internal_order_id', paymentId: payment.id });
            return res.status(200).json({ status: 'ok' });
        }

        try {
            // Verify order exists
            const order = await prisma.order.findUnique({ where: { id: orderId } });
            if (!order) {
                console.error(`[Razorpay Webhook] ❌ Order ${orderId} not found`);
                await logAudit('RAZORPAY_WEBHOOK_ORDER_NOT_FOUND', 'Order', String(orderId), undefined, req.ip,
                    { paymentId: payment.id });
                return res.status(500).json({ 
                    status: 'retry',
                    error: `Order ${orderId} not found. Will retry.`
                });
            }

            // Validate amount matches (paise conversion)
            const expectedPaise = Math.round(order.amount * 100);
            if (payment.amount !== expectedPaise) {
                console.error(`[Razorpay Webhook] ❌ Amount mismatch for order ${orderId}: expected ${expectedPaise}, got ${payment.amount}`);
                await logAudit("RAZORPAY_AMOUNT_MISMATCH", "Order", String(orderId), order.userId, req.ip, {
                    expected: expectedPaise, 
                    received: payment.amount, 
                    paymentId: payment.id,
                    severity: 'HIGH' // Flag for manual review
                });
                return res.status(200).json({ 
                    status: 'ok', 
                    warning: 'Amount mismatch logged for review',
                    orderId,
                    paymentId: payment.id
                });
            }

            console.log(`[Razorpay Webhook] Processing payment for order ${orderId}, user ${order.userId}`);

            // Atomic update / idempotency lock
            const updated = await prisma.order.updateMany({
                where: { id: orderId, status: 'PENDING' },
                data: { status: 'PAID', gatewayTxId: payment.id }
            });

            if (updated.count === 0) {
                // Order already processed or in different state
                const currentOrder = await prisma.order.findUnique({ where: { id: orderId } });
                if (currentOrder?.status === 'PAID') {
                    console.warn(`[Razorpay Webhook] ℹ️  Order ${orderId} already marked as PAID - idempotent`);
                    await logAudit('RAZORPAY_WEBHOOK_IDEMPOTENT', 'Order', String(orderId), order.userId, req.ip,
                        { paymentId: payment.id, currentStatus: currentOrder.status });
                    return res.status(200).json({ status: 'ok', idempotent: true });
                } else {
                    console.error(`[Razorpay Webhook] ❌ Order ${orderId} in unexpected state: ${currentOrder?.status}`);
                    return res.status(500).json({
                        status: 'retry',
                        error: `Order in unexpected state: ${currentOrder?.status}. Will retry.`
                    });
                }
            }

            // Payment marked as PAID ✅
            await logAudit("RAZORPAY_PAYMENT_MARKED_PAID", "Order", String(orderId), order.userId, req.ip,
                { gateway: 'Razorpay', paymentId: payment.id, amount: order.amount });

            // Queue async job to provision email and storage
            try {
                await CreateUserQueue.add('ProvisionGoogleUser', { 
                    userId: order.userId, 
                    orderId: order.id,
                    timestamp: new Date().toISOString()
                });
                console.log(`[Razorpay Webhook] ✅ Queued ProvisionGoogleUser job for user ${order.userId}`);
                await logAudit("RAZORPAY_PROVISION_JOB_QUEUED", "Order", String(orderId), order.userId, req.ip,
                    { paymentId: payment.id });
            } catch (queueError: any) {
                console.error('[Razorpay Webhook] ❌ Failed to queue provisioning job:', queueError.message);
                await logAudit("RAZORPAY_QUEUE_FAILED", "Order", String(orderId), order.userId, req.ip,
                    { error: queueError.message, paymentId: payment.id });
                
                return res.status(500).json({
                    status: 'retry',
                    error: 'Failed to queue provisioning job. Will retry.',
                    details: queueError.message
                });
            }

            return res.status(200).json({ 
                status: 'ok',
                orderId,
                message: 'Payment processed and provisioning queued' 
            });

        } catch (err: any) {
            console.error('[Razorpay Webhook] ❌ Processing error:', err.message);
            await logAudit("RAZORPAY_WEBHOOK_PROCESSING_ERROR", "Order", String(orderId), undefined, req.ip,
                { error: err.message, stack: err.stack?.substring(0, 200) });
            
            return res.status(500).json({
                status: 'retry',
                error: 'Internal processing error. Will retry.',
                details: err.message
            });
        }
    }

    res.json({ status: 'ok' });
};

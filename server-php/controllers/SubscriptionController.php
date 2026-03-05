<?php
/**
 * SubscriptionController
 * 
 * Routes:
 *   POST /api/subscription/payment-success      [Public - with verification signature]
 *   POST /api/subscription/verify-payment       [Authenticated]
 *   GET  /api/subscription/status               [Authenticated]
 *   GET  /api/subscription/details              [Authenticated]
 *   POST /api/subscription/renew                [Authenticated]
 *   GET  /api/subscription/all                  [Admin]
 *   GET  /api/subscription/stats                [Admin]
 */

declare(strict_types=1);

class SubscriptionController
{
    /**
     * Handle payment success callback from payment gateway
     * This endpoint is called after user completes payment
     */
    public function handlePaymentSuccess(Request $req): void
    {
        $paymentId = trim((string)($req->body['payment_id'] ?? ''));
        $email = strtolower(trim((string)($req->body['email'] ?? '')));
        $name = trim((string)($req->body['name'] ?? ''));
        $planName = trim((string)($req->body['plan_name'] ?? ''));
        $amount = (float)($req->body['amount'] ?? 0);
        $signature = (string)($req->body['signature'] ?? '');

        // Validate signature to prevent fraud
        if (!$this->verifyPaymentSignature($paymentId, $amount, $signature)) {
            Response::error('Invalid payment signature', 400);
        }

        $result = PaymentHandler::handlePaymentSuccess([
            'payment_id' => $paymentId,
            'email' => $email,
            'name' => $name,
            'plan_name' => $planName,
            'amount' => $amount,
        ]);

        if (!$result['success']) {
            Response::error($result['error'] ?? 'Payment processing failed', 400);
        }

        Response::json($result);
    }

    /**
     * Verify payment with the payment gateway
     * Called by client after payment modal closes
     */
    public function verifyPayment(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        if (!$userId) {
            Response::error('Unauthorized', 401);
        }

        $paymentId = trim((string)($req->body['payment_id'] ?? ''));
        if (!$paymentId) {
            Response::error('payment_id is required', 400);
        }

        // Verify payment exists and belongs to user
        $order = Database::queryOne(
            'SELECT * FROM "Order" WHERE paymentId = :pid AND userId = :uid',
            [':pid' => $paymentId, ':uid' => $userId]
        );

        if (!$order) {
            Response::error('Payment not found', 404);
        }

        if ($order['status'] !== 'COMPLETED') {
            Response::error('Payment not completed', 400);
        }

        Response::json([
            'success' => true,
            'message' => 'Payment verified',
            'order' => $order,
        ]);
    }

    /**
     * Get user's subscription status
     */
    public function getSubscriptionStatus(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        if (!$userId) {
            Response::error('Unauthorized', 401);
        }

        $subscription = SubscriptionService::getUserSubscription($userId);

        if (!$subscription) {
            Response::json([
                'success' => true,
                'hasActiveSubscription' => false,
                'subscription' => null,
            ]);
            return;
        }

        Response::json([
            'success' => true,
            'hasActiveSubscription' => true,
            'subscription' => [
                'plan_name' => $subscription['plan_name'],
                'status' => $subscription['status'],
                'start_date' => $subscription['start_date'],
                'end_date' => $subscription['end_date'],
                'days_remaining' => max(0, ceil((strtotime($subscription['end_date']) - time()) / (60 * 60 * 24))),
            ],
        ]);
    }

    /**
     * Get detailed subscription information
     */
    public function getSubscriptionDetails(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        if (!$userId) {
            Response::error('Unauthorized', 401);
        }

        $subscription = SubscriptionService::getUserSubscription($userId);

        if (!$subscription) {
            Response::json([
                'success' => true,
                'subscription' => null,
                'message' => 'No active subscription',
            ]);
            return;
        }

        Response::json([
            'success' => true,
            'subscription' => [
                'id' => $subscription['id'],
                'plan_name' => $subscription['plan_name'],
                'status' => $subscription['status'],
                'payment_id' => $subscription['payment_id'],
                'start_date' => $subscription['start_date'],
                'end_date' => $subscription['end_date'],
                'created_at' => $subscription['created_at'],
                'days_remaining' => max(0, ceil((strtotime($subscription['end_date']) - time()) / (60 * 60 * 24))),
            ],
        ]);
    }

    /**
     * Renew subscription
     */
    public function renewSubscription(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        if (!$userId) {
            Response::error('Unauthorized', 401);
        }

        $paymentId = trim((string)($req->body['payment_id'] ?? ''));
        if (!$paymentId) {
            Response::error('payment_id is required', 400);
        }

        $result = SubscriptionService::renewSubscription($userId, $paymentId, 365);

        if (!$result['success']) {
            Response::error($result['error'] ?? 'Renewal failed', 400);
        }

        Response::json($result);
    }

    /**
     * Get all active subscriptions (Admin only)
     */
    public function getAllSubscriptions(Request $req): void
    {
        // Check if user is admin
        if (($req->user['role'] ?? '') !== 'SUPERADMIN' && ($req->user['role'] ?? '') !== 'ADMIN') {
            Response::error('Unauthorized', 403);
        }

        $limit = (int)($req->query['limit'] ?? 100);
        $offset = (int)($req->query['offset'] ?? 0);

        $subscriptions = SubscriptionService::getAllActiveSubscriptions($limit, $offset);

        Response::json([
            'success' => true,
            'subscriptions' => $subscriptions,
            'limit' => $limit,
            'offset' => $offset,
        ]);
    }

    /**
     * Get subscription statistics (Admin only)
     */
    public function getStats(Request $req): void
    {
        // Check if user is admin
        if (($req->user['role'] ?? '') !== 'SUPERADMIN' && ($req->user['role'] ?? '') !== 'ADMIN') {
            Response::error('Unauthorized', 403);
        }

        $stats = SubscriptionService::getSubscriptionStats();

        Response::json([
            'success' => true,
            'stats' => $stats,
        ]);
    }

    /**
     * Verify payment signature (implement with your payment provider)
     */
    private function verifyPaymentSignature(string $paymentId, float $amount, string $signature): bool
    {
        // This should implement signature verification from your payment gateway
        // For Razorpay: https://razorpay.com/docs/api/webhooks/#webhook-signatures
        // Example:
        // $secret = getenv('RAZORPAY_WEBHOOK_SECRET');
        // $hash = hash_hmac('sha256', $paymentId . '|' . $amount, $secret);
        // return hash_equals($hash, $signature);
        
        // For now, return true - implement actual verification
        return true;
    }
}

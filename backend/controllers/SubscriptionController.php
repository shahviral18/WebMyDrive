<?php
/**
 * SubscriptionController
 * 
 * Routes:
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

}

<?php
/**
 * Subscription Middleware
 * 
 * Checks if the authenticated user has an active subscription.
 * Required after authentication to ensure user has paid and has access.
 */

declare(strict_types=1);

class SubscriptionMiddleware
{
    /**
     * Verify user has an active subscription
     * If not, redirect to pricing page or return error
     */
    public static function requireActiveSubscription(Request $request): void
    {
        // User must be authenticated first
        $userId = $request->user['userId'] ?? null;
        if (!$userId) {
            Response::error('Unauthorized', 401);
        }

        $subscription = Database::queryOne(
            'SELECT * FROM "Subscription" WHERE user_id = :uid ORDER BY created_at DESC LIMIT 1',
            [':uid' => $userId]
        );

        if (!$subscription) {
            Response::error('No active subscription found. Please purchase a plan.', 403);
        }

        if ($subscription['status'] !== 'active') {
            Response::error('Your subscription is not active. Please renew your plan.', 403);
        }

        // Check if subscription has expired
        if ($subscription['end_date'] && strtotime($subscription['end_date']) < time()) {
            // Update status to expired
            Database::execute(
                'UPDATE "Subscription" SET status = :status WHERE id = :id',
                [':status' => 'expired', ':id' => $subscription['id']]
            );
            Response::error('Your subscription has expired. Please renew.', 403);
        }

        // Attach subscription to request for use in controllers
        $request->subscription = $subscription;
    }

    /**
     * Check subscription without blocking - just for info
     */
    public static function checkSubscription(Request $request): ?array
    {
        $userId = $request->user['userId'] ?? null;
        if (!$userId) {
            return null;
        }

        $subscription = Database::queryOne(
            'SELECT * FROM "Subscription" WHERE user_id = :uid ORDER BY created_at DESC LIMIT 1',
            [':uid' => $userId]
        );

        if ($subscription && $subscription['status'] === 'active') {
            if (!$subscription['end_date'] || strtotime($subscription['end_date']) >= time()) {
                return $subscription;
            }
        }

        return null;
    }
}

<?php
/**
 * SubscriptionService
 * 
 * Handles subscription operations:
 * - Creating subscriptions after payment
 * - Verifying active subscriptions
 * - Renewing/expiring subscriptions
 */

declare(strict_types=1);

class SubscriptionService
{
    /**
     * Create a subscription after successful payment
     */
    public static function createSubscription(
        int $userId,
        string $planName,
        string $paymentId,
        int $durationDays = 365
    ): array {
        $now = date('Y-m-d H:i:s');
        $endDate = date('Y-m-d H:i:s', strtotime("+{$durationDays} days"));

        // Check if user already has a subscription
        $existing = Database::queryOne(
            'SELECT id FROM "Subscription" WHERE user_id = :uid LIMIT 1',
            [':uid' => $userId]
        );

        if ($existing) {
            // Update existing subscription
            Database::execute(
                'UPDATE "Subscription" 
                 SET plan_name = :pname, payment_id = :payid, status = :status, 
                     start_date = :sdate, end_date = :edate, updated_at = :now
                 WHERE user_id = :uid',
                [
                    ':uid' => $userId,
                    ':pname' => $planName,
                    ':payid' => $paymentId,
                    ':status' => 'active',
                    ':sdate' => $now,
                    ':edate' => $endDate,
                    ':now' => $now,
                ]
            );
        } else {
            // Create new subscription
            Database::execute(
                'INSERT INTO "Subscription" (user_id, plan_name, payment_id, status, start_date, end_date, created_at, updated_at)
                 VALUES (:uid, :pname, :payid, :status, :sdate, :edate, :now, :now)',
                [
                    ':uid' => $userId,
                    ':pname' => $planName,
                    ':payid' => $paymentId,
                    ':status' => 'active',
                    ':sdate' => $now,
                    ':edate' => $endDate,
                    ':now' => $now,
                ]
            );
        }

        return [
            'success' => true,
            'subscription' => [
                'user_id' => $userId,
                'plan_name' => $planName,
                'payment_id' => $paymentId,
                'status' => 'active',
                'start_date' => $now,
                'end_date' => $endDate,
            ]
        ];
    }

    /**
     * Get user's active subscription
     */
    public static function getUserSubscription(int $userId): ?array
    {
        $subscription = Database::queryOne(
            'SELECT * FROM "Subscription" 
             WHERE user_id = :uid 
             ORDER BY created_at DESC 
             LIMIT 1',
            [':uid' => $userId]
        );

        if (!$subscription) {
            return null;
        }

        // Check if expired
        if ($subscription['end_date'] && strtotime($subscription['end_date']) < time()) {
            Database::execute(
                'UPDATE "Subscription" SET status = :status WHERE id = :id',
                [':status' => 'expired', ':id' => $subscription['id']]
            );
            return null;
        }

        if ($subscription['status'] !== 'active') {
            return null;
        }

        return $subscription;
    }

    /**
     * Check if user has active subscription
     */
    public static function hasActiveSubscription(int $userId): bool
    {
        return self::getUserSubscription($userId) !== null;
    }

    /**
     * Renew subscription
     */
    public static function renewSubscription(
        int $userId,
        string $paymentId,
        int $durationDays = 365
    ): array {
        $subscription = self::getUserSubscription($userId);
        
        if (!$subscription) {
            return ['success' => false, 'error' => 'No existing subscription found'];
        }

        $now = date('Y-m-d H:i:s');
        $endDate = date('Y-m-d H:i:s', strtotime("+{$durationDays} days"));

        Database::execute(
            'UPDATE "Subscription" 
             SET status = :status, end_date = :edate, updated_at = :now, payment_id = :payid
             WHERE id = :id',
            [
                ':status' => 'active',
                ':edate' => $endDate,
                ':now' => $now,
                ':payid' => $paymentId,
                ':id' => $subscription['id'],
            ]
        );

        return [
            'success' => true,
            'subscription' => [
                'user_id' => $userId,
                'plan_name' => $subscription['plan_name'],
                'status' => 'active',
                'end_date' => $endDate,
            ]
        ];
    }

    /**
     * Get all active subscriptions (admin)
     */
    public static function getAllActiveSubscriptions(int $limit = 100, int $offset = 0): array
    {
        return Database::query(
            'SELECT s.*, u.name, u.email 
             FROM "Subscription" s
             LEFT JOIN "User" u ON s.user_id = u.id
             WHERE s.status = :status 
             AND (s.end_date IS NULL OR s.end_date > NOW())
             ORDER BY s.created_at DESC
             LIMIT :limit OFFSET :offset',
            [
                ':status' => 'active',
                ':limit' => $limit,
                ':offset' => $offset,
            ]
        );
    }

    /**
     * Get subscription stats
     */
    public static function getSubscriptionStats(): array
    {
        $active = Database::queryOne(
            'SELECT COUNT(*) as count FROM "Subscription" 
             WHERE status = :status 
             AND (end_date IS NULL OR end_date > NOW())',
            [':status' => 'active']
        );

        $expired = Database::queryOne(
            'SELECT COUNT(*) as count FROM "Subscription" 
             WHERE status = :status',
            [':status' => 'expired']
        );

        $total = Database::queryOne(
            'SELECT COUNT(*) as count FROM "Subscription"'
        );

        return [
            'total' => (int)$total['count'],
            'active' => (int)$active['count'],
            'expired' => (int)$expired['count'],
        ];
    }
}

<?php
/**
 * ReferralService — Per-plan referral commissions.
 *
 * Rules:
 *  - Referrer gets credit only on referred user's FIRST purchase (no renewals).
 *  - Credit rate and referred-user discount are per-plan (planDiscountSlabs config).
 *  - Credits stored in WalletTransaction with 2-year expiry; User.walletBalance stays
 *    as the live sum of non-expired credits for quick reads.
 *  - Self-referral and loop guards preserved.
 */

declare(strict_types=1);

class ReferralService
{
    /**
     * Process a new PAID order — credit the referrer if applicable.
     */
    public static function processNewOrder(int $orderId, int $purchasingUserId, ?string $promoCode): void
    {
        Logger::info("[ReferralService] processNewOrder — orderId=$orderId, userId=$purchasingUserId, code=$promoCode");

        $order = Database::queryOne(
            'SELECT * FROM `Order` WHERE id = :id',
            [':id' => $orderId]
        );

        if (!$order || $order['status'] !== 'PAID') {
            Logger::warn("[ReferralService] Order $orderId not found or not PAID — aborting");
            return;
        }

        if ((int) $order['userId'] !== $purchasingUserId) {
            Logger::error("[ReferralService] Order $orderId userId mismatch — aborting");
            return;
        }

        // Idempotency: abort if already processed for this order
        $existingLog = Database::queryOne(
            'SELECT id FROM `ReferralLog` WHERE orderId = :orderId',
            [':orderId' => $orderId]
        );
        if ($existingLog) {
            Logger::warn("[ReferralService] Referral already processed for order $orderId");
            return;
        }

        $userReferralConfig = ConfigService::getUserReferralConfig();
        if (empty($userReferralConfig['allowNewReferrals'])) {
            Logger::warn('[ReferralService] Referral program is disabled');
            return;
        }

        // Only credit on FIRST purchase — if this user was already a referee, skip
        $priorReferralAsReferee = Database::queryOne(
            'SELECT id FROM `ReferralLog` WHERE refereeId = :uid ORDER BY createdAt ASC LIMIT 1',
            [':uid' => $purchasingUserId]
        );

        if ($priorReferralAsReferee) {
            Logger::info("[ReferralService] User $purchasingUserId is a renewal — no referrer commission (first-purchase-only policy)");
            return;
        }

        // ── INITIAL PURCHASE ──────────────────────────────────────────────────
        if (!$promoCode) {
            Logger::info("[ReferralService] No promo code on initial purchase — no commission");
            return;
        }

        // Resolve referrer
        $referrer  = null;
        $validLink = ReferralLinkService::validateCode($promoCode);

        if ($validLink && $validLink['role'] === 'USER') {
            $referrer = Database::queryOne(
                'SELECT * FROM `User` WHERE id = :id',
                [':id' => $validLink['referrerId']]
            );
        } else {
            $referrer = Database::queryOne(
                'SELECT * FROM `User` WHERE referralCode = :code',
                [':code' => $promoCode]
            );
        }

        if (!$referrer) {
            Logger::warn("[ReferralService] Promo code \"$promoCode\" not found — no commission");
            return;
        }

        // Self-referral guard
        if ((int) $referrer['id'] === $purchasingUserId) {
            Logger::warn("[ReferralService] Self-referral blocked for user $purchasingUserId");
            AuditService::log('SELF_REFERRAL_BLOCKED', $purchasingUserId, null, ['promoCode' => $promoCode]);
            return;
        }

        // Loop guard: buyer has already referred the referrer
        $reverseReferral = Database::queryOne(
            'SELECT id FROM `ReferralLog` WHERE referrerId = :buyer AND refereeId = :referrer',
            [':buyer' => $purchasingUserId, ':referrer' => $referrer['id']]
        );
        if ($reverseReferral) {
            Logger::warn("[ReferralService] Referral loop blocked between {$referrer['id']} and $purchasingUserId");
            return;
        }

        // Determine plan name and per-plan credit rate
        $plan     = null;
        $planName = '';
        if ($order['planId']) {
            $plan     = Database::queryOne('SELECT * FROM `Plan` WHERE id = :id', [':id' => $order['planId']]);
            $planName = $plan['name'] ?? '';
        }

        $slab       = ConfigService::getPlanReferralSlab($planName);
        $creditRate = $slab['referrerCredit'];

        // Commission base = plan price (ex-GST, no discount — referrer gets % of what buyer pays ex-GST)
        $baseAmount = (float) $order['amount'];

        $commission = round($baseAmount * $creditRate, 2);
        Logger::info("[ReferralService] Plan '{$planName}' rate={$creditRate} — crediting referrer {$referrer['id']} ₹$commission");

        // Credit expiry = 2 years
        $creditConfig = ConfigService::getUserReferralConfig();
        $expiryMonths = (int) ($creditConfig['creditExpiryMonths'] ?? 24);
        $expiresAt    = date('Y-m-d H:i:s', strtotime("+{$expiryMonths} months"));

        Database::beginTransaction();
        try {
            $now = date('Y-m-d H:i:s');

            Database::insert(
                'INSERT INTO `ReferralLog`
                 (referrerId, refereeId, orderId, amount, commissionEarned, referralYear, referrer_credited, status, type, createdAt, updatedAt)
                 VALUES (:rr, :re, :oid, :baseAmt, :commission, 1, 1, \'VESTED\', \'INITIAL\', :now1, :now2)',
                [
                    ':rr'         => $referrer['id'],
                    ':re'         => $purchasingUserId,
                    ':oid'        => $orderId,
                    ':baseAmt'    => $baseAmount,
                    ':commission' => $commission,
                    ':now1'       => $now,
                    ':now2'       => $now,
                ]
            );

            Database::insert(
                'INSERT INTO `WalletTransaction`
                 (userId, amount, type, source, description, orderId, expires_at, createdAt)
                 VALUES (:uid, :amt, \'CREDIT\', \'REFERRAL\', :desc, :oid, :exp, :now)',
                [
                    ':uid'  => $referrer['id'],
                    ':amt'  => $commission,
                    ':desc' => "Referral commission — {$planName} purchase by user #{$purchasingUserId}",
                    ':oid'  => $orderId,
                    ':exp'  => $expiresAt,
                    ':now'  => $now,
                ]
            );

            Database::execute(
                'UPDATE `User` SET walletBalance = walletBalance + :amt WHERE id = :id',
                [':amt' => $commission, ':id' => $referrer['id']]
            );

            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            Logger::error("[ReferralService] Transaction failed: " . $e->getMessage());
            return;
        }

        AuditService::log('REFERRAL_COMMISSION_CREDITED', $referrer['id'], null, [
            'orderId'          => $orderId,
            'purchasingUserId' => $purchasingUserId,
            'commission'       => $commission,
            'planName'         => $planName,
            'creditRate'       => $creditRate,
            'promoCode'        => $promoCode,
            'expiresAt'        => $expiresAt,
        ]);

        Logger::info("[ReferralService] ✅ Commission ₹$commission credited to user {$referrer['id']} (expires {$expiresAt})");
    }

    /**
     * Recalculate a user's wallet balance from non-expired WalletTransactions.
     * Call after any expiry sweep or manual adjustment.
     */
    public static function recalcWalletBalance(int $userId): void
    {
        $now = date('Y-m-d H:i:s');
        $balance = Database::queryOne(
            "SELECT
               COALESCE(SUM(CASE WHEN type='CREDIT' AND (expires_at IS NULL OR expires_at > :now1) THEN amount ELSE 0 END), 0)
             - COALESCE(SUM(CASE WHEN type='DEBIT'  THEN amount ELSE 0 END), 0) AS bal
             FROM `WalletTransaction` WHERE userId = :uid",
            [':uid' => $userId, ':now1' => $now]
        );
        $bal = max(0, (float) ($balance['bal'] ?? 0));
        Database::execute(
            'UPDATE `User` SET walletBalance = :bal WHERE id = :id',
            [':bal' => $bal, ':id' => $userId]
        );
    }

    /**
     * Returns locked discount_percent for a user's current workspace.
     * Used at renewal billing to apply the grandfathered rate.
     */
    public static function getLockedDiscount(int $userId): float
    {
        $ws = Database::queryOne(
            'SELECT discount_percent FROM `Workspace` WHERE userId = :uid ORDER BY createdAt DESC LIMIT 1',
            [':uid' => $userId]
        );
        return $ws ? (float) $ws['discount_percent'] : 0.0;
    }

    // ── Dashboard / History ───────────────────────────────────────────────────

    public static function getUserReferralDashboard(int $userId): ?array
    {
        $user = Database::queryOne(
            'SELECT id, walletBalance, referralCodeChanges FROM `User` WHERE id = :id',
            [':id' => $userId]
        );
        if (!$user)
            return null;

        $referredRows  = Database::query(
            'SELECT DISTINCT refereeId FROM `ReferralLog` WHERE referrerId = :id',
            [':id' => $userId]
        );
        $referredIds   = array_column($referredRows, 'refereeId');
        $totalReferrals = count($referredIds);

        $activeRefereesCount = 0;
        if (!empty($referredIds)) {
            $placeholders        = implode(',', array_fill(0, count($referredIds), '?'));
            $activeRefereesCount = Database::count(
                '"Workspace"',
                "userId IN ($placeholders) AND status = 'ACTIVE'",
                $referredIds
            );
        }

        $config     = ConfigService::getUserReferralConfig();
        $activeLink = ReferralLinkService::getActiveLink($userId, 'USER');
        $changesUsed = (int)($user['referralCodeChanges'] ?? 0);

        // Wallet breakdown: non-expired credits
        $now = date('Y-m-d H:i:s');
        $walletTx = Database::query(
            "SELECT amount, type, source, description, expires_at, createdAt
             FROM `WalletTransaction`
             WHERE userId = :uid
             ORDER BY createdAt DESC
             LIMIT 50",
            [':uid' => $userId]
        );

        return [
            'promoCode'                     => $activeLink['code'],
            'totalReferrals'                => $totalReferrals,
            'activeReferrals'               => $activeRefereesCount,
            'creditBalance'                 => (float) $user['walletBalance'],
            'walletTransactions'            => $walletTx,
            'isEligibleForDistributorNudge' => $totalReferrals >= (int) ($config['nudgeThreshold'] ?? 5),
            'changesUsed'                   => $changesUsed,
            'changesRemaining'              => max(0, 2 - $changesUsed),
        ];
    }

    public static function getUserReferralHistory(int $userId): array
    {
        $logs = Database::query(
            'SELECT rl.*, u.name AS refereeName, u.email AS refereeEmail, o.amount AS orderAmount
             FROM `ReferralLog` rl
             LEFT JOIN `User` u  ON u.id  = rl.refereeId
             LEFT JOIN `Order` o ON o.id = rl.orderId
             WHERE rl.referrerId = :id
             ORDER BY rl.createdAt DESC',
            [':id' => $userId]
        );

        return array_map(function (array $log): array {
            return [
                'id'         => $log['id'],
                'user'       => $log['refereeName'] ?? $log['refereeEmail'] ?? 'Unknown',
                'plan'       => '₹' . number_format((float) ($log['orderAmount'] ?? 0), 0, '.', ','),
                'date'       => date('d/m/Y', strtotime($log['createdAt'])),
                'commission' => '₹' . number_format((float) $log['commissionEarned'], 0, '.', ','),
                'status'     => $log['status'],
            ];
        }, $logs);
    }
}

<?php
/**
 * ReferralService — Mirrors src/services/ReferralService.ts
 *
 * Processes referral commissions after a payment is marked PAID.
 * Handles:
 *   - Initial purchase (credit referrer from promoCode)
 *   - Renewal (decaying rate for original referrer)
 *   - Self-referral and loop guards
 *   - Idempotency (one commission per order)
 */

declare(strict_types=1);

class ReferralService
{
    /**
     * Process a new PAID order — credit the referrer if applicable.
     *
     * @param int         $orderId           The PAID order ID
     * @param int         $purchasingUserId  The buyer's user ID
     * @param string|null $promoCode         The referral/promo code used at checkout
     */
    public static function processNewOrder(int $orderId, int $purchasingUserId, ?string $promoCode): void
    {
        Logger::info("[ReferralService] processNewOrder — orderId=$orderId, userId=$purchasingUserId, code=$promoCode");

        $order = Database::queryOne(
            'SELECT * FROM "Order" WHERE id = :id',
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

        // Idempotency: abort if already processed
        $existingLog = Database::queryOne(
            'SELECT id FROM "ReferralLog" WHERE orderId = :orderId',
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

        // Has this buyer ever been credited as a referee before? (Initial vs. Renewal)
        $priorReferralAsReferee = Database::queryOne(
            'SELECT * FROM "ReferralLog" WHERE refereeId = :uid ORDER BY createdAt ASC LIMIT 1',
            [':uid' => $purchasingUserId]
        );

        if (!$priorReferralAsReferee) {
            // ── INITIAL PURCHASE ─────────────────────────────────────────────
            if (!$promoCode) {
                Logger::info("[ReferralService] No promo code on initial purchase — no commission");
                return;
            }

            // Resolve referrer
            $referrer = null;
            $validLink = ReferralLinkService::validateCode($promoCode);

            if ($validLink && $validLink['role'] === 'USER') {
                $referrer = Database::queryOne(
                    'SELECT * FROM "User" WHERE id = :id',
                    [':id' => $validLink['referrerId']]
                );
            } else {
                // Legacy: referral code on User table
                $referrer = Database::queryOne(
                    'SELECT * FROM "User" WHERE referralCode = :code',
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
                'SELECT id FROM "ReferralLog" WHERE referrerId = :buyer AND refereeId = :referrer',
                [':buyer' => $purchasingUserId, ':referrer' => $referrer['id']]
            );
            if ($reverseReferral) {
                Logger::warn("[ReferralService] Referral loop blocked between {$referrer['id']} and $purchasingUserId");
                return;
            }

            // Calculate commission (always on full plan price)
            $globalConfig = ConfigService::getGlobalPlanConfig();
            $rate = (float) $globalConfig['referralCreditRate'];
            $plan = null;

            if ($order['planId']) {
                $plan = Database::queryOne(
                    'SELECT * FROM "Plan" WHERE id = :id',
                    [':id' => $order['planId']]
                );
            }

            $baseAmount = (float) $order['amount'];
            if ($plan) {
                $baseAmount = $plan['hasOverride'] ? (float) $plan['price'] : (float) $globalConfig['priceINR'];
            }

            $commission = round($baseAmount * $rate, 2);
            Logger::info("[ReferralService] Crediting referrer {$referrer['id']} with ₹$commission ({$rate}% of ₹$baseAmount)");

            // Atomic: log + credit wallet
            Database::beginTransaction();
            try {
                $now = date('Y-m-d H:i:s');
                Database::insert(
                    'INSERT INTO "ReferralLog"
                     (referrerId, refereeId, orderId, amount, referralYear, status, createdAt)
                     VALUES (:rr, :re, :oid, :amt, 1, \'VESTED\', :now)',
                    [
                        ':rr' => $referrer['id'],
                        ':re' => $purchasingUserId,
                        ':oid' => $orderId,
                        ':amt' => $commission,
                        ':now' => $now,
                    ]
                );
                Database::execute(
                    'UPDATE "User" SET walletBalance = walletBalance + :amt WHERE id = :id',
                    [':amt' => $commission, ':id' => $referrer['id']]
                );
                Database::commit();
            } catch (Throwable $e) {
                Database::rollback();
                Logger::error("[ReferralService] Transaction failed: " . $e->getMessage());
                return;
            }

            AuditService::log('REFERRAL_COMMISSION_CREDITED', $referrer['id'], null, [
                'orderId' => $orderId,
                'purchasingUserId' => $purchasingUserId,
                'commission' => $commission,
                'promoCode' => $promoCode,
            ]);
            Logger::info("[ReferralService] ✅ Commission ₹$commission credited to user {$referrer['id']}");

        } else {
            // ── RENEWAL ──────────────────────────────────────────────────────
            $decaySchedule = $userReferralConfig['decaySchedule'] ?? [0.05, 0.04, 0.03, 0.02, 0.01, 0];
            $disableDate = $userReferralConfig['disableReferralsFromDate'] ?? null;
            $existingOnDisable = $userReferralConfig['existingReferralsOnDisable'] ?? 'CONTINUE_DECAY';

            if ($disableDate && new DateTime() >= new DateTime($disableDate) && $existingOnDisable === 'STOP_IMMEDIATELY') {
                Logger::info('[ReferralService] Program disabled for existing referrals');
                return;
            }

            $originalReferrerId = (int) $priorReferralAsReferee['referrerId'];
            $prevLogsCount = Database::count(
                '"ReferralLog"',
                'referrerId = :rr AND refereeId = :re',
                [':rr' => $originalReferrerId, ':re' => $purchasingUserId]
            );

            $currentYear = $prevLogsCount + 1;
            if ($currentYear > count($decaySchedule)) {
                Logger::info("[ReferralService] Decay schedule exhausted at year $currentYear — no commission");
                return;
            }

            $rate = (float) ($decaySchedule[$currentYear - 1] ?? 0);
            if ($rate <= 0) {
                Logger::info("[ReferralService] Rate is 0 at year $currentYear — no commission");
                return;
            }

            $renewalPlan = $order['planId']
                ? Database::queryOne('SELECT price FROM "Plan" WHERE id = :id', [':id' => $order['planId']])
                : null;

            $renewalBase = $renewalPlan ? (float) $renewalPlan['price'] : (float) $order['amount'];
            $commission = round($renewalBase * $rate, 2);

            Logger::info("[ReferralService] Renewal year $currentYear: crediting $originalReferrerId with ₹$commission");

            Database::beginTransaction();
            try {
                $now = date('Y-m-d H:i:s');
                Database::insert(
                    'INSERT INTO "ReferralLog"
                     (referrerId, refereeId, orderId, amount, referralYear, status, createdAt)
                     VALUES (:rr, :re, :oid, :amt, :yr, \'VESTED\', :now)',
                    [
                        ':rr' => $originalReferrerId,
                        ':re' => $purchasingUserId,
                        ':oid' => $orderId,
                        ':amt' => $commission,
                        ':yr' => $currentYear,
                        ':now' => $now,
                    ]
                );
                Database::execute(
                    'UPDATE "User" SET walletBalance = walletBalance + :amt WHERE id = :id',
                    [':amt' => $commission, ':id' => $originalReferrerId]
                );
                Database::commit();
            } catch (Throwable $e) {
                Database::rollback();
                Logger::error("[ReferralService] Renewal transaction failed: " . $e->getMessage());
                return;
            }

            AuditService::log('REFERRAL_RENEWAL_COMMISSION_CREDITED', $originalReferrerId, null, [
                'orderId' => $orderId,
                'purchasingUserId' => $purchasingUserId,
                'commission' => $commission,
                'year' => $currentYear,
            ]);
            Logger::info("[ReferralService] ✅ Renewal commission ₹$commission credited to referrer $originalReferrerId");
        }
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

        // Unique referred users
        $referredRows = Database::query(
            'SELECT DISTINCT refereeId FROM "ReferralLog" WHERE referrerId = :id',
            [':id' => $userId]
        );
        $referredIds = array_column($referredRows, 'refereeId');
        $totalReferrals = count($referredIds);

        // Active workspaces among referred users
        $activeRefereesCount = 0;
        if (!empty($referredIds)) {
            $placeholders = implode(',', array_fill(0, count($referredIds), '?'));
            $activeRefereesCount = Database::count(
                '"Workspace"',
                "userId IN ($placeholders) AND status = 'ACTIVE'",
                $referredIds
            );
        }

        $config = ConfigService::getUserReferralConfig();
        $activeLink = ReferralLinkService::getActiveLink($userId, 'USER');

        $changesUsed = (int)($user['referralCodeChanges'] ?? 0);

        return [
            'promoCode'                     => $activeLink['code'],
            'totalReferrals'                => $totalReferrals,
            'activeReferrals'               => $activeRefereesCount,
            'creditBalance'                 => (float) $user['walletBalance'],
            'isEligibleForDistributorNudge' => $totalReferrals >= (int) ($config['nudgeThreshold'] ?? 5),
            'changesUsed'                   => $changesUsed,
            'changesRemaining'              => max(0, 2 - $changesUsed),
        ];
    }

    public static function getUserReferralHistory(int $userId): array
    {
        $logs = Database::query(
            'SELECT rl.*, u.name AS refereeName, u.email AS refereeEmail, o.amount AS orderAmount
             FROM "ReferralLog" rl
             LEFT JOIN "User" u ON u.id = rl.refereeId
             LEFT JOIN "Order" o ON o.id = rl.orderId
             WHERE rl.referrerId = :id
             ORDER BY rl.createdAt DESC',
            [':id' => $userId]
        );

        return array_map(function (array $log): array {
            return [
                'id' => $log['id'],
                'user' => $log['refereeName'] ?? $log['refereeEmail'] ?? 'Unknown',
                'plan' => '₹' . number_format((float) ($log['orderAmount'] ?? 0), 0, '.', ','),
                'date' => date('d/m/Y', strtotime($log['createdAt'])),
                'commission' => '₹' . number_format((float) $log['amount'], 0, '.', ','),
                'status' => $log['status'],
            ];
        }, $logs);
    }
}

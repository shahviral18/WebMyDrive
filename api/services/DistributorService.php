<?php
/**
 * DistributorService — Mirrors src/services/DistributorService.ts
 *
 * Handles:
 *  - Distributor onboarding
 *  - Sale processing with commission + tier upgrades + fee refunds (atomic)
 *  - Payout requests with balance guards
 *  - Sales history
 *  - Annual soft reset (tier demotion)
 */

declare(strict_types=1);

class DistributorService
{
    /**
     * Calculate the first annual reset date for a distributor based on their join date.
     * Resets always land on January 1. Joined in Jan–Jun → reset Jan 1 next year.
     * Joined Jul–Dec (second half) → first partial year is short; still reset Jan 1 next year.
     * This gives every distributor at most 12 months before their first year-end reset.
     */
    public static function getResetDate(\DateTimeImmutable $joinDate): \DateTimeImmutable
    {
        return $joinDate->modify('first day of January next year')->setTime(0, 0, 0);
    }

    /**
     * Onboard a user as a distributor (self-service).
     */
    public static function onboard(int $userId, string $email): array
    {
        $config = ConfigService::getDistributorConfig();
        if (empty($config['allowNewSignups'])) {
            throw new RuntimeException('Distributor signups are disabled.');
        }

        $existing = Database::queryOne(
            'SELECT id FROM "Distributor" WHERE userId = :uid',
            [':uid' => $userId]
        );
        if ($existing) {
            throw new RuntimeException('User is already a distributor.');
        }

        $now = new \DateTimeImmutable();
        $resetDate = self::getResetDate($now);
        $nowStr = $now->format('Y-m-d H:i:s');
        $resetStr = $resetDate->format('Y-m-d H:i:s');
        $tierName = $config['tiers'][0]['name'] ?? 'Starter';

        $id = Database::insert(
            'INSERT INTO "Distributor"
             (userId, email, tier, joinDate, resetDate, status, walletBalance,
              revenueThisYear, newOrdersRevenueThisYear, renewalRevenueThisYear, createdAt, updatedAt)
             VALUES (:uid, :email, :tier, :joined, :reset, \'ACTIVE\', 0, 0, 0, 0, :now1, :now2)',
            [
                ':uid' => $userId,
                ':email' => $email,
                ':tier' => $tierName,
                ':joined' => $nowStr,
                ':reset' => $resetStr,
                ':now1' => $nowStr, ':now2' => $nowStr,
            ]
        );

        AuditService::log('DISTRIBUTOR_ONBOARDED', $userId, null, ['email' => $email]);
        return Database::queryOne('SELECT * FROM "Distributor" WHERE id = :id', [':id' => $id]) ?? [];
    }

    /**
     * Resolve the highest tier a distributor qualifies for given their revenue counters.
     * Requires BOTH thresholds to be met to qualify for a tier above Starter.
     */
    private static function resolveQualifyingTier(array $tiers, float $newOrdersRev, float $renewalRev): string
    {
        if (empty($tiers)) {
            return 'Starter';
        }
        // Sort descending by newOrdersThreshold so we find the highest qualifying tier first
        usort($tiers, fn($a, $b) => $b['newOrdersThreshold'] <=> $a['newOrdersThreshold']);
        foreach ($tiers as $t) {
            if ($newOrdersRev >= (float) $t['newOrdersThreshold'] && $renewalRev >= (float) $t['renewalThreshold']) {
                return $t['name'];
            }
        }
        return $tiers[count($tiers) - 1]['name']; // fallback to lowest tier
    }

    /**
     * Process a commission sale when a distributor's customer places a PAID order.
     * Commission = flat tier rate (no decay). Tracks new-order vs renewal revenue separately.
     * Mid-year upgrade fires immediately when BOTH thresholds exceeded.
     * Starter tier earns 0% commission — sale is still recorded for threshold tracking.
     *
     * @param bool $isRenewal true if this is a renewal order, false for new orders
     */
    public static function processSale(
        int $distributorId,
        int $purchasingUserId,
        int $orderId,
        float $amount,
        bool $isRenewal = false
    ): void {
        $dist = Database::queryOne(
            'SELECT * FROM "Distributor" WHERE id = :id',
            [':id' => $distributorId]
        );

        if (!$dist || $dist['status'] !== 'ACTIVE') {
            Logger::warn("[DistributorService] Skipping sale — distributor $distributorId not active");
            return;
        }

        // Duplicate guard
        $existingSale = Database::queryOne(
            'SELECT id FROM "DistributorSale" WHERE orderId = :oid',
            [':oid' => $orderId]
        );
        if ($existingSale) {
            Logger::warn("[DistributorService] Sale for order $orderId already recorded");
            return;
        }

        $config = ConfigService::getDistributorConfig();

        // Check if distributor program is globally disabled
        if (!empty($config['disableProgramFromDate'])) {
            $disableDate = new \DateTimeImmutable($config['disableProgramFromDate']);
            $policy = $config['existingOnDisable'] ?? 'CONTINUE';
            if (new \DateTimeImmutable() >= $disableDate && in_array($policy, ['TERMINATE', 'FREEZE'], true)) {
                return;
            }
        }

        // Find current tier config for commission rate
        $currentTierConfig = null;
        foreach ($config['tiers'] as $tier) {
            if ($tier['name'] === $dist['tier']) {
                $currentTierConfig = $tier;
                break;
            }
        }
        if (!$currentTierConfig) {
            $currentTierConfig = $config['tiers'][0]; // fallback to Starter
        }

        $commissionRate = (float) ($currentTierConfig['rate'] ?? 0.00);
        $commission = round($amount * $commissionRate, 2);

        // Update revenue counters prospectively to check for tier upgrade
        $newOrdersRev = (float) ($dist['newOrdersRevenueThisYear'] ?? 0);
        $renewalRev   = (float) ($dist['renewalRevenueThisYear'] ?? 0);
        $totalRev     = (float) $dist['revenueThisYear'];

        if ($isRenewal) {
            $renewalRev += $amount;
        } else {
            $newOrdersRev += $amount;
        }
        $totalRev += $amount;

        // Mid-year upgrade: check if BOTH thresholds are now exceeded
        $newTier = self::resolveQualifyingTier($config['tiers'], $newOrdersRev, $renewalRev);
        $tierUpgraded = $newTier !== $dist['tier'];

        $now = date('Y-m-d H:i:s');

        // Atomic transaction
        Database::beginTransaction();
        try {
            Database::insert(
                'INSERT INTO "DistributorSale"
                 (distributorId, purchasingUserId, orderId, amount, commissionRate, commissionEarned, isRenewal, status, createdAt)
                 VALUES (:did, :uid, :oid, :amt, :rate, :comm, :ren, \'COMPLETED\', :now)',
                [
                    ':did'  => $distributorId,
                    ':uid'  => $purchasingUserId,
                    ':oid'  => $orderId,
                    ':amt'  => $amount,
                    ':rate' => $commissionRate,
                    ':comm' => $commission,
                    ':ren'  => $isRenewal ? 1 : 0,
                    ':now'  => $now,
                ]
            );

            // Optimistic concurrency guard
            $rows = Database::execute(
                'UPDATE "Distributor"
                 SET walletBalance              = walletBalance + :wi,
                     revenueThisYear            = revenueThisYear + :amt,
                     newOrdersRevenueThisYear   = newOrdersRevenueThisYear + :new_rev,
                     renewalRevenueThisYear     = renewalRevenueThisYear + :ren_rev,
                     tier                       = :tier,
                     updatedAt                  = :now
                 WHERE id = :id AND ROUND(revenueThisYear, 2) = :prev_rev',
                [
                    ':wi'       => $commission,
                    ':amt'      => $amount,
                    ':new_rev'  => $isRenewal ? 0 : $amount,
                    ':ren_rev'  => $isRenewal ? $amount : 0,
                    ':tier'     => $newTier,
                    ':now'      => $now,
                    ':id'       => $distributorId,
                    ':prev_rev' => round((float) $dist['revenueThisYear'], 2),
                ]
            );

            if ($rows === 0) {
                throw new RuntimeException('Concurrent modification of distributor revenue detected. Please retry.');
            }

            if ($commission > 0) {
                $saleType = $isRenewal ? 'Renewal' : 'New order';
                Database::insert(
                    'INSERT INTO "DistributorWalletTx"
                     (distributorId, amount, type, status, description, createdAt)
                     VALUES (:did, :amt, \'COMMISSION\', \'COMPLETED\', :desc, :now)',
                    [
                        ':did'  => $distributorId,
                        ':amt'  => $commission,
                        ':desc' => "$saleType commission for user #$purchasingUserId | Order #$orderId | {$currentTierConfig['name']} tier ({$commissionRate}%)",
                        ':now'  => $now,
                    ]
                );
            }

            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            Logger::error("[DistributorService] processSale failed: " . $e->getMessage());
            throw $e;
        }

        AuditService::log('DISTRIBUTOR_COMMISSION_CREDITED', $distributorId, null, [
            'orderId'        => $orderId,
            'purchasingUserId' => $purchasingUserId,
            'commission'     => $commission,
            'commissionRate' => $commissionRate,
            'isRenewal'      => $isRenewal,
            'tierUpgraded'   => $tierUpgraded,
            'newTier'        => $newTier,
        ]);
    }

    /**
     * Year-end reset: reset revenue counters, downgrade tier if thresholds not met.
     * Called by a scheduled job at each distributor's resetDate.
     * Rule: if EITHER new-orders OR renewal threshold not met → downgrade to highest qualifying tier.
     */
    public static function processAnnualReset(int $distributorId): void
    {
        $dist = Database::queryOne(
            'SELECT * FROM "Distributor" WHERE id = :id',
            [':id' => $distributorId]
        );
        if (!$dist || $dist['status'] !== 'ACTIVE') {
            return;
        }

        $config = ConfigService::getDistributorConfig();
        $newOrdersRev = (float) ($dist['newOrdersRevenueThisYear'] ?? 0);
        $renewalRev   = (float) ($dist['renewalRevenueThisYear'] ?? 0);

        // Find highest tier where BOTH thresholds were met during the year
        $qualifyingTier = self::resolveQualifyingTier($config['tiers'], $newOrdersRev, $renewalRev);

        $now = new \DateTimeImmutable();
        $nextResetDate = $now->modify('+1 year')->modify('first day of January');
        $nowStr = $now->format('Y-m-d H:i:s');

        Database::execute(
            'UPDATE "Distributor"
             SET tier                     = :tier,
                 revenueThisYear          = 0,
                 newOrdersRevenueThisYear = 0,
                 renewalRevenueThisYear   = 0,
                 resetDate                = :reset,
                 updatedAt               = :now
             WHERE id = :id',
            [
                ':tier'  => $qualifyingTier,
                ':reset' => $nextResetDate->format('Y-m-d H:i:s'),
                ':now'   => $nowStr,
                ':id'    => $distributorId,
            ]
        );

        AuditService::log('DISTRIBUTOR_ANNUAL_RESET', $distributorId, null, [
            'previousTier'     => $dist['tier'],
            'newTier'          => $qualifyingTier,
            'newOrdersRevenue' => $newOrdersRev,
            'renewalRevenue'   => $renewalRev,
        ]);
    }

    /**
     * Permanently deactivate a distributor.
     * If deactivationWalletForfeit is enabled, forfeits the minimum balance (Rs 2,000) to WebMyDrive.
     */
    public static function deactivate(int $distributorId): void
    {
        $dist = Database::queryOne(
            'SELECT * FROM "Distributor" WHERE id = :id',
            [':id' => $distributorId]
        );
        if (!$dist) {
            throw new RuntimeException('Distributor not found.');
        }

        $walletConfig = ConfigService::getWalletConfig();
        $minBalance   = (float) ($walletConfig['distributorMinBalance'] ?? 2000);
        $forfeit      = (bool) ($walletConfig['deactivationWalletForfeit'] ?? true);

        $now = date('Y-m-d H:i:s');

        Database::beginTransaction();
        try {
            if ($forfeit && (float) $dist['walletBalance'] > 0) {
                $forfeitAmount = min((float) $dist['walletBalance'], $minBalance);
                Database::execute(
                    'UPDATE "Distributor" SET walletBalance = walletBalance - :amt, updatedAt = :now WHERE id = :id',
                    [':amt' => $forfeitAmount, ':now' => $now, ':id' => $distributorId]
                );
                Database::insert(
                    'INSERT INTO "DistributorWalletTx"
                     (distributorId, amount, type, status, description, createdAt)
                     VALUES (:did, :amt, \'FORFEIT\', \'COMPLETED\', :desc, :now)',
                    [
                        ':did'  => $distributorId,
                        ':amt'  => -$forfeitAmount,
                        ':desc' => "Deactivation: minimum balance forfeited to WebMyDrive",
                        ':now'  => $now,
                    ]
                );
            }

            Database::execute(
                'UPDATE "Distributor" SET status = \'INACTIVE\', updatedAt = :now WHERE id = :id',
                [':now' => $now, ':id' => $distributorId]
            );

            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            throw $e;
        }

        AuditService::log('DISTRIBUTOR_DEACTIVATED', $distributorId, null, [
            'forfeit' => $forfeit,
        ]);
    }

    /**
     * Request a payout from distributor wallet.
     * Enforces minimum balance retention and payout threshold.
     */
    public static function requestPayout(int $distributorId, float $reqAmount, ?string $invoicePath = null): array
    {
        if ($reqAmount <= 0) {
            throw new RuntimeException('Invalid payout amount.');
        }

        $walletConfig = ConfigService::getWalletConfig();
        $dist = Database::queryOne(
            'SELECT * FROM "Distributor" WHERE id = :id',
            [':id' => $distributorId]
        );

        if (!$dist || $dist['status'] !== 'ACTIVE') {
            throw new RuntimeException('Invalid distributor.');
        }

        $minBalance = (float) ($walletConfig['distributorMinBalance'] ?? 2000);
        $threshold = (float) ($walletConfig['payoutThreshold'] ?? 5000);
        $available = (float) $dist['walletBalance'] - $minBalance;

        if ($available < $threshold) {
            throw new RuntimeException(
                "Available payout (Rs " . number_format($available, 2) . ") must be at least Rs $threshold. " .
                "Minimum balance of Rs $minBalance is retained."
            );
        }

        if ($reqAmount > $available) {
            throw new RuntimeException(
                "Requested amount Rs $reqAmount exceeds available payout Rs " . number_format($available, 2) . "."
            );
        }

        $now = date('Y-m-d H:i:s');

        Database::beginTransaction();
        try {
            $rows = Database::execute(
                'UPDATE "Distributor"
                 SET walletBalance = walletBalance - :amt, updatedAt = :now
                 WHERE id = :id AND walletBalance >= :minRequired',
                [':amt' => $reqAmount, ':now' => $now, ':id' => $distributorId, ':minRequired' => $reqAmount + $minBalance]
            );

            if ($rows === 0) {
                throw new RuntimeException('Payout failed: insufficient balance or concurrent modification.');
            }

            $txId = Database::insert(
                'INSERT INTO "DistributorWalletTx"
                 (distributorId, amount, type, status, description, invoicePath, createdAt)
                 VALUES (:did, :amt, \'PAYOUT\', \'PENDING\', :desc, :inv, :now)',
                [
                    ':did' => $distributorId,
                    ':amt' => -$reqAmount,
                    ':desc' => "Payout request — Rs $reqAmount",
                    ':inv' => $invoicePath,
                    ':now' => $now,
                ]
            );

            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            throw $e;
        }

        return ['success' => true, 'amountPaid' => $reqAmount, 'txId' => $txId ?? null];
    }

    /**
     * Return sales history for a distributor.
     */
    public static function getSalesHistory(int $distributorId): array
    {
        $sales = Database::query(
            'SELECT ds.*, u.name AS userName, u.email AS userEmail, o.amount AS orderAmount
             FROM "DistributorSale" ds
             JOIN "Order" o ON o.id = ds.orderId
             LEFT JOIN "User" u ON u.id = ds.purchasingUserId
             WHERE ds.distributorId = :did
             ORDER BY ds.createdAt DESC',
            [':did' => $distributorId]
        );

        return array_map(fn(array $s) => [
            'id' => $s['id'],
            'user' => $s['userName'] ?? $s['userEmail'] ?? 'Unknown',
            'date' => date('d/m/Y', strtotime($s['createdAt'])),
            'amount' => (float) $s['amount'],
            'commission' => (float) $s['commissionEarned'],
            'rate' => number_format((float) $s['commissionRate'] * 100, 1) . '%',
        ], $sales);
    }
}

<?php
/**
 * DistributorService — Dual-threshold tier model, flat commission, no decay.
 *
 * Tiers upgrade mid-year when BOTH newOrdersThreshold AND renewalThreshold are met.
 * At year-end, tier resets to the highest tier where both thresholds were met.
 * Starter tier always earns 0% commission.
 */

declare(strict_types=1);

class DistributorService
{
    /**
     * Calculate the annual reset date for a distributor based on their join date.
     * Rule: if joined after the 15th, reset starts next month; otherwise this month.
     */
    public static function getResetDate(\DateTimeImmutable $joinDate): \DateTimeImmutable
    {
        $day = (int) $joinDate->format('j');
        if ($day >= 16) {
            return $joinDate->modify('+1 month')->modify('first day of this month');
        }
        return $joinDate->modify('first day of next year');
    }

    /**
     * Resolve the highest qualifying tier given current new-order and renewal revenue.
     * A distributor qualifies for a tier only if BOTH thresholds are met.
     * Falls back to the first tier (Starter) if none match.
     */
    private static function resolveQualifyingTier(array $tiers, float $newOrders, float $renewals): string
    {
        usort($tiers, fn($a, $b) => $b['newOrdersThreshold'] <=> $a['newOrdersThreshold']);
        foreach ($tiers as $tier) {
            $noThreshold = (float) ($tier['newOrdersThreshold'] ?? 0);
            $rnThreshold = (float) ($tier['renewalThreshold'] ?? 0);
            if ($newOrders >= $noThreshold && $renewals >= $rnThreshold) {
                return $tier['name'];
            }
        }
        return $tiers[count($tiers) - 1]['name'] ?? 'Starter';
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
              revenueThisYear, newOrdersRevenueThisYear, renewalRevenueThisYear,
              createdAt, updatedAt)
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
     * Process a commission sale when a distributor's customer places a PAID order.
     * Fully atomic: sale record + wallet credit + tier upgrade.
     * Starter (rate = 0) earns nothing — sale is silently skipped.
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

        // Resolve current tier rate
        $currentTierConfig = null;
        foreach ($config['tiers'] as $tier) {
            if ($tier['name'] === $dist['tier']) {
                $currentTierConfig = $tier;
                break;
            }
        }
        if (!$currentTierConfig) {
            Logger::warn("[DistributorService] Tier '{$dist['tier']}' not found in config for distributor $distributorId");
            return;
        }

        $rate = (float) ($currentTierConfig['rate'] ?? 0);

        // Starter (rate = 0) earns nothing
        if ($rate <= 0) {
            Logger::info("[DistributorService] Skipping sale — distributor $distributorId is on Starter (0% commission)");
            return;
        }

        $commission = round($amount * $rate, 2);

        // Prospective revenue tracking and tier upgrade
        $newOrdersRev = (float) $dist['newOrdersRevenueThisYear'] + ($isRenewal ? 0.0 : $amount);
        $renewalRev   = (float) $dist['renewalRevenueThisYear']   + ($isRenewal ? $amount : 0.0);
        $newTier = self::resolveQualifyingTier($config['tiers'], $newOrdersRev, $renewalRev);

        $now = date('Y-m-d H:i:s');

        // Atomic transaction
        Database::beginTransaction();
        try {
            Database::insert(
                'INSERT INTO "DistributorSale"
                 (distributorId, purchasingUserId, orderId, amount, commissionRate,
                  commissionEarned, isRenewal, status, createdAt)
                 VALUES (:did, :uid, :oid, :amt, :rate, :comm, :renew, \'COMPLETED\', :now)',
                [
                    ':did'   => $distributorId,
                    ':uid'   => $purchasingUserId,
                    ':oid'   => $orderId,
                    ':amt'   => $amount,
                    ':rate'  => $rate,
                    ':comm'  => $commission,
                    ':renew' => $isRenewal ? 1 : 0,
                    ':now'   => $now,
                ]
            );

            // Optimistic concurrency guard
            $prevNewOrders = round((float) $dist['newOrdersRevenueThisYear'], 2);
            $prevRenewals  = round((float) $dist['renewalRevenueThisYear'], 2);

            $rows = Database::execute(
                'UPDATE "Distributor"
                 SET walletBalance              = walletBalance + :wi,
                     revenueThisYear            = revenueThisYear + :amt,
                     newOrdersRevenueThisYear   = newOrdersRevenueThisYear + :no_inc,
                     renewalRevenueThisYear     = renewalRevenueThisYear + :rn_inc,
                     tier                       = :tier,
                     updatedAt                  = :now
                 WHERE id = :id
                   AND ROUND(newOrdersRevenueThisYear, 2) = :prev_no
                   AND ROUND(renewalRevenueThisYear, 2)   = :prev_rn',
                [
                    ':wi'      => $commission,
                    ':amt'     => $amount,
                    ':no_inc'  => $isRenewal ? 0.0 : $amount,
                    ':rn_inc'  => $isRenewal ? $amount : 0.0,
                    ':tier'    => $newTier,
                    ':now'     => $now,
                    ':id'      => $distributorId,
                    ':prev_no' => $prevNewOrders,
                    ':prev_rn' => $prevRenewals,
                ]
            );

            if ($rows === 0) {
                throw new RuntimeException('Concurrent modification of distributor revenue detected. Please retry.');
            }

            Database::insert(
                'INSERT INTO "DistributorWalletTx"
                 (distributorId, amount, type, status, description, createdAt)
                 VALUES (:did, :amt, \'COMMISSION\', \'COMPLETED\', :desc, :now)',
                [
                    ':did'  => $distributorId,
                    ':amt'  => $commission,
                    ':desc' => ($isRenewal ? "Renewal" : "New order") . " commission | Order #$orderId | User #$purchasingUserId",
                    ':now'  => $now,
                ]
            );

            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            Logger::error("[DistributorService] processSale failed: " . $e->getMessage());
            throw $e;
        }

        AuditService::log('DISTRIBUTOR_COMMISSION_CREDITED', $distributorId, null, [
            'orderId'          => $orderId,
            'purchasingUserId' => $purchasingUserId,
            'commission'       => $commission,
            'rate'             => $rate,
            'isRenewal'        => $isRenewal,
            'tierBefore'       => $dist['tier'],
            'tierAfter'        => $newTier,
        ]);
    }

    /**
     * Year-end reset: resolve new tier based on full-year revenue, zero counters.
     */
    public static function processAnnualReset(int $distributorId): array
    {
        $dist = Database::queryOne(
            'SELECT * FROM "Distributor" WHERE id = :id',
            [':id' => $distributorId]
        );
        if (!$dist) {
            return ['success' => false, 'error' => 'Distributor not found'];
        }

        $config = ConfigService::getDistributorConfig();
        $newTier = self::resolveQualifyingTier(
            $config['tiers'],
            (float) $dist['newOrdersRevenueThisYear'],
            (float) $dist['renewalRevenueThisYear']
        );

        $nextReset = date('Y-01-01', strtotime('+1 year'));
        $now = date('Y-m-d H:i:s');

        Database::execute(
            'UPDATE "Distributor"
             SET tier                     = :tier,
                 revenueThisYear          = 0,
                 newOrdersRevenueThisYear = 0,
                 renewalRevenueThisYear   = 0,
                 resetDate                = :reset,
                 updatedAt                = :now
             WHERE id = :id',
            [':tier' => $newTier, ':reset' => $nextReset, ':now' => $now, ':id' => $distributorId]
        );

        AuditService::log('DISTRIBUTOR_ANNUAL_RESET', $distributorId, null, [
            'tierBefore' => $dist['tier'],
            'tierAfter'  => $newTier,
        ]);

        return ['success' => true, 'newTier' => $newTier];
    }

    /**
     * Deactivate a distributor. If deactivationWalletForfeit is enabled,
     * forfeits the minimum balance (up to Rs 2,000) before setting INACTIVE.
     */
    public static function deactivate(int $distributorId, int $adminId): array
    {
        $dist = Database::queryOne(
            'SELECT * FROM "Distributor" WHERE id = :id',
            [':id' => $distributorId]
        );
        if (!$dist) {
            return ['success' => false, 'error' => 'Distributor not found'];
        }

        $walletCfg = ConfigService::getWalletConfig();
        $doForfeit = !empty($walletCfg['deactivationWalletForfeit']);
        $forfeited = 0.0;
        $now = date('Y-m-d H:i:s');

        Database::beginTransaction();
        try {
            if ($doForfeit && (float) $dist['walletBalance'] > 0) {
                $minBal = (float) ($walletCfg['distributorMinBalance'] ?? 2000);
                $forfeited = min((float) $dist['walletBalance'], $minBal);
                Database::execute(
                    'UPDATE "Distributor" SET walletBalance = walletBalance - :f, updatedAt = :now WHERE id = :id',
                    [':f' => $forfeited, ':now' => $now, ':id' => $distributorId]
                );
                Database::insert(
                    'INSERT INTO "DistributorWalletTx"
                     (distributorId, amount, type, status, description, createdAt)
                     VALUES (:did, :amt, \'FORFEIT\', \'COMPLETED\', \'Forfeited on permanent deactivation\', :now)',
                    [':did' => $distributorId, ':amt' => $forfeited, ':now' => $now]
                );
            }

            Database::execute(
                'UPDATE "Distributor" SET status = \'INACTIVE\', updatedAt = :now WHERE id = :id',
                [':now' => $now, ':id' => $distributorId]
            );

            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            Logger::error("[DistributorService] deactivate failed: " . $e->getMessage());
            throw $e;
        }

        AuditService::log('DISTRIBUTOR_DEACTIVATED', $adminId, null, [
            'distributorId' => $distributorId,
            'forfeited'     => $forfeited,
        ]);

        return ['success' => true, 'forfeited' => $forfeited];
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
                    ':did'  => $distributorId,
                    ':amt'  => -$reqAmount,
                    ':desc' => "Payout request — Rs $reqAmount",
                    ':inv'  => $invoicePath,
                    ':now'  => $now,
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
            'id'         => $s['id'],
            'user'       => $s['userName'] ?? $s['userEmail'] ?? 'Unknown',
            'date'       => date('d/m/Y', strtotime($s['createdAt'])),
            'amount'     => (float) $s['amount'],
            'commission' => (float) $s['commissionEarned'],
            'rate'       => number_format((float) $s['commissionRate'] * 100, 1) . '%',
            'isRenewal'  => !empty($s['isRenewal']),
        ], $sales);
    }
}

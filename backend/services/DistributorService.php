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
             (userId, email, tier, joinDate, resetDate, status, walletBalance, revenueThisYear, createdAt, updatedAt)
             VALUES (:uid, :email, :tier, :joined, :reset, \'ACTIVE\', 0, 0, :now1, :now2)',
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
     * Fully atomic: sale record + wallet credit + tier upgrade + optional fee refund.
     */
    public static function processSale(
        int $distributorId,
        int $purchasingUserId,
        int $orderId,
        float $amount
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

        // Determine sale year for decay multiplier
        $priorSalesCount = Database::count(
            '"DistributorSale"',
            'purchasingUserId = :uid AND distributorId = :did',
            [':uid' => $purchasingUserId, ':did' => $distributorId]
        );
        $currentYearOfSale = $priorSalesCount + 1;

        $decayMultipliers = $config['decayMultipliers'] ?? [1.0, 0.8, 0.6, 0.4, 0.2, 0];
        if ($currentYearOfSale > count($decayMultipliers))
            return;

        $multiplier = (float) ($decayMultipliers[$currentYearOfSale - 1] ?? 0);
        if ($multiplier <= 0)
            return;

        $currentTierConfig = null;
        foreach ($config['tiers'] as $tier) {
            if ($tier['name'] === $dist['tier']) {
                $currentTierConfig = $tier;
                break;
            }
        }
        if (!$currentTierConfig)
            return;

        $globalConfig = ConfigService::getGlobalPlanConfig();

        $order = Database::queryOne('SELECT * FROM "Order" WHERE id = :id', [':id' => $orderId]);
        $plan = ($order && $order['planId'])
            ? Database::queryOne('SELECT * FROM "Plan" WHERE id = :id', [':id' => $order['planId']])
            : null;

        $baseAmount = $amount;
        if ($plan) {
            $baseAmount = $plan['hasOverride'] ? (float) $plan['price'] : (float) $globalConfig['priceINR'];
        }

        $baseRate = (float) $globalConfig['distributorCreditRate'];
        $finalRate = round($baseRate * $multiplier, 6);
        $commission = round($baseAmount * $finalRate, 2);

        // Prospective tier upgrade based on new revenue
        $newRevenue = (float) $dist['revenueThisYear'] + $amount;
        $tiersDesc = $config['tiers'];
        usort($tiersDesc, fn($a, $b) => $b['threshold'] <=> $a['threshold']);
        $newTier = $dist['tier'];
        foreach ($tiersDesc as $t) {
            if ($newRevenue >= (float) $t['threshold']) {
                $newTier = $t['name'];
                break;
            }
        }

        $tierUpgraded = $newTier !== $dist['tier'];
        $feeRefundNeeded = $tierUpgraded && $newTier === ($config['feeRefundTier'] ?? 'Silver');
        $walletIncrement = $feeRefundNeeded ? $commission + (float) ($config['annualFee'] ?? 0) : $commission;

        $now = date('Y-m-d H:i:s');

        // Atomic transaction
        Database::beginTransaction();
        try {
            Database::insert(
                'INSERT INTO "DistributorSale"
                 (distributorId, purchasingUserId, orderId, amount, commissionRate, commissionEarned, saleYear, status, createdAt)
                 VALUES (:did, :uid, :oid, :amt, :rate, :comm, :yr, \'COMPLETED\', :now)',
                [
                    ':did' => $distributorId,
                    ':uid' => $purchasingUserId,
                    ':oid' => $orderId,
                    ':amt' => $amount,
                    ':rate' => $finalRate,
                    ':comm' => $commission,
                    ':yr' => $currentYearOfSale,
                    ':now' => $now,
                ]
            );

            // Optimistic concurrency guard: only proceed if revenueThisYear unchanged
            $rows = Database::execute(
                'UPDATE "Distributor"
                 SET walletBalance = walletBalance + :wi,
                     revenueThisYear = revenueThisYear + :amt,
                     tier = :tier,
                     updatedAt = :now
                 WHERE id = :id AND ROUND(revenueThisYear, 2) = :prev_rev',
                [
                    ':wi' => $walletIncrement,
                    ':amt' => $amount,
                    ':tier' => $newTier,
                    ':now' => $now,
                    ':id' => $distributorId,
                    ':prev_rev' => round((float) $dist['revenueThisYear'], 2),
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
                    ':did' => $distributorId,
                    ':amt' => $commission,
                    ':desc' => "Sale Year $currentYearOfSale for user #$purchasingUserId | Order #$orderId",
                    ':now' => $now,
                ]
            );

            if ($feeRefundNeeded) {
                $annualFee = (float) ($config['annualFee'] ?? 0);
                Database::insert(
                    'INSERT INTO "DistributorWalletTx"
                     (distributorId, amount, type, status, description, createdAt)
                     VALUES (:did, :amt, \'REFUND_FEE\', \'COMPLETED\', :desc, :now)',
                    [
                        ':did' => $distributorId,
                        ':amt' => $annualFee,
                        ':desc' => "Tier upgrade to $newTier — annual fee refund",
                        ':now' => $now,
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
            'orderId' => $orderId,
            'purchasingUserId' => $purchasingUserId,
            'commission' => $commission,
            'finalRate' => $finalRate,
            'saleYear' => $currentYearOfSale,
            'tierUpgraded' => $tierUpgraded,
            'newTier' => $newTier,
            'feeRefundNeeded' => $feeRefundNeeded,
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

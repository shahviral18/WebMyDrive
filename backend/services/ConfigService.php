<?php
/**
 * ConfigService — Mirrors src/services/ConfigService.ts
 *
 * Reads/writes typed config from the AdminConfig table (key/value JSON store).
 * Provides defaults for: GLOBAL_PLAN_SETTINGS, USER_REFERRAL_SETTINGS,
 *                         DISTRIBUTOR_SETTINGS, WALLET_SETTINGS
 */

declare(strict_types=1);

class ConfigService
{
    // ── Defaults (mirror TypeScript DEFAULT_* constants) ─────────────────────

    public static function defaultGlobalPlanConfig(): array
    {
        return [
            'priceINR' => 499,
            'storageGB' => 500,
            'validityMonths' => 1,
            'referralCreditRate' => 0.05,
            'distributorCreditRate' => 0.10,
            'customerDiscountRate' => 0.025,
        ];
    }

    public static function defaultUserReferralConfig(): array
    {
        return [
            'planDiscountSlabs' => [
                'Basic'           => ['referredDiscount' => 0.10, 'referrerCredit' => 0.05],
                'Professional'    => ['referredDiscount' => 0.20, 'referrerCredit' => 0.05],
                'Premium'         => ['referredDiscount' => 0.40, 'referrerCredit' => 0.075],
                'Enterprise'      => ['referredDiscount' => 0.40, 'referrerCredit' => 0.075],
                'Enterprise Plus' => ['referredDiscount' => 0.10, 'referrerCredit' => 0.05],
            ],
            'paidAdsDiscountRate' => 0.20,
            'creditExpiryMonths' => 24,
            'nudgeThreshold' => 5,
            'allowNewReferrals' => true,
            'disableReferralsFromDate' => null,
            'existingReferralsOnDisable' => 'CONTINUE_DECAY',
        ];
    }

    public static function defaultDistributorConfig(): array
    {
        return [
            'tiers' => [
                ['name' => 'Starter',  'newOrdersThreshold' => 0,      'renewalThreshold' => 0,      'rate' => 0],
                ['name' => 'Silver',   'newOrdersThreshold' => 50000,   'renewalThreshold' => 30000,  'rate' => 0.10],
                ['name' => 'Gold',     'newOrdersThreshold' => 100000,  'renewalThreshold' => 75000,  'rate' => 0.15],
                ['name' => 'Platinum', 'newOrdersThreshold' => 200000,  'renewalThreshold' => 150000, 'rate' => 0.20],
            ],
            'allowNewSignups' => true,
            'disableProgramFromDate' => null,
            'existingOnDisable' => 'CONTINUE',
            'promoDiscounts' => [
                'Basic'           => 10,
                'Professional'    => 20,
                'Premium'         => 40,
                'Enterprise'      => 40,
                'Enterprise Plus' => 0,
            ],
            'payoutConfig' => [
                'tdsEnabled'      => false,
                'tdsRate'         => 10,
                'minPayoutAmount' => 5000,
            ],
        ];
    }

    public static function defaultWalletConfig(): array
    {
        return [
            'distributorMinBalance' => 2000,
            'payoutThreshold' => 5000,
            'deactivationWalletForfeit' => true,
        ];
    }

    /**
     * Returns ['referredDiscount' => float, 'referrerCredit' => float] for a plan name.
     * Falls back to global referredDiscountRate / referrerCreditRate if plan not in slabs.
     */
    public static function getPlanReferralSlab(string $planName): array
    {
        $config = self::getUserReferralConfig();
        $slabs  = $config['planDiscountSlabs'] ?? [];
        if (isset($slabs[$planName])) {
            return [
                'referredDiscount' => (float) $slabs[$planName]['referredDiscount'],
                'referrerCredit'   => (float) $slabs[$planName]['referrerCredit'],
            ];
        }
        return [
            'referredDiscount' => (float) ($config['referredDiscountRate'] ?? 0.10),
            'referrerCredit'   => (float) ($config['referrerCreditRate']   ?? 0.05),
        ];
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    public static function getConfig(string $key, array $default): array
    {
        $row = Database::queryOne(
            'SELECT value FROM "AdminConfig" WHERE `key` = :key',
            [':key' => $key]
        );
        if (!$row)
            return $default;
        $parsed = json_decode($row['value'], true);
        return is_array($parsed) ? $parsed : $default;
    }

    public static function getGlobalPlanConfig(): array
    {
        return self::getConfig('GLOBAL_PLAN_SETTINGS', self::defaultGlobalPlanConfig());
    }

    public static function getUserReferralConfig(): array
    {
        return self::getConfig('USER_REFERRAL_SETTINGS', self::defaultUserReferralConfig());
    }

    public static function getDistributorConfig(): array
    {
        return self::getConfig('DISTRIBUTOR_SETTINGS', self::defaultDistributorConfig());
    }

    public static function getWalletConfig(): array
    {
        return self::getConfig('WALLET_SETTINGS', self::defaultWalletConfig());
    }

    public static function defaultRolePermissions(): array
    {
        return [
            'ADMIN' => [
                'dashboard'               => 'full',
                'users'                   => 'limited',
                'googleUsers'             => 'limited',
                'plans'                   => 'read',
                'orders'                  => 'read',
                'referralEngine'          => 'read',
                'vouchers'                => 'full',
                'distributors'            => 'limited',
                'distributorApplications' => 'full',
                'distributorPayouts'      => 'full',
                'importUsers'             => 'limited',
                'assignDistributor'       => 'full',
                'auditLogs'               => 'read',
                'settings'                => 'none',
                'changePlan'              => 'none',
                'invoices'                => 'full',
            ],
        ];
    }

    public static function getRolePermissions(): array
    {
        return self::getConfig('ROLE_PERMISSIONS', self::defaultRolePermissions());
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    public static function setConfig(string $key, array $value): void
    {
        $json = json_encode($value);
        $now = date('Y-m-d H:i:s');

        // MySQL UPSERT
        Database::execute(
            'INSERT INTO "AdminConfig" (`key`, value, updatedAt)
             VALUES (:key, :value, :now)
             ON DUPLICATE KEY UPDATE value = VALUES(value), updatedAt = VALUES(updatedAt)',
            [':key' => $key, ':value' => $json, ':now' => $now]
        );
    }
}

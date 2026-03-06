<?php
/**
 * ReferralLinkService — Mirrors src/services/ReferralLinkService.ts
 *
 * Manages single-use referral link codes stored in the ReferralLink table.
 */

declare(strict_types=1);

class ReferralLinkService
{
    /**
     * Validate a referral code.
     * Returns the link row if ACTIVE, null otherwise.
     */
    public static function validateCode(string $code): ?array
    {
        return Database::queryOne(
            'SELECT * FROM "ReferralLink" WHERE code = :code AND status = \'ACTIVE\'',
            [':code' => $code]
        );
    }

    /**
     * Get or create an active referral link for a user/distributor.
     */
    public static function getActiveLink(int $referrerId, string $role): array
    {
        $link = Database::queryOne(
            'SELECT * FROM "ReferralLink" WHERE referrerId = :id AND role = :role AND status = \'ACTIVE\'
             ORDER BY createdAt DESC LIMIT 1',
            [':id' => $referrerId, ':role' => $role]
        );

        if ($link)
            return $link;

        // Get their actual referral code from db instead of random hex string
        $userRow = null;
        if ($role === 'USER') {
            $userRow = Database::queryOne('SELECT referralCode FROM "User" WHERE id = :id', [':id' => $referrerId]);
        } else {
            $userRow = Database::queryOne('SELECT referralCode FROM "Distributor" WHERE id = :id', [':id' => $referrerId]);
        }

        $code = ($userRow && $userRow['referralCode']) ? $userRow['referralCode'] : strtoupper(bin2hex(random_bytes(8)));
        $now = date('Y-m-d H:i:s');

        $id = Database::insert(
            'INSERT INTO "ReferralLink" (code, referrerId, role, status, createdAt)
             VALUES (:code, :referrerId, :role, \'ACTIVE\', :now)',
            [':code' => $code, ':referrerId' => $referrerId, ':role' => $role, ':now' => $now]
        );

        return [
            'id' => $id,
            'code' => $code,
            'referrerId' => $referrerId,
            'role' => $role,
            'status' => 'ACTIVE',
            'createdAt' => $now,
        ];
    }

    /**
     * Mark a referral link as USED.
     */
    public static function markUsed(string $code): void
    {
        Database::execute(
            'UPDATE "ReferralLink" SET status = \'USED\', usedAt = datetime(\'now\') WHERE code = :code',
            [':code' => $code]
        );
    }
}

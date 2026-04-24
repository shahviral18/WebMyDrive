<?php
/**
 * DistributorController — Mirrors src/controllers/DistributorController.ts
 *
 * Routes:
 *   POST /api/distributor/onboard       [auth]
 *   GET  /api/distributor/dashboard     [auth]
 *   GET  /api/distributor/history       [auth]
 *   POST /api/distributor/qa-sale       [auth]
 *   POST /api/distributor/request-payout[auth]
 *   GET  /api/distributor/payouts       [auth]
 *   GET  /api/distributor/wallet        [auth]
 *   GET  /api/distributor/customers     [auth]
 *   GET  /api/distributor/earnings      [auth]
 */

declare(strict_types=1);

class DistributorController
{
    private function requireDistributor(Request $req): int
    {
        $userId = $req->user['userId'] ?? null;
        $role = $req->user['role'] ?? '';

        if (!$userId || $role !== 'DISTRIBUTOR') {
            Response::error('Forbidden — distributor only', 403);
        }
        // Distributor IDs are stored as negative in JWT
        return abs((int) $userId);
    }

    public function onboard(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        $email = (string) ($req->body['email'] ?? '');

        if (!$userId)
            Response::error('Unauthorized', 401);
        if (!$email)
            Response::error('Email is required', 400);

        $dist = DistributorService::onboard((int) $userId, $email);
        Response::json(['success' => true, 'distributor' => $dist]);
    }

    public function getDashboard(Request $req): void
    {
        $distributorId = $this->requireDistributor($req);

        $dist = Database::queryOne('SELECT * FROM "Distributor" WHERE id = :id', [':id' => $distributorId]);
        if (!$dist)
            Response::error('Distributor not found', 404);

        $salesCount = Database::count('"DistributorSale"', 'distributorId = :id', [':id' => $distributorId]);
        $custCount = Database::count('"User"', 'distributorId = :id', [':id' => $distributorId]);
        $commission = (float) (Database::scalar(
            'SELECT COALESCE(SUM(commissionEarned), 0) FROM "DistributorSale" WHERE distributorId = :id',
            [':id' => $distributorId]
        ) ?? 0);

        $activeLink = ReferralLinkService::getActiveLink($distributorId, 'DISTRIBUTOR');
        $config = ConfigService::getDistributorConfig();

        $promoRow = Database::queryOne(
            'SELECT pc.code FROM "DistributorPromoCode" dpc
             JOIN "PromoCode" pc ON pc.id = dpc.promoCodeId
             WHERE dpc.distributorId = :id AND dpc.isActive = 1 LIMIT 1',
            [':id' => $distributorId]
        );

        $userToken = null;
        if (!empty($dist['linkedUserId'])) {
            $userToken = JwtHelper::generateToken((int) $dist['linkedUserId'], 'USER');
        }

        Response::json([
            'distributor' => [
                'id' => (int) $dist['id'],
                'name' => $dist['name'],
                'email' => $dist['displayEmail'] ?? $dist['email'],
                'tier' => $dist['tier'] ?? null,
                'status' => $dist['status'],
                'walletBalance' => (float) $dist['walletBalance'],
                'revenueThisYear' => (float) ($dist['revenueThisYear'] ?? 0),
                'totalCustomers' => $custCount,
                'totalSales' => $salesCount,
                'totalCommission' => $commission,
                'referralCode' => $activeLink['code'],
            ],
            'promoCode' => $promoRow['code'] ?? null,
            'promoDiscounts' => $config['promoDiscounts'] ?? [],
            'userToken' => $userToken,
        ]);
    }

    public function getPromoCodeHistory(Request $req): void
    {
        $distributorId = $this->requireDistributor($req);

        $rows = Database::query(
            'SELECT dpc.id, dpc.isActive, dpc.isFestive, dpc.assignedAt, dpc.revokedAt, dpc.note,
                    pc.code, pc.name, pc.discountPercent, pc.status AS promoStatus, pc.expiresAt
             FROM "DistributorPromoCode" dpc
             JOIN "PromoCode" pc ON pc.id = dpc.promoCodeId
             WHERE dpc.distributorId = :id
             ORDER BY dpc.assignedAt DESC',
            [':id' => $distributorId]
        );

        Response::json(['history' => $rows]);
    }

    public function getHistory(Request $req): void
    {
        $distributorId = $this->requireDistributor($req);
        $history = DistributorService::getSalesHistory($distributorId);
        Response::json(['history' => $history]);
    }

    public function simulateSale(Request $req): void
    {
        $distributorId = $this->requireDistributor($req);
        $userId = (int) ($req->body['userId'] ?? 0);
        $orderId = (int) ($req->body['orderId'] ?? 0);
        $amount = (float) ($req->body['amount'] ?? 0);

        if (!$userId || !$orderId || $amount <= 0) {
            Response::error('userId, orderId, and amount are required', 400);
        }

        DistributorService::processSale($distributorId, $userId, $orderId, $amount);
        Response::json(['success' => true, 'message' => 'Sale simulated']);
    }

    public function requestPayout(Request $req): void
    {
        $distributorId = $this->requireDistributor($req);
        $amount = (float) ($req->body['amount'] ?? 0);

        $result = DistributorService::requestPayout($distributorId, $amount);
        Response::json($result);
    }

    public function getPayouts(Request $req): void
    {
        $distributorId = $this->requireDistributor($req);
        $payouts = Database::query(
            'SELECT * FROM "DistributorWalletTx" WHERE distributorId = :id AND type = \'PAYOUT\' ORDER BY createdAt DESC',
            [':id' => $distributorId]
        );
        Response::json(['payouts' => $payouts]);
    }

    public function getWallet(Request $req): void
    {
        $distributorId = $this->requireDistributor($req);
        $dist = Database::queryOne('SELECT walletBalance FROM "Distributor" WHERE id = :id', [':id' => $distributorId]);
        $txs = Database::query(
            'SELECT * FROM "DistributorWalletTx" WHERE distributorId = :id ORDER BY createdAt DESC LIMIT 50',
            [':id' => $distributorId]
        );
        Response::json([
            'walletBalance' => (float) ($dist['walletBalance'] ?? 0),
            'transactions' => $txs,
        ]);
    }

    public function getCustomers(Request $req): void
    {
        $distributorId = $this->requireDistributor($req);
        $customers = Database::query(
            'SELECT u.id, u.name, u.email, u.walletBalance, u.createdAt, w.status AS wsStatus, p.name AS planName
             FROM "User" u
             LEFT JOIN "Workspace" w ON w.id = (SELECT id FROM "Workspace" WHERE userId = u.id ORDER BY createdAt DESC LIMIT 1)
             LEFT JOIN "Plan" p ON p.id = w.planId
             WHERE u.distributorId = :id
             ORDER BY u.createdAt DESC',
            [':id' => $distributorId]
        );
        Response::json(['customers' => $customers]);
    }

    public function getEarningsStats(Request $req): void
    {
        $distributorId = $this->requireDistributor($req);

        $totalCommission = (float) (Database::scalar(
            'SELECT COALESCE(SUM(commissionEarned), 0) FROM "DistributorSale" WHERE distributorId = :id',
            [':id' => $distributorId]
        ) ?? 0);

        $pending = (float) (Database::scalar(
            'SELECT COALESCE(SUM(ABS(amount)), 0) FROM "DistributorWalletTx" WHERE distributorId = :id AND type = \'PAYOUT\' AND status = \'PENDING\'',
            [':id' => $distributorId]
        ) ?? 0);

        $salesByYear = Database::query(
            'SELECT saleYear, COUNT(*) AS count, SUM(commissionEarned) AS commission
             FROM "DistributorSale" WHERE distributorId = :id GROUP BY saleYear ORDER BY saleYear',
            [':id' => $distributorId]
        );

        Response::json([
            'totalCommission' => $totalCommission,
            'pendingPayout' => $pending,
            'salesByYear' => $salesByYear,
        ]);
    }
}

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
                'entityType'        => $dist['entityType']        ?? null,
                'panNumber'         => $dist['panNumber']         ?? null,
                'gstin'             => $dist['gstin']             ?? null,
                'bankAccountHolder' => $dist['bankAccountHolder'] ?? null,
                'bankName'          => $dist['bankName']          ?? null,
                'bankAccountNumber' => $dist['bankAccountNumber'] ?? null,
                'bankIfscCode'      => $dist['bankIfscCode']      ?? null,
                'bankAccountType'   => $dist['bankAccountType']   ?? null,
                'upiId'             => $dist['upiId']             ?? null,
            ],
            'promoCode' => $promoRow['code'] ?? null,
            'promoDiscounts' => $config['promoDiscounts'] ?? [],
            'payoutConfig' => $config['payoutConfig'] ?? ['tdsEnabled' => false, 'tdsRate' => 10, 'minPayoutAmount' => 5000],
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

    public function getSettings(Request $req): void
    {
        $distributorId = $this->requireDistributor($req);
        $dist = Database::queryOne(
            'SELECT d.linkedUserId FROM "Distributor" d WHERE d.id = :id',
            [':id' => $distributorId]
        );
        $app = $dist && $dist['linkedUserId'] ? Database::queryOne(
            'SELECT panFilePath, aadharFilePath, gstFilePath FROM "DistributorApplication"
             WHERE linkedUserId = :uid AND status = \'APPROVED\'
             ORDER BY id DESC LIMIT 1',
            [':uid' => $dist['linkedUserId']]
        ) : null;
        Response::json([
            'kyc' => [
                'hasPan'    => !empty($app['panFilePath'])    && file_exists($app['panFilePath']),
                'hasAadhar' => !empty($app['aadharFilePath']) && file_exists($app['aadharFilePath']),
                'hasGst'    => !empty($app['gstFilePath'])    && file_exists($app['gstFilePath']),
            ],
        ]);
    }

    public function updateSettings(Request $req): void
    {
        $distributorId = $this->requireDistributor($req);

        $holder  = trim((string) ($req->body['bankAccountHolder'] ?? ''));
        $bank    = trim((string) ($req->body['bankName'] ?? ''));
        $account = trim((string) ($req->body['bankAccountNumber'] ?? ''));
        $ifsc    = strtoupper(trim((string) ($req->body['bankIfscCode'] ?? '')));
        $type    = in_array($req->body['bankAccountType'] ?? '', ['SAVINGS', 'CURRENT'], true)
                   ? $req->body['bankAccountType'] : 'SAVINGS';
        $upi     = trim((string) ($req->body['upiId'] ?? '')) ?: null;

        if (!$holder || !$bank || !$account) {
            Response::error('Account holder, bank name, and account number are required.', 400);
        }
        if (!preg_match('/^[A-Z]{4}0[A-Z0-9]{6}$/', $ifsc)) {
            Response::error('Invalid IFSC code format.', 400);
        }

        Database::execute(
            'UPDATE "Distributor" SET bankAccountHolder = :h, bankName = :b, bankAccountNumber = :a,
             bankIfscCode = :i, bankAccountType = :t, upiId = :u, updatedAt = :now WHERE id = :id',
            [':h' => $holder, ':b' => $bank, ':a' => $account, ':i' => $ifsc,
             ':t' => $type, ':u' => $upi, ':now' => date('Y-m-d H:i:s'), ':id' => $distributorId]
        );
        Response::json(['success' => true]);
    }

    public function requestPayout(Request $req): void
    {
        $distributorId = $this->requireDistributor($req);
        $amount = (float) ($req->body['amount'] ?? 0);

        // Accept invoice file if provided (multipart)
        $invoicePath = null;
        if (!empty($_FILES['invoiceFile']) && $_FILES['invoiceFile']['error'] === UPLOAD_ERR_OK) {
            $dir = '/home1/wmdadmin/secure_uploads/distributor-payouts/' . $distributorId;
            if (!is_dir($dir)) @mkdir($dir, 0755, true);
            $mime = mime_content_type($_FILES['invoiceFile']['tmp_name']) ?: '';
            if ($mime === 'application/pdf') {
                $dest = $dir . '/invoice_' . time() . '.pdf';
                if (@move_uploaded_file($_FILES['invoiceFile']['tmp_name'], $dest)) {
                    @chmod($dest, 0644);
                    $invoicePath = $dest;
                }
            }
        }

        $result = DistributorService::requestPayout($distributorId, $amount, $invoicePath);
        Response::json($result);
    }

    public function getPayouts(Request $req): void
    {
        $distributorId = $this->requireDistributor($req);
        $payouts = Database::query(
            'SELECT id, distributorId, amount, type, status, description, invoicePath IS NOT NULL AS hasInvoice,
                    utrNumber, adminNote, createdAt
             FROM "DistributorWalletTx"
             WHERE distributorId = :id AND type = \'PAYOUT\' ORDER BY createdAt DESC',
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

    // ── Admin payout management ───────────────────────────────────────────────

    public function adminListPayouts(Request $req): void
    {
        $status = (string) ($req->query['status'] ?? '');
        $where = 'WHERE t.type = \'PAYOUT\'';
        $params = [];
        if ($status !== '') {
            $where .= ' AND t.status = :s';
            $params[':s'] = strtoupper($status);
        }
        $rows = Database::query(
            "SELECT t.id, t.distributorId, d.name AS distributorName, d.email AS distributorEmail,
                    t.amount, t.status, t.invoicePath IS NOT NULL AS hasInvoice,
                    t.utrNumber, t.adminNote, t.createdAt
             FROM \"DistributorWalletTx\" t
             JOIN \"Distributor\" d ON d.id = t.distributorId
             $where
             ORDER BY t.createdAt DESC",
            $params
        );
        Response::json(['payouts' => $rows]);
    }

    public function adminUpdatePayout(Request $req): void
    {
        $id = (int) ($req->params['id'] ?? 0);
        $tx = Database::queryOne('SELECT * FROM "DistributorWalletTx" WHERE id = :id', [':id' => $id]);
        if (!$tx) Response::error('Not found', 404);

        $newStatus  = strtoupper((string) ($req->body['status'] ?? $tx['status']));
        $utrNumber  = trim((string) ($req->body['utrNumber'] ?? ($tx['utrNumber'] ?? ''))) ?: null;
        $adminNote  = $req->body['adminNote'] ?? $tx['adminNote'];

        if (!in_array($newStatus, ['PENDING', 'COMPLETED', 'FAILED'], true)) {
            Response::error('Invalid status', 400);
        }

        Database::execute(
            'UPDATE "DistributorWalletTx" SET status = :s, utrNumber = :u, adminNote = :n WHERE id = :id',
            [':s' => $newStatus, ':u' => $utrNumber, ':n' => $adminNote, ':id' => $id]
        );

        if ($newStatus === 'FAILED' && $tx['status'] !== 'FAILED') {
            // Reverse the wallet deduction
            $amt = abs((float) $tx['amount']);
            Database::execute(
                'UPDATE "Distributor" SET walletBalance = walletBalance + :amt WHERE id = :id',
                [':amt' => $amt, ':id' => $tx['distributorId']]
            );
        }

        Logger::info("[AdminPayout] id=$id status -> $newStatus by admin=" . ($req->user['userId'] ?? '?'));
        Response::json(['success' => true]);
    }

    public function adminDownloadInvoice(Request $req): void
    {
        $id = (int) ($req->params['id'] ?? 0);
        $tx = Database::queryOne('SELECT invoicePath FROM "DistributorWalletTx" WHERE id = :id', [':id' => $id]);
        if (!$tx) Response::error('Not found', 404);
        $path = $tx['invoicePath'];
        if (!$path || !file_exists($path)) Response::error('Invoice not found', 404);

        $mime = mime_content_type($path) ?: 'application/pdf';
        header('Content-Type: ' . $mime);
        header('Content-Disposition: inline; filename="invoice-' . $id . '.pdf"');
        header('Content-Length: ' . filesize($path));
        readfile($path);
        exit;
    }
}

<?php
/**
 * AdminController — Mirrors src/controllers/AdminController.ts
 *
 * All routes require ADMIN or SUPERADMIN role.
 *
 * Routes:
 *   GET    /api/admin/config
 *   POST   /api/admin/config
 *   GET    /api/admin/kpis
 *   GET    /api/admin/users
 *   GET    /api/admin/users/:id
 *   POST   /api/admin/users
 *   POST   /api/admin/users/:id/reset-password
 *   DELETE /api/admin/users/:id
 *   POST   /api/admin/users/:id/adjust-wallet
 *   POST   /api/admin/users/:id/toggle-status
 *   GET    /api/admin/orders
 *   GET    /api/admin/distributors
 *   POST   /api/admin/distributors
 *   POST   /api/admin/distributors/:id/reset-password
 *   POST   /api/admin/distributors/:id/adjust-wallet
 *   GET    /api/admin/referrals
 *   PATCH  /api/admin/referrals/:id/override-commission
 *   GET    /api/admin/audit-logs
 *   GET    /api/admin/referral-analytics
 *   GET    /api/admin/plans
 *   POST   /api/admin/plans
 *   DELETE /api/admin/plans/:id
 *   PATCH  /api/admin/plans/:id/toggle
 */

declare(strict_types=1);

class AdminController
{
    // ── Config ────────────────────────────────────────────────────────────────

    public function getConfig(Request $req): void
    {
        $type = (string) ($req->query['type'] ?? '');

        switch ($type) {
            case 'USER_REFERRAL_SETTINGS':
                Response::json(ConfigService::getUserReferralConfig());
                break;
            case 'DISTRIBUTOR_SETTINGS':
                Response::json(ConfigService::getDistributorConfig());
                break;
            case 'WALLET_SETTINGS':
                Response::json(ConfigService::getWalletConfig());
                break;
            case 'GLOBAL_PLAN_SETTINGS':
                Response::json(ConfigService::getGlobalPlanConfig());
                break;
            default:
                Response::json([
                    'USER_REFERRAL_SETTINGS' => ConfigService::getUserReferralConfig(),
                    'DISTRIBUTOR_SETTINGS' => ConfigService::getDistributorConfig(),
                    'WALLET_SETTINGS' => ConfigService::getWalletConfig(),
                    'GLOBAL_PLAN_SETTINGS' => ConfigService::getGlobalPlanConfig(),
                ]);
        }
    }

    public function updateConfig(Request $req): void
    {
        $type = $req->body['type'] ?? '';
        $data = $req->body['data'] ?? null;

        if (!$type || !$data)
            Response::error('Missing type or data', 400);
        if (!is_array($data))
            Response::error('data must be an object', 400);

        ConfigService::setConfig((string) $type, $data);
        Response::json(['success' => true, 'message' => "$type updated."]);
    }

    // ── KPIs ──────────────────────────────────────────────────────────────────

    public function getKpis(Request $req): void
    {
        $userCount = Database::count('"User"', 'role != \'SUPERADMIN\'');
        $distCount = Database::count('"Distributor"', 'status = \'ACTIVE\'');
        $pendingOrders = Database::count('"Order"', 'status = \'PENDING\'');

        $paidAgg = Database::queryOne(
            'SELECT SUM(amount) AS total, COUNT(*) AS cnt FROM "Order" WHERE status = \'PAID\''
        );
        $walletAgg = Database::queryOne('SELECT SUM(walletBalance) AS total FROM "User"');

        $startOfMonth = date('Y-m-01 00:00:00');
        $monthAgg = Database::queryOne(
            'SELECT SUM(amount) AS total FROM "Order" WHERE status = \'PAID\' AND createdAt >= :som',
            [':som' => $startOfMonth]
        );

        Response::json([
            'totalUsers' => $userCount,
            'activeDistributors' => $distCount,
            'totalRevenue' => (float) ($paidAgg['total'] ?? 0),
            'totalOrders' => (int) ($paidAgg['cnt'] ?? 0),
            'pendingOrders' => $pendingOrders,
            'monthRevenue' => (float) ($monthAgg['total'] ?? 0),
            'totalWalletBalance' => (float) ($walletAgg['total'] ?? 0),
        ]);
    }

    // ── Users ─────────────────────────────────────────────────────────────────

    public function getUsers(Request $req): void
    {
        $limit = min(200, max(1, (int) ($req->query['limit'] ?? 20)));
        $search = (string) ($req->query['search'] ?? '');

        $userWhere = 'u.role != \'SUPERADMIN\'';
        $params = [];

        if ($search) {
            $userWhere .= ' AND (u.email LIKE :s OR u.name LIKE :s)';
            $params[':s'] = "%$search%";
        }

        $users = Database::query(
            "SELECT u.*, w.status AS wsStatus, w.planId AS wsPlanId, p.name AS planName,
                    (SELECT COUNT(*) FROM \"ReferralLog\" rl WHERE rl.refereeId = u.id LIMIT 1) AS wasReferred
             FROM \"User\" u
             LEFT JOIN \"Workspace\" w ON w.id = (SELECT id FROM \"Workspace\" WHERE userId = u.id ORDER BY createdAt DESC LIMIT 1)
             LEFT JOIN \"Plan\" p ON p.id = w.planId
             WHERE $userWhere
             ORDER BY u.createdAt DESC
             LIMIT :lim",
            array_merge($params, [':lim' => $limit])
        );

        $distParams = [];
        $distWhere = '1=1';
        if ($search) {
            $distWhere = '(email LIKE :s OR name LIKE :s)';
            $distParams[':s'] = "%$search%";
        }

        $distributors = Database::query(
            "SELECT * FROM \"Distributor\" WHERE $distWhere ORDER BY createdAt DESC LIMIT :lim",
            array_merge($distParams, [':lim' => $limit])
        );

        $combined = [];
        foreach ($users as $u) {
            $combined[] = [
                'id' => (int) $u['id'],
                'name' => $u['name'],
                'email' => $u['email'],
                'role' => $u['role'],
                'walletBalance' => (float) $u['walletBalance'],
                'referralCode' => $u['referralCode'],
                'plan' => $u['planName'] ?? 'None',
                'status' => $u['wsStatus'] ?? 'NO_WORKSPACE',
                'createdAt' => $u['createdAt'],
                'distributorId' => $u['distributorId'],
                'source' => $u['distributorId'] ? 'Distributor'
                    : ($u['wasReferred'] ? 'User Referral' : 'Direct'),
            ];
        }
        foreach ($distributors as $d) {
            $combined[] = [
                'id' => (int) $d['id'] + 1000000,
                'name' => $d['name'],
                'email' => $d['email'],
                'role' => 'DISTRIBUTOR',
                'walletBalance' => (float) $d['walletBalance'],
                'referralCode' => $d['referralCode'],
                'plan' => $d['tier'],
                'status' => $d['status'],
                'createdAt' => $d['createdAt'],
                'distributorId' => (int) $d['id'],
                'source' => 'Distributor',
            ];
        }

        // Sort by createdAt desc
        usort($combined, fn($a, $b) => strtotime($b['createdAt']) <=> strtotime($a['createdAt']));
        $sliced = array_slice($combined, 0, $limit);

        Response::json([
            'users' => $sliced,
            'total' => count($sliced),
            'page' => 1,
            'totalPages' => 1,
        ]);
    }

    public function getUser(Request $req): void
    {
        $id = (int) ($req->params['id'] ?? 0);
        $user = Database::queryOne('SELECT * FROM "User" WHERE id = :id', [':id' => $id]);
        if (!$user)
            Response::error('User not found', 404);

        $workspaces = Database::query(
            'SELECT w.*, p.id AS planId, p.name AS planName, p.price AS planPrice FROM "Workspace" w LEFT JOIN "Plan" p ON p.id = w.planId WHERE w.userId = :uid',
            [':uid' => $id]
        );
        $orders = Database::query(
            'SELECT * FROM "Order" WHERE userId = :uid ORDER BY createdAt DESC LIMIT 10',
            [':uid' => $id]
        );
        $referrals = Database::query(
            'SELECT rl.*, u.email AS refereeEmail FROM "ReferralLog" rl LEFT JOIN "User" u ON u.id = rl.refereeId WHERE rl.referrerId = :uid',
            [':uid' => $id]
        );

        Response::json(array_merge($user, [
            'workspaces' => $workspaces,
            'orders' => $orders,
            'referralsMade' => $referrals,
        ]));
    }

    public function createUser(Request $req): void
    {
        $name = (string) ($req->body['name'] ?? '');
        $email = strtolower(trim((string) ($req->body['email'] ?? '')));
        $password = (string) ($req->body['password'] ?? '');
        $role = (string) ($req->body['role'] ?? 'USER');

        if (!$email)
            Response::error('Email is required', 400);

        $existing = Database::queryOne('SELECT id FROM "User" WHERE email = :e', [':e' => $email]);
        if ($existing)
            Response::error('User with this email already exists', 409);

        $src = trim($name) ?: explode('@', $email)[0];
        $firstWord = preg_split('/\s+/', $src)[0];
        $basePass = preg_replace('/[^a-z0-9]/i', '', $firstWord);
        $defaultPass = ucfirst(strtolower($basePass)) . date('Y');
        $plainPassword = $password ?: $defaultPass;
        $passwordHash = password_hash($plainPassword, PASSWORD_BCRYPT);
        $baseRef = strtoupper(preg_replace('/[^a-z0-9]/i', '', $basePass));
        $referralCode = substr($baseRef, 0, 12) . date('Y');
        $now = date('Y-m-d H:i:s');

        $id = Database::insert(
            'INSERT INTO "User" (name, email, passwordHash, role, referralCode, walletBalance, createdAt, updatedAt)
             VALUES (:name, :email, :hash, :role, :code, 0, :now, :now)',
            [
                ':name' => $name,
                ':email' => $email,
                ':hash' => $passwordHash,
                ':role' => $role,
                ':code' => $referralCode,
                ':now' => $now,
            ]
        );

        $user = Database::queryOne('SELECT * FROM "User" WHERE id = :id', [':id' => $id]);
        Response::json([
            'user' => $user,
            'plainPassword' => $plainPassword,
            'message' => 'User created. Save this password — it will not be shown again.',
        ]);
    }

    public function resetUserPassword(Request $req): void
    {
        $id = (int) ($req->params['id'] ?? 0);
        $user = Database::queryOne('SELECT id FROM "User" WHERE id = :id', [':id' => $id]);
        if (!$user)
            Response::error('User not found', 404);

        $token = bin2hex(random_bytes(14));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));
        $now = date('Y-m-d H:i:s');

        Database::insert(
            'INSERT INTO "SecurityLink" (token, userId, role, type, status, expiresAt, createdAt)
             VALUES (:token, :uid, \'USER\', \'PASSWORD_RESET\', \'ACTIVE\', :exp, :now)',
            [':token' => $token, ':uid' => $id, ':exp' => $expiresAt, ':now' => $now]
        );

        $resetLink = SITE_URL . '/reset-password?token=' . $token;
        Response::json([
            'plainPassword' => $resetLink,
            'message' => 'Security link generated. It will expire in 24 hours.',
        ]);
    }

    public function deleteUser(Request $req): void
    {
        $id = (int) ($req->params['id'] ?? 0);
        if (!$id)
            Response::error('User ID required', 400);

        $user = Database::queryOne('SELECT * FROM "User" WHERE id = :id', [':id' => $id]);
        if (!$user)
            Response::error('User not found', 404);
        if ($user['role'] === 'SUPERADMIN')
            Response::error('Cannot delete a SUPERADMIN account', 403);

        Database::execute('DELETE FROM "DistributorSale" WHERE purchasingUserId = :id', [':id' => $id]);
        Database::execute('DELETE FROM "Workspace" WHERE userId = :id', [':id' => $id]);
        Database::execute('DELETE FROM "ReferralLog" WHERE referrerId = :id OR refereeId = :id', [':id' => $id]);
        Database::execute('DELETE FROM "Order" WHERE userId = :id', [':id' => $id]);
        Database::execute('DELETE FROM "User" WHERE id = :id', [':id' => $id]);

        AuditService::log('[Admin] DELETE_USER', $req->user['userId'] ?? null, $req->ip, [
            'deletedUserId' => $id,
            'email' => $user['email'],
        ]);
        Response::json(['success' => true]);
    }

    public function adjustWallet(Request $req): void
    {
        $id = (int) ($req->params['id'] ?? 0);
        $amount = $req->body['amount'] ?? null;
        $reason = (string) ($req->body['reason'] ?? 'Manual admin adjustment');

        if (!is_numeric($amount))
            Response::error('amount must be a number (positive to credit, negative to deduct)', 400);
        $amount = (float) $amount;

        $user = Database::queryOne('SELECT * FROM "User" WHERE id = :id', [':id' => $id]);
        if (!$user)
            Response::error('User not found', 404);

        $newBalance = round((float) $user['walletBalance'] + $amount, 2);
        if ($newBalance < 0) {
            Response::error("Deduction of ₹" . abs($amount) . " would result in negative balance (current: ₹{$user['walletBalance']})", 400);
        }

        Database::execute(
            'UPDATE "User" SET walletBalance = :bal, updatedAt = :now WHERE id = :id',
            [':bal' => $newBalance, ':now' => date('Y-m-d H:i:s'), ':id' => $id]
        );

        AuditService::log('ADMIN_WALLET_ADJUST', $req->user['userId'] ?? null, $req->ip, [
            'userId' => $id,
            'email' => $user['email'],
            'amount' => $amount,
            'newBalance' => $newBalance,
            'reason' => $reason,
        ]);

        Response::json([
            'success' => true,
            'newBalance' => $newBalance,
            'message' => 'Wallet ' . ($amount >= 0 ? 'credited' : 'debited') . " ₹" . abs($amount),
        ]);
    }

    public function toggleUserStatus(Request $req): void
    {
        $id = (int) ($req->params['id'] ?? 0);
        $user = Database::queryOne('SELECT * FROM "User" WHERE id = :id', [':id' => $id]);
        if (!$user)
            Response::error('User not found', 404);
        if ($user['role'] === 'SUPERADMIN')
            Response::error('Cannot disable a SUPERADMIN account', 403);

        $newStatus = !(bool) $user['isDisabled'];
        Database::execute(
            'UPDATE "User" SET isDisabled = :s, updatedAt = :now WHERE id = :id',
            [':s' => (int) $newStatus, ':now' => date('Y-m-d H:i:s'), ':id' => $id]
        );

        $action = $newStatus ? 'ADMIN_USER_DISABLED' : 'ADMIN_USER_ENABLED';
        AuditService::log($action, $req->user['userId'] ?? null, $req->ip, ['email' => $user['email']]);

        Response::json([
            'success' => true,
            'isDisabled' => $newStatus,
            'message' => 'Account ' . ($newStatus ? 'disabled' : 'enabled'),
        ]);
    }

    // ── Orders ────────────────────────────────────────────────────────────────

    public function getOrders(Request $req): void
    {
        $page = max(1, (int) ($req->query['page'] ?? 1));
        $limit = min(100, (int) ($req->query['limit'] ?? 20));
        $status = (string) ($req->query['status'] ?? '');
        $skip = ($page - 1) * $limit;

        $where = '1=1';
        $params = [];
        if ($status) {
            $where .= ' AND o.status = :status';
            $params[':status'] = $status;
        }

        $total = (int) Database::scalar(
            "SELECT COUNT(*) FROM \"Order\" o WHERE $where",
            $params
        );

        $orders = Database::query(
            "SELECT o.*, u.id AS userId, u.name AS userName, u.email AS userEmail
             FROM \"Order\" o
             LEFT JOIN \"User\" u ON u.id = o.userId
             WHERE $where
             ORDER BY o.createdAt DESC
             LIMIT :lim OFFSET :off",
            array_merge($params, [':lim' => $limit, ':off' => $skip])
        );

        Response::json([
            'orders' => array_map(fn($o) => [
                'id' => (int) $o['id'],
                'amount' => (float) $o['amount'],
                'currency' => $o['currency'],
                'status' => $o['status'],
                'gatewayTxId' => $o['gatewayTxId'],
                'createdAt' => $o['createdAt'],
                'user' => ['id' => (int) $o['userId'], 'name' => $o['userName'], 'email' => $o['userEmail']],
            ], $orders),
            'total' => $total,
            'page' => $page,
            'totalPages' => (int) ceil($total / $limit),
        ]);
    }

    // ── Distributors ──────────────────────────────────────────────────────────

    public function getDistributors(Request $req): void
    {
        $page = max(1, (int) ($req->query['page'] ?? 1));
        $limit = min(100, (int) ($req->query['limit'] ?? 50));
        $skip = ($page - 1) * $limit;

        $total = (int) Database::scalar('SELECT COUNT(*) FROM "Distributor"');
        $distributors = Database::query(
            'SELECT d.*,
                    (SELECT COUNT(*) FROM "User" WHERE distributorId = d.id) AS totalCustomers,
                    (SELECT COUNT(*) FROM "DistributorSale" WHERE distributorId = d.id) AS totalSales,
                    (SELECT COALESCE(SUM(commissionEarned),0) FROM "DistributorSale" WHERE distributorId = d.id) AS commissionTotal,
                    (SELECT COALESCE(SUM(ABS(amount)),0) FROM "DistributorWalletTx" WHERE distributorId = d.id AND status = \'PENDING\') AS pendingWithdrawal,
                    (SELECT pc.code FROM "DistributorPromoCode" dpc
                     JOIN "PromoCode" pc ON pc.id = dpc.promoCodeId
                     WHERE dpc.distributorId = d.id AND dpc.isActive = 1 LIMIT 1) AS promoCode
             FROM "Distributor" d
             ORDER BY d.createdAt DESC
             LIMIT :lim OFFSET :off',
            [':lim' => $limit, ':off' => $skip]
        );

        Response::json([
            'distributors' => array_map(fn($d) => [
                'id' => (string) $d['id'],
                'name' => $d['name'] ?? $d['email'],
                'email' => $d['email'],
                'status' => strtolower($d['status'] ?? 'active'),
                'tier' => $d['tier'] ?? null,
                'commissionPct' => (float) ($d['commissionPct'] ?? 10),
                'referralCode' => $d['referralCode'],
                'promoCode' => $d['promoCode'],
                'totalCustomers' => (int) $d['totalCustomers'],
                'activeCustomers' => (int) $d['totalCustomers'],
                'walletBalanceINR' => (float) $d['walletBalance'],
                'revenueThisYearINR' => (float) ($d['revenueThisYear'] ?? 0),
                'revenueGeneratedINR' => (float) ($d['revenueThisYear'] ?? 0),
                'commissionEarnedINR' => (float) $d['commissionTotal'],
                'pendingWithdrawalINR' => (float) $d['pendingWithdrawal'],
                'joinedAt' => $d['joinDate'] ?? $d['createdAt'],
                'lastActiveAt' => $d['updatedAt'],
                'monthlyBreakdown' => [],
                'createdAt' => $d['createdAt'],
                'updatedAt' => $d['updatedAt'],
            ], $distributors),
            'total' => $total,
            'page' => $page,
            'totalPages' => (int) ceil($total / $limit),
        ]);
    }

    public function createDistributor(Request $req): void
    {
        $name = (string) ($req->body['name'] ?? '');
        $email = strtolower(trim((string) ($req->body['email'] ?? '')));
        $password = (string) ($req->body['password'] ?? '');

        if (!$email)
            Response::error('Email is required', 400);

        $existing = Database::queryOne('SELECT id FROM "Distributor" WHERE email = :e', [':e' => $email]);
        if ($existing)
            Response::error('Distributor with this email already exists', 409);

        $plainPassword = $password ?: 'Dist@' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
        $passwordHash = password_hash($plainPassword, PASSWORD_BCRYPT);

        $baseCode = strtoupper(substr(preg_replace('/[^A-Z0-9]/i', '', $name ?: $email), 0, 6));
        $baseCode = str_pad($baseCode, 4, 'X');
        $referralCode = $baseCode . '001';

        for ($attempt = 1; $attempt <= 10; $attempt++) {
            $conflict = Database::queryOne(
                'SELECT id FROM "Distributor" WHERE referralCode = :code',
                [':code' => $referralCode]
            );
            if (!$conflict)
                break;
            $referralCode = $baseCode . strtoupper(dechex(time()))[-4];
            if ($attempt === 10)
                throw new RuntimeException('Could not generate unique referral code.');
        }

        $now = date('Y-m-d H:i:s');
        $id = Database::insert(
            'INSERT INTO "Distributor" (name, email, passwordHash, tier, status, walletBalance, revenueThisYear, referralCode, createdAt, updatedAt)
             VALUES (:name, :email, :hash, \'Starter\', \'ACTIVE\', 0, 0, :code, :now, :now)',
            [
                ':name' => $name,
                ':email' => $email,
                ':hash' => $passwordHash,
                ':code' => $referralCode,
                ':now' => $now,
            ]
        );

        $dist = Database::queryOne('SELECT * FROM "Distributor" WHERE id = :id', [':id' => $id]);
        Response::json([
            'distributor' => $dist,
            'plainPassword' => $plainPassword,
            'message' => 'Distributor created. Save this password — it will not be shown again.',
        ]);
    }

    public function resetDistributorPassword(Request $req): void
    {
        $id = (int) ($req->params['id'] ?? 0);

        $token = bin2hex(random_bytes(14));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));
        $now = date('Y-m-d H:i:s');

        Database::insert(
            'INSERT INTO "SecurityLink" (token, userId, role, type, status, expiresAt, createdAt)
             VALUES (:token, :uid, \'DISTRIBUTOR\', \'PASSWORD_RESET\', \'ACTIVE\', :exp, :now)',
            [':token' => $token, ':uid' => $id, ':exp' => $expiresAt, ':now' => $now]
        );

        $resetLink = SITE_URL . '/reset-password?token=' . $token;
        Response::json([
            'plainPassword' => $resetLink,
            'message' => 'Security link generated. It will expire in 24 hours.',
        ]);
    }

    public function adjustDistributorWallet(Request $req): void
    {
        $id = (int) ($req->params['id'] ?? 0);
        $amount = $req->body['amount'] ?? null;
        $reason = (string) ($req->body['reason'] ?? 'Admin manual adjustment');

        if (!is_numeric($amount))
            Response::error('amount must be a number', 400);
        $amount = (float) $amount;

        $dist = Database::queryOne('SELECT * FROM "Distributor" WHERE id = :id', [':id' => $id]);
        if (!$dist)
            Response::error('Distributor not found', 404);

        $newBalance = round((float) $dist['walletBalance'] + $amount, 2);
        if ($newBalance < 0)
            Response::error('Deduction would result in negative balance', 400);

        $now = date('Y-m-d H:i:s');
        Database::execute(
            'UPDATE "Distributor" SET walletBalance = :bal, updatedAt = :now WHERE id = :id',
            [':bal' => $newBalance, ':now' => $now, ':id' => $id]
        );
        Database::insert(
            'INSERT INTO "DistributorWalletTx" (distributorId, amount, type, status, description, createdAt)
             VALUES (:did, :amt, :type, \'COMPLETED\', :desc, :now)',
            [
                ':did' => $id,
                ':amt' => $amount,
                ':type' => $amount >= 0 ? 'COMMISSION' : 'PAYOUT',
                ':desc' => $reason,
                ':now' => $now,
            ]
        );

        AuditService::log('ADMIN_DISTRIBUTOR_WALLET_ADJUST', $req->user['userId'] ?? null, $req->ip, [
            'distributorId' => $id,
            'amount' => $amount,
            'newBalance' => $newBalance,
            'reason' => $reason,
        ]);

        Response::json([
            'success' => true,
            'newBalance' => $newBalance,
            'message' => 'Wallet ' . ($amount >= 0 ? 'credited' : 'debited') . " ₹" . abs($amount),
        ]);
    }

    // ── Referrals ─────────────────────────────────────────────────────────────

    public function getAllReferrals(Request $req): void
    {
        $page = max(1, (int) ($req->query['page'] ?? 1));
        $limit = min(100, (int) ($req->query['limit'] ?? 50));
        $skip = ($page - 1) * $limit;

        $total = (int) Database::scalar('SELECT COUNT(*) FROM "ReferralLog"');
        $logs = Database::query(
            'SELECT rl.*,
                    rr.id AS rrId, rr.email AS rrEmail, rr.name AS rrName, rr.walletBalance AS rrWallet,
                    re.id AS reId, re.email AS reEmail,
                    o.id AS orderId, o.amount AS orderAmount, o.status AS orderStatus, p.name AS planName
             FROM "ReferralLog" rl
             LEFT JOIN "User" rr ON rr.id = rl.referrerId
             LEFT JOIN "User" re ON re.id = rl.refereeId
             LEFT JOIN "Order" o ON o.id = rl.orderId
             LEFT JOIN "Plan" p ON p.id = o.planId
             ORDER BY rl.createdAt DESC
             LIMIT :lim OFFSET :off',
            [':lim' => $limit, ':off' => $skip]
        );

        Response::json([
            'logs' => array_map(fn($l) => [
                'id' => (int) $l['id'],
                'referrer' => ['id' => (int) $l['rrId'], 'email' => $l['rrEmail'], 'name' => $l['rrName'], 'walletBalance' => (float) $l['rrWallet']],
                'referee' => ['id' => (int) $l['reId'], 'email' => $l['reEmail']],
                'order' => ['id' => (int) $l['orderId'], 'amount' => (float) $l['orderAmount'], 'status' => $l['orderStatus'], 'plan' => ['name' => $l['planName']]],
                'amount' => (float) $l['amount'],
                'status' => $l['status'],
                'year' => (int) $l['referralYear'],
                'createdAt' => $l['createdAt'],
            ], $logs),
            'total' => $total,
            'page' => $page,
            'totalPages' => (int) ceil($total / $limit),
        ]);
    }

    public function overrideCommission(Request $req): void
    {
        $id = (int) ($req->params['id'] ?? 0);
        $newAmount = $req->body['newAmount'] ?? null;
        $reason = (string) ($req->body['reason'] ?? 'Admin override');

        if (!is_numeric($newAmount) || (float) $newAmount < 0) {
            Response::error('newAmount must be a non-negative number', 400);
        }
        $newAmount = (float) $newAmount;

        $log = Database::queryOne('SELECT * FROM "ReferralLog" WHERE id = :id', [':id' => $id]);
        if (!$log)
            Response::error('Referral log not found', 404);

        $diff = $newAmount - (float) $log['amount'];
        $now = date('Y-m-d H:i:s');

        Database::beginTransaction();
        try {
            Database::execute(
                'UPDATE "ReferralLog" SET amount = :amt WHERE id = :id',
                [':amt' => $newAmount, ':id' => $id]
            );
            if ($diff !== 0.0) {
                Database::execute(
                    'UPDATE "User" SET walletBalance = walletBalance + :diff, updatedAt = :now WHERE id = :uid',
                    [':diff' => $diff, ':now' => $now, ':uid' => $log['referrerId']]
                );
            }
            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            Response::error($e->getMessage());
        }

        AuditService::log('ADMIN_COMMISSION_OVERRIDE', $req->user['userId'] ?? null, $req->ip, [
            'oldAmount' => $log['amount'],
            'newAmount' => $newAmount,
            'diff' => $diff,
            'reason' => $reason,
        ]);

        Response::json([
            'success' => true,
            'message' => "Commission updated from ₹{$log['amount']} to ₹$newAmount. Wallet adjusted by ₹" . number_format($diff, 2),
        ]);
    }

    // ── Audit Logs ────────────────────────────────────────────────────────────

    public function getAuditLogs(Request $req): void
    {
        $page = max(1, (int) ($req->query['page'] ?? 1));
        $limit = min(200, (int) ($req->query['limit'] ?? 50));
        $skip = ($page - 1) * $limit;

        $keywords = ['PAYMENT', 'CHECKOUT', 'COMMISSION', 'WALLET', 'ORDER', 'PURCHASE', 'REFERRAL', 'RAZORPAY', 'PLAN_PURCHASE', 'BILLING', 'PAYOUT'];
        $orClauses = implode(' OR ', array_map(fn($k) => "action LIKE '%$k%'", $keywords));

        $total = (int) Database::scalar("SELECT COUNT(*) FROM \"AuditLog\" WHERE $orClauses");
        $logs = Database::query(
            "SELECT * FROM \"AuditLog\" WHERE $orClauses ORDER BY createdAt DESC LIMIT :lim OFFSET :off",
            [':lim' => $limit, ':off' => $skip]
        );

        Response::json([
            'logs' => $logs,
            'total' => $total,
            'page' => $page,
            'totalPages' => (int) ceil($total / $limit),
        ]);
    }

    // ── Referral Analytics ────────────────────────────────────────────────────

    public function getReferralAnalytics(Request $req): void
    {
        $totalReferrals = (int) Database::scalar('SELECT COUNT(*) FROM "ReferralLog"');
        $totalCommission = (float) (Database::scalar('SELECT COALESCE(SUM(amount),0) FROM "ReferralLog"') ?? 0);

        $vestedLogs = Database::query(
            'SELECT rl.*, rr.email AS rrEmail, rr.name AS rrName, re.email AS reEmail
             FROM "ReferralLog" rl
             LEFT JOIN "User" rr ON rr.id = rl.referrerId
             LEFT JOIN "User" re ON re.id = rl.refereeId
             WHERE rl.status = \'VESTED\'
             ORDER BY rl.createdAt DESC
             LIMIT 50'
        );

        Response::json([
            'totalReferrals' => $totalReferrals,
            'totalCommissionPaid' => $totalCommission,
            'recentLogs' => array_map(fn($l) => [
                'id' => (int) $l['id'],
                'referrer' => $l['rrEmail'],
                'referee' => $l['reEmail'],
                'amount' => (float) $l['amount'],
                'year' => (int) $l['referralYear'],
                'status' => $l['status'],
                'date' => $l['createdAt'],
            ], $vestedLogs),
        ]);
    }

    // ── Plans ─────────────────────────────────────────────────────────────────

    public function getPlans(Request $req): void
    {
        $plans = Database::query('SELECT * FROM "Plan" ORDER BY sortOrder ASC, price ASC');
        Response::json($plans);
    }

    public function upsertPlan(Request $req): void
    {
        $id = $req->body['id'] ?? null;
        $name = trim((string) ($req->body['name'] ?? ''));
        $price = $req->body['price'] ?? 0;
        $priceINR = $req->body['priceINR'] ?? null;
        $priceMonthly = $req->body['priceMonthlyINR'] ?? null;
        $priceYearly = $req->body['priceYearlyINR'] ?? null;
        $features = $req->body['features'] ?? null;
        $isActive = $req->body['isActive'] ?? null;
        $storageGB = $req->body['storageGB'] ?? 0;
        $maxUsers = $req->body['maxUsers'] ?? 0;
        $googleSKU = $req->body['googleSKU'] ?? null;
        $hasOverride = $req->body['hasOverride'] ?? null;
        $sortOrder = $req->body['sortOrder'] ?? null;
        $googleOrgUnit = isset($req->body['googleOrgUnit']) ? trim((string)$req->body['googleOrgUnit']) : null;

        if (!$name)
            Response::error('Plan name is required', 400);
        if ((float) $price <= 0)
            Response::error('Price must be greater than 0', 400);

        $featuresJson = null;
        if ($features !== null) {
            $featuresJson = is_string($features) ? $features : json_encode($features);
        }

        $now = date('Y-m-d H:i:s');
        $priceFloatINR = $priceINR !== null ? (float) $priceINR : (float) $price;

        if ($id) {
            Database::execute(
                'UPDATE "Plan" SET name=:name, price=:price, priceINR=:pINR,
                 priceMonthlyINR=:pM, priceYearlyINR=:pY, features=:feats,
                 storageGB=:storage, maxUsers=:maxu, googleSKU=:sku,
                 isActive=CASE WHEN :ia1 IS NOT NULL THEN :ia2 ELSE isActive END,
                 hasOverride=CASE WHEN :ho1 IS NOT NULL THEN :ho2 ELSE hasOverride END,
                 sortOrder=CASE WHEN :so1 IS NOT NULL THEN :so2 ELSE sortOrder END,
                 googleOrgUnit=CASE WHEN :gou1 IS NOT NULL THEN :gou2 ELSE googleOrgUnit END,
                 updatedAt=:now
                 WHERE id=:id',
                [
                    ':name' => $name,
                    ':price' => (float) $price,
                    ':pINR' => $priceFloatINR,
                    ':pM' => $priceMonthly !== null ? (float) $priceMonthly : null,
                    ':pY' => $priceYearly !== null ? (float) $priceYearly : null,
                    ':feats' => $featuresJson,
                    ':storage' => (int) $storageGB,
                    ':maxu' => (int) $maxUsers,
                    ':sku' => $googleSKU,
                    ':ia1' => $isActive !== null ? (int) (bool) $isActive : null,
                    ':ia2' => $isActive !== null ? (int) (bool) $isActive : null,
                    ':ho1' => $hasOverride !== null ? (int) (bool) $hasOverride : null,
                    ':ho2' => $hasOverride !== null ? (int) (bool) $hasOverride : null,
                    ':so1' => $sortOrder !== null ? (int) $sortOrder : null,
                    ':so2' => $sortOrder !== null ? (int) $sortOrder : null,
                    ':gou1' => $googleOrgUnit !== null ? ($googleOrgUnit ?: null) : null,
                    ':gou2' => $googleOrgUnit !== null ? ($googleOrgUnit ?: null) : null,
                    ':now' => $now,
                    ':id' => (int) $id,
                ]
            );
            $plan = Database::queryOne('SELECT * FROM "Plan" WHERE id = :id', [':id' => (int) $id]);
        } else {
            $newId = Database::insert(
                'INSERT INTO "Plan" (name, price, priceINR, priceMonthlyINR, priceYearlyINR, features, isActive, storageGB, maxUsers, googleSKU, hasOverride, sortOrder, googleOrgUnit, createdAt, updatedAt)
                 VALUES (:name, :price, :pINR, :pM, :pY, :feats, :ia, :storage, :maxu, :sku, :ho, :so, :gou, :now1, :now2)',
                [
                    ':name' => $name,
                    ':price' => (float) $price,
                    ':pINR' => $priceFloatINR,
                    ':pM' => $priceMonthly !== null ? (float) $priceMonthly : null,
                    ':pY' => $priceYearly !== null ? (float) $priceYearly : null,
                    ':feats' => $featuresJson,
                    ':ia' => $isActive !== null ? (int) (bool) $isActive : 1,
                    ':storage' => (int) $storageGB,
                    ':maxu' => (int) $maxUsers,
                    ':sku' => $googleSKU,
                    ':ho' => $hasOverride !== null ? (int) (bool) $hasOverride : 0,
                    ':so' => $sortOrder !== null ? (int) $sortOrder : 0,
                    ':gou' => $googleOrgUnit ?: null,
                    ':now1' => $now,
                    ':now2' => $now,
                ]
            );
            $plan = Database::queryOne('SELECT * FROM "Plan" WHERE id = :id', [':id' => $newId]);
        }

        Response::json($plan);
    }

    public function deletePlan(Request $req): void
    {
        $id = (int) ($req->params['id'] ?? 0);
        if (!$id)
            Response::error('Plan ID required', 400);

        $existing = Database::queryOne('SELECT id FROM "Plan" WHERE id = :id', [':id' => $id]);
        if (!$existing)
            Response::error('Plan not found', 404);

        // Unlink workspaces (don't block deletion)
        Database::execute('UPDATE "Workspace" SET planId = NULL WHERE planId = :id', [':id' => $id]);
        Database::execute('DELETE FROM "Plan" WHERE id = :id', [':id' => $id]);

        Response::json(['success' => true, 'message' => 'Plan deleted successfully']);
    }

    public function togglePlan(Request $req): void
    {
        $id = (int) ($req->params['id'] ?? 0);
        if (!$id)
            Response::error('Plan ID required', 400);

        $plan = Database::queryOne('SELECT * FROM "Plan" WHERE id = :id', [':id' => $id]);
        if (!$plan)
            Response::error('Plan not found', 404);

        $newStatus = !(bool) $plan['isActive'];
        Database::execute(
            'UPDATE "Plan" SET isActive = :s, updatedAt = :now WHERE id = :id',
            [':s' => (int) $newStatus, ':now' => date('Y-m-d H:i:s'), ':id' => $id]
        );

        Response::json(Database::queryOne('SELECT * FROM "Plan" WHERE id = :id', [':id' => $id]));
    }

    // ── Distributor Promo Code Assignment ─────────────────────────────────────

    public function getDistributorPromoCodes(Request $req): void
    {
        $distributorId = (int)($req->params['id'] ?? 0);
        if (!$distributorId) Response::error('Distributor ID required', 400);

        $rows = Database::query(
            'SELECT dpc.id, dpc.distributorId, dpc.isActive, dpc.isFestive,
                    dpc.assignedAt, dpc.revokedAt, dpc.note,
                    pc.id AS promoCodeId, pc.code, pc.name, pc.discountPercent,
                    pc.status AS promoStatus, pc.expiresAt
             FROM "DistributorPromoCode" dpc
             JOIN "PromoCode" pc ON pc.id = dpc.promoCodeId
             WHERE dpc.distributorId = :did
             ORDER BY dpc.assignedAt DESC',
            [':did' => $distributorId]
        );

        Response::json($rows);
    }

    public function assignDistributorPromoCode(Request $req): void
    {
        $distributorId = (int)($req->params['id'] ?? 0);
        $promoCodeId = (int)($req->body['promoCodeId'] ?? 0);
        $isFestive = !empty($req->body['isFestive']) ? 1 : 0;
        $note = trim((string)($req->body['note'] ?? ''));
        $adminId = $req->user['userId'] ?? null;

        if (!$distributorId) Response::error('Distributor ID required', 400);
        if (!$promoCodeId) Response::error('promoCodeId required', 400);

        $dist = Database::queryOne('SELECT id FROM "Distributor" WHERE id = :id', [':id' => $distributorId]);
        if (!$dist) Response::error('Distributor not found', 404);

        $promo = Database::queryOne('SELECT id FROM "PromoCode" WHERE id = :id', [':id' => $promoCodeId]);
        if (!$promo) Response::error('Promo code not found', 404);

        $now = date('Y-m-d H:i:s');

        Database::execute(
            'UPDATE "DistributorPromoCode" SET isActive = 0, revokedAt = :now
             WHERE distributorId = :did AND isActive = 1',
            [':now' => $now, ':did' => $distributorId]
        );

        Database::insert(
            'INSERT INTO "DistributorPromoCode" (distributorId, promoCodeId, isFestive, isActive, assignedAt, assignedBy, note)
             VALUES (:did, :pcid, :fest, 1, :now, :by, :note)',
            [
                ':did' => $distributorId, ':pcid' => $promoCodeId,
                ':fest' => $isFestive, ':now' => $now,
                ':by' => $adminId ? abs((int)$adminId) : null,
                ':note' => $note ?: null,
            ]
        );

        AuditService::log('ADMIN_PROMO_CODE_ASSIGNED', $adminId ? abs((int)$adminId) : null, null, [
            'distributorId' => $distributorId, 'promoCodeId' => $promoCodeId, 'isFestive' => $isFestive,
        ]);

        Response::json(['success' => true]);
    }

    public function revokeDistributorPromoCode(Request $req): void
    {
        $distributorId = (int)($req->params['id'] ?? 0);
        $dpcId = (int)($req->params['dpcId'] ?? 0);

        if (!$distributorId || !$dpcId) Response::error('IDs required', 400);

        $row = Database::queryOne(
            'SELECT id FROM "DistributorPromoCode" WHERE id = :id AND distributorId = :did',
            [':id' => $dpcId, ':did' => $distributorId]
        );
        if (!$row) Response::error('Assignment not found', 404);

        Database::execute(
            'UPDATE "DistributorPromoCode" SET isActive = 0, revokedAt = :now WHERE id = :id',
            [':now' => date('Y-m-d H:i:s'), ':id' => $dpcId]
        );

        Response::json(['success' => true]);
    }

    // ── Promo Codes ───────────────────────────────────────────────────────────

    public function getPromoCodes(Request $req): void
    {
        $codes = Database::query('SELECT * FROM "PromoCode" ORDER BY createdAt DESC');
        Response::json($codes);
    }

    public function upsertPromoCode(Request $req): void
    {
        $id = $req->body['id'] ?? null;
        $code = strtoupper(trim((string)($req->body['code'] ?? '')));
        $name = trim((string)($req->body['name'] ?? ''));
        $discountPercent = $req->body['discountPercent'] ?? null;
        $applicablePlans = $req->body['applicablePlans'] ?? null; // null = all, array of ints = specific
        $status = $req->body['status'] ?? 'ACTIVE';
        $usesLimit = isset($req->body['usesLimit']) && $req->body['usesLimit'] !== '' ? (int)$req->body['usesLimit'] : null;
        $expiresAt = $req->body['expiresAt'] ?? null;

        if (!$code) Response::error('Code is required', 400);
        if (!preg_match('/^[A-Z0-9_\-]{2,50}$/', $code)) Response::error('Code must be alphanumeric (A-Z, 0-9, _, -), 2-50 chars', 400);
        if ($discountPercent === null || $discountPercent === '') Response::error('Discount percent is required', 400);
        $discountFloat = (float)$discountPercent;
        if ($discountFloat <= 0 || $discountFloat > 100) Response::error('Discount must be between 1 and 100', 400);

        $applicablePlansJson = null;
        if (is_array($applicablePlans) && count($applicablePlans) > 0) {
            $applicablePlansJson = json_encode(array_values(array_map('intval', $applicablePlans)));
        }

        $expiresAtVal = null;
        if ($expiresAt && trim($expiresAt) !== '') {
            $ts = strtotime($expiresAt);
            if ($ts) $expiresAtVal = date('Y-m-d H:i:s', $ts);
        }

        $now = date('Y-m-d H:i:s');

        if ($id) {
            $existing = Database::queryOne('SELECT id FROM "PromoCode" WHERE id = :id', [':id' => (int)$id]);
            if (!$existing) Response::error('Promo code not found', 404);

            $conflict = Database::queryOne(
                'SELECT id FROM "PromoCode" WHERE code = :c AND id != :id',
                [':c' => $code, ':id' => (int)$id]
            );
            if ($conflict) Response::error('A promo code with this code already exists', 409);

            Database::execute(
                'UPDATE "PromoCode" SET code=:c, name=:n, discountPercent=:dp, applicablePlans=:ap,
                 status=:s, usesLimit=:ul, expiresAt=:ea, updatedAt=:now WHERE id=:id',
                [
                    ':c' => $code, ':n' => $name ?: null, ':dp' => $discountFloat,
                    ':ap' => $applicablePlansJson, ':s' => $status,
                    ':ul' => $usesLimit, ':ea' => $expiresAtVal,
                    ':now' => $now, ':id' => (int)$id,
                ]
            );
            $row = Database::queryOne('SELECT * FROM "PromoCode" WHERE id = :id', [':id' => (int)$id]);
        } else {
            $conflict = Database::queryOne('SELECT id FROM "PromoCode" WHERE code = :c', [':c' => $code]);
            if ($conflict) Response::error('A promo code with this code already exists', 409);

            $newId = Database::insert(
                'INSERT INTO "PromoCode" (code, name, discountPercent, applicablePlans, status, usesLimit, usesCount, expiresAt, createdAt, updatedAt)
                 VALUES (:c, :n, :dp, :ap, :s, :ul, 0, :ea, :now1, :now2)',
                [
                    ':c' => $code, ':n' => $name ?: null, ':dp' => $discountFloat,
                    ':ap' => $applicablePlansJson, ':s' => $status,
                    ':ul' => $usesLimit, ':ea' => $expiresAtVal, ':now1' => $now, ':now2' => $now,
                ]
            );
            $row = Database::queryOne('SELECT * FROM "PromoCode" WHERE id = :id', [':id' => $newId]);
        }

        Response::json($row);
    }

    public function deletePromoCode(Request $req): void
    {
        $id = (int)($req->params['id'] ?? 0);
        if (!$id) Response::error('Promo code ID required', 400);

        $existing = Database::queryOne('SELECT id FROM "PromoCode" WHERE id = :id', [':id' => $id]);
        if (!$existing) Response::error('Promo code not found', 404);

        Database::execute('DELETE FROM "PromoCode" WHERE id = :id', [':id' => $id]);
        Response::json(['success' => true]);
    }

    // ── OU Validation ─────────────────────────────────────────────────────────

    public function validateOuPath(Request $req): void
    {
        $path = trim((string)($req->query['path'] ?? ''));
        if (!$path) Response::error('path required', 400);

        $valid = GoogleWorkspaceService::validateOrgUnit($path);
        Response::json(['valid' => $valid, 'path' => $path]);
    }

    // ── Change Plan (SUPERADMIN only) ─────────────────────────────────────────

    public function getUsersWithPlans(Request $req): void
    {
        $search = trim((string)($req->query['search'] ?? ''));
        $searchParam = $search ? "%{$search}%" : '%';

        $rows = Database::query(
            'SELECT u.id, u.name, u.email, u.phone, u.recoveryEmail, u.recoveryPhone,
                    w.planId, p.name AS planName, w.billingPeriod, w.renewalDate, w.status AS workspaceStatus
             FROM "User" u
             LEFT JOIN "Workspace" w ON w.userId = u.id AND w.status = \'ACTIVE\'
             LEFT JOIN "Plan" p ON p.id = w.planId
             WHERE u.role = \'USER\'
               AND (u.email LIKE :s1 OR u.name LIKE :s2)
             ORDER BY u.createdAt DESC
             LIMIT 200',
            [':s1' => $searchParam, ':s2' => $searchParam]
        );

        Response::json($rows ?: []);
    }

    public function changePlan(Request $req): void
    {
        $userId        = (int)($req->params['id'] ?? 0);
        $body          = $req->body ?? [];
        $planId        = (int)($body['planId'] ?? 0);
        $billingPeriod = (string)($body['billingPeriod'] ?? '');
        $paymentMethod = (string)($body['paymentMethod'] ?? '');
        $paymentRef    = trim((string)($body['paymentRef'] ?? ''));
        $note          = trim((string)($body['note'] ?? ''));

        if (!$userId) Response::error('User ID required', 400);
        if (!$planId) Response::error('Plan ID required', 400);
        if (!in_array($billingPeriod, ['monthly', 'yearly'], true)) Response::error('Invalid billing period', 400);
        if (!in_array($paymentMethod, ['NEFT', 'Cash', 'Cheque', 'Other'], true)) Response::error('Invalid payment method', 400);
        if ($paymentRef === '') Response::error('Payment reference is required', 400);

        $user = Database::queryOne(
            'SELECT id, name, email FROM "User" WHERE id = :id AND role = \'USER\'',
            [':id' => $userId]
        );
        if (!$user) Response::error('User not found', 404);

        $plan = Database::queryOne(
            'SELECT id, name, googleOrgUnit FROM "Plan" WHERE id = :id AND isActive = 1',
            [':id' => $planId]
        );
        if (!$plan) Response::error('Plan not found or inactive', 404);

        // Old plan for audit / email
        $oldWs = Database::queryOne(
            'SELECT w.planId, p.name AS planName FROM "Workspace" w
             LEFT JOIN "Plan" p ON p.id = w.planId
             WHERE w.userId = :uid',
            [':uid' => $userId]
        );
        $oldPlanName = $oldWs['planName'] ?? 'None';

        $now         = date('Y-m-d H:i:s');
        $renewalDate = date('Y-m-d H:i:s', strtotime($billingPeriod === 'yearly' ? '+365 days' : '+30 days'));

        // Upsert Workspace
        if ($oldWs) {
            Database::execute(
                'UPDATE "Workspace" SET planId=:pid, billingPeriod=:bp, renewalDate=:rd,
                 status=\'ACTIVE\', nextPlanId=NULL, updatedAt=:now WHERE userId=:uid',
                [':pid' => $planId, ':bp' => $billingPeriod, ':rd' => $renewalDate, ':now' => $now, ':uid' => $userId]
            );
        } else {
            Database::execute(
                'INSERT INTO "Workspace" (userId, planId, status, billingPeriod, renewalDate, createdAt, updatedAt)
                 VALUES (:uid, :pid, \'ACTIVE\', :bp, :rd, NOW(), NOW())',
                [':uid' => $userId, ':pid' => $planId, ':bp' => $billingPeriod, ':rd' => $renewalDate]
            );
        }

        // Upsert Subscription
        $existingSub = Database::queryOne('SELECT id FROM "Subscription" WHERE user_id=:uid', [':uid' => $userId]);
        if ($existingSub) {
            Database::execute(
                'UPDATE "Subscription" SET plan_name=:pn, payment_id=:pi, status=\'active\',
                 start_date=:sd, end_date=:ed, updated_at=:now WHERE user_id=:uid',
                [':pn' => $plan['name'], ':pi' => $paymentRef, ':sd' => $now, ':ed' => $renewalDate, ':now' => $now, ':uid' => $userId]
            );
        } else {
            Database::execute(
                'INSERT INTO "Subscription" (user_id, plan_name, payment_id, status, start_date, end_date, created_at, updated_at)
                 VALUES (:uid, :pn, :pi, \'active\', :sd, :ed, NOW(), NOW())',
                [':uid' => $userId, ':pn' => $plan['name'], ':pi' => $paymentRef, ':sd' => $now, ':ed' => $renewalDate]
            );
        }

        // Create Order record
        Database::execute(
            'INSERT INTO "Order" (userId, planId, amount, currency, status, paymentId, orderType, billingPeriod, fromPlanId, createdAt, updatedAt)
             VALUES (:uid, :pid, 0, \'INR\', \'COMPLETED\', :pi, \'ADMIN_OVERRIDE\', :bp, :fpid, NOW(), NOW())',
            [
                ':uid'  => $userId, ':pid'  => $planId, ':pi'   => $paymentRef,
                ':bp'   => $billingPeriod, ':fpid' => $oldWs['planId'] ?? null,
            ]
        );

        // Audit log
        $actorId = (int)($req->user['userId'] ?? 0);
        $actor   = Database::queryOne('SELECT email FROM "User" WHERE id=:id', [':id' => $actorId]);
        AuditService::log('ADMIN_PLAN_CHANGE', $actorId, $req->ip ?? '', [
            'targetUserId'    => $userId,
            'targetUserEmail' => $user['email'],
            'oldPlan'         => $oldPlanName,
            'newPlan'         => $plan['name'],
            'billingPeriod'   => $billingPeriod,
            'paymentMethod'   => $paymentMethod,
            'paymentRef'      => $paymentRef,
            'note'            => $note ?: null,
        ]);

        // Move Google OU (best-effort) — User.email is username@webmydrive.com
        if (!empty($plan['googleOrgUnit'])) {
            try {
                GoogleWorkspaceService::moveUserToOrgUnit($user['email'], $plan['googleOrgUnit']);
            } catch (Throwable $e) {
                Logger::warn('[changePlan] Google OU move failed: ' . $e->getMessage());
            }
        }

        // Send emails
        $adminEmail = $actor['email'] ?? 'admin@webmydrive.com';
        $this->sendPlanChangeEmails($user, $oldPlanName, $plan['name'], $billingPeriod, $renewalDate, $paymentMethod, $paymentRef, $note, $adminEmail);

        Response::json(['success' => true, 'message' => 'Plan updated successfully']);
    }

    private function sendPlanChangeEmails(
        array $user, string $oldPlan, string $newPlan, string $billingPeriod,
        string $renewalDate, string $paymentMethod, string $paymentRef,
        string $note, string $adminEmail
    ): void {
        $userName    = $user['name'] ?: $user['email'];
        $renewal     = date('d M Y', strtotime($renewalDate));
        $billingLabel = ucfirst($billingPeriod);

        // ── Email to user ──────────────────────────────────────────────────────
        $bodyUser =
            "Dear {$userName},\n\n"
            . "Your WebMyDrive plan has been updated by our team.\n\n"
            . "Previous Plan : {$oldPlan}\n"
            . "New Plan      : {$newPlan}\n"
            . "Billing       : {$billingLabel}\n"
            . "Valid Until   : {$renewal}\n"
            . "Payment Ref   : {$paymentRef}\n"
            . ($note ? "Note          : {$note}\n" : '')
            . "\nIf you have any questions, please contact support@technodoc.in\n\n"
            . "Thank you,\nWebMyDrive Team";

        @mail(
            $user['email'],
            'Your WebMyDrive plan has been updated',
            $bodyUser,
            "From: noreply@webmydrive.com\r\nReply-To: support@technodoc.in\r\nContent-Type: text/plain; charset=UTF-8"
        );

        // ── Email to support ───────────────────────────────────────────────────
        $bodySupport =
            "Plan change performed by admin.\n\n"
            . "Admin          : {$adminEmail}\n"
            . "User           : {$user['email']}\n"
            . "Old Plan       : {$oldPlan}\n"
            . "New Plan       : {$newPlan}\n"
            . "Billing        : {$billingLabel}\n"
            . "Renewal Date   : {$renewal}\n"
            . "Payment Method : {$paymentMethod}\n"
            . "Payment Ref    : {$paymentRef}\n"
            . ($note ? "Note           : {$note}\n" : '')
            . "\nTimestamp: " . date('d M Y H:i:s') . " (server time)";

        @mail(
            'support@technodoc.in',
            "[Admin Action] Plan changed: {$user['email']}",
            $bodySupport,
            "From: noreply@webmydrive.com\r\nContent-Type: text/plain; charset=UTF-8"
        );
    }
}

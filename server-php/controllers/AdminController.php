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
            'SELECT rl.*, u.email AS refereeEmail FROM "ReferralLog" rl LEFT JOIN "User" u ON u.id = rl.refereeId WHERE rl.referrerUserId = :uid',
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
        Database::execute('DELETE FROM "ReferralLog" WHERE referrerUserId = :id OR refereeId = :id', [':id' => $id]);
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
                    (SELECT COALESCE(SUM(ABS(amount)),0) FROM "DistributorWalletTx" WHERE distributorId = d.id AND status = \'PENDING\') AS pendingWithdrawal
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
                'tier' => $d['tier'],
                'commissionPct' => 10,
                'referralCode' => $d['referralCode'],
                'totalCustomers' => (int) $d['totalCustomers'],
                'activeCustomers' => (int) $d['totalCustomers'],
                'walletBalanceINR' => (float) $d['walletBalance'],
                'revenueThisYearINR' => (float) $d['revenueThisYear'],
                'revenueGeneratedINR' => (float) $d['revenueThisYear'],
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
             LEFT JOIN "User" rr ON rr.id = rl.referrerUserId
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
                    [':diff' => $diff, ':now' => $now, ':uid' => $log['referrerUserId']]
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

        $keywords = ['PAYMENT', 'CHECKOUT', 'COMMISSION', 'WALLET', 'ORDER', 'PURCHASE', 'REFERRAL', 'RAZORPAY', 'STRIPE', 'PLAN_PURCHASE', 'BILLING', 'PAYOUT'];
        $orClauses = implode(' OR ', array_map(fn($k) => "actionName LIKE '%$k%'", $keywords));

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
             LEFT JOIN "User" rr ON rr.id = rl.referrerUserId
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
        $plans = Database::query('SELECT * FROM "Plan" ORDER BY price ASC');
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
                 isActive=CASE WHEN :ia IS NOT NULL THEN :ia ELSE isActive END,
                 hasOverride=CASE WHEN :ho IS NOT NULL THEN :ho ELSE hasOverride END,
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
                    ':ia' => $isActive !== null ? (int) (bool) $isActive : null,
                    ':ho' => $hasOverride !== null ? (int) (bool) $hasOverride : null,
                    ':now' => $now,
                    ':id' => (int) $id,
                ]
            );
            $plan = Database::queryOne('SELECT * FROM "Plan" WHERE id = :id', [':id' => (int) $id]);
        } else {
            $newId = Database::insert(
                'INSERT INTO "Plan" (name, price, priceINR, priceMonthlyINR, priceYearlyINR, features, isActive, storageGB, maxUsers, googleSKU, hasOverride, createdAt, updatedAt)
                 VALUES (:name, :price, :pINR, :pM, :pY, :feats, :ia, :storage, :maxu, :sku, :ho, :now, :now)',
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
                    ':now' => $now,
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
}

<?php
/**
 * UserController — Mirrors /src/routes/user.ts (inline route handlers)
 *
 * Routes:
 *   GET  /api/user/workspace          [authenticated]
 *   GET  /api/user/check-username
 *   GET  /api/user/plans              (public)
 *   POST /api/user/plans/:id/purchase [authenticated]
 *   GET  /api/user/orders             [authenticated]
 *   PUT  /api/user/profile            [authenticated]
 */

declare(strict_types=1);

class UserController
{
    public function getWorkspace(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        $workspace = Database::queryOne(
            'SELECT w.*, p.id AS planId, p.name AS planName, p.price AS planPrice
             FROM "Workspace" w
             LEFT JOIN "Plan" p ON p.id = w.planId
             WHERE w.userId = :uid
             ORDER BY w.createdAt DESC
             LIMIT 1',
            [':uid' => $userId]
        );
        Response::json(['workspace' => $workspace]);
    }

    public function checkUsername(Request $req): void
    {
        $username = (string) ($req->query['u'] ?? '');
        if (!$username)
            Response::error('Username required', 400);

        $emailToSearch = str_contains($username, '@') ? $username : "$username@webmydrive.com";
        $base = strtolower(preg_replace('/[^a-z0-9._-]/', '', explode('@', $emailToSearch)[0]));

        $existing = Database::queryOne(
            'SELECT id FROM "User" WHERE email = :e OR displayEmail = :e',
            [':e' => $emailToSearch]
        );

        if ($existing) {
            $year = date('Y');
            $candidates = [
                "{$base}{$year}",
                "{$base}" . (rand(100, 999)),
                "{$base}_drive",
                "{$base}pro",
                "{$base}" . (rand(10, 99)),
            ];

            $suggestions = [];
            foreach ($candidates as $candidate) {
                if (count($suggestions) >= 2)
                    break;
                $candidateEmail = "$candidate@webmydrive.com";
                $conflict = Database::queryOne(
                    'SELECT id FROM "User" WHERE email = :e OR displayEmail = :e',
                    [':e' => $candidateEmail]
                );
                if (!$conflict)
                    $suggestions[] = $candidateEmail;
            }

            if (count($suggestions) < 2) {
                $suggestions[] = $base . substr((string) time(), -4) . '@webmydrive.com';
            }

            Response::json(['available' => false, 'suggestions' => $suggestions]);
        }

        Response::json(['available' => true, 'email' => $emailToSearch]);
    }

    public function getPlans(Request $req): void
    {
        $plans = Database::query('SELECT * FROM "Plan" ORDER BY price ASC');
        $globalConfig = ConfigService::getGlobalPlanConfig();

        $finalPlans = array_map(function (array $p) use ($globalConfig): array {
            if (!isset($p['hasOverride']) || !(bool) $p['hasOverride']) {
                $p['price'] = $globalConfig['priceINR'];
                $p['priceINR'] = $globalConfig['priceINR'];
                $p['storageGB'] = $globalConfig['storageGB'];
            }
            return $p;
        }, $plans);

        Response::json(['plans' => $finalPlans]);
    }

    public function purchasePlan(Request $req): void
    {
        $planId = (int) ($req->params['id'] ?? 0);
        $userId = $req->user['userId'] ?? null;

        if (!$userId)
            Response::error('Unauthorized', 401);

        $plan = Database::queryOne('SELECT * FROM "Plan" WHERE id = :id', [':id' => $planId]);
        if (!$plan)
            Response::error('Plan not found', 404);

        $now = date('Y-m-d H:i:s');
        $orderId = Database::insert(
            'INSERT INTO "Order" (userId, planId, amount, currency, status, createdAt, updatedAt)
             VALUES (:uid, :pid, :amt, \'INR\', \'PENDING\', :now, :now)',
            [':uid' => $userId, ':pid' => $planId, ':amt' => (float) $plan['price'], ':now' => $now]
        );

        AuditService::log('PLAN_PURCHASE_REQUEST', $userId, $req->ip, [
            'planId' => $planId,
            'planName' => $plan['name'],
            'amount' => $plan['price'],
            'orderId' => $orderId,
        ]);

        $order = Database::queryOne('SELECT * FROM "Order" WHERE id = :id', [':id' => $orderId]);
        Response::json([
            'order' => $order,
            'message' => "Purchase request for \"{$plan['name']}\" created. Pending payment.",
        ]);
    }

    public function getOrders(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        $orders = Database::query(
            'SELECT o.*, p.name AS planName FROM "Order" o LEFT JOIN "Plan" p ON p.id = o.planId WHERE o.userId = :uid ORDER BY o.createdAt DESC LIMIT 20',
            [':uid' => $userId]
        );
        Response::json(['orders' => $orders]);
    }

    public function updateProfile(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        $webMyDriveId = (string) ($req->body['webMyDriveId'] ?? '');
        $password = (string) ($req->body['password'] ?? '');

        if (!$userId)
            Response::error('Unauthorized', 401);
        if (!$webMyDriveId)
            Response::json(['success' => true]);

        // Check for conflict
        $conflict = Database::queryOne(
            'SELECT id FROM "User" WHERE id != :uid AND (email = :e OR displayEmail = :e)',
            [':uid' => $userId, ':e' => $webMyDriveId]
        );
        if ($conflict)
            Response::error('That ID is no longer available', 400);

        $user = Database::queryOne('SELECT * FROM "User" WHERE id = :id', [':id' => $userId]);
        $now = date('Y-m-d H:i:s');

        $updateDisplay = null;
        if ($user && !str_contains($user['email'], '@webmydrive.com')) {
            $updateDisplay = $user['email'];
        }

        $setClauses = ['email = :e', 'updatedAt = :now'];
        $params = [':e' => $webMyDriveId, ':now' => $now, ':id' => $userId];

        if ($updateDisplay !== null) {
            $setClauses[] = 'displayEmail = :de';
            $params[':de'] = $updateDisplay;
        }

        if ($password) {
            $setClauses[] = 'passwordHash = :hash';
            $setClauses[] = 'passwordResetRequired = 0';
            $setClauses[] = 'first_login = 0';
            $params[':hash'] = password_hash($password, PASSWORD_BCRYPT);
        }

        $sql = 'UPDATE "User" SET ' . implode(', ', $setClauses) . ' WHERE id = :id';
        Database::execute($sql, $params);

        $updated = Database::queryOne('SELECT * FROM "User" WHERE id = :id', [':id' => $userId]);
        Response::json(['success' => true, 'user' => $updated]);
    }
}

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
            'SELECT id FROM "User" WHERE email = :e1 OR displayEmail = :e2',
            [':e1' => $emailToSearch, ':e2' => $emailToSearch]
        );

        if (!$existing) {
            $existing = Database::queryOne(
                'SELECT id FROM "ExistingUser" WHERE username = :e',
                [':e' => $emailToSearch]
            );
        }

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
                    'SELECT id FROM "User" WHERE email = :e1 OR displayEmail = :e2',
                    [':e1' => $candidateEmail, ':e2' => $candidateEmail]
                ) ?? Database::queryOne(
                    'SELECT id FROM "ExistingUser" WHERE username = :e',
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
        $plans = Database::query('SELECT * FROM "Plan" WHERE isActive = 1 ORDER BY sortOrder ASC, price ASC');
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

    // ── Profile update helpers ────────────────────────────────────────────────

    /**
     * Returns the provisioned @webmydrive.com email for a user's active workspace,
     * or null if not yet provisioned (PENDING / demo / no workspace).
     */
    private static function getWorkspaceEmail(int $userId): ?string
    {
        $ws = Database::queryOne(
            'SELECT googleCustomerId, metadata FROM "Workspace"
             WHERE userId = :uid AND status = \'ACTIVE\'
             ORDER BY createdAt DESC LIMIT 1',
            [':uid' => $userId]
        );
        if (!$ws) return null;
        $meta  = @json_decode($ws['metadata'] ?? '', true) ?: [];
        $email = $meta['email'] ?? $ws['googleCustomerId'] ?? null;
        return GoogleWorkspaceService::isProvisioned($email) ? $email : null;
    }

    // ── Profile update endpoints ──────────────────────────────────────────────

    public function updateName(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        if (!$userId) Response::error('Unauthorized', 401);

        $firstName = trim((string) ($req->body['firstName'] ?? ''));
        $lastName  = trim((string) ($req->body['lastName']  ?? ''));
        $fullName  = trim("$firstName $lastName");

        Database::execute(
            'UPDATE "User" SET name = :name, updatedAt = :now WHERE id = :id',
            [':name' => $fullName ?: null, ':now' => date('Y-m-d H:i:s'), ':id' => $userId]
        );

        // Sync to Google Workspace (non-blocking — DB update already succeeded)
        $wsEmail = self::getWorkspaceEmail($userId);
        if ($wsEmail) GoogleWorkspaceService::updateName($wsEmail, $firstName, $lastName);

        Response::json(['success' => true]);
    }

    public function updateContact(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        if (!$userId) Response::error('Unauthorized', 401);

        $phone    = trim((string) ($req->body['phone']    ?? '')) ?: null;
        $country  = trim((string) ($req->body['country']  ?? '')) ?: null;
        $timezone = trim((string) ($req->body['timezone'] ?? '')) ?: null;

        Database::execute(
            'UPDATE "User" SET phone = :phone, country = :country, timezone = :tz, updatedAt = :now WHERE id = :id',
            [':phone' => $phone, ':country' => $country, ':tz' => $timezone, ':now' => date('Y-m-d H:i:s'), ':id' => $userId]
        );

        // Sync phone to Google Workspace (country/timezone are portal-only fields)
        if ($phone) {
            $wsEmail = self::getWorkspaceEmail($userId);
            if ($wsEmail) GoogleWorkspaceService::updatePhone($wsEmail, $phone);
        }

        Response::json(['success' => true]);
    }

    public function updateRecovery(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        if (!$userId) Response::error('Unauthorized', 401);

        $recoveryEmail = trim((string) ($req->body['recoveryEmail'] ?? '')) ?: null;
        $recoveryPhone = trim((string) ($req->body['recoveryPhone'] ?? '')) ?: null;

        if ($recoveryEmail && !filter_var($recoveryEmail, FILTER_VALIDATE_EMAIL)) {
            Response::error('Invalid recovery email address', 400);
        }

        Database::execute(
            'UPDATE "User" SET recoveryEmail = :re, recoveryPhone = :rp, updatedAt = :now WHERE id = :id',
            [':re' => $recoveryEmail, ':rp' => $recoveryPhone, ':now' => date('Y-m-d H:i:s'), ':id' => $userId]
        );

        // Sync recovery info to Google Workspace
        $wsEmail = self::getWorkspaceEmail($userId);
        if ($wsEmail) GoogleWorkspaceService::updateRecovery($wsEmail, $recoveryEmail, $recoveryPhone);

        Response::json(['success' => true]);
    }

    public function getStorage(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        if (!$userId) Response::error('Unauthorized', 401);

        // Try Google Drive API first
        $ws = Database::queryOne(
            'SELECT googleCustomerId, metadata FROM "Workspace"
             WHERE userId = :uid AND status = \'ACTIVE\'
             ORDER BY createdAt DESC LIMIT 1',
            [':uid' => $userId]
        );
        if ($ws) {
            $meta    = @json_decode($ws['metadata'] ?? '', true) ?: [];
            $wsEmail = $meta['email'] ?? $ws['googleCustomerId'] ?? null;
            if (GoogleWorkspaceService::isProvisioned($wsEmail)) {
                $info = GoogleWorkspaceService::getStorageInfo($wsEmail);
                if ($info) {
                    Response::json([
                        'used'      => $info['used'],
                        'limit'     => $info['limit'],
                        'breakdown' => [
                            'drive'      => $info['drive'],
                            'driveTrash' => $info['driveTrash'],
                            'mail'       => $info['mail'],
                        ],
                        'source' => 'google',
                    ]);
                    return;
                }
            }
        }

        // Fallback: DB-stored values
        $user = Database::queryOne(
            'SELECT storageUsed, storageLimit FROM "User" WHERE id = :id',
            [':id' => $userId]
        );
        Response::json([
            'used'      => (int) ($user['storageUsed']  ?? 0),
            'limit'     => (int) ($user['storageLimit'] ?? 0),
            'breakdown' => ['drive' => 0, 'driveTrash' => 0, 'mail' => 0],
            'source'    => 'db',
        ]);
    }

    public function getLoginHistory(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        if (!$userId) Response::error('Unauthorized', 401);

        $logs = Database::query(
            'SELECT ip, details, createdAt FROM "AuditLog"
             WHERE userId = :uid AND action = \'LOGIN\'
             ORDER BY createdAt DESC LIMIT 20',
            [':uid' => $userId]
        );

        $history = array_map(function (array $row): array {
            return [
                'ip'   => $row['ip'] ?? '—',
                'date' => $row['createdAt'],
            ];
        }, $logs);

        Response::json(['history' => $history]);
    }

    public function getSessions(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        if (!$userId) Response::error('Unauthorized', 401);

        // Sessions within the JWT expiry window (7 days), not revoked
        $rows = Database::query(
            'SELECT id, ipAddress, userAgent, createdAt FROM "UserSession"
             WHERE userId = :uid AND revokedAt IS NULL
               AND createdAt > DATE_SUB(NOW(), INTERVAL 7 DAY)
             ORDER BY createdAt DESC LIMIT 20',
            [':uid' => $userId]
        );

        $sessions = [];
        foreach ($rows as $i => $s) {
            $sessions[] = [
                'id'        => (int) $s['id'],
                'ip'        => $s['ipAddress'] ?? '—',
                'device'    => self::parseUserAgent($s['userAgent'] ?? ''),
                'createdAt' => $s['createdAt'],
                'current'   => $i === 0,
            ];
        }

        Response::json(['sessions' => $sessions]);
    }

    public function revokeSession(Request $req): void
    {
        $userId    = $req->user['userId'] ?? null;
        $sessionId = (int) ($req->params['id'] ?? 0);
        if (!$userId) Response::error('Unauthorized', 401);

        Database::execute(
            'UPDATE "UserSession" SET revokedAt = NOW() WHERE id = :id AND userId = :uid AND revokedAt IS NULL',
            [':id' => $sessionId, ':uid' => $userId]
        );
        Response::json(['success' => true]);
    }

    public function getSharedDrives(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        if (!$userId) Response::error('Unauthorized', 401);

        $ws = Database::queryOne(
            'SELECT googleCustomerId, metadata FROM "Workspace"
             WHERE userId = :uid AND status = \'ACTIVE\'
             ORDER BY createdAt DESC LIMIT 1',
            [':uid' => $userId]
        );

        if (!$ws) {
            Response::json(['drives' => [], 'provisioned' => false]);
            return;
        }

        $meta    = @json_decode($ws['metadata'] ?? '', true) ?: [];
        $wsEmail = $meta['email'] ?? $ws['googleCustomerId'] ?? null;

        if (!GoogleWorkspaceService::isProvisioned($wsEmail)) {
            Response::json(['drives' => [], 'provisioned' => false]);
            return;
        }

        $drives = GoogleWorkspaceService::getSharedDrives($wsEmail);
        Response::json(['drives' => $drives, 'provisioned' => true]);
    }

    public function refreshWorkspaceData(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        if (!$userId) Response::error('Unauthorized', 401);

        $limit = 3;
        $refreshCount = Database::count(
            '"AuditLog"',
            "userId = :uid AND action = 'WORKSPACE_REFRESH' AND createdAt > DATE_SUB(NOW(), INTERVAL 24 HOUR)",
            [':uid' => $userId]
        );

        if ($refreshCount >= $limit) {
            http_response_code(429);
            Response::json([
                'error'        => 'Refresh limit reached. You can refresh up to 3 times per 24 hours.',
                'refreshCount' => $refreshCount,
                'refreshLimit' => $limit,
            ]);
            return;
        }

        $ws = Database::queryOne(
            'SELECT googleCustomerId, metadata FROM "Workspace"
             WHERE userId = :uid AND status = \'ACTIVE\'
             ORDER BY createdAt DESC LIMIT 1',
            [':uid' => $userId]
        );

        $storageInfo = null;
        if ($ws) {
            $meta    = @json_decode($ws['metadata'] ?? '', true) ?: [];
            $wsEmail = $meta['email'] ?? $ws['googleCustomerId'] ?? null;
            if (GoogleWorkspaceService::isProvisioned($wsEmail)) {
                $storageInfo = GoogleWorkspaceService::getStorageInfo($wsEmail);
            }
        }

        AuditService::log('WORKSPACE_REFRESH', $userId, $req->ip, []);

        $newCount = $refreshCount + 1;
        Response::json([
            'success'      => true,
            'refreshCount' => $newCount,
            'refreshLimit' => $limit,
            'storage'      => $storageInfo,
        ]);
    }

    public function getWorkspaceSecurity(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        if (!$userId) Response::error('Unauthorized', 401);

        $ws = Database::queryOne(
            'SELECT googleCustomerId, metadata FROM "Workspace"
             WHERE userId = :uid AND status = \'ACTIVE\'
             ORDER BY createdAt DESC LIMIT 1',
            [':uid' => $userId]
        );

        if (!$ws) {
            Response::json(['provisioned' => false, 'twoFAEnabled' => null]);
            return;
        }

        $meta    = @json_decode($ws['metadata'] ?? '', true) ?: [];
        $wsEmail = $meta['email'] ?? $ws['googleCustomerId'] ?? null;

        if (!GoogleWorkspaceService::isProvisioned($wsEmail)) {
            Response::json(['provisioned' => false, 'twoFAEnabled' => null]);
            return;
        }

        $twoFA = GoogleWorkspaceService::get2FAStatus($wsEmail);
        Response::json(['provisioned' => true, 'twoFAEnabled' => $twoFA, 'workspaceEmail' => $wsEmail]);
    }

    // ── Plan lifecycle helpers ─────────────────────────────────────────────────

    /**
     * Fetch active Workspace + joined Plan for the authenticated user.
     * Also lazy-processes any pending downgrade if renewalDate has passed.
     */
    private function getActiveWorkspacePlan(int $userId): ?array
    {
        $ws = Database::queryOne(
            'SELECT w.*, p.name AS planName, p.monthlyPrice, p.yearlyPrice,
                    p.storageGB, p.features, p.googleOrgUnit, p.sortOrder,
                    np.name AS nextPlanName, np.googleOrgUnit AS nextOrgUnit
             FROM "Workspace" w
             LEFT JOIN "Plan" p  ON p.id  = w.planId
             LEFT JOIN "Plan" np ON np.id = w.nextPlanId
             WHERE w.userId = :uid AND w.status = \'ACTIVE\'
             ORDER BY w.createdAt DESC LIMIT 1',
            [':uid' => $userId]
        );
        if (!$ws) return null;

        // Lazy downgrade: if renewalDate has passed and a downgrade is pending, apply it now
        if ($ws['nextPlanId'] && $ws['renewalDate'] && strtotime($ws['renewalDate']) < time()) {
            $meta    = @json_decode($ws['metadata'] ?? '', true) ?: [];
            $wsEmail = $meta['email'] ?? $ws['googleCustomerId'] ?? null;

            $nextPlan = Database::queryOne('SELECT * FROM "Plan" WHERE id = :id', [':id' => $ws['nextPlanId']]);
            if ($nextPlan) {
                $newOrgUnit = $nextPlan['googleOrgUnit'] ?? '';
                if ($newOrgUnit) GoogleWorkspaceService::moveUserToOrgUnit($wsEmail, $newOrgUnit);

                $billingDays = ($ws['billingPeriod'] === 'monthly') ? 30 : 365;
                $newRenewal  = date('Y-m-d H:i:s', strtotime($ws['renewalDate']) + $billingDays * 86400);

                $newBase = ($ws['billingPeriod'] === 'monthly')
                    ? (float)($nextPlan['monthlyPrice'] ?? 0)
                    : (float)($nextPlan['yearlyPrice'] ?? 0) * 12;

                Database::execute(
                    'UPDATE "Workspace" SET planId = :pid, nextPlanId = NULL, renewalDate = :rd,
                     baseAmountPaid = :base, updatedAt = NOW() WHERE id = :id',
                    [':pid' => $ws['nextPlanId'], ':rd' => $newRenewal,
                     ':base' => round($newBase, 2), ':id' => $ws['id']]
                );
                Database::execute(
                    'UPDATE "Subscription" SET plan_name = :pn, planId = :pid, end_date = :ed,
                     updated_at = NOW() WHERE user_id = :uid',
                    [':pn' => $nextPlan['name'], ':pid' => $nextPlan['id'],
                     ':ed' => $newRenewal, ':uid' => $userId]
                );
                AuditService::log('PLAN_DOWNGRADE_ACTIVATED', $userId, '', ['fromPlanId' => $ws['planId'], 'toPlanId' => $ws['nextPlanId']]);
                // Re-fetch updated workspace
                return $this->getActiveWorkspacePlan($userId);
            }
        }
        return $ws;
    }

    /** Resolve promo discount % from PromoCode table. Returns 0–100. */
    private function resolvePromoDiscount(string $code, int $planId = 0): float
    {
        if (!$code) return 0.0;
        $row = Database::queryOne(
            'SELECT discountPercent, applicablePlans FROM "PromoCode"
             WHERE code = :c AND status = \'ACTIVE\'
             AND (expiresAt IS NULL OR expiresAt > NOW())
             AND (usesLimit IS NULL OR usesCount < usesLimit)
             LIMIT 1',
            [':c' => strtoupper($code)]
        );
        if (!$row) return 0.0;
        // Check plan applicability
        if ($row['applicablePlans'] !== null) {
            $applicable = json_decode($row['applicablePlans'], true) ?: [];
            if ($planId && !in_array($planId, $applicable, false)) return 0.0;
        }
        return (float)($row['discountPercent'] ?? 0);
    }

    // ── Plan endpoints ─────────────────────────────────────────────────────────

    public function getCurrentPlan(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        if (!$userId) Response::error('Unauthorized', 401);

        $ws = $this->getActiveWorkspacePlan($userId);
        if (!$ws || !$ws['planId']) {
            Response::json(['hasPlan' => false]);
            return;
        }

        $start = $ws['createdAt'] ?? null;
        $renewal = $ws['renewalDate'] ?? null;
        $daysRemaining = $renewal ? max(0, (int) ceil((strtotime($renewal) - time()) / 86400)) : null;

        Response::json([
            'hasPlan'         => true,
            'planId'          => (int) $ws['planId'],
            'planName'        => $ws['planName'],
            'billingPeriod'   => $ws['billingPeriod'] ?? 'yearly',
            'startDate'       => $start,
            'renewalDate'     => $renewal,
            'daysRemaining'   => $daysRemaining,
            'baseAmountPaid'  => $ws['baseAmountPaid'] ? (float)$ws['baseAmountPaid'] : null,
            'monthlyPrice'    => (float)($ws['monthlyPrice'] ?? 0),
            'yearlyPrice'     => (float)($ws['yearlyPrice'] ?? 0),
            'storageGB'       => (int)($ws['storageGB'] ?? 0),
            'nextPlanId'      => $ws['nextPlanId'] ? (int)$ws['nextPlanId'] : null,
            'nextPlanName'    => $ws['nextPlanName'] ?? null,
        ]);
    }

    public function getUpgradePreview(Request $req): void
    {
        $userId       = $req->user['userId'] ?? null;
        if (!$userId) Response::error('Unauthorized', 401);

        $targetPlanId  = (int)($req->query['planId'] ?? 0);
        $billingPeriod = in_array($req->query['billingPeriod'] ?? 'yearly', ['monthly', 'yearly'])
            ? $req->query['billingPeriod']
            : 'yearly';
        $promoCode     = strtoupper(trim($req->query['promoCode'] ?? ''));

        if (!$targetPlanId) Response::error('planId required', 400);

        $ws = $this->getActiveWorkspacePlan($userId);
        if (!$ws || !$ws['planId']) Response::error('No active plan found', 400);

        $targetPlan = Database::queryOne('SELECT * FROM "Plan" WHERE id = :id AND isActive = 1', [':id' => $targetPlanId]);
        if (!$targetPlan) Response::error('Plan not found', 404);

        $billingDays     = ($billingPeriod === 'monthly') ? 30 : 365;
        $renewalTs       = $ws['renewalDate'] ? strtotime($ws['renewalDate']) : (time() + $billingDays * 86400);
        $daysRemaining   = max(0, (int)ceil(($renewalTs - time()) / 86400));

        // Current plan remaining value (back out from stored base amount)
        $currentBase     = (float)($ws['baseAmountPaid'] ?? 0);
        $currentBillingDays = ($ws['billingPeriod'] === 'monthly') ? 30 : 365;
        $currentDailyRate   = $currentBase > 0 ? $currentBase / $currentBillingDays : 0;
        $remainingValue     = round($currentDailyRate * $daysRemaining, 2);

        // New plan cost for remaining days
        $newPlanPeriodBase = ($billingPeriod === 'monthly')
            ? (float)($targetPlan['monthlyPrice'] ?? 0)
            : (float)($targetPlan['yearlyPrice'] ?? 0) * 12;
        $newDailyRate      = $newPlanPeriodBase / $billingDays;
        $newPlanRemaining  = round($newDailyRate * $daysRemaining, 2);

        // Promo discount on new plan remaining cost
        $discountPct  = $promoCode ? $this->resolvePromoDiscount($promoCode, $targetPlanId) : 0.0;
        $discountAmt  = round($newPlanRemaining * ($discountPct / 100), 2);
        $newAfterPromo = $newPlanRemaining - $discountAmt;

        $upgradeBase  = round($newAfterPromo - $remainingValue, 2);
        $upgradeGST   = round($upgradeBase * 0.18, 2);
        $upgradeTotal = round($upgradeBase * 1.18, 2);

        Response::json([
            'daysRemaining'    => $daysRemaining,
            'currentPlanName'  => $ws['planName'],
            'targetPlanName'   => $targetPlan['name'],
            'billingPeriod'    => $billingPeriod,
            'newPlanRemaining' => $newPlanRemaining,
            'discountPct'      => $discountPct,
            'discountAmt'      => $discountAmt,
            'remainingValue'   => $remainingValue,
            'upgradeBase'      => $upgradeBase,
            'upgradeGST'       => $upgradeGST,
            'upgradeTotal'     => max(1.0, $upgradeTotal), // min ₹1 for Razorpay
            'promoValid'       => $promoCode !== '' && $discountPct > 0,
        ]);
    }

    public function initiateUpgrade(Request $req): void
    {
        $userId        = $req->user['userId'] ?? null;
        if (!$userId) Response::error('Unauthorized', 401);

        $targetPlanId  = (int)($req->body['planId'] ?? 0);
        $billingPeriod = in_array($req->body['billingPeriod'] ?? 'yearly', ['monthly', 'yearly'])
            ? $req->body['billingPeriod'] : 'yearly';
        $promoCode     = strtoupper(trim($req->body['promoCode'] ?? ''));

        if (!$targetPlanId) Response::error('planId required', 400);

        $ws = $this->getActiveWorkspacePlan($userId);
        if (!$ws) Response::error('No active workspace', 400);

        $targetPlan = Database::queryOne('SELECT * FROM "Plan" WHERE id = :id AND isActive = 1', [':id' => $targetPlanId]);
        if (!$targetPlan) Response::error('Plan not found', 404);

        // Recalculate preview to get authoritative total
        $_GET['planId']        = (string)$targetPlanId;
        $_GET['billingPeriod'] = $billingPeriod;
        $_GET['promoCode']     = $promoCode;
        ob_start();
        $this->getUpgradePreview($req);
        $previewJson = ob_get_clean();
        $preview = json_decode($previewJson, true);

        $amountINR = (float)($preview['upgradeTotal'] ?? 1);

        // Create Razorpay order
        $receipt = 'UPG-' . $userId . '-' . time();
        $rzpOrder = RazorpayService::createOrder($amountINR, $receipt);

        // Create pending Order record
        $baseAmt = round($amountINR / 1.18, 2);
        $gstAmt  = round($amountINR - $baseAmt, 2);
        $orderId = Database::insert(
            'INSERT INTO "Order" (userId, planId, amount, baseAmount, gstAmount, currency, status,
             orderType, billingPeriod, promoCode, discountAmount, fromPlanId, createdAt, updatedAt)
             VALUES (:uid, :pid, :amt, :base, :gst, \'INR\', \'PENDING\',
             \'UPGRADE\', :bp, :promo, :disc, :fpid, NOW(), NOW())',
            [':uid' => $userId, ':pid' => $targetPlanId, ':amt' => $amountINR,
             ':base' => $baseAmt, ':gst' => $gstAmt, ':bp' => $billingPeriod,
             ':promo' => $promoCode ?: null, ':disc' => $preview['discountAmt'] ?? 0,
             ':fpid' => $ws['planId']]
        );

        AuditService::log('PLAN_UPGRADE_INITIATED', $userId, $req->ip,
            ['fromPlanId' => $ws['planId'], 'toPlanId' => $targetPlanId, 'amount' => $amountINR]);

        Response::json([
            'orderId'       => $orderId,
            'razorpayOrderId' => $rzpOrder['id'],
            'razorpayKeyId' => RAZORPAY_KEY_ID,
            'amount'        => $amountINR,
            'breakdown'     => $preview,
            'isDemoMode'    => RazorpayService::isDemoMode(),
        ]);
    }

    public function confirmUpgrade(Request $req): void
    {
        $userId    = $req->user['userId'] ?? null;
        if (!$userId) Response::error('Unauthorized', 401);

        $orderId   = (int)($req->body['orderId'] ?? 0);
        $paymentId = (string)($req->body['razorpayPaymentId'] ?? '');
        $rzpOrdId  = (string)($req->body['razorpayOrderId'] ?? '');
        $sig       = (string)($req->body['razorpaySignature'] ?? '');

        if (!$orderId || !$paymentId) Response::error('orderId and razorpayPaymentId required', 400);

        // Verify signature
        if (!RazorpayService::verifySignature($rzpOrdId, $paymentId, $sig)) {
            Response::error('Payment signature invalid', 400);
        }

        // Load order
        $order = Database::queryOne(
            'SELECT * FROM "Order" WHERE id = :id AND userId = :uid AND status = \'PENDING\' AND orderType = \'UPGRADE\'',
            [':id' => $orderId, ':uid' => $userId]
        );
        if (!$order) Response::error('Order not found or already processed', 404);

        $targetPlan = Database::queryOne('SELECT * FROM "Plan" WHERE id = :id', [':id' => $order['planId']]);
        if (!$targetPlan) Response::error('Target plan not found', 404);

        $ws = $this->getActiveWorkspacePlan($userId);
        if (!$ws) Response::error('No active workspace', 400);

        // Mark order complete
        Database::execute(
            'UPDATE "Order" SET status = \'COMPLETED\', paymentId = :pid, updatedAt = NOW() WHERE id = :id',
            [':pid' => $paymentId, ':id' => $orderId]
        );

        // Increment promo code usage counter if one was used
        if (!empty($order['promoCode'])) {
            Database::execute(
                'UPDATE "PromoCode" SET usesCount = usesCount + 1, updatedAt = NOW() WHERE code = :c',
                [':c' => $order['promoCode']]
            );
        }

        // Move Google Workspace user to new OU
        $meta    = @json_decode($ws['metadata'] ?? '', true) ?: [];
        $wsEmail = $meta['email'] ?? $ws['googleCustomerId'] ?? null;
        $orgUnit = $targetPlan['googleOrgUnit'] ?? '';
        if ($orgUnit) {
            GoogleWorkspaceService::moveUserToOrgUnit($wsEmail, $orgUnit);
        } else {
            Logger::error("[Plans] confirmUpgrade: Plan {$targetPlan['id']} has no googleOrgUnit set — OU not changed");
        }

        // Update Workspace
        $billingPeriod   = $order['billingPeriod'] ?? 'yearly';
        $billingDays     = ($billingPeriod === 'monthly') ? 30 : 365;
        $newRenewal      = date('Y-m-d H:i:s', time() + $billingDays * 86400);
        $newPeriodBase   = ($billingPeriod === 'monthly')
            ? (float)($targetPlan['monthlyPrice'] ?? 0)
            : (float)($targetPlan['yearlyPrice'] ?? 0) * 12;

        Database::execute(
            'UPDATE "Workspace" SET planId = :pid, billingPeriod = :bp, renewalDate = :rd,
             baseAmountPaid = :base, nextPlanId = NULL, updatedAt = NOW() WHERE id = :wid',
            [':pid' => $targetPlan['id'], ':bp' => $billingPeriod, ':rd' => $newRenewal,
             ':base' => round($newPeriodBase, 2), ':wid' => $ws['id']]
        );

        // Update Subscription
        Database::execute(
            'UPDATE "Subscription" SET plan_name = :pn, planId = :pid, billingPeriod = :bp,
             end_date = :ed, updated_at = NOW() WHERE user_id = :uid',
            [':pn' => $targetPlan['name'], ':pid' => $targetPlan['id'],
             ':bp' => $billingPeriod, ':ed' => $newRenewal, ':uid' => $userId]
        );

        AuditService::log('PLAN_UPGRADED', $userId, $req->ip,
            ['fromPlanId' => $order['fromPlanId'], 'toPlanId' => $targetPlan['id'],
             'amount' => $order['amount'], 'paymentId' => $paymentId]);

        Response::json([
            'success'     => true,
            'newPlanName' => $targetPlan['name'],
            'renewalDate' => $newRenewal,
        ]);
    }

    public function scheduleDowngrade(Request $req): void
    {
        $userId       = $req->user['userId'] ?? null;
        if (!$userId) Response::error('Unauthorized', 401);

        $targetPlanId = (int)($req->body['planId'] ?? 0);
        if (!$targetPlanId) Response::error('planId required', 400);

        $ws = $this->getActiveWorkspacePlan($userId);
        if (!$ws || !$ws['planId']) Response::error('No active plan found', 400);

        $targetPlan = Database::queryOne('SELECT * FROM "Plan" WHERE id = :id AND isActive = 1', [':id' => $targetPlanId]);
        if (!$targetPlan) Response::error('Plan not found', 404);

        // Verify it is actually a downgrade
        $currentMonthly = (float)($ws['monthlyPrice'] ?? 0);
        $targetMonthly  = (float)($targetPlan['monthlyPrice'] ?? 0);
        if ($targetMonthly >= $currentMonthly) {
            Response::error('Use upgrade flow for same or higher plans', 400);
        }

        Database::execute(
            'UPDATE "Workspace" SET nextPlanId = :nid, updatedAt = NOW() WHERE userId = :uid AND status = \'ACTIVE\'',
            [':nid' => $targetPlanId, ':uid' => $userId]
        );

        AuditService::log('PLAN_DOWNGRADE_SCHEDULED', $userId, $req->ip,
            ['fromPlanId' => $ws['planId'], 'toPlanId' => $targetPlanId]);

        Response::json([
            'success'       => true,
            'nextPlanName'  => $targetPlan['name'],
            'effectiveDate' => $ws['renewalDate'],
        ]);
    }

    public function cancelDowngrade(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        if (!$userId) Response::error('Unauthorized', 401);

        Database::execute(
            'UPDATE "Workspace" SET nextPlanId = NULL, updatedAt = NOW() WHERE userId = :uid AND status = \'ACTIVE\'',
            [':uid' => $userId]
        );

        AuditService::log('PLAN_DOWNGRADE_CANCELLED', $userId, $req->ip, []);
        Response::json(['success' => true]);
    }

    private static function parseUserAgent(string $ua): string
    {
        if (!$ua) return 'Unknown Device';

        if (str_contains($ua, 'iPhone') || str_contains($ua, 'iPad')) $os = 'iOS';
        elseif (str_contains($ua, 'Android')) $os = 'Android';
        elseif (str_contains($ua, 'Windows')) $os = 'Windows';
        elseif (str_contains($ua, 'Macintosh') || str_contains($ua, 'Mac OS')) $os = 'macOS';
        elseif (str_contains($ua, 'Linux')) $os = 'Linux';
        else $os = 'Unknown OS';

        if (str_contains($ua, 'Edg/') || str_contains($ua, 'EdgA/')) $browser = 'Edge';
        elseif (str_contains($ua, 'OPR/') || str_contains($ua, 'Opera')) $browser = 'Opera';
        elseif (str_contains($ua, 'Chrome/') && !str_contains($ua, 'Chromium')) $browser = 'Chrome';
        elseif (str_contains($ua, 'Firefox/')) $browser = 'Firefox';
        elseif (str_contains($ua, 'Safari/') && !str_contains($ua, 'Chrome')) $browser = 'Safari';
        else $browser = 'Browser';

        return "$browser / $os";
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

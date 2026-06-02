<?php
/**
 * AuthController — Mirrors src/controllers/AuthController.ts
 *
 * Routes:
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   POST /api/auth/google-login
 *   POST /api/auth/temp-login
 *   GET  /api/auth/me               [authenticated]
 *   POST /api/auth/forgot-password
 *   POST /api/auth/change-password  [authenticated]
 *   POST /api/auth/setup-workspace-password [authenticated]
 */

declare(strict_types=1);

class AuthController
{
    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Name-based referral code: first word of name + year (e.g. "Priya Sharma" → PRIYA2026)
     */
    private static function generateReferralCode(string $name, string $email): string
    {
        $src = trim($name) ?: explode('@', $email)[0];
        $firstWord = preg_split('/\s+/', $src)[0];
        $base = strtoupper(preg_replace('/[^a-z0-9]/i', '', $firstWord));
        $base = substr($base, 0, 12);
        return $base . date('Y');
    }

    /**
     * Generate a unique referral code (collision-safe, up to 10 attempts).
     */
    private static function uniqueReferralCode(string $name, string $email): string
    {
        $base = self::generateReferralCode($name, $email);
        $code = $base;
        for ($attempt = 1; $attempt <= 10; $attempt++) {
            $conflict = Database::queryOne(
                'SELECT id FROM "User" WHERE referralCode = :code',
                [':code' => $code]
            );
            if (!$conflict)
                return $code;
            $code = $base . $attempt;
            if ($attempt === 10)
                throw new RuntimeException('Could not generate unique referral code.');
        }
        return $code; // unreachable; satisfies static analysis
    }

    // ── Handlers ──────────────────────────────────────────────────────────────

    public function register(Request $req): void
    {
        $name = (string) ($req->body['name'] ?? '');
        $email = strtolower(trim((string) ($req->body['email'] ?? '')));
        $password = (string) ($req->body['password'] ?? '');
        $distributorId = $req->body['distributorId'] ?? null;

        if (!$email || !$password)
            Response::error('Email and password are required', 400);
        if (strlen($password) < 8)
            Response::error('Password must be at least 8 characters', 400);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL))
            Response::error('Invalid email address', 400);

        $existing = Database::queryOne('SELECT id FROM "User" WHERE email = :e', [':e' => $email]);
        if ($existing)
            Response::error('Email already registered', 400);

        $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
        $referralCode = self::uniqueReferralCode($name ?: explode('@', $email)[0], $email);
        $displayName = $name ?: explode('@', $email)[0];
        $now = date('Y-m-d H:i:s');

        $id = Database::insert(
            'INSERT INTO "User"
             (name, email, passwordHash, role, referralCode, walletBalance,
              passwordResetRequired, first_login, distributorId, createdAt, updatedAt)
             VALUES (:name, :email, :hash, \'USER\', :code, 0, 1, 1, :dist, :now1, :now2)',
            [
                ':name' => $displayName,
                ':email' => $email,
                ':hash' => $passwordHash,
                ':code' => $referralCode,
                ':dist' => $distributorId ? (int) $distributorId : null,
                ':now1' => $now, ':now2' => $now,
            ]
        );

        AuditService::log('REGISTER', $id, $req->ip, ['email' => $email]);

        $token = JwtHelper::generateToken($id, 'USER');
        Response::json([
            'token' => $token,
            'requiresPasswordChange' => true,
            'first_login' => true,
            'user' => [
                'id' => $id,
                'name' => $displayName,
                'email' => $email,
                'role' => 'USER',
                'referralCode' => $referralCode,
            ],
        ], 201);
    }

    public function login(Request $req): void
    {
        $email = strtolower(trim((string) ($req->body['email'] ?? '')));
        $password = (string) ($req->body['password'] ?? '');

        if (!$email || !$password)
            Response::error('Email and password are required', 400);

        // ── Distributor login ─────────────────────────────────────────────────
        $distributor = Database::queryOne(
            'SELECT * FROM "Distributor" WHERE email = :e',
            [':e' => $email]
        );
        if ($distributor && $distributor['passwordHash']) {
            if (!password_verify($password, $distributor['passwordHash'])) {
                AuditService::log('LOGIN_ATTEMPT', null, $req->ip, ['email' => $email, 'role' => 'DISTRIBUTOR', 'status' => 'failed']);
                Response::error('Invalid credentials', 401);
            }
            if (($distributor['status'] ?? '') === 'INACTIVE') {
                Response::error('Your distributor account has been deactivated. Please contact support.', 403);
            }
            // If distributor has a linked User account, check it is not disabled
            if (!empty($distributor['linkedUserId'])) {
                $linkedUser = Database::queryOne('SELECT isDisabled, deletedAt FROM "User" WHERE id = :id', [':id' => (int)$distributor['linkedUserId']]);
                if ($linkedUser && ($linkedUser['isDisabled'] || $linkedUser['deletedAt'])) {
                    Response::error('Your associated user account is disabled. Please contact support.', 403);
                }
            }
            AuditService::log('LOGIN', null, $req->ip, ['email' => $email, 'role' => 'DISTRIBUTOR']);
            $token = JwtHelper::generateToken(-(int) $distributor['id'], 'DISTRIBUTOR');
            $userToken = null;
            if (!empty($distributor['linkedUserId'])) {
                $userToken = JwtHelper::generateToken((int)$distributor['linkedUserId'], 'USER');
            }
            Response::json([
                'token' => $token,
                'userToken' => $userToken,
                'requiresPasswordChange' => (bool) $distributor['passwordResetRequired'],
                'user' => [
                    'id' => (int) $distributor['id'],
                    'name' => $distributor['name'],
                    'email' => $distributor['displayEmail'] ?? $distributor['email'],
                    'role' => 'DISTRIBUTOR',
                    'distributorId' => (int) $distributor['id'],
                ],
            ]);
        }

        // ── Regular user login ────────────────────────────────────────────────
        $user = Database::queryOne('SELECT * FROM "User" WHERE email = :e', [':e' => $email]);
        if (!$user || !$user['passwordHash']) {
            AuditService::log('LOGIN_ATTEMPT', null, $req->ip, ['email' => $email, 'status' => 'failed']);
            Response::error('Invalid credentials', 401);
        }
        if (!password_verify($password, $user['passwordHash'])) {
            AuditService::log('LOGIN_ATTEMPT', (int) $user['id'], $req->ip, ['email' => $email, 'status' => 'failed']);
            Response::error('Invalid credentials', 401);
        }
        if ($user['isDisabled'])
            Response::error('Your account has been suspended. Please contact support.', 403);

        // Check subscription status for regular users (not admins or super admins)
        $hasActiveSubscription = true;
        if ($user['role'] === 'USER') {
            $subscription = SubscriptionService::getUserSubscription((int) $user['id']);
            if (!$subscription) {
                $hasActiveSubscription = false;
                // Don't block login — let the frontend redirect to /pricing
            }
        }

        // Detect default password pattern
        $src = trim($user['name'] ?? '') ?: explode('@', $user['email'])[0];
        $firstWord = preg_split('/\s+/', $src)[0];
        $basePass = preg_replace('/[^a-z0-9]/i', '', $firstWord);
        $defaultPass = ucfirst(strtolower($basePass)) . date('Y');
        $requiresPasswordChange = (bool) $user['passwordResetRequired'] || $password === $defaultPass;

        AuditService::log('LOGIN', (int) $user['id'], $req->ip, ['email' => $email]);
        $token = JwtHelper::generateToken((int) $user['id'], $user['role']);

        // Track session for real active-sessions view
        try {
            $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500);
            Database::insert(
                'INSERT INTO "UserSession" (userId, ipAddress, userAgent, createdAt) VALUES (:uid, :ip, :ua, NOW())',
                [':uid' => (int) $user['id'], ':ip' => $req->ip, ':ua' => $ua ?: null]
            );
        } catch (Throwable $ignored) {}

        Response::json([
            'token' => $token,
            'requiresPasswordChange' => $requiresPasswordChange,
            'first_login' => (bool) $user['first_login'],
            'hasActiveSubscription' => $hasActiveSubscription,
            'user' => [
                'id' => (int) $user['id'],
                'name' => $user['name'],
                'email' => $user['displayEmail'] ?? $user['email'],
                'role' => $user['role'],
                'referralCode' => $user['referralCode'],
                'walletBalance' => (float) $user['walletBalance'],
            ],
        ]);
    }

    public function googleLogin(Request $req): void
    {
        $idToken = $req->body['idToken'] ?? null;
        $googleEmail = $req->body['googleEmail'] ?? null;
        $googleName = $req->body['name'] ?? null;
        $distributorId = $req->body['distributorId'] ?? null;

        try {
            if ($googleEmail) {
                $email = strtolower(trim((string) $googleEmail));
                $name = $googleName ?: explode('@', $email)[0];
            } elseif ($idToken) {
                // Verify Google ID token via tokeninfo endpoint (no SDK needed)
                [$email, $name] = self::verifyGoogleToken((string) $idToken);
            } else {
                Response::error('Either idToken or googleEmail is required', 400);
            }

            // Admin check
            $adminUser = Database::queryOne(
                'SELECT * FROM "User" WHERE email = :e AND role IN (\'ADMIN\', \'SUPERADMIN\')',
                [':e' => $email]
            );
            if ($adminUser) {
                if ($adminUser['isDisabled'])
                    Response::error('Your account has been suspended.', 403);
                AuditService::log('GOOGLE_LOGIN', (int) $adminUser['id'], $req->ip, ['email' => $email]);
                $token = JwtHelper::generateToken((int) $adminUser['id'], $adminUser['role']);
                Response::json([
                    'token' => $token,
                    'requiresPasswordChange' => false,
                    'user' => [
                        'id' => (int) $adminUser['id'],
                        'name' => $adminUser['name'],
                        'email' => $adminUser['email'],
                        'role' => $adminUser['role'],
                    ],
                ]);
            }

            // Distributor check
            $dist = Database::queryOne('SELECT * FROM "Distributor" WHERE email = :e', [':e' => $email]);
            if ($dist) {
                if ($dist['status'] === 'INACTIVE')
                    Response::error('Your account has been suspended.', 403);
                AuditService::log('GOOGLE_LOGIN', null, $req->ip, ['email' => $email, 'role' => 'DISTRIBUTOR']);
                $token = JwtHelper::generateToken(-(int) $dist['id'], 'DISTRIBUTOR');
                Response::json([
                    'token' => $token,
                    'requiresPasswordChange' => false,
                    'user' => [
                        'id' => (int) $dist['id'],
                        'name' => $dist['name'],
                        'email' => $dist['displayEmail'] ?? $dist['email'],
                        'role' => 'DISTRIBUTOR',
                        'distributorId' => (int) $dist['id'],
                    ],
                ]);
            }

            // Regular user: find or create
            $user = Database::queryOne(
                'SELECT * FROM "User" WHERE email = :e OR displayEmail = :e',
                [':e' => $email]
            );

            if (!$user) {
                $tempHash = password_hash(bin2hex(random_bytes(16)) . 'Gg1!', PASSWORD_BCRYPT);
                $referralCode = self::uniqueReferralCode($name, $email);
                $now = date('Y-m-d H:i:s');

                $id = Database::insert(
                    'INSERT INTO "User"
                     (name, email, passwordHash, role, referralCode, walletBalance,
                      passwordResetRequired, first_login, distributorId, createdAt, updatedAt)
                     VALUES (:name, :email, :hash, \'USER\', :code, 0, 0, 0, :dist, :now1, :now2)',
                    [
                        ':name' => $name,
                        ':email' => $email,
                        ':hash' => $tempHash,
                        ':code' => $referralCode,
                        ':dist' => $distributorId ? (int) $distributorId : null,
                        ':now1' => $now, ':now2' => $now,
                    ]
                );
                $user = Database::queryOne('SELECT * FROM "User" WHERE id = :id', [':id' => $id]);
                AuditService::log('GOOGLE_REGISTER', (int) $user['id'], $req->ip, ['email' => $email]);
            }

            if ($user['isDisabled'])
                Response::error('Your account has been suspended. Please contact support.', 403);

            AuditService::log('GOOGLE_LOGIN', (int) $user['id'], $req->ip, ['email' => $email]);
            $token = JwtHelper::generateToken((int) $user['id'], $user['role']);
            Response::json([
                'token' => $token,
                'requiresPasswordChange' => false,
                'first_login' => false,
                'user' => [
                    'id' => (int) $user['id'],
                    'name' => $user['name'],
                    'email' => $user['displayEmail'] ?? $user['email'],
                    'role' => $user['role'],
                    'referralCode' => $user['referralCode'],
                    'walletBalance' => (float) $user['walletBalance'],
                ],
            ]);
        } catch (RuntimeException $e) {
            Logger::error('[GoogleLogin] ' . $e->getMessage());
            Response::error($e->getMessage(), 500);
        }
    }

    public function tempLogin(Request $req): void
    {
        $email = strtolower(trim((string) ($req->body['email'] ?? '')));
        $distributorId = $req->body['distributorId'] ?? null;

        if (!$email)
            Response::error('Email is required', 400);

        $name = explode('@', $email)[0];
        $user = Database::queryOne('SELECT * FROM "User" WHERE email = :e', [':e' => $email]);

        if (!$user) {
            $tempPassword = bin2hex(random_bytes(8)) . 'Aa1!';
            $passwordHash = password_hash($tempPassword, PASSWORD_BCRYPT);
            $referralCode = self::uniqueReferralCode($name, $email);
            $now = date('Y-m-d H:i:s');

            $id = Database::insert(
                'INSERT INTO "User"
                 (name, email, passwordHash, role, referralCode, walletBalance, first_login, distributorId, createdAt, updatedAt)
                 VALUES (:name, :email, :hash, \'USER\', :code, 0, 1, :dist, :now1, :now2)',
                [
                    ':name' => $name,
                    ':email' => $email,
                    ':hash' => $passwordHash,
                    ':code' => $referralCode,
                    ':dist' => $distributorId ? (int) $distributorId : null,
                    ':now1' => $now, ':now2' => $now,
                ]
            );
            $user = Database::queryOne('SELECT * FROM "User" WHERE id = :id', [':id' => $id]);
            AuditService::log('TEMP_REGISTER', (int) $user['id'], $req->ip, ['email' => $email]);
        }

        if ($user['isDisabled'])
            Response::error('Your account has been suspended.', 403);

        AuditService::log('TEMP_LOGIN', (int) $user['id'], $req->ip, ['email' => $email]);
        $token = JwtHelper::generateToken((int) $user['id'], $user['role']);

        Response::json([
            'token' => $token,
            'requiresPasswordChange' => (bool) $user['first_login'],
            'first_login' => (bool) $user['first_login'],
            'user' => [
                'id' => (int) $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role'],
                'referralCode' => $user['referralCode'],
                'walletBalance' => (float) $user['walletBalance'],
            ],
        ]);
    }

    public function me(Request $req): void
    {
        $reqUser = $req->user;
        if (!$reqUser)
            Response::error('Unauthorized', 401);

        if ($reqUser['role'] === 'DISTRIBUTOR') {
            $dist = Database::queryOne(
                'SELECT * FROM "Distributor" WHERE id = :id',
                [':id' => abs($reqUser['userId'])]
            );
            if (!$dist)
                Response::error('Distributor not found', 404);
            Response::json([
                'user' => [
                    'id' => (int) $dist['id'],
                    'name' => $dist['name'],
                    'email' => $dist['displayEmail'] ?? $dist['email'],
                    'role' => 'DISTRIBUTOR',
                    'distributorId' => (int) $dist['id'],
                    'walletBalance' => (float) $dist['walletBalance'],
                ],
            ]);
        }

        $user = Database::queryOne(
            'SELECT u.*, w.status AS wsStatus, w.planId AS wsPlanId, w.metadata AS wsMeta, p.name AS planName
             FROM "User" u
             LEFT JOIN "Workspace" w ON w.userId = u.id
             LEFT JOIN "Plan" p ON p.id = w.planId
             WHERE u.id = :id
             ORDER BY w.createdAt DESC
             LIMIT 1',
            [':id' => $reqUser['userId']]
        );

        if (!$user)
            Response::error('User not found', 404);

        $workspace = $user['wsStatus'] ? [
            'status' => $user['wsStatus'],
            'planId' => $user['wsPlanId'],
            'metadata' => $user['wsMeta'],
            'plan' => $user['planName'] ? ['name' => $user['planName']] : null,
        ] : null;

        Response::json([
            'user' => [
                'id' => (int) $user['id'],
                'name' => $user['name'],
                'email' => $user['displayEmail'] ?? $user['email'],
                'role' => $user['role'],
                'referralCode' => $user['referralCode'],
                'walletBalance' => (float) $user['walletBalance'],
                'isDisabled' => (bool) $user['isDisabled'],
                'workspace' => $workspace,
                'phone' => $user['phone'] ?? null,
                'country' => $user['country'] ?? null,
                'timezone' => $user['timezone'] ?? null,
                'recoveryEmail' => $user['recoveryEmail'] ?? null,
                'recoveryPhone' => $user['recoveryPhone'] ?? null,
            ],
        ]);
    }

    public function forgotPassword(Request $req): void
    {
        $email = (string) ($req->body['email'] ?? '');
        $newPassword = (string) ($req->body['newPassword'] ?? '');
        $token = (string) ($req->body['token'] ?? '');

        if (!$newPassword || (!$email && !$token)) {
            Response::error('Email/token and new password are required', 400);
        }
        if (strlen($newPassword) < 8)
            Response::error('Password must be at least 8 characters', 400);

        if ($token) {
            $link = Database::queryOne(
                'SELECT * FROM "SecurityLink" WHERE token = :t',
                [':t' => $token]
            );
            if (!$link || $link['status'] !== 'ACTIVE' || strtotime($link['expiresAt']) < time()) {
                Response::error('Invalid or expired reset link', 400);
            }

            $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
            $now = date('Y-m-d H:i:s');

            if ($link['role'] === 'USER') {
                Database::execute(
                    'UPDATE "User" SET passwordHash = :h, passwordResetRequired = 0, first_login = 0, updatedAt = :now WHERE id = :id',
                    [':h' => $newHash, ':now' => $now, ':id' => $link['userId']]
                );
                $u = Database::queryOne('SELECT email FROM "User" WHERE id = :id', [':id' => $link['userId']]);
                if ($u) self::syncDistributorPassword($u['email'], $newHash, $now);
            } else {
                Database::execute(
                    'UPDATE "Distributor" SET passwordHash = :h, passwordResetRequired = 0, updatedAt = :now WHERE id = :id',
                    [':h' => $newHash, ':now' => $now, ':id' => $link['userId']]
                );
            }

            Database::execute(
                'UPDATE "SecurityLink" SET status = \'USED\', usedAt = :now WHERE id = :id',
                [':now' => $now, ':id' => $link['id']]
            );
            Response::json(['success' => true, 'message' => 'Password updated successfully via security link']);
        }

        // Legacy email-based reset
        $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
        $now = date('Y-m-d H:i:s');

        $user = Database::queryOne('SELECT id FROM "User" WHERE email = :e', [':e' => $email]);
        if ($user) {
            Database::execute(
                'UPDATE "User" SET passwordHash = :h, passwordResetRequired = 0, first_login = 0, updatedAt = :now WHERE id = :id',
                [':h' => $newHash, ':now' => $now, ':id' => $user['id']]
            );
            self::syncDistributorPassword($email, $newHash, $now);
            AuditService::log('FORGOT_PASSWORD_RESET', (int) $user['id'], $req->ip, ['email' => $email]);
            Response::json(['success' => true, 'message' => 'Password updated successfully']);
        }

        $dist = Database::queryOne('SELECT id FROM "Distributor" WHERE email = :e', [':e' => $email]);
        if ($dist) {
            Database::execute(
                'UPDATE "Distributor" SET passwordHash = :h, passwordResetRequired = 0, updatedAt = :now WHERE id = :id',
                [':h' => $newHash, ':now' => $now, ':id' => $dist['id']]
            );
            AuditService::log('FORGOT_PASSWORD_RESET', null, $req->ip, ['email' => $email, 'role' => 'DISTRIBUTOR']);
            Response::json(['success' => true, 'message' => 'Password updated successfully']);
        }

        Response::error('Account not found', 404);
    }

    public function changePassword(Request $req): void
    {
        $reqUser = $req->user;
        $currentPassword = (string) ($req->body['currentPassword'] ?? '');
        $newPassword     = (string) ($req->body['newPassword']     ?? '');
        $target          = (string) ($req->body['target']          ?? 'portal');

        if (!$reqUser) Response::error('Unauthorized', 401);
        if (!in_array($target, ['portal', 'google', 'both'], true)) $target = 'portal';
        if (strlen($newPassword) < 8) Response::error('Password must be at least 8 characters', 400);

        // Distributor JWT uses negative userId
        $isDistributor = $reqUser['role'] === 'DISTRIBUTOR' || $reqUser['userId'] < 0;
        if ($isDistributor) {
            $distId = abs((int) $reqUser['userId']);
            $dist = Database::queryOne('SELECT * FROM "Distributor" WHERE id = :id', [':id' => $distId]);
            if (!$dist || !$dist['passwordHash']) Response::error('Account not found', 404);
            if (!password_verify($currentPassword, $dist['passwordHash'])) {
                Response::error('Current password is incorrect', 400);
            }
            $now = date('Y-m-d H:i:s');
            $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
            Database::execute(
                'UPDATE "Distributor" SET passwordHash = :h, passwordResetRequired = 0, updatedAt = :now WHERE id = :id',
                [':h' => $newHash, ':now' => $now, ':id' => $dist['id']]
            );
            // Sync to the linked User row if same email exists
            self::syncDistributorPassword($dist['email'], $newHash, $now);
            Response::json(['success' => true, 'portalUpdated' => true, 'googleUpdated' => false]);
        }

        $user = Database::queryOne('SELECT * FROM "User" WHERE id = :id', [':id' => $reqUser['userId']]);
        if (!$user || !$user['passwordHash']) Response::error('User not found', 404);

        if (!password_verify($currentPassword, $user['passwordHash'])) {
            Response::error('Current password is incorrect', 400);
        }

        $portalUpdated = false;
        $googleUpdated = false;

        if ($target === 'portal' || $target === 'both') {
            $now = date('Y-m-d H:i:s');
            $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
            Database::execute(
                'UPDATE "User" SET passwordHash = :h, passwordResetRequired = 0, first_login = 0, updatedAt = :now WHERE id = :id',
                [':h' => $newHash, ':now' => $now, ':id' => $user['id']]
            );
            self::syncDistributorPassword($user['email'], $newHash, $now);
            $portalUpdated = true;
        }

        if ($target === 'google' || $target === 'both') {
            $ws = Database::queryOne(
                'SELECT googleCustomerId, metadata FROM "Workspace"
                 WHERE userId = :uid AND status = \'ACTIVE\'
                 ORDER BY createdAt DESC LIMIT 1',
                [':uid' => $user['id']]
            );
            if ($ws) {
                $meta    = @json_decode($ws['metadata'] ?? '', true) ?: [];
                $wsEmail = $meta['email'] ?? $ws['googleCustomerId'] ?? null;
                if ($wsEmail && GoogleWorkspaceService::isProvisioned($wsEmail)) {
                    $googleUpdated = GoogleWorkspaceService::updatePassword($wsEmail, $newPassword);
                }
            }
        }

        Response::json([
            'success'       => true,
            'portalUpdated' => $portalUpdated,
            'googleUpdated' => $googleUpdated,
        ]);
    }

    public function setupWorkspacePassword(Request $req): void
    {
        $reqUser = $req->user;
        $newPassword = (string) ($req->body['newPassword'] ?? '');

        if (!$reqUser)
            Response::error('Unauthorized', 401);
        if (!$newPassword || strlen($newPassword) < 8) {
            Response::error('Password must be at least 8 characters long.', 400);
        }

        $user = Database::queryOne('SELECT * FROM "User" WHERE id = :id', [':id' => $reqUser['userId']]);
        if (!$user)
            Response::error('User not found', 404);

        $workspace = Database::queryOne(
            'SELECT * FROM "Workspace" WHERE userId = :uid AND status = \'ACTIVE\' ORDER BY createdAt DESC LIMIT 1',
            [':uid' => $user['id']]
        );

        if (!$workspace || !$workspace['metadata']) {
            Response::error('Workspace not found or not fully provisioned yet.', 400);
        }

        $wsMeta = @json_decode($workspace['metadata'], true) ?: [];
        $workspaceEmail = $wsMeta['email'] ?? $workspace['googleCustomerId'] ?? null;

        if (!$workspaceEmail || $workspaceEmail === 'PENDING' || !str_contains($workspaceEmail, '@')) {
            if ($workspaceEmail === 'demo@webmydrive.com' || !$workspaceEmail) {
                Response::json(['success' => true, 'message' => 'Demo Workspace password successfully configured.']);
            }
            Response::error('Could not find a valid Workspace email to update.', 400);
        }

        // Update portal DB password
        $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
        $now = date('Y-m-d H:i:s');
        Database::execute(
            'UPDATE "User" SET passwordHash = :h, passwordResetRequired = 0, first_login = 0, updatedAt = :now WHERE id = :id',
            [':h' => $newHash, ':now' => $now, ':id' => $user['id']]
        );
        self::syncDistributorPassword($user['email'], $newHash, $now);

        // Clear temp password from metadata
        $updatedMeta = json_encode(array_merge($wsMeta, ['tempPassword' => null, 'passwordSet' => true]));
        Database::execute(
            'UPDATE "Workspace" SET metadata = :meta, updatedAt = :now WHERE id = :id',
            [':meta' => $updatedMeta, ':now' => $now, ':id' => $workspace['id']]
        );

        Response::json(['success' => true, 'message' => 'Password configured successfully. You can now log in.']);
    }

    /**
     * Setup credentials (email/password) for user without WebMyDrive credentials.
     * POST /auth/setup-credentials
     * Body: { email, password } (and user must have been recently created via checkout)
     * Returns: { token, user }
     */
    public function setupCredentials(Request $req): void
    {
        $email = strtolower(trim((string) ($req->body['email'] ?? '')));
        $password = (string) ($req->body['password'] ?? '');

        if (!$email || !$password) {
            Response::error('Email and password are required', 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Invalid email address', 400);
        }

        if (strlen($password) < 8) {
            Response::error('Password must be at least 8 characters', 400);
        }

        // Find user by email (must exist - created during checkout)
        $user = Database::queryOne(
            'SELECT * FROM "User" WHERE email = :e',
            [':e' => $email]
        );

        if (!$user) {
            Response::error('User not found. Please contact support if this is your first time.', 404);
        }

        // Check if this user has already set credentials
        if ($user['passwordResetRequired'] === 0 && $user['first_login'] === 0) {
            Response::error('This user has already set up credentials. Please log in instead.', 400);
        }

        // Hash the password and update user credentials
        $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
        $now = date('Y-m-d H:i:s');

        Database::execute(
            'UPDATE "User" SET email = :email, displayEmail = :email, passwordHash = :hash, passwordResetRequired = 0, first_login = 0, updatedAt = :now WHERE id = :id',
            [
                ':email' => $email,
                ':hash' => $passwordHash,
                ':now' => $now,
                ':id' => $user['id'],
            ]
        );

        AuditService::log('SETUP_CREDENTIALS', (int) $user['id'], $req->ip, ['email' => $email]);

        // Generate token and return user data
        $token = JwtHelper::generateToken((int) $user['id'], 'USER');

        Response::json([
            'token' => $token,
            'requiresPasswordChange' => false,
            'user' => [
                'id' => (int) $user['id'],
                'name' => $user['name'],
                'email' => $email,
                'role' => 'USER',
                'referralCode' => $user['referralCode'],
                'walletBalance' => (float) $user['walletBalance'],
                'isDisabled' => (bool) $user['isDisabled'],
            ],
        ]);
    }

    public function setupWmdId(Request $req): void
    {
        $reqUser = $req->user;
        if (!$reqUser) {
            Response::error('Unauthorized', 401);
        }

        $username = trim((string) ($req->body['username'] ?? ''));
        if (!$username) {
            Response::error('Username is required', 400);
        }

        $email = strtolower($username . '@webmydrive.com');

        // Check availability
        $existing = Database::queryOne(
            'SELECT id FROM "User" WHERE email = :e OR displayEmail = :e',
            [':e' => $email]
        );
        if ($existing) {
            Response::error('Username is already taken', 400);
        }

        $user = Database::queryOne('SELECT * FROM "User" WHERE id = :id', [':id' => $reqUser['userId']]);
        if (!$user) {
            Response::error('User not found', 404);
        }

        $workspace = Database::queryOne(
            'SELECT * FROM "Workspace" WHERE userId = :uid ORDER BY createdAt DESC LIMIT 1',
            [':uid' => $user['id']]
        );

        $now = date('Y-m-d H:i:s');
        $password = $req->body['password'] ?? '';
        if (strlen($password) < 8) {
            Response::error('Password must be at least 8 characters', 400);
        }
        $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);

        Database::beginTransaction();
        try {
            // Update User table
            Database::execute(
                'UPDATE "User" SET email = :email, displayEmail = :email, passwordHash = :hash, passwordResetRequired = 1, first_login = 1, updatedAt = :now WHERE id = :id',
                [
                    ':email' => $email,
                    ':hash' => $passwordHash,
                    ':now' => $now,
                    ':id' => $user['id']
                ]
            );

            // Update Workspace metadata (if exists)
            if ($workspace) {
                $meta = @json_decode($workspace['metadata'], true) ?: [];
                $meta['email'] = $email;
                $metaJson = json_encode($meta);
                Database::execute(
                    'UPDATE "Workspace" SET googleCustomerId = :email, metadata = :meta, updatedAt = :now WHERE id = :id',
                    [
                        ':email' => $email,
                        ':meta' => $metaJson,
                        ':now' => $now,
                        ':id' => $workspace['id']
                    ]
                );
            }

            AuditService::log('SETUP_WMD_ID', (int) $user['id'], $req->ip, ['newEmail' => $email]);
            Database::commit();

            Response::json(['success' => true, 'message' => 'WebMyDrive ID configured']);
        } catch (Throwable $e) {
            Database::rollback();
            Logger::error('Failed to setup WMD ID: ' . $e->getMessage());
            Response::error('Internal server error', 500);
        }
    }

    // ── OTP-based forgot password ─────────────────────────────────────────────

    public function forgotOtpRequest(Request $req): void
    {
        $wmdId = strtolower(trim((string)($req->body['wmdId'] ?? '')));
        if (!$wmdId) Response::error('WebMyDrive ID required', 400);

        $email = str_contains($wmdId, '@') ? $wmdId : $wmdId . '@webmydrive.com';

        $user = Database::queryOne(
            'SELECT * FROM "User" WHERE email = :e1 OR displayEmail = :e2',
            [':e1' => $email, ':e2' => $email]
        );
        if (!$user) Response::error('Account not found', 404);

        $recoveryEmail = $user['recoveryEmail'] ?? null;
        if (!$recoveryEmail) {
            Response::json(['noRecovery' => true]);
            return;
        }

        // Invalidate any previous OTPs for this user
        Database::execute(
            "UPDATE \"SecurityLink\" SET status = 'USED' WHERE userId = :uid AND status = 'ACTIVE' AND role = 'OTP_RESET'",
            [':uid' => $user['id']]
        );

        // Generate 6-digit OTP, store in SecurityLink table
        $otp = str_pad((string) random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
        $expiresAt = date('Y-m-d H:i:s', time() + 600);

        Database::insert(
            "INSERT INTO \"SecurityLink\" (userId, token, role, status, expiresAt)
             VALUES (:uid, :otp, 'OTP_RESET', 'ACTIVE', :exp)",
            [':uid' => $user['id'], ':otp' => $otp, ':exp' => $expiresAt]
        );

        // Send OTP via email
        $name = $user['name'] ?: 'User';
        $subject = 'WebMyDrive — Your Password Reset OTP';
        $body  = "Hi {$name},\r\n\r\n";
        $body .= "Your password reset OTP is: {$otp}\r\n\r\n";
        $body .= "This code is valid for 10 minutes. Do not share it with anyone.\r\n\r\n";
        $body .= "If you did not request this, please ignore this email.\r\n\r\n";
        $body .= "— WebMyDrive Team";
        $headers = implode("\r\n", [
            'From: WebMyDrive <noreply@webmydrive.com>',
            'Reply-To: support@webmydrive.com',
            'X-Mailer: PHP/' . phpversion(),
            'Content-Type: text/plain; charset=UTF-8',
        ]);
        @mail($recoveryEmail, $subject, $body, $headers);

        AuditService::log('FORGOT_OTP_REQUESTED', (int) $user['id'], $req->ip, ['email' => $email]);
        Response::json(['maskedEmail' => self::maskEmail($recoveryEmail)]);
    }

    public function forgotOtpVerify(Request $req): void
    {
        $wmdId       = strtolower(trim((string)($req->body['wmdId'] ?? '')));
        $otp         = trim((string)($req->body['otp'] ?? ''));
        $newPassword = (string)($req->body['newPassword'] ?? '');

        if (!$wmdId || !$otp || !$newPassword) Response::error('All fields are required', 400);
        if (strlen($newPassword) < 8) Response::error('Password must be at least 8 characters', 400);

        $email = str_contains($wmdId, '@') ? $wmdId : $wmdId . '@webmydrive.com';

        $user = Database::queryOne(
            'SELECT * FROM "User" WHERE email = :e1 OR displayEmail = :e2',
            [':e1' => $email, ':e2' => $email]
        );
        if (!$user) Response::error('Account not found', 404);

        $link = Database::queryOne(
            "SELECT * FROM \"SecurityLink\" WHERE userId = :uid AND token = :otp AND role = 'OTP_RESET' AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1",
            [':uid' => $user['id'], ':otp' => $otp]
        );

        if (!$link || strtotime($link['expiresAt']) < time()) {
            Response::error('Invalid or expired OTP. Please request a new one.', 400);
        }

        $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
        $now = date('Y-m-d H:i:s');

        Database::execute(
            'UPDATE "User" SET passwordHash = :h, passwordResetRequired = 0, first_login = 0, updatedAt = :now WHERE id = :id',
            [':h' => $newHash, ':now' => $now, ':id' => $user['id']]
        );
        self::syncDistributorPassword($user['email'], $newHash, $now);

        Database::execute(
            "UPDATE \"SecurityLink\" SET status = 'USED', usedAt = :now WHERE id = :id",
            [':now' => $now, ':id' => $link['id']]
        );

        AuditService::log('FORGOT_OTP_VERIFIED', (int) $user['id'], $req->ip, ['email' => $email]);
        Response::json(['success' => true, 'message' => 'Password reset successfully']);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Sync a password hash to both User and Distributor rows that share the same email,
     * so all login paths stay in sync after any password change.
     */
    private static function syncDistributorPassword(string $email, string $newHash, string $now): void
    {
        Database::execute(
            'UPDATE "Distributor" SET passwordHash = :h, updatedAt = :now WHERE email = :e',
            [':h' => $newHash, ':now' => $now, ':e' => $email]
        );
        Database::execute(
            'UPDATE "User" SET passwordHash = :h, updatedAt = :now WHERE email = :e',
            [':h' => $newHash, ':now' => $now, ':e' => $email]
        );
    }

    private static function maskEmail(string $email): string
    {
        if (!str_contains($email, '@')) return $email;
        [$local, $domain] = explode('@', $email, 2);
        $localLen = strlen($local);
        if ($localLen <= 3) {
            $maskedLocal = $local[0] . str_repeat('*', max(1, $localLen - 1));
        } elseif ($localLen <= 6) {
            $maskedLocal = substr($local, 0, 2) . str_repeat('*', $localLen - 3) . substr($local, -1);
        } else {
            $show    = min(3, max(1, (int) floor($localLen * 0.3)));
            $endShow = min(2, max(1, (int) floor($localLen * 0.2)));
            $maskedLocal = substr($local, 0, $show)
                         . str_repeat('*', $localLen - $show - $endShow)
                         . substr($local, -$endShow);
        }
        $dotPos  = strrpos($domain, '.');
        if ($dotPos === false) return $maskedLocal . '@' . $domain;
        $tld     = substr($domain, $dotPos);
        $domName = substr($domain, 0, $dotPos);
        $domLen  = strlen($domName);
        $maskedDom = $domName[0] . str_repeat('*', max(1, $domLen - 1)) . $tld;
        return $maskedLocal . '@' . $maskedDom;
    }



    /**
     * Verify a Google ID token via Google's tokeninfo endpoint (no SDK).
     * Returns [email, name].
     */
    private static function verifyGoogleToken(string $idToken): array
    {
        $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken);
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            throw new RuntimeException('Invalid Google token');
        }

        $data = json_decode($response, true);
        if (!isset($data['email'])) {
            throw new RuntimeException('Invalid Google token');
        }

        // Optionally verify audience matches our CLIENT_ID
        $clientId = GOOGLE_CLIENT_ID;
        if ($clientId && isset($data['aud']) && $data['aud'] !== $clientId) {
            throw new RuntimeException('Google token audience mismatch');
        }

        return [strtolower($data['email']), $data['name'] ?? $data['email']];
    }

    /**
     * Activate Lookup — POST /api/auth/activate-lookup (Public)
     *
     * Looks up a user by their payment email (from CheckoutSession or User table).
     * Returns a JWT token so the frontend can call PUT /api/user/profile to set credentials.
     */
    public function activateLookup(Request $req): void
    {
        $email = strtolower(trim((string) ($req->body['email'] ?? '')));

        if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Valid email is required', 400);
        }

        // 1. Look up user by email
        $user = Database::queryOne(
            'SELECT * FROM "User" WHERE email = :email',
            [':email' => $email]
        );

        if (!$user) {
            // 2. Check if there's a completed checkout session for this email
            $session = Database::queryOne(
                'SELECT * FROM "CheckoutSession" WHERE customer_email = :email AND status = \'COMPLETED\' ORDER BY created_at DESC LIMIT 1',
                [':email' => $email]
            );

            if (!$session) {
                Response::error('No subscription found for this email address. Please complete your payment first.', 404);
            }

            // User should have been created by processPayment — re-check
            $user = Database::queryOne('SELECT * FROM "User" WHERE email = :email', [':email' => $email]);
            if (!$user) {
                Response::error('Account setup incomplete. Please contact support@webmydrive.com.', 404);
            }
        }

        // 3. Check they have an active subscription or completed order
        $hasOrder = Database::queryOne(
            'SELECT id FROM "Order" WHERE userId = :uid AND status IN (\'COMPLETED\', \'PAID\') LIMIT 1',
            [':uid' => $user['id']]
        );
        $hasSubscription = Database::queryOne(
            'SELECT id FROM "Subscription" WHERE user_id = :uid AND status = \'active\' LIMIT 1',
            [':uid' => $user['id']]
        );

        if (!$hasOrder && !$hasSubscription) {
            Response::error('No completed purchase found for this email. Please complete payment first.', 404);
        }

        // 4. Generate a short-lived token for credential setup
        $token = JwtHelper::generateToken((int) $user['id'], $user['role'] ?? 'USER');

        Logger::info('[Auth] Activate lookup for: ' . $email);
        AuditService::log('ACTIVATE_LOOKUP', (int) $user['id'], $req->ip ?? null, ['email' => $email]);

        Response::json([
            'success' => true,
            'userId' => (int) $user['id'],
            'email' => $user['email'],
            'token' => $token,
            'message' => 'Subscription found.',
        ]);
    }
}

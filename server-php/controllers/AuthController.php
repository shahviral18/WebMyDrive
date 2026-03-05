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
             VALUES (:name, :email, :hash, \'USER\', :code, 0, 1, 1, :dist, :now, :now)',
            [
                ':name' => $displayName,
                ':email' => $email,
                ':hash' => $passwordHash,
                ':code' => $referralCode,
                ':dist' => $distributorId ? (int) $distributorId : null,
                ':now' => $now,
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
                Response::error('Invalid credentials', 401);
            }
            AuditService::log('LOGIN', null, $req->ip, ['email' => $email, 'role' => 'DISTRIBUTOR']);
            $token = JwtHelper::generateToken(-(int) $distributor['id'], 'DISTRIBUTOR');
            Response::json([
                'token' => $token,
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
        if (!$user || !$user['passwordHash'])
            Response::error('Invalid credentials', 401);
        if (!password_verify($password, $user['passwordHash']))
            Response::error('Invalid credentials', 401);
        if ($user['isDisabled'])
            Response::error('Your account has been suspended. Please contact support.', 403);

        // Check subscription status for regular users (not admins or super admins)
        if ($user['role'] === 'USER') {
            $subscription = SubscriptionService::getUserSubscription((int)$user['id']);
            if (!$subscription) {
                // User has no active subscription - redirect to pricing
                Response::json([
                    'token' => null,
                    'hasActiveSubscription' => false,
                    'message' => 'No active subscription. Please purchase a plan first.',
                    'redirect' => '/pricing',
                ], 403);
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

        Response::json([
            'token' => $token,
            'requiresPasswordChange' => $requiresPasswordChange,
            'first_login' => (bool) $user['first_login'],
            'hasActiveSubscription' => true,
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
                     VALUES (:name, :email, :hash, \'USER\', :code, 0, 0, 0, :dist, :now, :now)',
                    [
                        ':name' => $name,
                        ':email' => $email,
                        ':hash' => $tempHash,
                        ':code' => $referralCode,
                        ':dist' => $distributorId ? (int) $distributorId : null,
                        ':now' => $now,
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
                 VALUES (:name, :email, :hash, \'USER\', :code, 0, 1, :dist, :now, :now)',
                [
                    ':name' => $name,
                    ':email' => $email,
                    ':hash' => $passwordHash,
                    ':code' => $referralCode,
                    ':dist' => $distributorId ? (int) $distributorId : null,
                    ':now' => $now,
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
        $newPassword = (string) ($req->body['newPassword'] ?? '');

        if (!$reqUser)
            Response::error('Unauthorized', 401);

        $user = Database::queryOne('SELECT * FROM "User" WHERE id = :id', [':id' => $reqUser['userId']]);
        if (!$user || !$user['passwordHash'])
            Response::error('User not found', 404);

        if (!password_verify($currentPassword, $user['passwordHash'])) {
            Response::error('Current password is incorrect', 400);
        }

        $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
        $now = date('Y-m-d H:i:s');
        Database::execute(
            'UPDATE "User" SET passwordHash = :h, passwordResetRequired = 0, first_login = 0, updatedAt = :now WHERE id = :id',
            [':h' => $newHash, ':now' => $now, ':id' => $user['id']]
        );

        Response::json(['success' => true]);
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

    // ── Private helpers ───────────────────────────────────────────────────────

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
}

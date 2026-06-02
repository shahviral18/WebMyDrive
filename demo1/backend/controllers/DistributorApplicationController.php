<?php
/**
 * DistributorApplicationController — Resell WebMyDrive flow.
 *
 * Public:
 *   GET  /api/distributor/check-eligibility?email=...
 *   POST /api/distributor/apply   (multipart: form fields + panFile, aadharFile)
 *
 * Admin-only:
 *   GET    /api/admin/distributor-applications
 *   GET    /api/admin/distributor-applications/:id
 *   PATCH  /api/admin/distributor-applications/:id          body: { status, reviewNotes }
 *   GET    /api/admin/distributor-applications/:id/files/:type   (pan|aadhar)
 */

declare(strict_types=1);

class DistributorApplicationController
{
    /** Minimum storage (GB) required to become a distributor. */
    private const MIN_STORAGE_GB = 50000; // 50 TB

    /** Where uploaded docs are stored. Outside web root. */
    private static function uploadBase(): string
    {
        $p = '/home1/wmdadmin/secure_uploads/distributor-applications';
        if (!is_dir($p)) @mkdir($p, 0755, true);
        return $p;
    }

    // ── Public ────────────────────────────────────────────────────────────────

    public function checkEligibility(Request $req): void
    {
        $email = strtolower(trim((string) ($req->query['email'] ?? '')));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::json(['eligible' => false, 'reason' => 'invalid_email']);
        }

        $user = Database::queryOne(
            'SELECT id FROM "User" WHERE email = :e1 OR displayEmail = :e2',
            [':e1' => $email, ':e2' => $email]
        );
        if (!$user) {
            Response::json(['eligible' => false, 'reason' => 'no_account']);
        }

        // Qualifying plan via Workspace
        $row = Database::queryOne(
            'SELECT p.name AS planName, p.storage AS storage
             FROM "Workspace" w
             JOIN "Plan" p ON p.id = w.planId
             WHERE w.userId = :uid AND (w.status IS NULL OR w.status <> :cancel)
             ORDER BY p.storage DESC
             LIMIT 1',
            [':uid' => $user['id'], ':cancel' => 'CANCELLED']
        );

        // Also check Subscription by plan_name (some flows write only here)
        if (!$row) {
            $sub = Database::queryOne(
                'SELECT s.plan_name AS planName, p.storage AS storage
                 FROM "Subscription" s
                 LEFT JOIN "Plan" p ON p.name = s.plan_name
                 WHERE s.user_id = :uid AND s.status = :active
                 ORDER BY p.storage DESC
                 LIMIT 1',
                [':uid' => $user['id'], ':active' => 'active']
            );
            if ($sub) $row = $sub;
        }

        if (!$row) {
            Response::json(['eligible' => false, 'reason' => 'no_plan', 'userId' => (int) $user['id']]);
        }

        $storage = (int) ($row['storage'] ?? 0);
        $eligible = $storage >= self::MIN_STORAGE_GB;
        Response::json([
            'eligible' => $eligible,
            'reason'   => $eligible ? 'ok' : 'plan_too_small',
            'userId'   => (int) $user['id'],
            'planName' => $row['planName'] ?? null,
            'storage'  => $storage,
        ]);
    }

    public function apply(Request $req): void
    {
        // multipart/form-data: body via $_POST, files via $_FILES
        $post = $_POST;
        $email = strtolower(trim((string) ($post['accountEmail'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Invalid account email', 400);
        }

        // Re-check eligibility server-side
        $user = Database::queryOne(
            'SELECT id FROM "User" WHERE email = :e1 OR displayEmail = :e2',
            [':e1' => $email, ':e2' => $email]
        );
        if (!$user) Response::error('Account not found. Please subscribe to a qualifying plan first.', 400);

        $plan = Database::queryOne(
            'SELECT MAX(p.storage) AS storage
             FROM "Workspace" w JOIN "Plan" p ON p.id = w.planId
             WHERE w.userId = :uid AND (w.status IS NULL OR w.status <> :cancel)',
            [':uid' => $user['id'], ':cancel' => 'CANCELLED']
        );
        $maxStorage = (int) ($plan['storage'] ?? 0);
        if ($maxStorage < self::MIN_STORAGE_GB) {
            $sub = Database::queryOne(
                'SELECT MAX(p.storage) AS storage
                 FROM "Subscription" s LEFT JOIN "Plan" p ON p.name = s.plan_name
                 WHERE s.user_id = :uid AND s.status = :active',
                [':uid' => $user['id'], ':active' => 'active']
            );
            $maxStorage = max($maxStorage, (int) ($sub['storage'] ?? 0));
        }
        if ($maxStorage < self::MIN_STORAGE_GB) {
            Response::error('Your account does not have a qualifying plan (50 TB+).', 400);
        }

        // Validate bank details server-side
        $bankAccountHolder = trim((string) ($post['bankAccountHolder'] ?? ''));
        $bankName          = trim((string) ($post['bankName']          ?? ''));
        $bankAccountNumber = trim((string) ($post['bankAccountNumber'] ?? ''));
        $bankIfscCode      = strtoupper(trim((string) ($post['bankIfscCode'] ?? '')));
        $bankAccountType   = in_array($post['bankAccountType'] ?? '', ['SAVINGS', 'CURRENT'], true)
                             ? $post['bankAccountType'] : 'SAVINGS';
        $upiId             = trim((string) ($post['upiId'] ?? '')) ?: null;

        if (!$bankAccountHolder || !$bankName || !$bankAccountNumber) {
            Response::error('Bank account holder, bank name, and account number are required.', 400);
        }
        if (!preg_match('/^[A-Z]{4}0[A-Z0-9]{6}$/', $bankIfscCode)) {
            Response::error('Invalid IFSC code format.', 400);
        }

        // Entity type + GST
        $validEntityTypes = ['INDIVIDUAL','PROPRIETOR','PARTNERSHIP','LLP','PVT_LTD'];
        $entityType = strtoupper(trim((string)($post['entityType'] ?? '')));
        if (!in_array($entityType, $validEntityTypes, true)) $entityType = null;
        $gstin = strtoupper(trim((string)($post['gstin'] ?? ''))) ?: null;
        if ($gstin && !preg_match('/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/', $gstin)) {
            Response::error('Invalid GSTIN format.', 400);
        }

        // Insert row first so we have an id for the folder
        $id = Database::insert(
            'INSERT INTO "DistributorApplication"
                 (accountEmail, linkedUserId, firstName, lastName, whatsapp, recoveryEmail,
                  companyName, panNumber, aadharNumber, entityType, gstin,
                  addressLine1, addressLine2, area, city, state,
                  teamSize, accountantName, accountantPhone, accountantEmail,
                  bankAccountHolder, bankName, bankAccountNumber, bankIfscCode, bankAccountType, upiId,
                  status)
             VALUES
                 (:accountEmail, :linkedUserId, :firstName, :lastName, :whatsapp, :recoveryEmail,
                  :companyName, :panNumber, :aadharNumber, :entityType, :gstin,
                  :addressLine1, :addressLine2, :area, :city, :state,
                  :teamSize, :accountantName, :accountantPhone, :accountantEmail,
                  :bankAccountHolder, :bankName, :bankAccountNumber, :bankIfscCode, :bankAccountType, :upiId,
                  :status)',
            [
                ':accountEmail'       => $email,
                ':linkedUserId'       => (int) $user['id'],
                ':firstName'          => $post['firstName']      ?? null,
                ':lastName'           => $post['lastName']       ?? null,
                ':whatsapp'           => $post['whatsapp']       ?? null,
                ':recoveryEmail'      => $post['recoveryEmail']  ?? null,
                ':companyName'        => $post['companyName']    ?? null,
                ':panNumber'          => strtoupper(trim((string)($post['panNumber']    ?? ''))) ?: null,
                ':aadharNumber'       => preg_replace('/\s+/', '', (string)($post['aadharNumber'] ?? '')) ?: null,
                ':entityType'         => $entityType,
                ':gstin'              => $gstin,
                ':addressLine1'       => $post['addressLine1']   ?? null,
                ':addressLine2'       => $post['addressLine2']   ?? null,
                ':area'               => $post['area']           ?? null,
                ':city'               => $post['city']           ?? null,
                ':state'              => $post['state']          ?? null,
                ':teamSize'           => $post['teamSize']       ?? null,
                ':accountantName'     => $post['accountantName'] ?? null,
                ':accountantPhone'    => $post['accountantPhone']?? null,
                ':accountantEmail'    => $post['accountantEmail']?? null,
                ':bankAccountHolder'  => $bankAccountHolder,
                ':bankName'           => $bankName,
                ':bankAccountNumber'  => $bankAccountNumber,
                ':bankIfscCode'       => $bankIfscCode,
                ':bankAccountType'    => $bankAccountType,
                ':upiId'              => $upiId,
                ':status'             => 'PENDING',
            ]
        );

        // Save uploaded files
        $dir = self::uploadBase() . "/$id";
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        $panPath    = self::saveUpload($_FILES['panFile']    ?? null, $dir, "pan");
        $aadharPath = self::saveUpload($_FILES['aadharFile'] ?? null, $dir, "aadhar");
        $gstPath    = self::saveUpload($_FILES['gstFile']    ?? null, $dir, "gst");

        Database::execute(
            'UPDATE "DistributorApplication" SET panFilePath = :p, aadharFilePath = :a, gstFilePath = :g WHERE id = :id',
            [':p' => $panPath, ':a' => $aadharPath, ':g' => $gstPath, ':id' => $id]
        );

        Logger::info("[DistributorApp] submitted id=$id email=$email");
        Response::json(['success' => true, 'id' => $id]);
    }

    /** @param array|null $file one entry from $_FILES */
    private static function saveUpload(?array $file, string $dir, string $prefix): ?string
    {
        if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) return null;
        if (($file['size'] ?? 0) > 5 * 1024 * 1024) return null; // 5 MB cap
        $allowed = ['application/pdf', 'image/jpeg', 'image/png'];
        $mime = mime_content_type($file['tmp_name']) ?: '';
        if (!in_array($mime, $allowed, true)) return null;
        $ext = match ($mime) {
            'application/pdf' => 'pdf',
            'image/jpeg'      => 'jpg',
            'image/png'       => 'png',
            default           => 'bin',
        };
        $dest = "$dir/{$prefix}.{$ext}";
        if (!@move_uploaded_file($file['tmp_name'], $dest)) return null;
        @chmod($dest, 0644);
        return $dest;
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    public function adminList(Request $req): void
    {
        $status = (string) ($req->query['status'] ?? '');
        $where = '';
        $params = [];
        if ($status !== '') { $where = 'WHERE status = :s'; $params[':s'] = $status; }
        $rows = Database::query(
            "SELECT id, accountEmail, firstName, lastName, companyName, city, state, status, createdAt
             FROM \"DistributorApplication\" $where
             ORDER BY createdAt DESC",
            $params
        );
        Response::json(['applications' => $rows]);
    }

    public function adminDetail(Request $req): void
    {
        $id = (int) ($req->params['id'] ?? 0);
        $row = Database::queryOne('SELECT * FROM "DistributorApplication" WHERE id = :id', [':id' => $id]);
        if (!$row) Response::error('Not found', 404);
        $row['hasPanFile'] = !empty($row['panFilePath']) && file_exists($row['panFilePath']);
        $row['hasAadharFile'] = !empty($row['aadharFilePath']) && file_exists($row['aadharFilePath']);
        // Never leak server paths to client
        unset($row['panFilePath'], $row['aadharFilePath']);
        Response::json(['application' => $row]);
    }

    public function adminUpdate(Request $req): void
    {
        $id = (int) ($req->params['id'] ?? 0);
        $row = Database::queryOne('SELECT * FROM "DistributorApplication" WHERE id = :id', [':id' => $id]);
        if (!$row) Response::error('Not found', 404);

        $status = strtoupper((string) ($req->body['status'] ?? $row['status']));
        $notes  = $req->body['reviewNotes'] ?? $row['reviewNotes'];
        if (!in_array($status, ['PENDING', 'APPROVED', 'REJECTED'], true)) {
            Response::error('Invalid status', 400);
        }
        Database::execute(
            'UPDATE "DistributorApplication" SET status = :s, reviewNotes = :n WHERE id = :id',
            [':s' => $status, ':n' => $notes, ':id' => $id]
        );

        if ($status === 'APPROVED') {
            // Load the application details
            $app = Database::queryOne('SELECT * FROM "DistributorApplication" WHERE id = :id', [':id' => $id]);
            $linkedUserId = (int) ($app['linkedUserId'] ?? 0);

            if ($linkedUserId) {
                $user = Database::queryOne('SELECT * FROM "User" WHERE id = :id', [':id' => $linkedUserId]);
                if ($user) {
                    // Check if Distributor record already exists for this email or linkedUserId
                    $existing = Database::queryOne('SELECT id FROM "Distributor" WHERE email = :e OR linkedUserId = :uid',
                        [':e' => $app['accountEmail'], ':uid' => $linkedUserId]);

                    if (!$existing) {
                        $name = trim(($app['firstName'] ?? '') . ' ' . ($app['lastName'] ?? '')) ?: $user['name'];
                        $refCode = strtoupper(substr(preg_replace('/[^A-Z0-9]/', '', strtoupper($name)), 0, 6)) . rand(10, 99);
                        $now = date('Y-m-d H:i:s');

                        $newDistId = Database::insert(
                            'INSERT INTO "Distributor"
                                 (name, email, displayEmail, passwordHash, referralCode, walletBalance, status,
                                  passwordResetRequired, linkedUserId,
                                  entityType, panNumber, gstin,
                                  bankAccountHolder, bankName, bankAccountNumber, bankIfscCode, bankAccountType, upiId,
                                  createdAt, updatedAt)
                             VALUES
                                 (:name, :email, :display, :hash, :ref, 0, \'ACTIVE\', 0, :uid,
                                  :entityType, :panNumber, :gstin,
                                  :bankAccountHolder, :bankName, :bankAccountNumber, :bankIfscCode, :bankAccountType, :upiId,
                                  :now1, :now2)',
                            [
                                ':name'               => $name,
                                ':email'              => $app['accountEmail'],
                                ':display'            => $app['accountEmail'],
                                ':hash'               => $user['passwordHash'],
                                ':ref'                => $refCode,
                                ':uid'                => $linkedUserId,
                                ':entityType'         => $app['entityType']        ?? null,
                                ':panNumber'          => $app['panNumber']         ?? null,
                                ':gstin'              => $app['gstin']             ?? null,
                                ':bankAccountHolder'  => $app['bankAccountHolder'] ?? null,
                                ':bankName'           => $app['bankName']          ?? null,
                                ':bankAccountNumber'  => $app['bankAccountNumber'] ?? null,
                                ':bankIfscCode'       => $app['bankIfscCode']      ?? null,
                                ':bankAccountType'    => $app['bankAccountType']   ?? 'SAVINGS',
                                ':upiId'              => $app['upiId']             ?? null,
                                ':now1'               => $now,
                                ':now2'               => $now,
                            ]
                        );

                        // Create ReferralLink for the new distributor
                        if ($newDistId) {
                            ReferralLinkService::getActiveLink((int) $newDistId, 'DISTRIBUTOR');
                        }
                    }
                }
            }
        }

        Logger::info("[DistributorApp] id=$id status -> $status by user=" . ($req->user['userId'] ?? '?'));
        Response::json(['success' => true]);
    }

    public function adminDownload(Request $req): void
    {
        $id   = (int) ($req->params['id'] ?? 0);
        $type = (string) ($req->params['type'] ?? '');
        if (!in_array($type, ['pan', 'aadhar'], true)) Response::error('Invalid file type', 400);
        $row = Database::queryOne('SELECT panFilePath, aadharFilePath FROM "DistributorApplication" WHERE id = :id', [':id' => $id]);
        if (!$row) Response::error('Not found', 404);
        $path = $type === 'pan' ? $row['panFilePath'] : $row['aadharFilePath'];
        if (!$path || !file_exists($path)) Response::error('File not found', 404);

        $mime = mime_content_type($path) ?: 'application/octet-stream';
        header_remove('Content-Type');
        header('Content-Type: ' . $mime);
        header('Content-Disposition: inline; filename="' . basename($path) . '"');
        header('Content-Length: ' . filesize($path));
        readfile($path);
        exit;
    }
}

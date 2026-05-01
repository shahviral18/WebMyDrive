<?php
/**
 * PaymentController
 *
 * Routes:
 *   POST /api/payment/create-session   [public]  — create Zoho payment session
 *   POST /api/webhook/zoho-payment     [public]  — Zoho webhook handler
 */

declare(strict_types=1);

class PaymentController
{
    // ── Create Zoho Payment Session ───────────────────────────────────────────

    public function createSession(Request $req): void
    {
        $b = $req->body;

        $planId        = (int)   ($b['planId']        ?? 0);
        $amount        = (float) ($b['amount']        ?? 0);   // post-GST total
        $billingPeriod = (string)($b['billingPeriod'] ?? 'yearly');
        $planName      = (string)($b['planName']      ?? '');
        $username      = (string)($b['username']      ?? '');  // full email e.g. john@webmydrive.com
        $password      = (string)($b['password']      ?? '');
        $firstName     = (string)($b['firstName']     ?? '');
        $lastName      = (string)($b['lastName']      ?? '');
        $customerEmail = (string)($b['customerEmail'] ?? '');
        $customerPhone = (string)($b['customerPhone'] ?? '');
        $recoveryEmail = (string)($b['recoveryEmail'] ?? '');
        $whatsapp      = (string)($b['whatsapp']      ?? '');
        $companyName   = (string)($b['companyName']   ?? '');
        $gstNumber     = (string)($b['gstNumber']     ?? '');
        $billingAddr   = $b['billingAddress'] ?? [];

        if (!$planId || $amount <= 0 || !$username || !$password || !$customerEmail) {
            Response::error('planId, amount, username, password and customerEmail are required', 400);
        }

        $plan = Database::queryOne('SELECT * FROM `Plan` WHERE id = :id AND isActive = 1', [':id' => $planId]);
        if (!$plan) Response::error('Plan not found', 404);

        // Check username not already taken
        $taken = Database::queryOne('SELECT id FROM `User` WHERE email = :e', [':e' => $username]);
        if ($taken) Response::error('Username already taken. Please choose another.', 409);

        $passwordHash    = password_hash($password, PASSWORD_BCRYPT);
        $referenceNumber = 'WMD-' . strtoupper(bin2hex(random_bytes(5)));
        $now             = date('Y-m-d H:i:s');
        $customerName    = trim("$firstName $lastName") ?: $username;

        // payments_session_id added after session creation below
        $checkoutMetaArr = [
            'username'         => $username,
            'passwordHash'     => $passwordHash,
            'firstName'        => $firstName,
            'lastName'         => $lastName,
            'recoveryEmail'    => $recoveryEmail,
            'whatsapp'         => $whatsapp,
            'companyName'      => $companyName,
            'gstNumber'        => $gstNumber,
            'billingAddress'   => $billingAddr,
        ];
        $checkoutMeta = json_encode($checkoutMetaArr);

        // Store pending checkout
        Database::insert(
            'INSERT INTO `PendingCheckout`
             (referenceNumber, planId, amount, billingPeriod, customerEmail, customerName, customerPhone, checkoutMeta, status, createdAt, updatedAt)
             VALUES (:ref, :planId, :amount, :bp, :email, :name, :phone, :meta, \'PENDING\', :now1, :now2)',
            [
                ':ref'    => $referenceNumber,
                ':planId' => $planId,
                ':amount' => $amount,
                ':bp'     => $billingPeriod,
                ':email'  => $customerEmail,
                ':name'   => $customerName,
                ':phone'  => $customerPhone,
                ':meta'   => $checkoutMeta,
                ':now1'   => $now,
                ':now2'   => $now,
            ]
        );

        AuditService::log('PAYMENT_SESSION_CREATED', null, $req->ip, [
            'referenceNumber' => $referenceNumber,
            'planId'          => $planId,
            'amount'          => $amount,
        ]);

        // Create server-side Zoho payment session (required by widget)
        try {
            $description = "WebMyDrive - {$planName} (" . ucfirst($billingPeriod) . ")";
            $session     = ZohoPaymentService::createSession($amount, $referenceNumber, $description);
        } catch (Throwable $e) {
            Logger::error('[PaymentController] ZohoPaymentService::createSession failed: ' . $e->getMessage());
            Response::error('Payment gateway error: ' . $e->getMessage(), 502);
        }

        // Store session ID in meta so getStatus can fallback to Zoho API
        $paymentsSessionId = $session['payments_session_id'] ?? '';
        if ($paymentsSessionId) {
            $checkoutMetaArr['paymentsSessionId'] = $paymentsSessionId;
            Database::execute(
                'UPDATE `PendingCheckout` SET checkoutMeta=:meta WHERE referenceNumber=:ref',
                [':meta' => json_encode($checkoutMetaArr), ':ref' => $referenceNumber]
            );
        }

        Response::json([
            'success'             => true,
            'account_id'          => ZOHO_PAYMENTS_ACCOUNT_ID,
            'api_key'             => ZOHO_PAYMENTS_API_KEY,
            'payments_session_id' => $paymentsSessionId,
            'amount'              => $amount,
            'referenceNumber'     => $referenceNumber,
            'description'         => "WebMyDrive - {$planName} (" . ucfirst($billingPeriod) . ")",
        ]);
    }

    // ── Payment Status ────────────────────────────────────────────────────────

    public function getStatus(Request $req): void
    {
        $ref = trim($req->query['ref'] ?? '');
        if (!$ref) Response::error('ref is required', 400);

        $checkout = Database::queryOne(
            'SELECT status, checkoutMeta FROM `PendingCheckout` WHERE referenceNumber = :ref',
            [':ref' => $ref]
        );

        if (!$checkout) Response::error('Not found', 404);

        $status = $checkout['status'];

        // If still PENDING, ask Zoho directly as a fallback (in case webhook didn't fire)
        if ($status === 'PENDING') {
            $meta = json_decode($checkout['checkoutMeta'] ?? '{}', true);
            $sessionId = $meta['paymentsSessionId'] ?? '';
            if ($sessionId) {
                try {
                    $zohoStatus = ZohoPaymentService::getSessionStatus($sessionId);
                    Logger::info("[PaymentStatus] Zoho session {$sessionId} status={$zohoStatus} ref={$ref}");
                    if (in_array($zohoStatus, ['paid', 'succeeded', 'success', 'completed'], true)) {
                        // Webhook hasn't fired yet — trigger processing now
                        Logger::info("[PaymentStatus] Zoho paid but webhook pending — triggering processing for ref={$ref}");
                        $fakePayload = [
                            'event_type' => 'payment.succeeded',
                            'event_id'   => 'fallback-' . time(),
                            'event_object' => [
                                'payment' => [
                                    'reference_number' => $ref,
                                    'payment_id'       => 'ZOHO-DIRECT-' . time(),
                                    'amount'           => 0, // will use checkout amount
                                ]
                            ]
                        ];
                        $this->handlePaymentSucceeded($fakePayload);
                        // Re-fetch status
                        $updated = Database::queryOne('SELECT status FROM `PendingCheckout` WHERE referenceNumber=:ref', [':ref' => $ref]);
                        $status = $updated['status'] ?? $status;
                    } elseif (in_array($zohoStatus, ['failed', 'cancelled', 'expired'], true)) {
                        $status = 'FAILED';
                    }
                } catch (Throwable $e) {
                    Logger::warn('[PaymentStatus] Zoho fallback check failed: ' . $e->getMessage());
                }
            }
        }

        Response::json(['status' => $status]);
    }

    // ── Zoho Webhook Handler ──────────────────────────────────────────────────

    public function zohoWebhook(Request $req): void
    {
        // Read raw body BEFORE any parsing
        $rawBody    = file_get_contents('php://input');
        $sigHeader  = $_SERVER['HTTP_X_ZOHO_WEBHOOK_SIGNATURE'] ?? '';

        // Verify signature
        if (!ZohoPaymentService::verifyWebhookSignature($rawBody, $sigHeader)) {
            Logger::warn('[ZohoWebhook] Invalid signature — rejected');
            http_response_code(401);
            echo json_encode(['error' => 'Invalid signature']);
            exit;
        }

        $payload   = json_decode($rawBody, true) ?? [];
        $eventType = $payload['event_type'] ?? '';
        $eventId   = $payload['event_id']   ?? '';

        Logger::info("[ZohoWebhook] Received event: {$eventType} (id={$eventId})");

        switch ($eventType) {
            case 'payment.succeeded':
                $this->handlePaymentSucceeded($payload);
                break;
            case 'payment.failed':
                $this->handlePaymentFailed($payload);
                break;
            default:
                Logger::info("[ZohoWebhook] Unhandled event: {$eventType}");
        }

        http_response_code(200);
        echo json_encode(['received' => true]);
        exit;
    }

    // ── Private: Payment Succeeded ────────────────────────────────────────────

    private function handlePaymentSucceeded(array $payload): void
    {
        $payment         = $payload['event_object']['payment'] ?? [];
        $referenceNumber = $payment['reference_number'] ?? '';
        $zohoPaymentId   = $payment['payment_id']       ?? '';
        $paidAmount      = (float) ($payment['amount']  ?? 0);

        if (!$referenceNumber || !$zohoPaymentId) {
            Logger::warn('[ZohoWebhook] payment.succeeded missing reference_number or payment_id');
            return;
        }

        // Idempotency — already processed?
        $checkout = Database::queryOne(
            'SELECT * FROM `PendingCheckout` WHERE referenceNumber = :ref',
            [':ref' => $referenceNumber]
        );

        if (!$checkout) {
            Logger::warn("[ZohoWebhook] No PendingCheckout for ref={$referenceNumber}");
            return;
        }

        if ($checkout['status'] === 'COMPLETED') {
            Logger::info("[ZohoWebhook] Already processed ref={$referenceNumber}, skipping");
            return;
        }

        $meta = json_decode($checkout['checkoutMeta'] ?? '{}', true);
        $now  = date('Y-m-d H:i:s');

        Database::beginTransaction();
        try {
            // 1. Mark checkout as processing
            Database::execute(
                'UPDATE `PendingCheckout` SET status=\'PROCESSING\', zohoPaymentId=:zpid, updatedAt=:now WHERE referenceNumber=:ref',
                [':zpid' => $zohoPaymentId, ':now' => $now, ':ref' => $referenceNumber]
            );

            // 2. Create user account
            $username = $meta['username'] ?? '';
            $existing = Database::queryOne('SELECT id FROM `User` WHERE email = :e', [':e' => $username]);

            if ($existing) {
                Logger::warn("[ZohoWebhook] User already exists: {$username}");
                $userId = (int) $existing['id'];
            } else {
                $name = trim(($meta['firstName'] ?? '') . ' ' . ($meta['lastName'] ?? ''))
                    ?: explode('@', $username)[0];

                // Generate referral code
                $refBase = strtoupper(preg_replace('/[^A-Z0-9]/', '', strtoupper(preg_split('/\s+/', $name)[0])));
                $refCode = substr($refBase, 0, 8) . date('Y');

                // Ensure unique
                $attempt = 1;
                while (Database::queryOne('SELECT id FROM `User` WHERE referralCode = :c', [':c' => $refCode])) {
                    $refCode = substr($refBase, 0, 8) . $attempt++;
                }

                $userId = Database::insert(
                    'INSERT INTO `User`
                     (name, email, displayEmail, passwordHash, role, referralCode, walletBalance,
                      recoveryEmail, passwordResetRequired, isDisabled, createdAt, updatedAt)
                     VALUES (:name, :email, :displayEmail, :hash, \'USER\', :ref, 0,
                             :recovery, 0, 0, :now1, :now2)',
                    [
                        ':name'         => $name,
                        ':email'        => $username,
                        ':displayEmail' => $meta['recoveryEmail'] ?? $checkout['customerEmail'],
                        ':hash'         => $meta['passwordHash'] ?? '',
                        ':ref'          => $refCode,
                        ':recovery'     => $meta['recoveryEmail'] ?? '',
                        ':now1'         => $now,
                        ':now2'         => $now,
                    ]
                );

                Logger::info("[ZohoWebhook] User created: {$username} (id={$userId})");
            }

            // 3. Create Order record
            $orderId = Database::insert(
                'INSERT INTO `Order`
                 (userId, planId, amount, currency, status, paymentId, gatewayTxId, createdAt, updatedAt)
                 VALUES (:uid, :planId, :amount, \'INR\', \'PAID\', :payId, :ref, :now1, :now2)',
                [
                    ':uid'    => $userId,
                    ':planId' => (int) $checkout['planId'],
                    ':amount' => $paidAmount ?: (float) $checkout['amount'],
                    ':payId'  => $zohoPaymentId,
                    ':ref'    => $referenceNumber,
                    ':now1'   => $now,
                    ':now2'   => $now,
                ]
            );

            // 4. Create Workspace / Subscription
            $billingPeriod = strtoupper($checkout['billingPeriod'] ?? 'YEARLY');
            $renewalDate   = $billingPeriod === 'MONTHLY'
                ? date('Y-m-d H:i:s', strtotime('+1 month'))
                : date('Y-m-d H:i:s', strtotime('+1 year'));

            // Check if workspace exists
            $wsExists = Database::queryOne('SELECT id FROM `Workspace` WHERE userId = :uid', [':uid' => $userId]);
            if (!$wsExists) {
                Database::insert(
                    'INSERT INTO `Workspace`
                     (userId, planId, status, renewalDate, createdAt, updatedAt)
                     VALUES (:uid, :planId, \'ACTIVE\', :renewal, :now1, :now2)',
                    [
                        ':uid'     => $userId,
                        ':planId'  => (int) $checkout['planId'],
                        ':renewal' => $renewalDate,
                        ':now1'    => $now,
                        ':now2'    => $now,
                    ]
                );
            } else {
                Database::execute(
                    'UPDATE `Workspace` SET planId=:planId, status=\'ACTIVE\', renewalDate=:renewal, updatedAt=:now WHERE userId=:uid',
                    [':planId' => (int) $checkout['planId'], ':renewal' => $renewalDate, ':now' => $now, ':uid' => $userId]
                );
            }

            // 5. Mark checkout as completed
            Database::execute(
                'UPDATE `PendingCheckout` SET status=\'COMPLETED\', createdUserId=:uid, updatedAt=:now WHERE referenceNumber=:ref',
                [':uid' => $userId, ':now' => $now, ':ref' => $referenceNumber]
            );

            Database::commit();

            AuditService::log('PAYMENT_COMPLETED', $userId, null, [
                'referenceNumber' => $referenceNumber,
                'zohoPaymentId'   => $zohoPaymentId,
                'orderId'         => $orderId,
                'amount'          => $paidAmount,
            ]);

            Logger::info("[ZohoWebhook] Payment completed for ref={$referenceNumber}, userId={$userId}");

            // Create Google Workspace account + send welcome email (non-fatal)
            $tempPassword = null;
            try {
                $plan = Database::queryOne('SELECT name, googleOrgUnit FROM `Plan` WHERE id = :id', [':id' => (int)$checkout['planId']]);
                $orgUnit = $plan['googleOrgUnit'] ?? '/';

                Logger::info("[ZohoWebhook] Creating GWS user orgUnit='" . $orgUnit . "' planId=" . $checkout['planId']);

                $nameParts = explode(' ', $name, 2);
                $firstName = $nameParts[0] ?? '';
                $lastName  = $nameParts[1] ?? '';

                $tempPassword = GoogleWorkspaceService::createUser($username, $firstName, $lastName, $orgUnit);

                // Set recovery email and phone on Google account
                $recoveryEmail = $meta['recoveryEmail'] ?? '';
                $rawPhone = preg_replace('/\D/', '', $checkout['customerPhone'] ?? '');
                $recoveryPhone = $rawPhone ? (str_starts_with($rawPhone, '91') && strlen($rawPhone) > 10 ? '+' . $rawPhone : '+91' . $rawPhone) : null;
                if ($recoveryEmail || $recoveryPhone) {
                    GoogleWorkspaceService::updateRecovery($username, $recoveryEmail ?: null, $recoveryPhone);
                }

                // Send welcome email
                self::sendWelcomeEmail(
                    toEmail:      $checkout['customerEmail'],
                    toName:       $checkout['customerName'],
                    wsEmail:      $username,
                    tempPassword: $tempPassword,
                    planName:     $plan['name'] ?? '',
                    renewalDate:  $renewalDate,
                    billingPeriod:$billingPeriod
                );

                Logger::info("[ZohoWebhook] Google account created and welcome email sent → {$username}");
            } catch (Throwable $ge) {
                Logger::error('[ZohoWebhook] Google provisioning failed (non-fatal): ' . $ge->getMessage());
            }

            // Send Zoho Books invoice (non-fatal — don't roll back if this fails)
            try {
                $billingAddr = $meta['billingAddress'] ?? [];
                if (!is_array($billingAddr)) $billingAddr = [];

                ZohoBooksService::createAndSendInvoice([
                    'planName'       => $checkout['planId'] ? Database::queryOne('SELECT name FROM `Plan` WHERE id = :id', [':id' => $checkout['planId']])['name'] ?? '' : '',
                    'username'       => $meta['username'] ?? '',
                    'customerName'   => $checkout['customerName'] ?? '',
                    'customerEmail'  => $checkout['customerEmail'] ?? '',
                    'customerPhone'  => $checkout['customerPhone'] ?? '',
                    'companyName'    => $meta['companyName']   ?? '',
                    'gstNumber'      => $meta['gstNumber']     ?? '',
                    'billingAddress' => $billingAddr,
                    'billingPeriod'  => $checkout['billingPeriod'] ?? 'yearly',
                    'activationDate' => $now,
                    'renewalDate'    => $renewalDate,
                    'baseAmount'     => (float) $checkout['amount'],
                    'referenceNumber'=> $referenceNumber,
                    'orderId'        => $orderId,
                ]);
            } catch (Throwable $ie) {
                Logger::error('[ZohoWebhook] Invoice creation failed (non-fatal): ' . $ie->getMessage());
            }

        } catch (Throwable $e) {
            Database::rollback();
            // Mark as failed so it can be retried
            Database::execute(
                'UPDATE `PendingCheckout` SET status=\'FAILED\', updatedAt=:now WHERE referenceNumber=:ref',
                [':now' => $now, ':ref' => $referenceNumber]
            );
            Logger::error('[ZohoWebhook] handlePaymentSucceeded failed: ' . $e->getMessage());
        }
    }

    // ── Private: Welcome Email ────────────────────────────────────────────────

    private function sendWelcomeEmail(
        string $toEmail,
        string $toName,
        string $wsEmail,
        string $tempPassword,
        string $planName,
        string $renewalDate,
        string $billingPeriod
    ): void {
        $firstName    = explode(' ', trim($toName))[0] ?: 'there';
        $renewalLabel = $billingPeriod === 'MONTHLY' ? 'Monthly' : 'Annual';
        $renewalShow  = date('d M Y', strtotime($renewalDate . ' -1 day'));
        $subject      = "Your WebMyDrive account is ready - Login Details Inside";
        $messageId    = '<wmd-' . time() . '-' . bin2hex(random_bytes(4)) . '@webmydrive.com>';

        $htmlBody = "<!DOCTYPE html><html><body style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;'>
<div style='background:#4a90e2;padding:24px 32px;border-radius:8px 8px 0 0;'>
  <h1 style='color:#fff;margin:0;font-size:22px;'>Congratulations, {$firstName}!</h1>
  <p style='color:#dbeafe;margin:6px 0 0;font-size:14px;'>Your WebMyDrive account is now active.</p>
</div>
<div style='background:#fff;border:1px solid #e2e8f0;border-top:none;padding:32px;border-radius:0 0 8px 8px;'>

  <h2 style='font-size:15px;color:#1e293b;margin:0 0 16px;'>Your Login Details</h2>
  <table style='width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px;border-spacing:0;margin-bottom:24px;'>
    <tr><td style='padding:6px 12px;color:#64748b;font-size:13px;width:140px;'>Login Email</td><td style='padding:6px 12px;font-weight:bold;font-size:13px;color:#0f172a;'>{$wsEmail}</td></tr>
    <tr><td style='padding:6px 12px;color:#64748b;font-size:13px;'>Temporary Password</td><td style='padding:6px 12px;font-weight:bold;font-size:13px;color:#0f172a;font-family:monospace;letter-spacing:1px;'>{$tempPassword}</td></tr>
  </table>
  <p style='font-size:13px;color:#ef4444;margin:0 0 24px;'>You will be asked to set a new password on your first login.</p>

  <h2 style='font-size:15px;color:#1e293b;margin:0 0 12px;'>Access Your Services</h2>
  <table style='width:100%;border-spacing:0 8px;margin-bottom:24px;'>
    <tr><td><a href='https://mail.google.com' style='display:block;padding:12px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;text-decoration:none;color:#dc2626;font-size:13px;font-weight:600;'>Gmail &rarr;</a></td></tr>
    <tr><td><a href='https://drive.google.com' style='display:block;padding:12px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;text-decoration:none;color:#2563eb;font-size:13px;font-weight:600;'>Google Drive &rarr;</a></td></tr>
    <tr><td><a href='https://photos.google.com' style='display:block;padding:12px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;text-decoration:none;color:#16a34a;font-size:13px;font-weight:600;'>Google Photos &rarr;</a></td></tr>
    <tr><td><a href='https://webmydrive.com/demo1/user/dashboard' style='display:block;padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;text-decoration:none;color:#475569;font-size:13px;font-weight:600;'>WebMyDrive Portal &rarr;</a></td></tr>
  </table>

  <h2 style='font-size:15px;color:#1e293b;margin:0 0 12px;'>Subscription Details</h2>
  <table style='width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px;border-spacing:0;margin-bottom:24px;'>
    <tr><td style='padding:6px 12px;color:#64748b;font-size:13px;width:140px;'>Plan</td><td style='padding:6px 12px;font-size:13px;color:#0f172a;'>{$planName}</td></tr>
    <tr><td style='padding:6px 12px;color:#64748b;font-size:13px;'>Billing</td><td style='padding:6px 12px;font-size:13px;color:#0f172a;'>{$renewalLabel}</td></tr>
    <tr><td style='padding:6px 12px;color:#64748b;font-size:13px;'>Next Renewal</td><td style='padding:6px 12px;font-size:13px;color:#0f172a;'>{$renewalShow}</td></tr>
  </table>

  <p style='font-size:12px;color:#94a3b8;text-align:center;margin:0;'>Need help? Reply to this email or visit <a href='https://webmydrive.com' style='color:#4a90e2;'>webmydrive.com</a><br>Team WebMyDrive</p>
</div>
</body></html>";

        $boundary = md5(uniqid());
        $plainBody = "Hi {$firstName},\n\nCongratulations! Your WebMyDrive account is now active.\n\n"
            . "LOGIN EMAIL:        {$wsEmail}\n"
            . "TEMP PASSWORD:      {$tempPassword}\n\n"
            . "You will be asked to set a new password on your first login.\n\n"
            . "SERVICES:\n"
            . "  Gmail:         https://mail.google.com\n"
            . "  Google Drive:  https://drive.google.com\n"
            . "  Google Photos: https://photos.google.com\n"
            . "  Portal:        https://webmydrive.com/demo1/user/dashboard\n\n"
            . "PLAN: {$planName} | {$renewalLabel} | Renewal: {$renewalShow}\n\n"
            . "Team WebMyDrive | support@webmydrive.com";

        $headers  = "From: WebMyDrive <support@webmydrive.com>\r\n";
        $headers .= "Reply-To: support@webmydrive.com\r\n";
        $headers .= "Message-ID: {$messageId}\r\n";
        $headers .= "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: multipart/alternative; boundary=\"{$boundary}\"\r\n";

        $body  = "--{$boundary}\r\n";
        $body .= "Content-Type: text/plain; charset=UTF-8\r\n\r\n";
        $body .= $plainBody . "\r\n\r\n";
        $body .= "--{$boundary}\r\n";
        $body .= "Content-Type: text/html; charset=UTF-8\r\n\r\n";
        $body .= $htmlBody . "\r\n\r\n";
        $body .= "--{$boundary}--";

        mail($toEmail, $subject, $body, $headers);
        Logger::info("[WelcomeEmail] Sent to {$toEmail}");
    }

    // ── Private: Payment Failed ───────────────────────────────────────────────

    private function handlePaymentFailed(array $payload): void
    {
        $payment         = $payload['event_object']['payment'] ?? [];
        $referenceNumber = $payment['reference_number'] ?? '';

        if (!$referenceNumber) return;

        $now = date('Y-m-d H:i:s');
        Database::execute(
            'UPDATE `PendingCheckout` SET status=\'FAILED\', updatedAt=:now WHERE referenceNumber=:ref AND status=\'PENDING\'',
            [':now' => $now, ':ref' => $referenceNumber]
        );

        Logger::info("[ZohoWebhook] Payment failed for ref={$referenceNumber}");
    }
}

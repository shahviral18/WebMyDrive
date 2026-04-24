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

        $checkoutMeta = json_encode([
            'username'       => $username,
            'passwordHash'   => $passwordHash,
            'firstName'      => $firstName,
            'lastName'       => $lastName,
            'recoveryEmail'  => $recoveryEmail,
            'whatsapp'       => $whatsapp,
            'companyName'    => $companyName,
            'gstNumber'      => $gstNumber,
            'billingAddress' => $billingAddr,
        ]);

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

        // Return all data the frontend widget needs — no server-side Zoho session required.
        // The ZPayments widget creates its own session internally using account_id + api_key.
        // reference_number is passed through the widget call so the webhook can match it back.
        Response::json([
            'success'         => true,
            'account_id'      => ZOHO_PAYMENTS_ACCOUNT_ID,
            'api_key'         => ZOHO_PAYMENTS_API_KEY,
            'amount'          => $amount,
            'referenceNumber' => $referenceNumber,
            'description'     => "WebMyDrive - {$planName} (" . ucfirst($billingPeriod) . ")",
        ]);
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

                $nameParts = explode(' ', $name, 2);
                $firstName = $nameParts[0] ?? '';
                $lastName  = $nameParts[1] ?? '';

                $tempPassword = GoogleWorkspaceService::createUser($username, $firstName, $lastName, $orgUnit);

                // Also set recovery email on Google account
                if (!empty($meta['recoveryEmail'])) {
                    GoogleWorkspaceService::updateRecovery($username, $meta['recoveryEmail'], null);
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
                $billingAddr = json_decode($meta['billingAddress'] ?? '[]', true);
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
        $firstName   = explode(' ', trim($toName))[0] ?: 'there';
        $renewalLabel= $billingPeriod === 'MONTHLY' ? 'Monthly' : 'Annual';
        $renewalShow = date('d M Y', strtotime($renewalDate . ' -1 day'));
        $subject     = "Your WebMyDrive account is ready 🎉";

        $body = "Hi {$firstName},\n\n"
            . "Congratulations! Your {$planName} is now active.\n\n"
            . "──────────────────────────\n"
            . "Your WebMyDrive Login Details\n"
            . "──────────────────────────\n"
            . "Email:             {$wsEmail}\n"
            . "Temporary Password: {$tempPassword}\n\n"
            . "Please change your password after your first login.\n\n"
            . "──────────────────────────\n"
            . "Access your services:\n"
            . "──────────────────────────\n"
            . "📧 Gmail:   https://mail.google.com\n"
            . "📁 Drive:   https://drive.google.com\n"
            . "📸 Photos:  https://photos.google.com\n"
            . "🌐 Portal:  https://webmydrive.com/user/dashboard\n\n"
            . "──────────────────────────\n"
            . "Subscription Details\n"
            . "──────────────────────────\n"
            . "Plan:         {$planName}\n"
            . "Billing:      {$renewalLabel}\n"
            . "Next Renewal: {$renewalShow}\n\n"
            . "──────────────────────────\n\n"
            . "Need help? Reply to this email or visit webmydrive.com\n\n"
            . "Thank you for choosing WebMyDrive!\n"
            . "Team WebMyDrive";

        $headers  = "From: WebMyDrive <noreply@webmydrive.com>\r\n";
        $headers .= "Reply-To: support@webmydrive.com\r\n";
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

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

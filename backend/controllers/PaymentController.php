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
        $amount        = (float) ($b['amount']        ?? 0);   // post-GST total (pre-discount, frontend sends full price)
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
        $autoRenew     = !empty($b['autoRenew']);
        $promoCode        = trim((string)($b['promoCode'] ?? ''))  ?: null;
        $isPaidAd         = !empty($b['isPaidAd']);
        $useWalletAmount  = max(0, (float)($b['useWalletAmount'] ?? 0));  // amount user wants to pay from wallet

        if (!$planId || $amount <= 0 || !$username || !$password || !$customerEmail) {
            Response::error('planId, amount, username, password and customerEmail are required', 400);
        }

        $plan = Database::queryOne('SELECT * FROM `Plan` WHERE id = :id AND isActive = 1', [':id' => $planId]);
        if (!$plan) Response::error('Plan not found', 404);

        // Check username not already taken
        $taken = Database::queryOne('SELECT id FROM `User` WHERE email = :e', [':e' => $username]);
        if ($taken) Response::error('Username already taken. Please choose another.', 409);

        // Calculate referral / paid-ads discount
        $discountPercent = 0.0;
        $resolvedReferrerId = null;

        if ($isPaidAd) {
            $globalCfg = ConfigService::getUserReferralConfig();
            $discountPercent = (float) ($globalCfg['paidAdsDiscountRate'] ?? 0.20);
        } elseif ($promoCode) {
            // First: check USER referral link or user's personal referral code
            $validLink = ReferralLinkService::validateCode($promoCode);
            $referrer  = null;
            if ($validLink && $validLink['role'] === 'USER') {
                $referrer = Database::queryOne('SELECT id FROM `User` WHERE id = :id', [':id' => $validLink['referrerId']]);
            } else {
                $referrer = Database::queryOne('SELECT id FROM `User` WHERE referralCode = :c', [':c' => $promoCode]);
            }
            if ($referrer) {
                $slab               = ConfigService::getPlanReferralSlab($plan['name'] ?? '');
                $discountPercent    = $slab['referredDiscount'];
                $resolvedReferrerId = (int) $referrer['id'];
            } else {
                // Then: check distributor promo code
                $distPromoRow = Database::queryOne(
                    'SELECT pc.id, dpc.distributorId FROM `PromoCode` pc
                     JOIN `DistributorPromoCode` dpc ON dpc.promoCodeId = pc.id
                     WHERE pc.code = :code AND dpc.isActive = 1
                       AND (pc.expiresAt IS NULL OR pc.expiresAt > NOW())
                     LIMIT 1',
                    [':code' => strtoupper($promoCode)]
                );
                if ($distPromoRow) {
                    $distConfig    = ConfigService::getDistributorConfig();
                    $planDiscounts = $distConfig['promoDiscounts'] ?? [];
                    $shortName = trim((string) preg_replace('/^Cloud Storage\s*[-–]\s*/i', '', $plan['name'] ?? ''));
                    $discountPercent = (float)($planDiscounts[$shortName] ?? 0) / 100;
                    // Rewrite to DIST_ format so the webhook handler can attribute commission
                    $promoCode = 'DIST_' . $distPromoRow['distributorId'] . ':' . strtoupper(trim((string)($b['promoCode'] ?? '')));
                }
            }
            // Unknown code: silently ignore discount (don't block purchase)
        }

        // Apply discount to base amount (ex-GST)
        // Frontend passes full plan price; we recalculate final amount here
        $planBasePrice = (float) ($plan['priceINR'] ?? $plan['yearlyPrice'] ?? $plan['price'] ?? $amount);
        if ($billingPeriod === 'monthly') {
            $planBasePrice = (float) ($plan['priceMonthlyINR'] ?? $plan['monthlyPrice'] ?? $planBasePrice / 12);
        }
        $discountedBase = round($planBasePrice * (1 - $discountPercent), 2);
        $gstAmount      = round($discountedBase * 0.18, 2);
        $finalAmount    = round($discountedBase + $gstAmount, 2);

        // Wallet deduction — check existing user's balance
        $walletDeduction  = 0.0;
        $existingUserId   = null;
        $existingUserRow  = Database::queryOne('SELECT id, walletBalance FROM `User` WHERE email = :e', [':e' => $username]);
        if ($existingUserRow && $useWalletAmount > 0) {
            $availableWallet = (float) $existingUserRow['walletBalance'];
            $walletDeduction = min($useWalletAmount, $availableWallet, $finalAmount);
            $existingUserId  = (int) $existingUserRow['id'];
        }
        $amountAfterWallet = round($finalAmount - $walletDeduction, 2);
        // Minimum chargeable via Zoho is ₹1; if wallet covers everything charge ₹0 (free order)
        $zohoChargeAmount = max(0, $amountAfterWallet);

        $passwordHash    = password_hash($password, PASSWORD_BCRYPT);
        $referenceNumber = 'WMD-' . strtoupper(bin2hex(random_bytes(5)));
        $now             = date('Y-m-d H:i:s');
        $customerName    = trim("$firstName $lastName") ?: $username;

        // payments_session_id added after session creation below
        $checkoutMetaArr = [
            'username'          => $username,
            'passwordHash'      => $passwordHash,
            'firstName'         => $firstName,
            'lastName'          => $lastName,
            'recoveryEmail'     => $recoveryEmail,
            'whatsapp'          => $whatsapp,
            'companyName'       => $companyName,
            'gstNumber'         => $gstNumber,
            'billingAddress'    => $billingAddr,
            'autoRenew'         => $autoRenew,
            'discountPercent'   => $discountPercent,
            'resolvedReferrerId'=> $resolvedReferrerId,
            'isPaidAd'          => $isPaidAd,
            'walletDeduction'   => $walletDeduction,
            'zohoChargeAmount'  => $zohoChargeAmount,
        ];
        $checkoutMeta = json_encode($checkoutMetaArr);

        // Store pending checkout
        Database::insert(
            'INSERT INTO `PendingCheckout`
             (referenceNumber, planId, amount, billingPeriod, customerEmail, customerName, customerPhone, checkoutMeta, promoCode, status, createdAt, updatedAt)
             VALUES (:ref, :planId, :amount, :bp, :email, :name, :phone, :meta, :promo, \'PENDING\', :now1, :now2)',
            [
                ':ref'    => $referenceNumber,
                ':planId' => $planId,
                ':amount' => $finalAmount,
                ':bp'     => $billingPeriod,
                ':email'  => $customerEmail,
                ':name'   => $customerName,
                ':phone'  => $customerPhone,
                ':meta'   => $checkoutMeta,
                ':promo'  => $promoCode,
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
            $description = "WebMyDrive - {$planName} (" . ucfirst($billingPeriod) . ")"
                . ($discountPercent > 0 ? ' [' . round($discountPercent * 100) . '% off]' : '');
            $session     = ZohoPaymentService::createSession(max(1.0, $zohoChargeAmount), $referenceNumber, $description);
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
            'amount'              => $finalAmount,
            'zohoChargeAmount'    => $zohoChargeAmount,
            'walletDeduction'     => $walletDeduction,
            'originalAmount'      => round($planBasePrice * 1.18, 2),
            'discountPercent'     => $discountPercent,
            'discountedBase'      => $discountedBase,
            'gstAmount'           => $gstAmount,
            'referenceNumber'     => $referenceNumber,
            'description'         => $description,
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
                // Route to reactivation handler if this is a reactivation checkout
                $ref = $payload['event_object']['payment']['reference_number'] ?? '';
                $co  = $ref ? Database::queryOne('SELECT checkoutMeta FROM `PendingCheckout` WHERE referenceNumber=:r', [':r' => $ref]) : null;
                $coMeta = $co ? (json_decode($co['checkoutMeta'] ?? '{}', true) ?? []) : [];
                if (($coMeta['type'] ?? '') === 'REACTIVATION') {
                    $this->handleReactivationPaymentSucceeded($payload, $coMeta);
                } else {
                    $this->handlePaymentSucceeded($payload);
                }
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
            $autoRenew     = !empty($meta['autoRenew']) ? 1 : 0;
            $billingPeriodLower = strtolower($billingPeriod);

            // Recover discount & referrer from checkout meta
            $discountPercent    = (float) ($meta['discountPercent']    ?? 0);
            $resolvedReferrerId = isset($meta['resolvedReferrerId']) && $meta['resolvedReferrerId']
                                    ? (int) $meta['resolvedReferrerId'] : null;

            // Check if workspace exists
            $wsExists = Database::queryOne('SELECT id FROM `Workspace` WHERE userId = :uid', [':uid' => $userId]);
            if (!$wsExists) {
                Database::insert(
                    'INSERT INTO `Workspace`
                     (userId, planId, discount_percent, referred_by, status, renewalDate, billingPeriod, autoRenew, createdAt, updatedAt)
                     VALUES (:uid, :planId, :disc, :refBy, \'ACTIVE\', :renewal, :bp, :ar, :now1, :now2)',
                    [
                        ':uid'     => $userId,
                        ':planId'  => (int) $checkout['planId'],
                        ':disc'    => $discountPercent,
                        ':refBy'   => $resolvedReferrerId,
                        ':renewal' => $renewalDate,
                        ':bp'      => $billingPeriodLower,
                        ':ar'      => $autoRenew,
                        ':now1'    => $now,
                        ':now2'    => $now,
                    ]
                );
            } else {
                Database::execute(
                    'UPDATE `Workspace` SET planId=:planId, status=\'ACTIVE\', renewalDate=:renewal,
                     billingPeriod=:bp, autoRenew=:ar, updatedAt=:now WHERE userId=:uid',
                    [':planId' => (int) $checkout['planId'], ':renewal' => $renewalDate,
                     ':bp' => $billingPeriodLower, ':ar' => $autoRenew, ':now' => $now, ':uid' => $userId]
                );
            }

            // 4a. If auto-renew opted in, create mandate session (non-fatal — requires ZohoPay.mandates.ALL scope)
            if ($autoRenew) {
                try {
                    $plan = Database::queryOne('SELECT price, monthlyPrice FROM `Plan` WHERE id = :id', [':id' => (int)$checkout['planId']]);
                    $planAmt = ($billingPeriodLower === 'monthly')
                        ? (float)($plan['monthlyPrice'] ?? round((float)$plan['price'] / 12, 2))
                        : (float)($plan['price'] ?? 0);
                    $maxAmount   = round($planAmt * 1.5, 2);
                    $mandateRef  = 'WMD-MND-' . strtoupper(bin2hex(random_bytes(4)));
                    $mandateSess = ZohoMandateService::createMandateSession(
                        $maxAmount, $mandateRef, 'WebMyDrive Auto-Renewal'
                    );
                    $mandateSessionId = $mandateSess['id'] ?? ($mandateSess['mandate_session_id'] ?? '');
                    if ($mandateSessionId) {
                        Database::execute(
                            'UPDATE `Workspace` SET mandateId=:mid, updatedAt=:now WHERE userId=:uid',
                            [':mid' => 'SESSION:' . $mandateSessionId, ':now' => $now, ':uid' => $userId]
                        );
                        Logger::info("[ZohoWebhook] Mandate session created={$mandateSessionId} for userId={$userId}");
                    }
                } catch (Throwable $me) {
                    Logger::error('[ZohoWebhook] Mandate session creation failed (non-fatal): ' . $me->getMessage());
                }
            }

            // 5. Mark checkout as completed
            Database::execute(
                'UPDATE `PendingCheckout` SET status=\'COMPLETED\', createdUserId=:uid, updatedAt=:now WHERE referenceNumber=:ref',
                [':uid' => $userId, ':now' => $now, ':ref' => $referenceNumber]
            );

            Database::commit();

            // 6. Deduct wallet if used (non-fatal, after commit)
            $walletDeduction = (float)($meta['walletDeduction'] ?? 0);
            if ($walletDeduction > 0) {
                try {
                    $now2 = date('Y-m-d H:i:s');
                    Database::insert(
                        "INSERT INTO `WalletTransaction`
                         (userId, amount, type, source, description, orderId, createdAt)
                         VALUES (:uid, :amt, 'DEBIT', 'SPEND', :desc, :oid, :now)",
                        [':uid' => $userId, ':amt' => $walletDeduction,
                         ':desc' => "Wallet used for order #{$orderId}",
                         ':oid' => $orderId, ':now' => $now2]
                    );
                    Database::execute(
                        'UPDATE `User` SET walletBalance = GREATEST(0, walletBalance - :amt) WHERE id = :id',
                        [':amt' => $walletDeduction, ':id' => $userId]
                    );
                    Logger::info("[ZohoWebhook] Wallet ₹{$walletDeduction} deducted from user {$userId}");
                } catch (Throwable $we) {
                    Logger::error('[ZohoWebhook] Wallet deduction failed (non-fatal): ' . $we->getMessage());
                }
            }

            // 7. Process referral/distributor commission (non-fatal, after commit)
            $promoCode = $checkout['promoCode'] ?? ($meta['promoCode'] ?? null);
            if ($promoCode) {
                try {
                    if (str_starts_with((string)$promoCode, 'DIST_')) {
                        // Distributor promo code — attribute commission to the distributor
                        $parts = explode(':', (string)$promoCode, 2);
                        $distributorId = (int) str_replace('DIST_', '', $parts[0]);
                        if ($distributorId > 0) {
                            $orderForDist = Database::queryOne('SELECT amount FROM `Order` WHERE id = :id', [':id' => $orderId]);
                            DistributorService::processSale($distributorId, $userId, $orderId, (float)($orderForDist['amount'] ?? 0));
                        }
                    } else {
                        ReferralService::processNewOrder($orderId, $userId, $promoCode);
                    }
                } catch (Throwable $re) {
                    Logger::error('[ZohoWebhook] Commission processing failed (non-fatal): ' . $re->getMessage());
                }
            }

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

                $invPlan     = $checkout['planId'] ? Database::queryOne('SELECT name, priceINR, priceYearlyINR, priceMonthlyINR FROM `Plan` WHERE id = :id', [':id' => $checkout['planId']]) : [];
                $invPlanName = $invPlan['name'] ?? '';
                $billingPeriod = $checkout['billingPeriod'] ?? 'yearly';
                $invPlanRate = (float) ($billingPeriod === 'monthly'
                    ? ($invPlan['priceMonthlyINR'] ?? $invPlan['priceINR'] ?? 0)
                    : ($invPlan['priceYearlyINR']  ?? $invPlan['priceINR'] ?? 0));
                $invDiscountPct = (float) ($meta['discountPercent'] ?? 0);
                $invDiscountAmt = $invPlanRate > 0 ? round($invPlanRate * $invDiscountPct, 2) : 0.0;
                $invBase     = (float) $checkout['amount'];

                $invoiceResult = ZohoBooksService::createAndSendInvoice([
                    'planName'       => $invPlanName,
                    'username'       => $meta['username'] ?? '',
                    'customerName'   => $checkout['customerName'] ?? '',
                    'customerEmail'  => $checkout['customerEmail'] ?? '',
                    'customerPhone'  => $checkout['customerPhone'] ?? '',
                    'companyName'    => $meta['companyName']   ?? '',
                    'gstNumber'      => $meta['gstNumber']     ?? '',
                    'billingAddress' => $billingAddr,
                    'billingPeriod'  => $billingPeriod,
                    'activationDate' => $now,
                    'renewalDate'    => $renewalDate,
                    'planRate'       => $invPlanRate,
                    'discountAmount' => $invDiscountAmt,
                    'baseAmount'     => $invBase,
                    'referenceNumber'=> $referenceNumber,
                    'orderId'        => $orderId,
                ]);

                $zohoInvNumber = $invoiceResult['invoice_number'] ?? '';
                if ($zohoInvNumber) {
                    $invBaseNet = round($invBase / 1.18, 2);
                    $invGstAmt  = round($invBase - $invBaseNet, 2);
                    Database::insert(
                        "INSERT INTO `invoices`
                         (userId, orderId, invoiceNumber, invoiceDate, renewalDate,
                          planName, baseAmount, gstAmount, totalAmount, currency,
                          status, source, createdAt, updatedAt)
                         VALUES
                         (:uid, :oid, :num, :idate, :rdate,
                          :plan, :base, :gst, :total, 'INR',
                          'PAID', 'SYSTEM', :now, :now)",
                        [
                            ':uid'   => $userId,
                            ':oid'   => $orderId,
                            ':num'   => $zohoInvNumber,
                            ':idate' => date('Y-m-d'),
                            ':rdate' => date('Y-m-d', strtotime($renewalDate)),
                            ':plan'  => $invPlanName,
                            ':base'  => $invBaseNet,
                            ':gst'   => $invGstAmt,
                            ':total' => $invBase,
                            ':now'   => $now,
                        ]
                    );
                    Logger::info("[ZohoWebhook] Invoice {$zohoInvNumber} stored locally for orderId={$orderId}");
                }
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
    <tr><td><a href='https://webmydrive.com/user/dashboard' style='display:block;padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;text-decoration:none;color:#475569;font-size:13px;font-weight:600;'>WebMyDrive Portal &rarr;</a></td></tr>
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
            . "  Portal:        https://webmydrive.com/user/dashboard\n\n"
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

    // ── Public: Reactivation Info (public, token-authenticated) ──────────────

    public function getReactivationInfo(Request $req): void
    {
        $token = trim($_GET['token'] ?? '');
        if (!$token) Response::error('Token required', 400);

        $link = Database::queryOne(
            "SELECT sl.*, u.name, u.email, u.deletedAt
             FROM `SecurityLink` sl
             JOIN `User` u ON u.id = sl.userId
             WHERE sl.token = :tok AND sl.type = 'REACTIVATION' AND sl.status = 'ACTIVE'",
            [':tok' => $token]
        );

        if (!$link)                              Response::error('Invalid or expired link', 404);
        if (strtotime($link['expiresAt']) < time()) Response::error('This reactivation link has expired', 410);

        // Get current plan info
        $ws = Database::queryOne(
            'SELECT w.planId, p.name AS planName, p.priceINR, p.price
             FROM `Workspace` w LEFT JOIN `Plan` p ON p.id = w.planId
             WHERE w.userId = :uid ORDER BY w.createdAt DESC LIMIT 1',
            [':uid' => $link['userId']]
        );

        $basePrice   = (float)($ws['priceINR'] ?? $ws['price'] ?? 0);
        $gstAmount   = round($basePrice * 0.18, 2);
        $totalAmount = round($basePrice + $gstAmount, 2);

        $daysLeft    = max(0, ceil((strtotime($link['expiresAt']) - time()) / 86400));

        Response::json([
            'name'       => $link['name'] ?? explode('@', $link['email'])[0],
            'email'      => $link['email'],
            'planName'   => $ws['planName'] ?? 'Unknown',
            'baseAmount' => $basePrice,
            'gstAmount'  => $gstAmount,
            'total'      => $totalAmount,
            'daysLeft'   => $daysLeft,
            'tokenId'    => (int)$link['id'],
            'userId'     => (int)$link['userId'],
        ]);
    }

    // ── Public: Create Reactivation Payment Session ───────────────────────────

    public function createReactivationSession(Request $req): void
    {
        $token = trim($req->body['token'] ?? '');
        if (!$token) Response::error('Token required', 400);

        $link = Database::queryOne(
            "SELECT sl.*, u.name, u.email
             FROM `SecurityLink` sl JOIN `User` u ON u.id = sl.userId
             WHERE sl.token = :tok AND sl.type = 'REACTIVATION' AND sl.status = 'ACTIVE'",
            [':tok' => $token]
        );
        if (!$link || strtotime($link['expiresAt']) < time())
            Response::error('Invalid or expired token', 404);

        $ws = Database::queryOne(
            'SELECT w.planId, p.name AS planName, p.priceINR, p.price
             FROM `Workspace` w LEFT JOIN `Plan` p ON p.id = w.planId
             WHERE w.userId = :uid ORDER BY w.createdAt DESC LIMIT 1',
            [':uid' => $link['userId']]
        );

        $basePrice   = (float)($ws['priceINR'] ?? $ws['price'] ?? 0);
        $totalAmount = round($basePrice * 1.18, 2);

        $referenceNumber = 'WMD-REACT-' . strtoupper(bin2hex(random_bytes(6)));
        $now             = date('Y-m-d H:i:s');

        $checkoutMeta = json_encode([
            'type'    => 'REACTIVATION',
            'userId'  => (int)$link['userId'],
            'tokenId' => (int)$link['id'],
            'planId'  => (int)($ws['planId'] ?? 0),
        ]);

        Database::insert(
            'INSERT INTO `PendingCheckout`
             (referenceNumber, planId, amount, billingPeriod, customerEmail, customerName, customerPhone, checkoutMeta, status, createdAt, updatedAt)
             VALUES (:ref, :planId, :amount, \'monthly\', :email, :name, \'\', :meta, \'PENDING\', :now1, :now2)',
            [
                ':ref'    => $referenceNumber,
                ':planId' => (int)($ws['planId'] ?? 0),
                ':amount' => $totalAmount,
                ':email'  => $link['email'],
                ':name'   => $link['name'] ?? '',
                ':meta'   => $checkoutMeta,
                ':now1'   => $now,
                ':now2'   => $now,
            ]
        );

        $description = 'WebMyDrive Reactivation — ' . ($ws['planName'] ?? 'Plan');
        $session     = ZohoPaymentService::createSession(max(1.0, $totalAmount), $referenceNumber, $description);

        // Store session ID for fallback polling
        $paymentsSessionId = $session['payments_session_id'] ?? '';
        if ($paymentsSessionId) {
            $metaArr = json_decode($checkoutMeta, true);
            $metaArr['paymentsSessionId'] = $paymentsSessionId;
            Database::execute(
                'UPDATE `PendingCheckout` SET checkoutMeta=:meta WHERE referenceNumber=:ref',
                [':meta' => json_encode($metaArr), ':ref' => $referenceNumber]
            );
        }

        AuditService::log('REACTIVATION_SESSION_CREATED', (int)$link['userId'], $req->ip, [
            'referenceNumber' => $referenceNumber,
            'amount'          => $totalAmount,
        ]);

        Response::json([
            'account_id'         => ZOHO_PAYMENTS_ACCOUNT_ID,
            'api_key'            => ZOHO_PAYMENTS_API_KEY ?? '',
            'payments_session_id'=> $paymentsSessionId,
            'amount'             => $totalAmount,
            'referenceNumber'    => $referenceNumber,
        ]);
    }

    // ── Private: Reactivation Payment Succeeded ───────────────────────────────

    private function handleReactivationPaymentSucceeded(array $payload, array $meta): void
    {
        $payment         = $payload['event_object']['payment'] ?? [];
        $referenceNumber = $payment['reference_number'] ?? '';
        $zohoPaymentId   = $payment['payment_id']       ?? '';
        $paidAmount      = (float)($payment['amount']   ?? 0);

        $checkout = Database::queryOne(
            'SELECT * FROM `PendingCheckout` WHERE referenceNumber = :ref',
            [':ref' => $referenceNumber]
        );
        if (!$checkout || $checkout['status'] === 'COMPLETED') return;

        $userId  = (int)($meta['userId']  ?? 0);
        $tokenId = (int)($meta['tokenId'] ?? 0);
        $planId  = (int)($meta['planId']  ?? $checkout['planId'] ?? 0);
        $now     = date('Y-m-d H:i:s');
        $renewal = date('Y-m-d H:i:s', strtotime('+1 month'));

        $user = Database::queryOne('SELECT * FROM `User` WHERE id = :id', [':id' => $userId]);
        if (!$user) { Logger::error("[Reactivation] User {$userId} not found"); return; }

        Database::beginTransaction();
        try {
            Database::execute(
                'UPDATE `PendingCheckout` SET status=\'PROCESSING\', zohoPaymentId=:zpid, updatedAt=:now WHERE referenceNumber=:ref',
                [':zpid' => $zohoPaymentId, ':now' => $now, ':ref' => $referenceNumber]
            );

            // Restore portal account
            Database::execute(
                'UPDATE `User` SET isDisabled=0, deletedAt=NULL, scheduledGwsDeleteAt=NULL, updatedAt=:now WHERE id=:id',
                [':now' => $now, ':id' => $userId]
            );

            // Restore workspace + extend renewal
            Database::execute(
                "UPDATE `Workspace` SET status='ACTIVE', planId=:pid, renewalDate=:renewal, updatedAt=:now WHERE userId=:uid",
                [':pid' => $planId, ':renewal' => $renewal, ':now' => $now, ':uid' => $userId]
            );

            // Create order record
            $orderId = Database::insert(
                'INSERT INTO `Order` (userId, planId, amount, currency, status, paymentId, gatewayTxId, createdAt, updatedAt)
                 VALUES (:uid, :pid, :amt, \'INR\', \'PAID\', :payId, :ref, :now1, :now2)',
                [':uid' => $userId, ':pid' => $planId,
                 ':amt' => $paidAmount ?: (float)$checkout['amount'],
                 ':payId' => $zohoPaymentId, ':ref' => $referenceNumber,
                 ':now1' => $now, ':now2' => $now]
            );

            // Mark SecurityLink token as used
            if ($tokenId) {
                Database::execute(
                    "UPDATE `SecurityLink` SET status='USED', usedAt=:now WHERE id=:id",
                    [':now' => $now, ':id' => $tokenId]
                );
            }

            Database::execute(
                'UPDATE `PendingCheckout` SET status=\'COMPLETED\', createdUserId=:uid, updatedAt=:now WHERE referenceNumber=:ref',
                [':uid' => $userId, ':now' => $now, ':ref' => $referenceNumber]
            );

            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            Database::execute(
                'UPDATE `PendingCheckout` SET status=\'FAILED\', updatedAt=:now WHERE referenceNumber=:ref',
                [':now' => $now, ':ref' => $referenceNumber]
            );
            Logger::error('[Reactivation] handleReactivationPaymentSucceeded failed: ' . $e->getMessage());
            return;
        }

        // Unsuspend GWS (non-fatal)
        GoogleWorkspaceService::unsuspendUser($user['email']);

        // Confirmation email
        $name    = $user['name'] ?? explode('@', $user['email'])[0];
        $subject = "Your WebMyDrive account has been reactivated";
        $body    = "Hi {$name},\r\n\r\n"
                 . "Great news — your WebMyDrive account has been successfully reactivated.\r\n\r\n"
                 . "Your Google Workspace login: {$user['email']}\r\n"
                 . "Next renewal: " . date('d M Y', strtotime($renewal)) . "\r\n\r\n"
                 . "Login at: " . SITE_URL . "\r\n\r\n"
                 . "WebMyDrive Team\r\nsupport@webmydrive.com";
        $headers = "From: WebMyDrive <support@webmydrive.com>\r\nReply-To: support@webmydrive.com\r\nX-Mailer: PHP/" . PHP_VERSION;
        @mail($user['email'], $subject, $body, $headers);

        AuditService::log('[Payment] REACTIVATION_COMPLETE', $userId, null, [
            'referenceNumber' => $referenceNumber,
            'orderId'         => $orderId,
            'amount'          => $paidAmount,
        ]);

        Logger::info("[Reactivation] Account restored for userId={$userId} ref={$referenceNumber}");
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

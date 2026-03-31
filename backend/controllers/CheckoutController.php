<?php
/**
 * CheckoutController
 * 
 * Public checkout endpoints for unauthenticated users purchasing plans
 * 
 * Routes:
 *   POST /api/checkout/create-session    [Public] Create checkout session
 *   POST /api/checkout/process-payment   [Public] Process payment after Razorpay success
 */

declare(strict_types=1);

class CheckoutController
{
    /**
     * Create a checkout session for a new customer (public, unauthenticated)
     * 
     * POST /api/checkout/create-session
     * 
     * Request body:
     *   {
     *     "planId": "1",
     *     "planName": "Cloud Storage - 500GB",
     *     "amount": 5999,
     *     "customerName": "John Doe",
     *     "customerEmail": "john@example.com",
     *     "customerPhone": "+919876543210",
     *     "address": "123 Street",
     *     "city": "Mumbai",
     *     "state": "Maharashtra",
     *     "zipCode": "400001",
     *     "country": "India"
     *   }
     */
    public function createSession(Request $req): void
    {
        // Validate required fields
        $planId = trim((string) ($req->body['planId'] ?? ''));
        $planName = trim((string) ($req->body['planName'] ?? ''));
        $amount = (float) ($req->body['amount'] ?? 0);
        $customerName = trim((string) ($req->body['customerName'] ?? ''));
        $customerEmail = strtolower(trim((string) ($req->body['customerEmail'] ?? '')));
        $customerPhone = trim((string) ($req->body['customerPhone'] ?? ''));
        $address = trim((string) ($req->body['address'] ?? ''));
        $city = trim((string) ($req->body['city'] ?? ''));
        $state = trim((string) ($req->body['state'] ?? ''));
        $zipCode = trim((string) ($req->body['zipCode'] ?? ''));
        $country = trim((string) ($req->body['country'] ?? 'India'));
        $referralCode = strtoupper(trim((string) ($req->body['referralCode'] ?? '')));
        $billingPeriod = trim((string) ($req->body['billingPeriod'] ?? 'yearly'));

        // Validate required fields
        $errors = [];
        if (!$planId)
            $errors[] = 'planId is required';
        if (!$planName)
            $errors[] = 'planName is required';
        if ($amount <= 0)
            $errors[] = 'amount must be greater than 0';
        if (!$customerName)
            $errors[] = 'customerName is required';
        if (!$customerEmail || !filter_var($customerEmail, FILTER_VALIDATE_EMAIL))
            $errors[] = 'Valid email is required';
        if (!$customerPhone)
            $errors[] = 'customerPhone is required';
        if (!$address)
            $errors[] = 'address is required';
        if (!$city)
            $errors[] = 'city is required';
        if (!$state)
            $errors[] = 'state is required';
        if (!$zipCode)
            $errors[] = 'zipCode is required';

        if (!empty($errors)) {
            Response::error('Validation failed: ' . implode(', ', $errors), 400);
        }

        try {
            // Create Razorpay order
            $rzpOrder = RazorpayService::createOrder($amount, 'checkout_' . time());

            if (!$rzpOrder || !isset($rzpOrder['id'])) {
                Logger::error('[Checkout] Razorpay order creation failed');
                Response::error('Failed to create payment order. Please try again.', 500);
            }

            // Store checkout session data in a persistent way (database)
            // We'll use a simple checkout_sessions table or store in audit log
            $sessionId = bin2hex(random_bytes(16));
            $now = date('Y-m-d H:i:s');
            $expiresAt = date('Y-m-d H:i:s', strtotime('+1 hour'));

            Database::execute(
                'INSERT INTO "CheckoutSession" (
                    session_id, plan_id, plan_name, amount, customer_name, customer_email,
                    customer_phone, address, city, state, zip_code, country,
                    rzp_order_id, status, created_at, expires_at
                ) VALUES (
                    :sid, :pid, :pname, :amt, :cname, :cemail,
                    :cphone, :addr, :city, :state, :zcode, :country,
                    :rzpid, :status, :now, :expires
                )',
                [
                    ':sid' => $sessionId,
                    ':pid' => $planId,
                    ':pname' => $planName,
                    ':amt' => $amount,
                    ':cname' => $customerName,
                    ':cemail' => $customerEmail,
                    ':cphone' => $customerPhone,
                    ':addr' => $address,
                    ':city' => $city,
                    ':state' => $state,
                    ':zcode' => $zipCode,
                    ':country' => $country,
                    ':rzpid' => $rzpOrder['id'],
                    ':status' => 'PENDING',
                    ':now' => $now,
                    ':expires' => $expiresAt,
                ]
            );

            // -- Store referral code for attribution in audit log --
            if ($referralCode) {
                AuditService::log('CHECKOUT_REFERRAL_CODE', 0, $req->ip, [
                    'sessionId' => $sessionId,
                    'referralCode' => $referralCode,
                    'billingPeriod' => $billingPeriod,
                ]);
            }

            Logger::info('[Checkout] Session created', [
                'session_id' => $sessionId,
                'plan_id' => $planId,
                'amount' => $amount,
                'customer_email' => $customerEmail,
                'rzp_order_id' => $rzpOrder['id'],
            ]);

            Response::json([
                'success' => true,
                'sessionId' => $sessionId,
                'orderId' => $rzpOrder['id'],
                'razorpayKeyId' => RAZORPAY_KEY_ID ?: 'rzp_test_1234567890abcde', // Use test key in demo mode
                'amount' => $amount,
                'isDemoMode' => RazorpayService::isDemoMode(),
                'message' => 'Checkout session created successfully',
            ]);
        } catch (Exception $e) {
            Logger::error('[Checkout] Session creation error: ' . $e->getMessage());
            Response::error('Failed to create checkout session', 500);
        }
    }

    /**
     * Process payment after successful Razorpay payment
     * 
     * POST /api/checkout/process-payment
     * 
     * Request body:
     *   {
     *     "sessionId": "...",
     *     "paymentId": "pay_...",
     *     "orderId": "order_...",
     *     "signature": "..."
     *   }
     */
    public function processPayment(Request $req): void
    {
        $sessionId = trim((string) ($req->body['sessionId'] ?? ''));
        $paymentId = trim((string) ($req->body['paymentId'] ?? ''));
        $orderId = trim((string) ($req->body['orderId'] ?? ''));
        $signature = trim((string) ($req->body['signature'] ?? ''));

        if (!$sessionId || !$paymentId || !$orderId) {
            Response::error('Missing required fields', 400);
        }

        try {
            // Verify Razorpay signature
            if (!RazorpayService::verifySignature($orderId, $paymentId, $signature)) {
                Logger::error('[Checkout] Payment signature verification failed', [
                    'payment_id' => $paymentId,
                    'order_id' => $orderId,
                ]);
                Response::error('Payment verification failed. Invalid signature.', 400);
            }

            // Retrieve checkout session
            $session = Database::queryOne(
                'SELECT * FROM "CheckoutSession" WHERE session_id = :sid',
                [':sid' => $sessionId]
            );

            if (!$session) {
                Response::error('Invalid or expired checkout session', 400);
            }

            if ($session['status'] !== 'PENDING') {
                Response::error('Checkout session already processed', 400);
            }

            $customerEmail = $session['customer_email'];
            $customerName = $session['customer_name'];
            $planName = $session['plan_name'];
            $amount = $session['amount'];

            // Check if user already exists
            $existingUser = Database::queryOne(
                'SELECT * FROM "User" WHERE email = :email',
                [':email' => $customerEmail]
            );

            $userId = null;

            if (!$existingUser) {
                // Create new user account
                $tempPassword = self::generateTemporaryPassword();
                $passwordHash = password_hash($tempPassword, PASSWORD_BCRYPT, ['cost' => 10]);
                $referralCode = self::generateUniqueReferralCode($customerName, $customerEmail);
                $now = date('Y-m-d H:i:s');

                Database::execute(
                    'INSERT INTO "User" (
                        name, email, passwordHash, role, referralCode,
                        walletBalance, passwordResetRequired, first_login,
                        createdAt, updatedAt
                    ) VALUES (
                        :name, :email, :hash, :role, :refcode,
                        :wallet, :passreq, :firstlogin, :now, :now
                    )',
                    [
                        ':name' => $customerName,
                        ':email' => $customerEmail,
                        ':hash' => $passwordHash,
                        ':role' => 'USER',
                        ':refcode' => $referralCode,
                        ':wallet' => 0,
                        ':passreq' => 1,
                        ':firstlogin' => 1,
                        ':now' => $now,
                    ]
                );

                $user = Database::queryOne(
                    'SELECT id FROM "User" WHERE email = :email',
                    [':email' => $customerEmail]
                );
                $userId = (int) $user['id'];

                Logger::info('[Checkout] New user created', [
                    'user_id' => $userId,
                    'email' => $customerEmail,
                ]);
            } else {
                $userId = (int) $existingUser['id'];
            }

            // Create subscription
            $subscriptionResult = SubscriptionService::createSubscription(
                $userId,
                $planName,
                $paymentId,
                365 // 1 year subscription
            );

            if (!$subscriptionResult['success']) {
                Logger::error('[Checkout] Subscription creation failed', [
                    'user_id' => $userId,
                    'payment_id' => $paymentId,
                ]);
                Response::error('Failed to create subscription', 500);
            }

            // Create order record
            $now = date('Y-m-d H:i:s');
            Database::execute(
                'INSERT INTO "Order" (
                    userId, planId, amount, currency, paymentId,
                    status, createdAt, updatedAt
                ) VALUES (
                    :uid, :pid, :amt, :curr, :payid,
                    :status, :now, :now
                )',
                [
                    ':uid' => $userId,
                    ':pid' => $session['plan_id'],
                    ':amt' => $amount,
                    ':curr' => 'INR',
                    ':payid' => $paymentId,
                    ':status' => 'COMPLETED',
                    ':now' => $now,
                ]
            );

            // Update checkout session
            Database::execute(
                'UPDATE "CheckoutSession" SET status = :status, processed_at = :now WHERE session_id = :sid',
                [
                    ':status' => 'COMPLETED',
                    ':now' => $now,
                    ':sid' => $sessionId,
                ]
            );

            Logger::info('[Checkout] Payment processed successfully', [
                'user_id' => $userId,
                'email' => $customerEmail,
                'payment_id' => $paymentId,
                'plan_name' => $planName,
                'amount' => $amount,
            ]);

            // ── PURCHASE ATTRIBUTION ─────────────────────────────────────────
            // Retrieve referral code stored in audit log at session creation
            $refCodeRow = Database::queryOne(
                'SELECT details FROM "AuditLog"
                 WHERE action = \'CHECKOUT_REFERRAL_CODE\'
                 AND details LIKE :sid
                 ORDER BY createdAt DESC LIMIT 1',
                [':sid' => '%' . $sessionId . '%']
            );
            $attribution = $refCodeRow ? @json_decode($refCodeRow['details'], true) : null;
            $referralCode = $attribution['referralCode'] ?? '';

            // Get the newly created order ID
            $newOrder = Database::queryOne(
                'SELECT id FROM "Order" WHERE userId = :uid AND paymentId = :pid LIMIT 1',
                [':uid' => $userId, ':pid' => $paymentId]
            );
            $newOrderId = $newOrder ? (int) $newOrder['id'] : null;

            if ($newOrderId) {
                // Update order with referral code for audit trail
                Database::execute(
                    'UPDATE "Order" SET referralCode = :code WHERE id = :id',
                    [':code' => $referralCode ?: null, ':id' => $newOrderId]
                );

                if ($referralCode && str_starts_with($referralCode, 'DIST_')) {
                    // ── DISTRIBUTOR REFERRAL ─────────────────────────────────
                    $parts = explode('_', $referralCode, 3); // DIST_{id}_{code}
                    $distId = isset($parts[1]) ? (int) $parts[1] : 0;
                    if ($distId > 0) {
                        DistributorService::processSale($distId, (int) $userId, $newOrderId, (float) $amount);
                        AuditService::log('ATTRIBUTION_DISTRIBUTOR', (int) $userId, null, [
                            'orderId' => $newOrderId,
                            'distributorId' => $distId,
                            'referralCode' => $referralCode,
                        ]);
                        Logger::info('[Checkout] Attribution → Distributor', ['dist_id' => $distId, 'order_id' => $newOrderId]);
                    }
                } elseif ($referralCode) {
                    // ── USER REFERRAL ─────────────────────────────────────────
                    // Mark order as PAID first so ReferralService processes it
                    Database::execute(
                        'UPDATE "Order" SET status = \'PAID\' WHERE id = :id',
                        [':id' => $newOrderId]
                    );
                    ReferralService::processNewOrder($newOrderId, (int) $userId, $referralCode);
                    // Restore COMPLETED status
                    Database::execute(
                        'UPDATE "Order" SET status = \'COMPLETED\' WHERE id = :id',
                        [':id' => $newOrderId]
                    );
                    AuditService::log('ATTRIBUTION_USER_REFERRAL', (int) $userId, null, [
                        'orderId' => $newOrderId,
                        'referralCode' => $referralCode,
                    ]);
                    Logger::info('[Checkout] Attribution → User Referral', ['code' => $referralCode, 'order_id' => $newOrderId]);
                } else {
                    // ── DIRECT SALE ───────────────────────────────────────────
                    AuditService::log('ATTRIBUTION_DIRECT', (int) $userId, null, [
                        'orderId' => $newOrderId,
                        'email' => $customerEmail,
                    ]);
                    Logger::info('[Checkout] Attribution → Direct Sale', ['order_id' => $newOrderId]);
                }

                // Clear the referral code from localStorage (signal via response)
                // Frontend will clear wmd_pending_ref on success
            }

            // Generate Token for Auto-Login
            $role = $existingUser ? $existingUser['role'] : 'USER';
            $token = JwtHelper::generateToken((int) $userId, $role);

            Response::json([
                'success' => true,
                'userId' => $userId,
                'email' => $customerEmail,
                'token' => $token,
                'clearReferral' => true,   // ← frontend clears wmd_pending_ref
                'message' => 'Payment processed successfully.',
            ]);
        } catch (Exception $e) {
            Logger::error('[Checkout] Payment processing error: ' . $e->getMessage());
            Response::error('Failed to process payment', 500);
        }
    }

    /**
     * Generate a secure temporary password
     */
    private static function generateTemporaryPassword(): string
    {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        $password = '';
        for ($i = 0; $i < 12; $i++) {
            $password .= $chars[mt_rand(0, strlen($chars) - 1)];
        }
        return $password;
    }

    /**
     * Generate unique referral code
     */
    private static function generateUniqueReferralCode(string $name, string $email): string
    {
        $basename = substr(str_replace(' ', '', strtoupper($name)), 0, 3) .
            substr(md5($email), 0, 5);

        $code = $basename;
        $counter = 1;

        while (
            Database::queryOne(
                'SELECT id FROM "User" WHERE referralCode = :code',
                [':code' => $code]
            )
        ) {
            $code = $basename . $counter;
            $counter++;
        }

        return $code;
    }
}

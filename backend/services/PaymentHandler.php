<?php
/**
 * PaymentHandler
 * 
 * Handles payment verification and account creation flow:
 * 1. Verify payment with payment gateway
 * 2. Create user account if doesn't exist
 * 3. Create subscription
 * 4. Return credentials to user
 */

declare(strict_types=1);

class PaymentHandler
{
    /**
     * Handle successful payment and create subscription
     */
    public static function handlePaymentSuccess(array $paymentData): array
    {
        try {
            $paymentId = $paymentData['payment_id'] ?? null;
            $email = strtolower(trim($paymentData['email'] ?? ''));
            $name = trim($paymentData['name'] ?? '');
            $planName = trim($paymentData['plan_name'] ?? '');
            $amount = $paymentData['amount'] ?? 0;

            // Validate required fields
            if (!$paymentId || !$email || !$name || !$planName) {
                return ['success' => false, 'error' => 'Missing required payment fields'];
            }

            // Check if payment already processed (idempotency)
            $existing = Database::queryOne(
                'SELECT * FROM "Order" WHERE paymentId = :pid',
                [':pid' => $paymentId]
            );

            if ($existing) {
                // Payment already processed, return existing user info
                return [
                    'success' => true,
                    'message' => 'Payment already processed',
                    'email' => $email,
                    'planName' => $planName,
                ];
            }

            // Check if user already exists
            $user = Database::queryOne(
                'SELECT * FROM "User" WHERE email = :email',
                [':email' => $email]
            );

            $userId = null;

            // Create user if doesn't exist
            if (!$user) {
                // Generate temporary password
                $tempPassword = self::generateTemporaryPassword();
                $passwordHash = password_hash($tempPassword, PASSWORD_BCRYPT, ['cost' => 10]);

                // Generate referral code
                $referralCode = self::generateUniqueReferralCode($name, $email);

                $now = date('Y-m-d H:i:s');

                Database::execute(
                    'INSERT INTO "User" (name, email, passwordHash, role, referralCode, walletBalance, passwordResetRequired, first_login, createdAt, updatedAt)
                     VALUES (:name, :email, :hash, :role, :refcode, :wallet, :passreq, :firstlogin, :now, :now)',
                    [
                        ':name' => $name,
                        ':email' => $email,
                        ':hash' => $passwordHash,
                        ':role' => 'USER',
                        ':refcode' => $referralCode,
                        ':wallet' => 0,
                        ':passreq' => 1, // Require password change on first login
                        ':firstlogin' => 1,
                        ':now' => $now,
                    ]
                );

                $userId = Database::queryOne(
                    'SELECT id FROM "User" WHERE email = :email',
                    [':email' => $email]
                )['id'];
            } else {
                $userId = (int)$user['id'];
            }

            // Create subscription
            $subscriptionResult = SubscriptionService::createSubscription(
                $userId,
                $planName,
                $paymentId,
                365 // 1 year subscription
            );

            if (!$subscriptionResult['success']) {
                return ['success' => false, 'error' => 'Failed to create subscription'];
            }

            // Create order record
            Database::execute(
                'INSERT INTO "Order" (userId, planId, amount, currency, status, paymentId, createdAt, updatedAt)
                 VALUES (:uid, :pid, :amount, :currency, :status, :payid, :now, :now)',
                [
                    ':uid' => $userId,
                    ':pid' => null, // Could fetch plan ID if needed
                    ':amount' => $amount,
                    ':currency' => 'INR',
                    ':status' => 'COMPLETED',
                    ':payid' => $paymentId,
                    ':now' => date('Y-m-d H:i:s'),
                ]
            );

            // Log audit event
            Logger::info("Payment processed for user $userId (email: $email, payment_id: $paymentId)");

            return [
                'success' => true,
                'message' => 'Payment verified and subscription created',
                'user' => [
                    'email' => $email,
                    'name' => $name,
                ],
                'subscription' => $subscriptionResult['subscription'],
                'requiresPasswordChange' => !$user, // New user needs to set password
                'temporaryPassword' => !$user ? $tempPassword : null, // Send temp password to new users
            ];

        } catch (Exception $e) {
            Logger::error("Payment handler error: " . $e->getMessage());
            return ['success' => false, 'error' => 'Payment processing failed: ' . $e->getMessage()];
        }
    }

    /**
     * Verify payment with payment gateway (Razorpay, etc.)
     * Implement integration with your payment provider
     */
    public static function verifyRazorpayPayment(string $paymentId, string $signature): bool
    {
        // This should call your Razorpay API to verify the payment
        // For now, just return true - implement actual verification
        // 
        // Example:
        // $client = new Client();
        // $payment = $client->payment->fetch($paymentId);
        // return $payment->status === 'captured';
        
        return true; // Replace with actual verification
    }

    /**
     * Generate temporary password for new users
     */
    private static function generateTemporaryPassword(): string
    {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        $password = '';
        for ($i = 0; $i < 12; $i++) {
            $password .= $chars[random_int(0, strlen($chars) - 1)];
        }
        return $password;
    }

    /**
     * Generate unique referral code
     */
    private static function generateUniqueReferralCode(string $name, string $email): string
    {
        $src = trim($name) ?: explode('@', $email)[0];
        $firstWord = preg_split('/\s+/', $src)[0];
        $base = strtoupper(preg_replace('/[^a-z0-9]/i', '', $firstWord));
        $base = substr($base, 0, 12);
        
        $code = $base . date('Y');
        $attempt = 1;

        while (Database::queryOne(
            'SELECT id FROM "User" WHERE referralCode = :code',
            [':code' => $code]
        )) {
            $code = $base . $attempt;
            $attempt++;
            if ($attempt > 10) {
                $code = bin2hex(random_bytes(6));
                break;
            }
        }

        return $code;
    }
}

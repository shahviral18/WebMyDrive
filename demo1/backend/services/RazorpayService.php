<?php
/**
 * RazorpayService — Mirrors src/services/RazorpayService.ts
 *
 * Creates Razorpay orders and verifies payment signatures.
 * Demo mode active when keys are missing/placeholder — simulates payments.
 *
 * No external SDK required: uses raw HTTP via cURL (Razorpay REST API).
 */

declare(strict_types=1);

class RazorpayService
{
    private static bool $demoMode;

    public static function isDemoMode(): bool
    {
        if (!isset(self::$demoMode)) {
            $keyId = RAZORPAY_KEY_ID;
            $keySecret = RAZORPAY_KEY_SECRET;

            self::$demoMode = (
                !$keyId ||
                !$keySecret ||
                str_contains($keyId, '...') ||
                $keyId === 'rzp_test_placeholder' ||
                $keySecret === 'secret' ||
                $keySecret === 'secret_placeholder'
            );

            if (self::$demoMode) {
                Logger::warn('[RazorpayService] ⚠️  Running in DEMO MODE — payments are simulated.');
            }
        }
        return self::$demoMode;
    }

    /**
     * Create a Razorpay order (or a demo stub if in demo mode).
     *
     * @param float  $amountINR Amount in Indian Rupees
     * @param string $receipt   Internal order ID (used as receipt reference)
     * @return array  Razorpay order object shape: {id, amount, currency, receipt, status}
     */
    public static function createOrder(float $amountINR, string $receipt): array
    {
        if (self::isDemoMode()) {
            return [
                'id' => 'demo_order_' . $receipt . '_' . time(),
                'amount' => (int) round($amountINR * 100),
                'currency' => 'INR',
                'receipt' => $receipt,
                'status' => 'created',
            ];
        }

        $payload = json_encode([
            'amount' => (int) round($amountINR * 100), // Razorpay expects paise
            'currency' => 'INR',
            'receipt' => $receipt,
        ]);

        $ch = curl_init('https://api.razorpay.com/v1/orders');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_USERPWD => RAZORPAY_KEY_ID . ':' . RAZORPAY_KEY_SECRET,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT => 15,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($curlErr) {
            throw new RuntimeException("Razorpay API error: $curlErr");
        }

        $data = json_decode($response, true);
        if ($httpCode !== 200 || !isset($data['id'])) {
            $errMsg = $data['error']['description'] ?? $response;
            throw new RuntimeException("Razorpay order creation failed: $errMsg");
        }

        return $data;
    }

    /**
     * Verify the Razorpay payment signature (HMAC-SHA256).
     * In demo mode, accepts any payment ID starting with "demo_pay_".
     */
    public static function verifySignature(string $orderId, string $paymentId, string $signature): bool
    {
        if (self::isDemoMode()) {
            return str_starts_with($paymentId, 'demo_pay_');
        }

        $body = $orderId . '|' . $paymentId;
        $expected = hash_hmac('sha256', $body, RAZORPAY_KEY_SECRET);

        // Constant-time comparison
        return hash_equals($expected, $signature);
    }
}

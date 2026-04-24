<?php
/**
 * ZohoPaymentService
 *
 * Handles Zoho Payments India (payments.zoho.in) integration:
 *  - Creating payment sessions via API
 *  - Verifying webhook signatures (HMAC-SHA256)
 */

declare(strict_types=1);

class ZohoPaymentService
{
    private const API_BASE = 'https://payments.zoho.in/api/v1';

    /**
     * Create a Zoho payment session.
     * Returns the payments_session object from Zoho.
     */
    public static function createSession(
        float  $amount,
        string $referenceNumber,
        string $description,
        string $customerName  = '',
        string $customerEmail = '',
        string $customerPhone = ''
    ): array {
        $accountId = ZOHO_PAYMENTS_ACCOUNT_ID;
        $apiKey    = ZOHO_PAYMENTS_API_KEY;

        $payload = [
            'amount'           => (float) round($amount, 2),
            'currency'         => 'INR',
            'description'      => substr($description, 0, 255),
            'reference_number' => $referenceNumber,
        ];

        if ($customerName || $customerEmail || $customerPhone) {
            $customer = [];
            if ($customerName)  $customer['name']         = $customerName;
            if ($customerEmail) $customer['email']        = $customerEmail;
            if ($customerPhone) $customer['phone_number'] = $customerPhone;
            $payload['customer'] = $customer;
        }

        $url = self::API_BASE . "/paymentsessions?account_id={$accountId}";
        $ch  = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => [
                'Authorization: Zoho-apikey ' . $apiKey,
                'Content-Type: application/json',
                'Accept: application/json',
            ],
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr  = curl_error($ch);
        curl_close($ch);

        if ($curlErr) {
            throw new RuntimeException("Zoho API cURL error: $curlErr");
        }

        $data = json_decode($response, true);

        if ($httpCode < 200 || $httpCode >= 300) {
            $errMsg = $data['message'] ?? $response;
            Logger::error('[ZohoPayments] Session creation failed HTTP=' . $httpCode . ' response=' . $response . ' payload=' . json_encode($payload));
            throw new RuntimeException("Zoho session creation failed (HTTP $httpCode): $errMsg");
        }

        return $data['payments_session'] ?? $data;
    }

    /**
     * Verify the X-Zoho-Webhook-Signature header.
     * Format: t=TIMESTAMP,v=HMAC_HEX
     * HMAC = SHA256( signingKey, "TIMESTAMP.rawBody" )
     */
    public static function verifyWebhookSignature(string $rawBody, string $signatureHeader): bool
    {
        $signingKey = ZOHO_PAYMENTS_SIGNING_KEY;
        if (!$signingKey || !$signatureHeader) {
            // If no signing key configured, skip verification (dev mode only)
            Logger::warn('[ZohoPayments] Webhook signature verification skipped — no signing key');
            return true;
        }

        // Parse "t=1234567890,v=abc123..."
        $parts = [];
        foreach (explode(',', $signatureHeader) as $part) {
            [$k, $v] = array_pad(explode('=', $part, 2), 2, '');
            $parts[trim($k)] = trim($v);
        }

        $timestamp = $parts['t'] ?? '';
        $received  = $parts['v'] ?? '';

        if (!$timestamp || !$received) {
            Logger::warn('[ZohoPayments] Malformed webhook signature header');
            return false;
        }

        $dataString = "{$timestamp}.{$rawBody}";
        $expected   = hash_hmac('sha256', $dataString, $signingKey);

        return hash_equals($expected, $received);
    }
}

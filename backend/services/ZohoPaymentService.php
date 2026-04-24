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
    private const API_BASE   = 'https://payments.zoho.in/api/v1';
    private const TOKEN_URL  = 'https://accounts.zoho.in/oauth/v2/token';

    /**
     * Exchange refresh token for a fresh OAuth access token.
     */
    private static function getAccessToken(): string
    {
        $ch = curl_init(self::TOKEN_URL);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query([
                'grant_type'    => 'refresh_token',
                'client_id'     => ZOHO_OAUTH_CLIENT_ID,
                'client_secret' => ZOHO_OAUTH_CLIENT_SECRET,
                'refresh_token' => ZOHO_OAUTH_REFRESH_TOKEN,
            ]),
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $response = curl_exec($ch);
        $curlErr  = curl_error($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($curlErr) throw new RuntimeException("Zoho OAuth cURL error: $curlErr");

        $data = json_decode($response, true);
        if ($httpCode !== 200 || empty($data['access_token'])) {
            Logger::error('[ZohoPayments] OAuth token refresh failed HTTP=' . $httpCode . ' response=' . $response);
            throw new RuntimeException('Zoho OAuth token refresh failed');
        }
        return $data['access_token'];
    }

    /**
     * Create a Zoho payment session.
     * Returns the payments_session object from Zoho.
     */
    public static function createSession(
        float  $amount,
        string $referenceNumber,
        string $description,
        string $redirectUrl = ''
    ): array {
        $accountId   = ZOHO_PAYMENTS_ACCOUNT_ID;
        $accessToken = self::getAccessToken();

        $payload = [
            'amount'           => (float) round($amount, 2),
            'currency'         => 'INR',
            'description'      => substr($description, 0, 255),
            'reference_number' => $referenceNumber,
        ];

        $url = self::API_BASE . "/paymentsessions?account_id={$accountId}";
        $ch  = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => [
                'Authorization: Zoho-oauthtoken ' . $accessToken,
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
     * Fetch a payment session from Zoho and return its status string.
     * Returns 'paid', 'pending', 'failed', etc. (lowercase Zoho values).
     */
    public static function getSessionStatus(string $sessionId): string
    {
        $accountId   = ZOHO_PAYMENTS_ACCOUNT_ID;
        $accessToken = self::getAccessToken();

        $url = self::API_BASE . "/paymentsessions/{$sessionId}?account_id={$accountId}";
        $ch  = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Zoho-oauthtoken ' . $accessToken,
                'Accept: application/json',
            ],
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr  = curl_error($ch);
        curl_close($ch);

        if ($curlErr || $httpCode < 200 || $httpCode >= 300) {
            Logger::warn('[ZohoPayments] getSessionStatus failed HTTP=' . $httpCode . ' err=' . $curlErr);
            return 'unknown';
        }

        $data = json_decode($response, true);
        $session = $data['payments_session'] ?? $data;
        return strtolower($session['status'] ?? 'unknown');
    }

    /**
     * Verify the X-Zoho-Webhook-Signature header.
     * Format: t=TIMESTAMP,v=HMAC_HEX
     * HMAC = SHA256( signingKey, "TIMESTAMP.rawBody" )
     */
    public static function verifyWebhookSignature(string $rawBody, string $signatureHeader): bool
    {
        $signingKey = ZOHO_PAYMENTS_WEBHOOK_SECRET; // use the webhook-specific secret
        if (!$signingKey || !$signatureHeader) {
            Logger::warn('[ZohoPayments] Webhook signature verification skipped — no signing key configured');
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

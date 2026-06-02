<?php
/**
 * ZohoMandateService — Zoho Payments India mandate (auto-debit) integration
 *
 * Requires OAuth scope: ZohoPay.mandates.ALL (in addition to ZohoPay.payments.*)
 * Add this scope in api-console.zoho.in and regenerate ZOHO_OAUTH_REFRESH_TOKEN.
 *
 * Mandate flow:
 *  1. createMandateSession()  → returns widget params for user to authorise
 *  2. User completes mandate setup via Zoho widget
 *  3. getMandateIdFromSession() → store mandate_id in Workspace.mandateId
 *  4. chargeMandate()          → called by cron on renewal day
 *  5. cancelMandate()          → called when user disables auto-renewal
 */

declare(strict_types=1);

class ZohoMandateService
{
    private const API_BASE  = 'https://payments.zoho.in/api/v1';
    private const TOKEN_URL = 'https://accounts.zoho.in/oauth/v2/token';

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
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr  = curl_error($ch);
        curl_close($ch);

        if ($curlErr) throw new RuntimeException("Zoho OAuth cURL error: $curlErr");
        $data = json_decode($response, true);
        if ($httpCode !== 200 || empty($data['access_token'])) {
            Logger::error('[ZohoMandate] OAuth token refresh failed HTTP=' . $httpCode . ' body=' . $response);
            throw new RuntimeException('Zoho OAuth token refresh failed — check ZOHO_OAUTH_REFRESH_TOKEN has ZohoPay.mandates.ALL scope');
        }
        return $data['access_token'];
    }

    private static function call(string $method, string $path, array $payload = []): array
    {
        $accountId   = ZOHO_PAYMENTS_ACCOUNT_ID;
        $accessToken = self::getAccessToken();
        $url         = self::API_BASE . $path . '?account_id=' . $accountId;

        $ch = curl_init($url);
        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Zoho-oauthtoken ' . $accessToken,
                'Content-Type: application/json',
                'Accept: application/json',
            ],
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_SSL_VERIFYPEER => true,
        ];

        if ($method === 'POST') {
            $opts[CURLOPT_POST]       = true;
            $opts[CURLOPT_POSTFIELDS] = json_encode($payload);
        } elseif ($method === 'DELETE') {
            $opts[CURLOPT_CUSTOMREQUEST] = 'DELETE';
        }

        curl_setopt_array($ch, $opts);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr  = curl_error($ch);
        curl_close($ch);

        if ($curlErr) throw new RuntimeException("Zoho Mandate cURL error: $curlErr");

        $data = json_decode($response, true);
        if ($httpCode < 200 || $httpCode >= 300) {
            $errMsg = $data['message'] ?? $response;
            Logger::error("[ZohoMandate] $method $path failed HTTP=$httpCode msg=$errMsg");
            throw new RuntimeException("Zoho Mandate API error: $errMsg");
        }

        return $data;
    }

    /**
     * Create a mandate session for user authorization.
     * Returns widget params (mandate_session_id, account_id, api_key).
     * Max amount = plan price × 1.5 (covers up to 50% price increase).
     */
    public static function createMandateSession(
        float  $maxAmount,
        string $referenceNumber,
        string $description
    ): array {
        $payload = [
            'amount'           => round($maxAmount, 2),
            'currency'         => 'INR',
            'description'      => substr($description, 0, 255),
            'reference_number' => $referenceNumber,
            'amount_rule'      => 'MAX_AMOUNT',
        ];

        Logger::info('[ZohoMandate] Creating mandate session ref=' . $referenceNumber . ' max=' . $maxAmount);
        $data = self::call('POST', '/mandatesessions', $payload);

        $session = $data['mandate_session'] ?? $data;
        Logger::info('[ZohoMandate] Mandate session created id=' . ($session['id'] ?? 'unknown'));
        return $session;
    }

    /**
     * Get the mandate_id from a completed mandate session.
     * Call this after the user has authorised the mandate via the widget.
     */
    public static function getMandateIdFromSession(string $mandateSessionId): ?string
    {
        $data    = self::call('GET', '/mandatesessions/' . $mandateSessionId);
        $session = $data['mandate_session'] ?? $data;
        $status  = strtolower($session['status'] ?? '');

        if ($status === 'active' || $status === 'approved') {
            return $session['mandate_id'] ?? null;
        }
        return null;
    }

    /**
     * Get current status of a mandate.
     */
    public static function getMandateStatus(string $mandateId): string
    {
        $data   = self::call('GET', '/mandates/' . $mandateId);
        $mandate = $data['mandate'] ?? $data;
        return strtolower($mandate['status'] ?? 'unknown');
    }

    /**
     * Charge an existing mandate. Used by the renewal cron job.
     * Returns ['success' => bool, 'payment_id' => string, 'message' => string]
     */
    public static function chargeMandate(
        string $mandateId,
        float  $amount,
        string $referenceNumber,
        string $description
    ): array {
        try {
            $payload = [
                'amount'           => round($amount, 2),
                'currency'         => 'INR',
                'description'      => substr($description, 0, 255),
                'reference_number' => $referenceNumber,
            ];

            Logger::info("[ZohoMandate] Charging mandate=$mandateId amount=$amount ref=$referenceNumber");
            $data    = self::call('POST', '/mandates/' . $mandateId . '/charge', $payload);
            $payment = $data['payment'] ?? $data;
            $status  = strtolower($payment['status'] ?? '');

            $success = in_array($status, ['paid', 'success', 'completed', 'captured'], true);
            Logger::info("[ZohoMandate] Charge result status=$status success=" . ($success ? 'yes' : 'no'));

            return [
                'success'    => $success,
                'payment_id' => $payment['id'] ?? $payment['payment_id'] ?? '',
                'status'     => $status,
                'message'    => $payment['message'] ?? '',
            ];
        } catch (Throwable $e) {
            Logger::error('[ZohoMandate] chargeMandate failed: ' . $e->getMessage());
            return ['success' => false, 'payment_id' => '', 'status' => 'error', 'message' => $e->getMessage()];
        }
    }

    /**
     * Cancel (revoke) a mandate. Called when user disables auto-renewal.
     */
    public static function cancelMandate(string $mandateId): bool
    {
        try {
            self::call('DELETE', '/mandates/' . $mandateId);
            Logger::info('[ZohoMandate] Mandate cancelled: ' . $mandateId);
            return true;
        } catch (Throwable $e) {
            Logger::error('[ZohoMandate] cancelMandate failed: ' . $e->getMessage());
            return false;
        }
    }
}

<?php
/**
 * ZohoBooksService
 *
 * Creates and sends invoices via Zoho Books API (India — zohoapis.in).
 * OAuth access tokens are refreshed automatically using the stored refresh token.
 *
 * GST logic:
 *   - Billing state = Gujarat → CGST 9% + SGST 9%
 *   - Any other state / country  → IGST 18%
 */

declare(strict_types=1);

class ZohoBooksService
{
    private const API_BASE  = 'https://www.zohoapis.in/books/v3';
    private const TOKEN_URL = 'https://accounts.zoho.in/oauth/v2/token';

    // ── Access Token (refreshed per request cycle) ────────────────────────────

    private static ?string $accessToken = null;

    private static function getAccessToken(): string
    {
        if (self::$accessToken) return self::$accessToken;

        $ch = curl_init(self::TOKEN_URL);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query([
                'grant_type'    => 'refresh_token',
                'client_id'     => ZOHO_BOOKS_CLIENT_ID,
                'client_secret' => ZOHO_BOOKS_CLIENT_SECRET,
                'refresh_token' => ZOHO_BOOKS_REFRESH_TOKEN,
            ]),
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $resp = curl_exec($ch);
        curl_close($ch);

        $data = json_decode($resp, true);
        if (empty($data['access_token'])) {
            throw new RuntimeException('Zoho Books: failed to obtain access token — ' . $resp);
        }

        self::$accessToken = $data['access_token'];
        return self::$accessToken;
    }

    // ── Internal cURL helper ──────────────────────────────────────────────────

    private static function call(string $method, string $path, array $body = []): array
    {
        $token  = self::getAccessToken();
        $orgId  = ZOHO_BOOKS_ORG_ID;
        $url    = self::API_BASE . $path . (str_contains($path, '?') ? '&' : '?') . "organization_id={$orgId}";

        $ch = curl_init($url);
        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Zoho-oauthtoken ' . $token,
                'Content-Type: application/json',
            ],
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_SSL_VERIFYPEER => true,
        ];

        if ($method === 'POST') {
            $opts[CURLOPT_POST]       = true;
            $opts[CURLOPT_POSTFIELDS] = json_encode($body);
        }

        curl_setopt_array($ch, $opts);
        $resp    = curl_exec($ch);
        $code    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($curlErr) throw new RuntimeException("Zoho Books cURL error: $curlErr");

        $data = json_decode($resp, true) ?? [];
        if ($code < 200 || $code >= 300) {
            Logger::error('[ZohoBooks] API error HTTP=' . $code . ' path=' . $path . ' resp=' . $resp);
            throw new RuntimeException('Zoho Books API error (HTTP ' . $code . '): ' . ($data['message'] ?? $resp));
        }
        return $data;
    }

    // ── Find or create a contact ──────────────────────────────────────────────

    private static function findOrCreateContact(
        string $name,
        string $email,
        string $phone,
        string $companyName,
        string $gstNumber,
        array  $billingAddress
    ): string {
        // Search by email
        $search = self::call('GET', '/contacts?email=' . urlencode($email));
        foreach ($search['contacts'] ?? [] as $c) {
            if (strtolower($c['email']) === strtolower($email)) {
                return (string) $c['contact_id'];
            }
        }

        // Create new contact
        $contact = [
            'contact_name'  => $name ?: $email,
            'company_name'  => $companyName ?: '',
            'email'         => $email,
            'phone'         => $phone,
            'contact_type'  => 'customer',
            'billing_address' => [
                'address'  => $billingAddress['address'] ?? '',
                'city'     => $billingAddress['city']    ?? '',
                'state'    => $billingAddress['state']   ?? '',
                'zip'      => $billingAddress['zipCode'] ?? '',
                'country'  => $billingAddress['country'] ?? 'India',
            ],
        ];

        if ($gstNumber) {
            $contact['gst_no']           = $gstNumber;
            $contact['gst_treatment']    = 'business_gst';
        }

        $result = self::call('POST', '/contacts', $contact);
        return (string) ($result['contact']['contact_id'] ?? '');
    }

    // ── Public: create & send invoice ────────────────────────────────────────

    /**
     * @param array $data {
     *   planName, username, customerName, customerEmail, customerPhone,
     *   companyName, gstNumber, billingAddress (array),
     *   billingPeriod (monthly|yearly), activationDate (Y-m-d H:i:s),
     *   renewalDate (Y-m-d H:i:s), baseAmount (pre-tax), referenceNumber
     * }
     */
    public static function createAndSendInvoice(array $data): string
    {
        $billingState = strtolower(trim($data['billingAddress']['state'] ?? ''));
        $isGujarat    = in_array($billingState, ['gujarat', 'gj'], true);

        $baseAmount = (float) $data['baseAmount'];
        $activationDate = date('Y-m-d', strtotime($data['activationDate']));

        // Next renewal = renewal date minus 1 day
        $renewalDate    = date('Y-m-d', strtotime($data['renewalDate'] . ' -1 day'));

        $description = sprintf(
            "Username: %s | Activated: %s | Renewal Type: %s | Next Renewal: %s",
            $data['username'],
            $activationDate,
            ucfirst($data['billingPeriod'] ?? 'yearly'),
            $renewalDate
        );

        // Build line items with GST
        if ($isGujarat) {
            $lineItems = [[
                'name'          => $data['planName'],
                'description'   => $description,
                'rate'          => $baseAmount,
                'quantity'      => 1,
                'tax_name'      => 'GST18',
                'tax_percentage'=> 18,
                'tax_type'      => 'tax_group',
                'tax_treatment' => 'intra_state',
            ]];
        } else {
            $lineItems = [[
                'name'          => $data['planName'],
                'description'   => $description,
                'rate'          => $baseAmount,
                'quantity'      => 1,
                'tax_name'      => 'IGST18',
                'tax_percentage'=> 18,
                'tax_type'      => 'tax',
                'tax_treatment' => 'inter_state',
            ]];
        }

        $contactId = self::findOrCreateContact(
            $data['customerName'],
            $data['customerEmail'],
            $data['customerPhone'] ?? '',
            $data['companyName']   ?? '',
            $data['gstNumber']     ?? '',
            $data['billingAddress']
        );

        $invoicePayload = [
            'customer_id'        => $contactId,
            'invoice_date'       => $activationDate,
            'due_date'           => $activationDate,
            'reference_number'   => $data['referenceNumber'],
            'notes'              => "Thank you for subscribing to WebMyDrive.",
            'line_items'         => $lineItems,
            'send_from_org_email_id' => true,
        ];

        // Apply configurable invoice prefix via custom field / invoice number series if available
        $prefix = defined('ZOHO_BOOKS_INVOICE_PREFIX') ? ZOHO_BOOKS_INVOICE_PREFIX : 'WMD';
        if ($prefix) {
            $invoicePayload['invoice_number'] = $prefix . '-' . date('Y') . '-' . strtoupper(substr($data['referenceNumber'], -6));
        }

        // Create invoice
        $created = self::call('POST', '/invoices', $invoicePayload);
        $invoiceId = $created['invoice']['invoice_id'] ?? '';

        if (!$invoiceId) {
            throw new RuntimeException('Zoho Books: invoice created but no invoice_id returned');
        }

        // Send invoice via email
        self::call('POST', "/invoices/{$invoiceId}/email", [
            'send_from_org_email_id' => true,
            'to_mail_ids'            => [$data['customerEmail']],
            'subject'                => "Your WebMyDrive Invoice — {$data['planName']}",
            'body'                   => "Dear {$data['customerName']},\n\nPlease find your invoice for {$data['planName']} attached.\n\nThank you for choosing WebMyDrive!\n\nTeam WebMyDrive",
        ]);

        Logger::info("[ZohoBooks] Invoice {$invoiceId} created and sent to {$data['customerEmail']}");
        return $invoiceId;
    }
}

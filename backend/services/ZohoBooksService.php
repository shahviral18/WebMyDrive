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

    // ── Internal cURL helper (JSON) ───────────────────────────────────────────

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
        } elseif ($method === 'PUT') {
            $opts[CURLOPT_CUSTOMREQUEST] = 'PUT';
            $opts[CURLOPT_POSTFIELDS]    = json_encode($body);
        } elseif ($method === 'DELETE') {
            $opts[CURLOPT_CUSTOMREQUEST] = 'DELETE';
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

    // ── Internal cURL helper (binary PDF) ────────────────────────────────────

    private static function callPdf(string $invoiceId): string
    {
        $token = self::getAccessToken();
        $orgId = ZOHO_BOOKS_ORG_ID;
        $url   = self::API_BASE . "/invoices/{$invoiceId}?accept=pdf&organization_id={$orgId}";

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Zoho-oauthtoken ' . $token,
                'Accept: application/pdf',
            ],
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $pdf     = curl_exec($ch);
        $code    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($curlErr) throw new RuntimeException("Zoho Books PDF cURL error: $curlErr");
        if ($code < 200 || $code >= 300) {
            throw new RuntimeException("Zoho Books PDF fetch failed (HTTP $code)");
        }
        return (string) $pdf;
    }

    // ── Build line items + contact (shared) ──────────────────────────────────

    private static function buildPayload(array $data): array
    {
        $activationDate    = date('Y-m-d', strtotime($data['activationDate']));
        $activationDateFmt = date('d-M-Y', strtotime($data['activationDate']));
        $renewalTs         = strtotime($data['renewalDate'] . ' -1 day');
        $renewalDateFmt    = date('d-M-Y', $renewalTs);

        $description = sprintf(
            "Username: %s\nActivation Date: %s\nRenewal Type: %s\nNext Renewal Date: %s",
            $data['username'],
            $activationDateFmt,
            ucfirst($data['billingPeriod'] ?? 'yearly'),
            $renewalDateFmt
        );

        $planRate       = (float) ($data['planRate'] ?? 0);
        $discountAmount = (float) ($data['discountAmount'] ?? 0);
        if ($planRate <= 0) {
            $planRate = round((float)$data['baseAmount'] / 1.18, 2);
        }

        $lineItems = [[
            'name'        => $data['planName'],
            'description' => $description,
            'rate'        => $planRate,
            'quantity'    => 1,
        ]];

        if ($discountAmount > 0) {
            $lineItems[] = [
                'name'        => 'Discount',
                'description' => '',
                'rate'        => -$discountAmount,
                'quantity'    => 1,
            ];
        }

        $contactId = self::findOrCreateContact(
            $data['customerName'],
            $data['customerEmail'],
            $data['customerPhone'] ?? '',
            $data['companyName']   ?? '',
            $data['gstNumber']     ?? '',
            $data['billingAddress']
        );

        $wmdRef = 'WMD-' . str_pad((string)(int)($data['orderId'] ?? 0), 4, '0', STR_PAD_LEFT);

        return [
            'customer_id'      => $contactId,
            'invoice_date'     => $activationDate,
            'due_date'         => date('Y-m-d', strtotime($activationDate . ' +7 days')),
            'reference_number' => $wmdRef,
            'purchaseorder_no' => $wmdRef,
            'notes'            => "Thank you for subscribing to WebMyDrive.",
            'line_items'       => $lineItems,
        ];
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
                $contactId = (string) $c['contact_id'];
                if (($c['status'] ?? '') === 'inactive') {
                    self::call('POST', '/contacts/' . $contactId . '/active');
                }
                $existingName = trim($c['contact_name'] ?? '');
                $newName = trim($name ?: $email);
                if ($newName && $existingName !== $newName) {
                    try {
                        self::call('PUT', '/contacts/' . $contactId, ['contact_name' => $newName, 'email' => $email]);
                    } catch (Throwable $e) {
                        Logger::warn('[ZohoBooks] Could not update contact name: ' . $e->getMessage());
                    }
                }
                return $contactId;
            }
        }

        // Also search by name
        if ($name) {
            $nameSearch = self::call('GET', '/contacts?contact_name=' . urlencode($name));
            foreach ($nameSearch['contacts'] ?? [] as $c) {
                if (strtolower(trim($c['contact_name'] ?? '')) === strtolower(trim($name))) {
                    $contactId = (string) $c['contact_id'];
                    if (($c['status'] ?? '') === 'inactive') {
                        self::call('POST', '/contacts/' . $contactId . '/active');
                    }
                    return $contactId;
                }
            }
        }

        // Create new contact
        $contact = [
            'contact_name'    => $name ?: $email,
            'company_name'    => $companyName ?: '',
            'email'           => $email,
            'phone'           => $phone,
            'contact_type'    => 'customer',
            'billing_address' => [
                'address' => $billingAddress['address'] ?? '',
                'city'    => $billingAddress['city']    ?? '',
                'state'   => $billingAddress['state']   ?? '',
                'zip'     => $billingAddress['zipCode'] ?? '',
                'country' => $billingAddress['country'] ?? 'India',
            ],
        ];

        if ($gstNumber) {
            $contact['gst_no']        = $gstNumber;
            $contact['gst_treatment'] = 'business_gst';
        }

        try {
            $result = self::call('POST', '/contacts', $contact);
            return (string) ($result['contact']['contact_id'] ?? '');
        } catch (RuntimeException $e) {
            if (str_contains($e->getMessage(), 'already exists')) {
                $fallback = self::call('GET', '/contacts?contact_name=' . urlencode($name ?: $email));
                foreach ($fallback['contacts'] ?? [] as $c) {
                    return (string) $c['contact_id'];
                }
            }
            throw $e;
        }
    }

    // ── Public: create draft invoice + return PDF (base64) ───────────────────

    public static function createDraftInvoice(array $data): array
    {
        $payload = self::buildPayload($data);

        Logger::info('[ZohoBooks] Creating draft invoice payload=' . json_encode($payload));

        $created   = self::call('POST', '/invoices', $payload);
        $invoiceId = $created['invoice']['invoice_id'] ?? '';

        if (!$invoiceId) {
            throw new RuntimeException('Zoho Books: draft invoice created but no invoice_id returned');
        }

        $pdfBytes  = self::callPdf($invoiceId);
        $pdfBase64 = base64_encode($pdfBytes);

        Logger::info("[ZohoBooks] Draft invoice {$invoiceId} created, PDF fetched");

        return [
            'invoice_id'     => $invoiceId,
            'invoice_number' => $created['invoice']['invoice_number'] ?? '',
            'pdf_base64'     => $pdfBase64,
        ];
    }

    // ── Public: send a draft invoice via email ────────────────────────────────

    public static function sendDraftInvoice(string $invoiceId, string $customerEmail, string $customerName, string $planName): void
    {
        self::call('POST', "/invoices/{$invoiceId}/email", [
            'send_from_org_email_id' => true,
            'to_mail_ids'            => [$customerEmail],
            'subject'                => "Your WebMyDrive Invoice — {$planName}",
            'body'                   => "Dear {$customerName},\n\nPlease find your invoice for {$planName} attached.\n\nThank you for choosing WebMyDrive!\n\nTeam WebMyDrive",
        ]);

        Logger::info("[ZohoBooks] Invoice {$invoiceId} sent to {$customerEmail}");
    }

    // ── Public: void (cancel) a draft invoice ────────────────────────────────

    public static function voidInvoice(string $invoiceId): void
    {
        try {
            self::call('POST', "/invoices/{$invoiceId}/status/void");
        } catch (Throwable $e) {
            Logger::warn("[ZohoBooks] Could not void invoice {$invoiceId}: " . $e->getMessage());
        }
        try {
            self::call('DELETE', "/invoices/{$invoiceId}");
        } catch (Throwable $e) {
            Logger::warn("[ZohoBooks] Could not delete invoice {$invoiceId}: " . $e->getMessage());
        }
    }

    // ── Public: create draft + send in one step (payment webhook flow) ────────

    public static function createAndSendInvoice(array $data): array
    {
        $draft = self::createDraftInvoice($data);

        self::sendDraftInvoice(
            $draft['invoice_id'],
            $data['customerEmail'],
            $data['customerName'],
            $data['planName']
        );

        Logger::info("[ZohoBooks] Invoice {$draft['invoice_id']} created and sent to {$data['customerEmail']}");

        return [
            'invoice_id'     => $draft['invoice_id'],
            'invoice_number' => $draft['invoice_number'],
        ];
    }
}

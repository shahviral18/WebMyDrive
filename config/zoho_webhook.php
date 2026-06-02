<?php
/****************************************************
 * WebMyDrive — Zoho Billing Webhook Receiver (Production)
 * --------------------------------------------------------
 * Version: 1.1 (Clean)
 * Handles Zoho Billing webhooks without manual intervention.
 * Securely stores subscription data in MySQL.
 ****************************************************/

// === CONFIG ===
error_reporting(0);
ini_set('display_errors', 0);

$db_host = "localhost";
$db_name = "wmdadmin_ZohoWebHook";
$db_user = "wmdadmin_admin";
$db_pass = "r9mscVzUJPQ2LIh"; // <-- update this

// === DB CONNECT ===
$mysqli = new mysqli($db_host, $db_user, $db_pass, $db_name);
if ($mysqli->connect_error) {
    file_put_contents(__DIR__ . '/zoho_error.log', "DB connection failed: {$mysqli->connect_error}\n", FILE_APPEND);
    http_response_code(500);
    exit;
}

// === READ REQUEST ===
$rawBody = file_get_contents("php://input");
$headers = getallheaders();
$contentType = $headers['Content-Type'] ?? $headers['content-type'] ?? '';

if (stripos($contentType, 'application/json') !== false) {
    $data = json_decode($rawBody, true);
} else {
    parse_str($rawBody, $formData);
    $data = isset($formData['payload']) ? json_decode($formData['payload'], true) : $formData;
}

if (!$data || !isset($data['subscription'])) {
    http_response_code(400);
    exit;
}

$subscription = $data['subscription'];

// === FIELD EXTRACTION ===
$subscription_id     = $subscription['subscription_id'] ?? '';
$subscription_number  = $subscription['subscription_number'] ?? '';
$purchase_date        = isset($subscription['created_time']) ? date('Y-m-d H:i:s', strtotime($subscription['created_time'])) : null;
$plan_code            = $subscription['plan']['plan_code'] ?? '';
$plan_name            = $subscription['plan']['name'] ?? '';
$amount_cents         = isset($subscription['amount']) ? floatval($subscription['amount']) * 100 : 0;
$currency             = $subscription['currency_code'] ?? 'INR';
$payment_id           = $subscription['payment_id'] ?? null;
$invoice_id           = $subscription['child_invoice_id'] ?? null;
$customer_email       = $subscription['customer']['email'] ?? '';
$hostedpage_id        = $subscription['hostedpage_id'] ?? null;
$status               = $subscription['status'] ?? '';
$billing_period       = $subscription['interval_unit'] ?? '';
$next_billing_date    = isset($subscription['next_billing_at']) ? date('Y-m-d H:i:s', strtotime($subscription['next_billing_at'])) : null;
$event_type           = $data['event_type'] ?? 'subscription_created';
$raw_payload          = $mysqli->real_escape_string($rawBody);
$processed_at         = date('Y-m-d H:i:s');

// === SQL INSERT ===
$sql = sprintf(
    "INSERT INTO zoho_subscriptions
    (subscription_id, subscription_number, purchase_date, plan_code, plan_name, amount_cents, currency,
     payment_id, invoice_id, customer_email, hostedpage_id, status, billing_period, next_billing_date,
     event_type, raw_payload, processed_at)
    VALUES (
        '%s', '%s', %s, '%s', '%s', %s, '%s',
        %s, %s, '%s', %s, '%s', '%s', %s,
        '%s', '%s', '%s'
    )
    ON DUPLICATE KEY UPDATE
        plan_name = VALUES(plan_name),
        status = VALUES(status),
        next_billing_date = VALUES(next_billing_date),
        processed_at = VALUES(processed_at);",
    $mysqli->real_escape_string($subscription_id),
    $mysqli->real_escape_string($subscription_number),
    $purchase_date ? "'" . $mysqli->real_escape_string($purchase_date) . "'" : "NULL",
    $mysqli->real_escape_string($plan_code),
    $mysqli->real_escape_string($plan_name),
    $amount_cents ?: 0,
    $mysqli->real_escape_string($currency),
    $payment_id ? "'" . $mysqli->real_escape_string($payment_id) . "'" : "NULL",
    $invoice_id ? "'" . $mysqli->real_escape_string($invoice_id) . "'" : "NULL",
    $mysqli->real_escape_string($customer_email),
    $hostedpage_id ? "'" . $mysqli->real_escape_string($hostedpage_id) . "'" : "NULL",
    $mysqli->real_escape_string($status),
    $mysqli->real_escape_string($billing_period),
    $next_billing_date ? "'" . $mysqli->real_escape_string($next_billing_date) . "'" : "NULL",
    $mysqli->real_escape_string($event_type),
    $mysqli->real_escape_string($raw_payload),
    $mysqli->real_escape_string($processed_at)
);

// === EXECUTE ===
if (!$mysqli->query($sql)) {
    file_put_contents(__DIR__ . '/zoho_error.log', "SQL ERROR: " . $mysqli->error . "\n", FILE_APPEND);
    http_response_code(500);
    exit;
}

$mysqli->close();

// === SUCCESS ===
http_response_code(200);
echo "OK";
exit;
?>

<?php
/**
 * WebMyDrive — Renewal Cron Job
 *
 * Run daily at 9 AM via cPanel Cron:
 *   0 9 * * * /usr/bin/php /home1/wmdadmin/public_html/demo1/backend/cron/process-renewals.php
 *
 * What it does:
 *  1. Charge mandates for workspaces renewing within 7 days (auto-renew users)
 *  2. Suspend workspaces whose grace period has expired
 *  3. Send reminder emails to manual-renew users expiring in 30 and 7 days
 */

declare(strict_types=1);

// ── Bootstrap ─────────────────────────────────────────────────────────────────
define('BASE_PATH', dirname(__DIR__));
define('CRON_MODE', true);

require BASE_PATH . '/config/env.php';
require BASE_PATH . '/config/database.php';
require BASE_PATH . '/lib/Logger.php';
require BASE_PATH . '/lib/Database.php';
require BASE_PATH . '/services/ZohoMandateService.php';
require BASE_PATH . '/services/ZohoBooksService.php';

$now      = date('Y-m-d H:i:s');
$today    = date('Y-m-d');
$in7days  = date('Y-m-d H:i:s', strtotime('+7 days'));
$in30days = date('Y-m-d H:i:s', strtotime('+30 days'));

Logger::info('[Cron] process-renewals started at ' . $now);

// ── 1. Auto-renew: charge mandates due within 7 days ─────────────────────────
$autoRenewDue = Database::query(
    'SELECT w.*, u.email, u.name, p.name AS planName, p.price AS planPrice,
            p.monthlyPrice, p.id AS planId
       FROM "Workspace" w
       JOIN "User"      u ON u.id = w.userId
       JOIN "Plan"      p ON p.id = w.planId
      WHERE w.autoRenew   = 1
        AND w.mandateId   IS NOT NULL
        AND w.status      = \'ACTIVE\'
        AND w.renewalDate <= :in7
        AND (w.graceExpiry IS NULL OR w.graceExpiry > :now)',
    [':in7' => $in7days, ':now' => $now]
);

Logger::info('[Cron] Auto-renew candidates: ' . count($autoRenewDue));

foreach ($autoRenewDue as $ws) {
    $userId      = (int) $ws['userId'];
    $workspaceId = (int) $ws['id'];
    $mandateId   = $ws['mandateId'];
    $billingPeriod = $ws['billingPeriod'] ?? 'yearly';

    $amount = $billingPeriod === 'monthly'
        ? (float)($ws['monthlyPrice'] ?? round($ws['planPrice'] / 12, 2))
        : (float)$ws['planPrice'];

    $referenceNumber = 'WMD-RNW-' . strtoupper(bin2hex(random_bytes(4)));
    $description     = "WebMyDrive renewal — {$ws['planName']}";

    Logger::info("[Cron] Charging mandate for workspace=$workspaceId user=$userId amount=$amount");

    $result = ZohoMandateService::chargeMandate($mandateId, $amount, $referenceNumber, $description);

    if ($result['success']) {
        // Extend renewal date
        $billingDays  = $billingPeriod === 'monthly' ? 30 : 365;
        $newRenewal   = date('Y-m-d H:i:s', strtotime($ws['renewalDate']) + $billingDays * 86400);

        Database::execute(
            'UPDATE "Workspace" SET renewalDate = :rd, graceExpiry = NULL, updatedAt = :now WHERE id = :id',
            [':rd' => $newRenewal, ':now' => $now, ':id' => $workspaceId]
        );

        // Create Order record
        $baseAmt = round($amount / 1.18, 2);
        $gstAmt  = round($amount - $baseAmt, 2);
        $orderId = Database::insert(
            'INSERT INTO "Order" (userId, planId, amount, baseAmount, gstAmount, currency, status,
             orderType, billingPeriod, gatewayTxId, paymentId, createdAt, updatedAt)
             VALUES (:uid, :pid, :amt, :base, :gst, \'INR\', \'PAID\',
             \'RENEWAL\', :bp, :ref, :pid2, :now1, :now2)',
            [
                ':uid'  => $userId,
                ':pid'  => $ws['planId'],
                ':amt'  => $amount,
                ':base' => $baseAmt,
                ':gst'  => $gstAmt,
                ':bp'   => $billingPeriod,
                ':ref'  => $referenceNumber,
                ':pid2' => $result['payment_id'],
                ':now1' => $now,
                ':now2' => $now,
            ]
        );

        // Create Zoho Books invoice
        try {
            ZohoBooksService::createAndSendInvoice([
                'planName'       => $ws['planName'],
                'username'       => explode('@', $ws['email'])[0],
                'customerName'   => $ws['name'],
                'customerEmail'  => $ws['email'],
                'customerPhone'  => '',
                'companyName'    => '',
                'gstNumber'      => '',
                'billingAddress' => [],
                'billingPeriod'  => $billingPeriod,
                'activationDate' => $today,
                'renewalDate'    => $newRenewal,
                'baseAmount'     => $amount,
                'referenceNumber'=> $referenceNumber,
                'orderId'        => $orderId,
            ]);
        } catch (Throwable $ie) {
            Logger::error("[Cron] Invoice creation failed for workspace=$workspaceId: " . $ie->getMessage());
        }

        // Send renewal success email
        $subject = "Your WebMyDrive subscription has been renewed";
        $body    = "Hi {$ws['name']},\n\nYour WebMyDrive subscription ({$ws['planName']}) has been automatically renewed.\n"
                 . "Amount charged: ₹" . number_format($amount, 2) . "\n"
                 . "Next renewal: " . date('d M Y', strtotime($newRenewal)) . "\n\n"
                 . "Your invoice has been emailed separately.\n\nThank you,\nWebMyDrive Team";
        @mail($ws['email'], $subject, $body, "From: noreply@webmydrive.com");

        Logger::info("[Cron] Renewed workspace=$workspaceId new_renewal=$newRenewal orderId=$orderId");

    } else {
        // Charge failed — set 7-day grace period
        $graceExpiry = date('Y-m-d H:i:s', strtotime('+7 days'));

        Database::execute(
            'UPDATE "Workspace" SET graceExpiry = :ge, updatedAt = :now WHERE id = :id',
            [':ge' => $graceExpiry, ':now' => $now, ':id' => $workspaceId]
        );

        // Send charge failure email with manual payment link
        $manualLink = defined('SITE_URL') ? SITE_URL . '/user/renew' : 'https://webmydrive.com/user/renew';
        $subject    = "Action required: WebMyDrive renewal payment failed";
        $body       = "Hi {$ws['name']},\n\nWe were unable to auto-renew your WebMyDrive subscription ({$ws['planName']}).\n\n"
                    . "Reason: " . ($result['message'] ?: 'Payment could not be processed') . "\n\n"
                    . "Your account will remain active until " . date('d M Y', strtotime($graceExpiry)) . ".\n\n"
                    . "Please renew manually: $manualLink\n\n"
                    . "If you need help, contact support@webmydrive.com\n\nWebMyDrive Team";
        @mail($ws['email'], $subject, $body, "From: noreply@webmydrive.com");

        Logger::error("[Cron] Mandate charge failed workspace=$workspaceId reason=" . $result['message']);
    }
}

// ── 2. Suspend workspaces with expired grace period ───────────────────────────
$graceExpired = Database::query(
    'SELECT w.*, u.email, u.name, p.name AS planName
       FROM "Workspace" w
       JOIN "User" u ON u.id = w.userId
       JOIN "Plan" p ON p.id = w.planId
      WHERE w.graceExpiry < :now
        AND w.status = \'ACTIVE\'',
    [':now' => $now]
);

Logger::info('[Cron] Grace-expired workspaces to suspend: ' . count($graceExpired));

foreach ($graceExpired as $ws) {
    Database::execute(
        'UPDATE "Workspace" SET status = \'SUSPENDED\', updatedAt = :now WHERE id = :id',
        [':now' => $now, ':id' => (int)$ws['id']]
    );

    $subject = "Your WebMyDrive account has been suspended";
    $body    = "Hi {$ws['name']},\n\nYour WebMyDrive account ({$ws['planName']}) has been suspended due to non-payment.\n\n"
             . "To reactivate, please renew your subscription: " . (defined('SITE_URL') ? SITE_URL . '/user/renew' : 'https://webmydrive.com/user/renew') . "\n\n"
             . "Your data is safe and will be retained for 30 days.\n\nWebMyDrive Team";
    @mail($ws['email'], $subject, $body, "From: noreply@webmydrive.com");

    Logger::info('[Cron] Suspended workspace=' . $ws['id']);
}

// ── 3. Reminder emails for manual-renew users ─────────────────────────────────
// 30-day reminder
$manual30 = Database::query(
    'SELECT w.*, u.email, u.name, p.name AS planName
       FROM "Workspace" w
       JOIN "User" u ON u.id = w.userId
       JOIN "Plan" p ON p.id = w.planId
      WHERE w.autoRenew = 0
        AND w.status    = \'ACTIVE\'
        AND w.renewalDate BETWEEN :now AND :in30',
    [':now' => $now, ':in30' => $in30days]
);

foreach ($manual30 as $ws) {
    // Only send once — check if reminder was already sent this month via a simple check on renewal proximity
    $daysLeft = (int) ceil((strtotime($ws['renewalDate']) - time()) / 86400);
    if ($daysLeft > 28) { // Only for 29-30 day window
        $subject = "Your WebMyDrive plan renews in 30 days";
        $body    = "Hi {$ws['name']},\n\nYour {$ws['planName']} subscription expires on " . date('d M Y', strtotime($ws['renewalDate'])) . ".\n\n"
                 . "Renew now to avoid interruption: " . (defined('SITE_URL') ? SITE_URL . '/user/renew' : 'https://webmydrive.com/user/renew') . "\n\n"
                 . "Want peace of mind? Enable auto-renewal from your dashboard settings.\n\nWebMyDrive Team";
        @mail($ws['email'], $subject, $body, "From: noreply@webmydrive.com");
    }
}

// 7-day reminder
$manual7 = Database::query(
    'SELECT w.*, u.email, u.name, p.name AS planName, p.price AS planPrice, p.monthlyPrice
       FROM "Workspace" w
       JOIN "User" u ON u.id = w.userId
       JOIN "Plan" p ON p.id = w.planId
      WHERE w.autoRenew = 0
        AND w.status    = \'ACTIVE\'
        AND w.renewalDate BETWEEN :now AND :in7',
    [':now' => $now, ':in7' => $in7days]
);

foreach ($manual7 as $ws) {
    $renewLink = defined('SITE_URL') ? SITE_URL . '/user/renew' : 'https://webmydrive.com/user/renew';
    $subject   = "Urgent: Your WebMyDrive plan expires in 7 days";
    $body      = "Hi {$ws['name']},\n\nYour {$ws['planName']} subscription expires on " . date('d M Y', strtotime($ws['renewalDate'])) . ".\n\n"
               . "Renew immediately to avoid losing access: $renewLink\n\n"
               . "WebMyDrive Team";
    @mail($ws['email'], $subject, $body, "From: noreply@webmydrive.com");
}

Logger::info('[Cron] process-renewals completed at ' . date('Y-m-d H:i:s'));

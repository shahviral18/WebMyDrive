<?php
/**
 * InternalController — Protected endpoints for internal automation.
 *
 * Authentication: Authorization: Bearer <INTERNAL_CRON_TOKEN>
 * Called daily by GitHub Actions (not exposed in public JWT auth flow).
 *
 * Routes:
 *   POST /api/internal/run-renewals  — daily renewal processor
 */

declare(strict_types=1);

class InternalController
{
    private function authenticate(): void
    {
        $token = INTERNAL_CRON_TOKEN;
        if (!$token) {
            http_response_code(503);
            echo json_encode(['error' => 'INTERNAL_CRON_TOKEN not configured on server']);
            exit;
        }

        // Accept token via X-Cron-Token header (avoids ModSecurity Bearer rules)
        // or Authorization: Bearer as fallback
        $provided = $_SERVER['HTTP_X_CRON_TOKEN'] ?? '';
        if (!$provided) {
            $header   = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
            $provided = str_starts_with($header, 'Bearer ') ? substr($header, 7) : '';
        }

        if (!hash_equals($token, $provided)) {
            Logger::warn('[Internal] Unauthorized renewal attempt from ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }
    }

    public function runMigration(Request $req): void
    {
        $this->authenticate();

        $results = [];

        // ── Helper: add column if missing ─────────────────────────────────────
        $addCol = function (string $table, string $col, string $definition) use (&$results): void {
            $exists = Database::queryOne(
                "SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
                  WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME   = :tbl
                    AND COLUMN_NAME  = :col",
                [':tbl' => $table, ':col' => $col]
            );
            $key = "$table.$col";
            if ($exists && (int)$exists['cnt'] > 0) {
                $results[$key] = 'already exists';
            } else {
                try {
                    Database::execute("ALTER TABLE `$table` ADD COLUMN `$col` $definition", []);
                    $results[$key] = 'added';
                } catch (Throwable $e) {
                    $results[$key] = 'ERROR: ' . $e->getMessage();
                }
            }
        };

        // ── Helper: create table if missing ───────────────────────────────────
        $createTable = function (string $name, string $ddl) use (&$results): void {
            try {
                Database::execute($ddl, []);
                $results["table.$name"] = 'ready';
            } catch (Throwable $e) {
                $results["table.$name"] = 'ERROR: ' . $e->getMessage();
            }
        };

        // ── v2: Workspace auto-renewal columns ────────────────────────────────
        $addCol('Workspace', 'billingPeriod', "VARCHAR(20) NOT NULL DEFAULT 'yearly'");
        $addCol('Workspace', 'autoRenew',     'TINYINT(1) NOT NULL DEFAULT 0');
        $addCol('Workspace', 'mandateId',     'VARCHAR(255) NULL');
        $addCol('Workspace', 'graceExpiry',   'DATETIME NULL');

        // ── v3: User referral code changes ────────────────────────────────────
        $addCol('User', 'referralCodeChanges', 'INT NOT NULL DEFAULT 0');

        // ── v4: Wallet credits & per-plan referral discounts ──────────────────

        // Workspace
        $addCol('Workspace', 'discount_percent', 'DECIMAL(5,2) NOT NULL DEFAULT 0');
        $addCol('Workspace', 'referred_by',      'INT NULL');
        $addCol('Workspace', 'nextPlanId',        'INT NULL');
        $addCol('Workspace', 'baseAmountPaid',    'DECIMAL(12,2) NULL');

        // Plan
        $addCol('Plan', 'priceINR',        'DECIMAL(12,2) NULL');
        $addCol('Plan', 'priceMonthlyINR', 'DECIMAL(12,2) NULL');
        $addCol('Plan', 'priceYearlyINR',  'DECIMAL(12,2) NULL');
        $addCol('Plan', 'monthlyPrice',    'DECIMAL(12,2) NULL');
        $addCol('Plan', 'yearlyPrice',     'DECIMAL(12,2) NULL');
        $addCol('Plan', 'storageGB',       'INT NULL');
        $addCol('Plan', 'hasOverride',     'TINYINT NOT NULL DEFAULT 0');
        $addCol('Plan', 'googleOrgUnit',   'VARCHAR(255) NULL');
        $addCol('Plan', 'sortOrder',       'INT NOT NULL DEFAULT 0');

        // Order
        $addCol('Order', 'orderType',      "VARCHAR(50) NOT NULL DEFAULT 'NEW'");
        $addCol('Order', 'baseAmount',     'DECIMAL(12,2) NULL');
        $addCol('Order', 'gstAmount',      'DECIMAL(12,2) NULL');
        $addCol('Order', 'discountAmount', 'DECIMAL(12,2) NULL');
        $addCol('Order', 'fromPlanId',     'INT NULL');
        $addCol('Order', 'promoCode',      'VARCHAR(100) NULL');

        // ReferralLog
        $addCol('ReferralLog', 'referralYear',      'INT NOT NULL DEFAULT 1');
        $addCol('ReferralLog', 'referrer_credited', 'TINYINT(1) NOT NULL DEFAULT 1');
        $addCol('ReferralLog', 'commissionEarned',  'DECIMAL(12,2) NOT NULL DEFAULT 0');

        // PendingCheckout — create if missing, else add promoCode column
        $checkoutExists = Database::queryOne(
            "SELECT COUNT(*) AS cnt FROM information_schema.TABLES
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PendingCheckout'"
        );
        if (!(int)($checkoutExists['cnt'] ?? 0)) {
            $createTable('PendingCheckout', "
                CREATE TABLE IF NOT EXISTS `PendingCheckout` (
                  id               INT AUTO_INCREMENT PRIMARY KEY,
                  referenceNumber  VARCHAR(100) NOT NULL UNIQUE,
                  planId           INT,
                  amount           DECIMAL(12,2) NOT NULL,
                  billingPeriod    VARCHAR(20) NOT NULL DEFAULT 'yearly',
                  customerEmail    VARCHAR(255) NOT NULL,
                  customerName     VARCHAR(255),
                  customerPhone    VARCHAR(50),
                  checkoutMeta     TEXT,
                  promoCode        VARCHAR(100) NULL,
                  status           VARCHAR(50) NOT NULL DEFAULT 'PENDING',
                  zohoPaymentId    VARCHAR(255),
                  createdUserId    INT NULL,
                  createdAt        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  updatedAt        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
        } else {
            $addCol('PendingCheckout', 'promoCode',     'VARCHAR(100) NULL');
            $addCol('PendingCheckout', 'zohoPaymentId', 'VARCHAR(255) NULL');
            $addCol('PendingCheckout', 'createdUserId', 'INT NULL');
        }

        // WalletTransaction table
        $createTable('WalletTransaction', "
            CREATE TABLE IF NOT EXISTS `WalletTransaction` (
              id          INT AUTO_INCREMENT PRIMARY KEY,
              userId      INT NOT NULL,
              amount      DECIMAL(12,2) NOT NULL,
              type        VARCHAR(20) NOT NULL,
              source      VARCHAR(30) NOT NULL DEFAULT 'ADMIN',
              description TEXT,
              orderId     INT NULL,
              expires_at  DATETIME NULL,
              createdAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              INDEX idx_wt_user (userId),
              INDEX idx_wt_expires (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");

        // Voucher table
        $createTable('Voucher', "
            CREATE TABLE IF NOT EXISTS `Voucher` (
              id          INT AUTO_INCREMENT PRIMARY KEY,
              code        VARCHAR(50) NOT NULL UNIQUE,
              value       DECIMAL(12,2) NOT NULL,
              created_by  INT NOT NULL,
              used_by     INT NULL,
              used_at     DATETIME NULL,
              expires_at  DATETIME NULL,
              status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
              description TEXT,
              createdAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              INDEX idx_voucher_code   (code),
              INDEX idx_voucher_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");

        // ── v5: Distributor bank details ──────────────────────────────────────
        $addCol('DistributorApplication', 'bankAccountHolder', 'VARCHAR(255) NULL');
        $addCol('DistributorApplication', 'bankName',          'VARCHAR(255) NULL');
        $addCol('DistributorApplication', 'bankAccountNumber', 'VARCHAR(50)  NULL');
        $addCol('DistributorApplication', 'bankIfscCode',      'VARCHAR(11)  NULL');
        $addCol('DistributorApplication', 'bankAccountType',   "VARCHAR(20)  NULL DEFAULT 'SAVINGS'");
        $addCol('DistributorApplication', 'upiId',             'VARCHAR(100) NULL');

        $addCol('Distributor', 'bankAccountHolder', 'VARCHAR(255) NULL');
        $addCol('Distributor', 'bankName',          'VARCHAR(255) NULL');
        $addCol('Distributor', 'bankAccountNumber', 'VARCHAR(50)  NULL');
        $addCol('Distributor', 'bankIfscCode',      'VARCHAR(11)  NULL');
        $addCol('Distributor', 'bankAccountType',   "VARCHAR(20)  NULL DEFAULT 'SAVINGS'");
        $addCol('Distributor', 'upiId',             'VARCHAR(100) NULL');

        Logger::info('[Internal/Migration] v4 completed: ' . json_encode($results));
        http_response_code(200);
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'results' => $results]);
        exit;
    }

    public function runRenewals(Request $req): void
    {
        $this->authenticate();

        $now      = date('Y-m-d H:i:s');
        $today    = date('Y-m-d');
        $in7days  = date('Y-m-d H:i:s', strtotime('+7 days'));
        $in30days = date('Y-m-d H:i:s', strtotime('+30 days'));

        $stats = ['charged' => 0, 'failed' => 0, 'suspended' => 0, 'reminders_30' => 0, 'reminders_7' => 0];

        Logger::info('[Internal/Renewals] Started at ' . $now);

        // ── 1. Auto-renew: charge mandates due within 7 days ─────────────────
        $autoRenewDue = Database::query(
            'SELECT w.*, u.email, u.name, p.name AS planName, p.price AS planPrice,
                    p.monthlyPrice, p.id AS planId
               FROM `Workspace` w
               JOIN `User`      u ON u.id = w.userId
               JOIN `Plan`      p ON p.id = w.planId
              WHERE w.autoRenew   = 1
                AND w.mandateId   IS NOT NULL
                AND w.mandateId   NOT LIKE \'SESSION:%\'
                AND w.status      = \'ACTIVE\'
                AND w.renewalDate <= :in7
                AND (w.graceExpiry IS NULL OR w.graceExpiry > :now)',
            [':in7' => $in7days, ':now' => $now]
        );

        Logger::info('[Internal/Renewals] Auto-renew candidates: ' . count($autoRenewDue));

        foreach ($autoRenewDue as $ws) {
            $userId        = (int) $ws['userId'];
            $workspaceId   = (int) $ws['id'];
            $mandateId     = $ws['mandateId'];
            $billingPeriod = $ws['billingPeriod'] ?? 'yearly';

            $amount = $billingPeriod === 'monthly'
                ? (float)($ws['monthlyPrice'] ?? round($ws['planPrice'] / 12, 2))
                : (float)$ws['planPrice'];

            $referenceNumber = 'WMD-RNW-' . strtoupper(bin2hex(random_bytes(4)));
            $description     = "WebMyDrive renewal — {$ws['planName']}";

            Logger::info("[Internal/Renewals] Charging mandate for workspace={$workspaceId} user={$userId} amount={$amount}");

            $result = ZohoMandateService::chargeMandate($mandateId, $amount, $referenceNumber, $description);

            if ($result['success']) {
                $billingDays = $billingPeriod === 'monthly' ? 30 : 365;
                $newRenewal  = date('Y-m-d H:i:s', strtotime($ws['renewalDate']) + $billingDays * 86400);

                Database::execute(
                    'UPDATE `Workspace` SET renewalDate=:rd, graceExpiry=NULL, updatedAt=:now WHERE id=:id',
                    [':rd' => $newRenewal, ':now' => $now, ':id' => $workspaceId]
                );

                $baseAmt = round($amount / 1.18, 2);
                $gstAmt  = round($amount - $baseAmt, 2);
                $orderId = Database::insert(
                    'INSERT INTO `Order`
                     (userId, planId, amount, baseAmount, gstAmount, currency, status,
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

                try {
                    ZohoBooksService::createAndSendInvoice([
                        'planName'        => $ws['planName'],
                        'username'        => explode('@', $ws['email'])[0],
                        'customerName'    => $ws['name'],
                        'customerEmail'   => $ws['email'],
                        'customerPhone'   => '',
                        'companyName'     => '',
                        'gstNumber'       => '',
                        'billingAddress'  => [],
                        'billingPeriod'   => $billingPeriod,
                        'activationDate'  => $today,
                        'renewalDate'     => $newRenewal,
                        'baseAmount'      => $amount,
                        'referenceNumber' => $referenceNumber,
                        'orderId'         => $orderId,
                    ]);
                } catch (Throwable $ie) {
                    Logger::error("[Internal/Renewals] Invoice failed workspace={$workspaceId}: " . $ie->getMessage());
                }

                $subject = "Your WebMyDrive subscription has been renewed";
                $body    = "Hi {$ws['name']},\n\nYour WebMyDrive subscription ({$ws['planName']}) has been automatically renewed.\n"
                         . "Amount charged: ₹" . number_format($amount, 2) . "\n"
                         . "Next renewal: " . date('d M Y', strtotime($newRenewal)) . "\n\n"
                         . "Your invoice has been emailed separately.\n\nThank you,\nWebMyDrive Team";
                @mail($ws['email'], $subject, $body, "From: noreply@webmydrive.com");

                Logger::info("[Internal/Renewals] Renewed workspace={$workspaceId} new_renewal={$newRenewal} orderId={$orderId}");
                $stats['charged']++;

            } else {
                $graceExpiry = date('Y-m-d H:i:s', strtotime('+7 days'));
                Database::execute(
                    'UPDATE `Workspace` SET graceExpiry=:ge, updatedAt=:now WHERE id=:id',
                    [':ge' => $graceExpiry, ':now' => $now, ':id' => $workspaceId]
                );

                $manualLink = SITE_URL . '/user/renew';
                $subject    = "Action required: WebMyDrive renewal payment failed";
                $body       = "Hi {$ws['name']},\n\nWe were unable to auto-renew your WebMyDrive subscription ({$ws['planName']}).\n\n"
                            . "Reason: " . ($result['message'] ?: 'Payment could not be processed') . "\n\n"
                            . "Your account will remain active until " . date('d M Y', strtotime($graceExpiry)) . ".\n\n"
                            . "Please renew manually: {$manualLink}\n\n"
                            . "If you need help, contact support@webmydrive.com\n\nWebMyDrive Team";
                @mail($ws['email'], $subject, $body, "From: noreply@webmydrive.com");

                Logger::error("[Internal/Renewals] Charge failed workspace={$workspaceId}: " . $result['message']);
                $stats['failed']++;
            }
        }

        // ── 2. Suspend workspaces with expired grace period ───────────────────
        $graceExpired = Database::query(
            'SELECT w.*, u.email, u.name, p.name AS planName
               FROM `Workspace` w
               JOIN `User` u ON u.id = w.userId
               JOIN `Plan` p ON p.id = w.planId
              WHERE w.graceExpiry < :now
                AND w.status = \'ACTIVE\'',
            [':now' => $now]
        );

        Logger::info('[Internal/Renewals] Grace-expired to suspend: ' . count($graceExpired));

        foreach ($graceExpired as $ws) {
            Database::execute(
                'UPDATE `Workspace` SET status=\'SUSPENDED\', updatedAt=:now WHERE id=:id',
                [':now' => $now, ':id' => (int)$ws['id']]
            );

            $subject = "Your WebMyDrive account has been suspended";
            $body    = "Hi {$ws['name']},\n\nYour WebMyDrive account ({$ws['planName']}) has been suspended due to non-payment.\n\n"
                     . "To reactivate, please renew your subscription: " . SITE_URL . "/user/renew\n\n"
                     . "Your data is safe and will be retained for 30 days.\n\nWebMyDrive Team";
            @mail($ws['email'], $subject, $body, "From: noreply@webmydrive.com");

            Logger::info('[Internal/Renewals] Suspended workspace=' . $ws['id']);
            $stats['suspended']++;
        }

        // ── 3. Reminder emails for manual-renew users ─────────────────────────
        $manual30 = Database::query(
            'SELECT w.*, u.email, u.name, p.name AS planName
               FROM `Workspace` w
               JOIN `User` u ON u.id = w.userId
               JOIN `Plan` p ON p.id = w.planId
              WHERE w.autoRenew = 0
                AND w.status    = \'ACTIVE\'
                AND w.renewalDate BETWEEN :now AND :in30',
            [':now' => $now, ':in30' => $in30days]
        );

        foreach ($manual30 as $ws) {
            $daysLeft = (int) ceil((strtotime($ws['renewalDate']) - time()) / 86400);
            if ($daysLeft > 28) {
                $subject = "Your WebMyDrive plan renews in 30 days";
                $body    = "Hi {$ws['name']},\n\nYour {$ws['planName']} subscription expires on "
                         . date('d M Y', strtotime($ws['renewalDate'])) . ".\n\n"
                         . "Renew now to avoid interruption: " . SITE_URL . "/user/renew\n\n"
                         . "Want peace of mind? Enable auto-renewal from your dashboard settings.\n\nWebMyDrive Team";
                @mail($ws['email'], $subject, $body, "From: noreply@webmydrive.com");
                $stats['reminders_30']++;
            }
        }

        $manual7 = Database::query(
            'SELECT w.*, u.email, u.name, p.name AS planName
               FROM `Workspace` w
               JOIN `User` u ON u.id = w.userId
               JOIN `Plan` p ON p.id = w.planId
              WHERE w.autoRenew = 0
                AND w.status    = \'ACTIVE\'
                AND w.renewalDate BETWEEN :now AND :in7',
            [':now' => $now, ':in7' => $in7days]
        );

        foreach ($manual7 as $ws) {
            $subject = "Urgent: Your WebMyDrive plan expires in 7 days";
            $body    = "Hi {$ws['name']},\n\nYour {$ws['planName']} subscription expires on "
                     . date('d M Y', strtotime($ws['renewalDate'])) . ".\n\n"
                     . "Renew immediately to avoid losing access: " . SITE_URL . "/user/renew\n\n"
                     . "WebMyDrive Team";
            @mail($ws['email'], $subject, $body, "From: noreply@webmydrive.com");
            $stats['reminders_7']++;
        }

        Logger::info('[Internal/Renewals] Completed. Stats: ' . json_encode($stats));

        http_response_code(200);
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'stats' => $stats, 'ran_at' => $now]);
        exit;
    }
}

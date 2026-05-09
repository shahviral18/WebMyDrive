<?php
/**
 * migrate_v4.php — Wallet credits, vouchers, per-plan referral discounts,
 *                  pro-rata upgrades, scheduled downgrades, price revision.
 *
 * Run once on the production MySQL server via browser or CLI:
 *   php backend/database/migrate_v4.php
 *
 * Safe to re-run — all statements use IF NOT EXISTS / column-existence checks.
 */

declare(strict_types=1);

$host   = getenv('DB_HOST')   ?: 'localhost';
$dbname = getenv('DB_NAME')   ?: 'webmydrive';
$user   = getenv('DB_USER')   ?: 'root';
$pass   = getenv('DB_PASS')   ?: '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
} catch (PDOException $e) {
    die("DB connection failed: " . $e->getMessage() . "\n");
}

$steps = [];

// ── Helper: add column only if it doesn't exist ───────────────────────────────
function addColumnIfMissing(PDO $pdo, string $table, string $column, string $definition): void
{
    $row = $pdo->query(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = '$table'
           AND COLUMN_NAME  = '$column'"
    )->fetchColumn();

    if ((int)$row === 0) {
        $pdo->exec("ALTER TABLE `$table` ADD COLUMN `$column` $definition");
        echo "  ✅ Added $table.$column\n";
    } else {
        echo "  — $table.$column already exists\n";
    }
}

echo "\n=== migrate_v4 — WebMyDrive ===\n\n";

// ── 1. Workspace: lock referral discount, track referrer, scheduled downgrade ─
echo "1. Workspace table additions...\n";
addColumnIfMissing($pdo, 'Workspace', 'discount_percent', 'DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER planId');
addColumnIfMissing($pdo, 'Workspace', 'referred_by',      'INT NULL AFTER discount_percent');
addColumnIfMissing($pdo, 'Workspace', 'nextPlanId',       'INT NULL AFTER referred_by');
addColumnIfMissing($pdo, 'Workspace', 'baseAmountPaid',   'DECIMAL(12,2) NULL AFTER nextPlanId');
addColumnIfMissing($pdo, 'Workspace', 'billingPeriod',    "VARCHAR(20) NOT NULL DEFAULT 'yearly'");
addColumnIfMissing($pdo, 'Workspace', 'autoRenew',        'TINYINT(1) NOT NULL DEFAULT 0');
addColumnIfMissing($pdo, 'Workspace', 'mandateId',        'VARCHAR(255) NULL');
addColumnIfMissing($pdo, 'Workspace', 'graceExpiry',      'DATETIME NULL');

// Plan: additional columns used in upgrade/downgrade flows
echo "\n1b. Plan table additions...\n";
addColumnIfMissing($pdo, 'Plan', 'priceINR',        'DECIMAL(12,2) NULL');
addColumnIfMissing($pdo, 'Plan', 'priceMonthlyINR', 'DECIMAL(12,2) NULL');
addColumnIfMissing($pdo, 'Plan', 'priceYearlyINR',  'DECIMAL(12,2) NULL');
addColumnIfMissing($pdo, 'Plan', 'monthlyPrice',    'DECIMAL(12,2) NULL');
addColumnIfMissing($pdo, 'Plan', 'yearlyPrice',     'DECIMAL(12,2) NULL');
addColumnIfMissing($pdo, 'Plan', 'storageGB',       'INT NULL');
addColumnIfMissing($pdo, 'Plan', 'hasOverride',     'TINYINT NOT NULL DEFAULT 0');
addColumnIfMissing($pdo, 'Plan', 'googleOrgUnit',   'VARCHAR(255) NULL');
addColumnIfMissing($pdo, 'Plan', 'sortOrder',       'INT NOT NULL DEFAULT 0');

// User: referral code change tracking
echo "\n1c. User table additions...\n";
addColumnIfMissing($pdo, 'User', 'referralCodeChanges', 'INT NOT NULL DEFAULT 0');

// Order: order type and extra billing fields
echo "\n1d. Order table additions...\n";
addColumnIfMissing($pdo, 'Order', 'orderType',      "VARCHAR(50) NOT NULL DEFAULT 'NEW'");
addColumnIfMissing($pdo, 'Order', 'baseAmount',     'DECIMAL(12,2) NULL');
addColumnIfMissing($pdo, 'Order', 'gstAmount',      'DECIMAL(12,2) NULL');
addColumnIfMissing($pdo, 'Order', 'discountAmount', 'DECIMAL(12,2) NULL');
addColumnIfMissing($pdo, 'Order', 'fromPlanId',     'INT NULL');
addColumnIfMissing($pdo, 'Order', 'promoCode',      'VARCHAR(100) NULL');

// ── 2. ReferralLog: track referral year, prevent renewal double-credit ────────
echo "\n2. ReferralLog table additions...\n";
addColumnIfMissing($pdo, 'ReferralLog', 'referralYear',     'INT NOT NULL DEFAULT 1 AFTER type');
addColumnIfMissing($pdo, 'ReferralLog', 'referrer_credited','TINYINT(1) NOT NULL DEFAULT 1 AFTER referralYear');

// ── 3. PendingCheckout: store promo code for post-payment referral processing ─
echo "\n3. PendingCheckout table additions...\n";

// PendingCheckout may not exist yet — create it if missing
$tableExists = $pdo->query(
    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PendingCheckout'"
)->fetchColumn();

if (!(int)$tableExists) {
    $pdo->exec("
        CREATE TABLE `PendingCheckout` (
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
    echo "  ✅ Created PendingCheckout table\n";
} else {
    addColumnIfMissing($pdo, 'PendingCheckout', 'promoCode',     'VARCHAR(100) NULL AFTER checkoutMeta');
    addColumnIfMissing($pdo, 'PendingCheckout', 'zohoPaymentId', 'VARCHAR(255) NULL');
    addColumnIfMissing($pdo, 'PendingCheckout', 'createdUserId', 'INT NULL');
}

// ── 4. WalletTransaction table ────────────────────────────────────────────────
echo "\n4. WalletTransaction table...\n";
$pdo->exec("
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
      FOREIGN KEY (userId) REFERENCES `User`(id),
      INDEX idx_wt_user (userId),
      INDEX idx_wt_type (type),
      INDEX idx_wt_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");
echo "  ✅ WalletTransaction table ready\n";

// ── 5. Voucher table ──────────────────────────────────────────────────────────
echo "\n5. Voucher table...\n";
$pdo->exec("
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
      FOREIGN KEY (created_by) REFERENCES `User`(id),
      FOREIGN KEY (used_by)    REFERENCES `User`(id),
      INDEX idx_voucher_code   (code),
      INDEX idx_voucher_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");
echo "  ✅ Voucher table ready\n";

// ── 6. Migrate existing walletBalance into WalletTransaction ──────────────────
echo "\n6. Seeding WalletTransaction for existing wallet balances...\n";
$users = $pdo->query('SELECT id, walletBalance FROM `User` WHERE walletBalance > 0')->fetchAll(PDO::FETCH_ASSOC);
$stmt  = $pdo->prepare(
    "INSERT IGNORE INTO `WalletTransaction` (userId, amount, type, source, description, createdAt)
     SELECT :uid, :amt, 'CREDIT', 'ADMIN', 'Migrated from legacy walletBalance', NOW()
     WHERE NOT EXISTS (
       SELECT 1 FROM `WalletTransaction` WHERE userId = :uid2 AND source = 'ADMIN' AND description = 'Migrated from legacy walletBalance'
     )"
);
$migrated = 0;
foreach ($users as $u) {
    $stmt->execute([':uid' => $u['id'], ':amt' => $u['walletBalance'], ':uid2' => $u['id']]);
    $migrated++;
}
echo "  ✅ Migrated $migrated user wallet balances\n";

// ── 7. Distributor bank details ───────────────────────────────────────────────
echo "\n7. DistributorApplication bank detail columns...\n";
addColumnIfMissing($pdo, 'DistributorApplication', 'bankAccountHolder', 'VARCHAR(255) NULL');
addColumnIfMissing($pdo, 'DistributorApplication', 'bankName',          'VARCHAR(255) NULL');
addColumnIfMissing($pdo, 'DistributorApplication', 'bankAccountNumber', 'VARCHAR(50)  NULL');
addColumnIfMissing($pdo, 'DistributorApplication', 'bankIfscCode',      'VARCHAR(11)  NULL');
addColumnIfMissing($pdo, 'DistributorApplication', 'bankAccountType',   "VARCHAR(20)  NULL DEFAULT 'SAVINGS'");
addColumnIfMissing($pdo, 'DistributorApplication', 'upiId',             'VARCHAR(100) NULL');

echo "\n7b. Distributor bank detail columns...\n";
addColumnIfMissing($pdo, 'Distributor', 'bankAccountHolder', 'VARCHAR(255) NULL');
addColumnIfMissing($pdo, 'Distributor', 'bankName',          'VARCHAR(255) NULL');
addColumnIfMissing($pdo, 'Distributor', 'bankAccountNumber', 'VARCHAR(50)  NULL');
addColumnIfMissing($pdo, 'Distributor', 'bankIfscCode',      'VARCHAR(11)  NULL');
addColumnIfMissing($pdo, 'Distributor', 'bankAccountType',   "VARCHAR(20)  NULL DEFAULT 'SAVINGS'");
addColumnIfMissing($pdo, 'Distributor', 'upiId',             'VARCHAR(100) NULL');

// ── 8. Distributor: linkedUserId, entityType, PAN, GST ───────────────────────
echo "\n8. Distributor KYC + link columns...\n";
addColumnIfMissing($pdo, 'Distributor', 'linkedUserId', 'INT NULL');
addColumnIfMissing($pdo, 'Distributor', 'entityType',   'VARCHAR(50) NULL');
addColumnIfMissing($pdo, 'Distributor', 'panNumber',    'VARCHAR(20) NULL');
addColumnIfMissing($pdo, 'Distributor', 'gstin',        'VARCHAR(20) NULL');

echo "\n8b. DistributorApplication: entityType, GST columns...\n";
addColumnIfMissing($pdo, 'DistributorApplication', 'entityType',  'VARCHAR(50)  NULL');
addColumnIfMissing($pdo, 'DistributorApplication', 'gstin',       'VARCHAR(20)  NULL');
addColumnIfMissing($pdo, 'DistributorApplication', 'gstFilePath', 'VARCHAR(500) NULL');

// ── 9. DistributorWalletTx: payout invoice + UTR tracking ────────────────────
echo "\n9. DistributorWalletTx payout tracking columns...\n";
addColumnIfMissing($pdo, 'DistributorWalletTx', 'invoicePath', 'VARCHAR(500) NULL');
addColumnIfMissing($pdo, 'DistributorWalletTx', 'utrNumber',   'VARCHAR(100) NULL');
addColumnIfMissing($pdo, 'DistributorWalletTx', 'adminNote',   'TEXT NULL');

echo "\n=== migrate_v4 complete ===\n\n";

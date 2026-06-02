<?php
/**
 * migrate_v6.php — Distributor dual-threshold revenue tracking.
 *
 * Adds newOrdersRevenueThisYear and renewalRevenueThisYear columns to the
 * Distributor table to support the new tier model (separate new-order vs
 * renewal thresholds, no decay).
 *
 * Also adds isRenewal column to DistributorSale for sale-type tracking.
 *
 * Safe to re-run — all statements use IF NOT EXISTS / IGNORE.
 * Run once on the production MySQL server via cPanel PHP runner or browser.
 */

declare(strict_types=1);

$secureConfig = '/home1/wmdadmin/secure_config/db_config.php';
if (file_exists($secureConfig)) {
    require $secureConfig;
} else {
    $db_host = getenv('DB_HOST') ?: 'localhost';
    $db_name = getenv('DB_NAME') ?: 'webmydrive';
    $db_user = getenv('DB_USER') ?: 'root';
    $db_pass = getenv('DB_PASS') ?: '';
}

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
} catch (PDOException $e) {
    die("DB connection failed: " . $e->getMessage() . "\n");
}

$steps = [];

// Add newOrdersRevenueThisYear to Distributor
$col = $pdo->query("SHOW COLUMNS FROM `Distributor` LIKE 'newOrdersRevenueThisYear'")->fetch();
if (!$col) {
    $pdo->exec("ALTER TABLE `Distributor` ADD COLUMN `newOrdersRevenueThisYear` DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER `revenueThisYear`");
    $steps[] = "✅ Added Distributor.newOrdersRevenueThisYear";
} else {
    $steps[] = "⏭  Distributor.newOrdersRevenueThisYear already exists";
}

// Add renewalRevenueThisYear to Distributor
$col = $pdo->query("SHOW COLUMNS FROM `Distributor` LIKE 'renewalRevenueThisYear'")->fetch();
if (!$col) {
    $pdo->exec("ALTER TABLE `Distributor` ADD COLUMN `renewalRevenueThisYear` DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER `newOrdersRevenueThisYear`");
    $steps[] = "✅ Added Distributor.renewalRevenueThisYear";
} else {
    $steps[] = "⏭  Distributor.renewalRevenueThisYear already exists";
}

// Add isRenewal flag to DistributorSale
$col = $pdo->query("SHOW COLUMNS FROM `DistributorSale` LIKE 'isRenewal'")->fetch();
if (!$col) {
    $pdo->exec("ALTER TABLE `DistributorSale` ADD COLUMN `isRenewal` TINYINT(1) NOT NULL DEFAULT 0 AFTER `saleYear`");
    $steps[] = "✅ Added DistributorSale.isRenewal";
} else {
    $steps[] = "⏭  DistributorSale.isRenewal already exists";
}

// Remove saleYear column from DistributorSale (no longer meaningful without decay)
$col = $pdo->query("SHOW COLUMNS FROM `DistributorSale` LIKE 'saleYear'")->fetch();
if ($col) {
    $pdo->exec("ALTER TABLE `DistributorSale` DROP COLUMN `saleYear`");
    $steps[] = "✅ Dropped DistributorSale.saleYear (superseded by isRenewal)";
} else {
    $steps[] = "⏭  DistributorSale.saleYear already removed";
}

echo implode("\n", $steps) . "\n\nMigration v6 complete.\n";

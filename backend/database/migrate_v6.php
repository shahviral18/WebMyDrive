<?php
/**
 * migrate_v6.php — Dual-threshold distributor tier model.
 *
 * Adds newOrdersRevenueThisYear and renewalRevenueThisYear to Distributor,
 * and isRenewal to DistributorSale, to support the new commission model
 * where both new-order and renewal revenue are tracked separately.
 *
 * Run once on the production MySQL server via browser or CLI:
 *   php backend/database/migrate_v6.php
 *
 * Safe to re-run — all statements use column-existence checks.
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

echo "\n=== migrate_v6 — WebMyDrive Dual-Threshold Distributor Model ===\n\n";

// ── 1. Distributor: separate new-order and renewal revenue counters ────────────
echo "1. Distributor revenue tracking columns...\n";
addColumnIfMissing($pdo, 'Distributor', 'newOrdersRevenueThisYear', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
addColumnIfMissing($pdo, 'Distributor', 'renewalRevenueThisYear',   'DECIMAL(12,2) NOT NULL DEFAULT 0');

// ── 2. DistributorSale: track whether sale was a renewal ──────────────────────
echo "\n2. DistributorSale isRenewal flag...\n";
addColumnIfMissing($pdo, 'DistributorSale', 'isRenewal',      'TINYINT(1) NOT NULL DEFAULT 0');
addColumnIfMissing($pdo, 'DistributorSale', 'commissionRate', 'DECIMAL(8,6) NOT NULL DEFAULT 0');
addColumnIfMissing($pdo, 'DistributorSale', 'amount',         'DECIMAL(12,2) NOT NULL DEFAULT 0');

echo "\n=== migrate_v6 complete ===\n";

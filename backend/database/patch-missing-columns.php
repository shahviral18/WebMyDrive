<?php
/**
 * patch-missing-columns.php
 * Safely adds missing columns to existing database without wiping data.
 * Usage: php server-php/database/patch-missing-columns.php
 */

declare(strict_types=1);

$dbPath = __DIR__ . '/dev.db';
if (!file_exists($dbPath)) {
    echo "Database not found at $dbPath. Run migrate.php first.\n";
    exit(1);
}

$pdo = new PDO("sqlite:$dbPath", null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);
$pdo->exec('PRAGMA journal_mode=WAL;');

echo "Patching database at: $dbPath\n";

// Helper: add column if not exists
function addColumnIfMissing(PDO $pdo, string $table, string $column, string $definition): void
{
    // Query pragma for the table columns
    $stmt = $pdo->query("PRAGMA table_info(\"$table\")");
    $cols = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $exists = false;
    foreach ($cols as $col) {
        if (strtolower($col['name']) === strtolower($column)) {
            $exists = true;
            break;
        }
    }
    if (!$exists) {
        $pdo->exec("ALTER TABLE \"$table\" ADD COLUMN $column $definition");
        echo "  ✅ Added column '$column' to '$table'\n";
    } else {
        echo "  ⏭  Column '$column' already exists in '$table'\n";
    }
}

// Order table
echo "\n[Order]\n";
addColumnIfMissing($pdo, 'Order', 'gatewayTxId', 'TEXT');

// Workspace table
echo "\n[Workspace]\n";
addColumnIfMissing($pdo, 'Workspace', 'renewalDate', 'TEXT');

// ReferralLog — ensure refereeId exists (was 'referrerUserId' in older schema)
echo "\n[ReferralLog]\n";
addColumnIfMissing($pdo, 'ReferralLog', 'refereeId', 'INTEGER');

// ReferralLink — ensure referrerId exists (was 'referrerUserId' in older schema)
echo "\n[ReferralLink]\n";
addColumnIfMissing($pdo, 'ReferralLink', 'referrerId', 'INTEGER');

echo "\nPatch complete!\n";

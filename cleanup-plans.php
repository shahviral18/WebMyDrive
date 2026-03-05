<?php
/**
 * Clean up old plans and verify database
 */

$dbPath = __DIR__ . '/server-php/database/dev.db';

if (!file_exists($dbPath)) {
    echo "Error: Database not found\n";
    exit(1);
}

$pdo = new PDO("sqlite:$dbPath", null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);
$pdo->exec('PRAGMA foreign_keys=OFF;');

echo "Cleaning up old plans...\n";

// Delete old placeholder plans
$deleteStmt = $pdo->prepare("DELETE FROM \"Plan\" WHERE name IN ('Starter', 'Professional', 'Enterprise') AND priceMonthlyINR IS NULL");
$result = $deleteStmt->execute();
echo "✓ Deleted old placeholder plans\n\n";

// Re-enable foreign keys
$pdo->exec('PRAGMA foreign_keys=ON;');

// Display final plans
echo "Current Plans in Database:\n";
echo "==========================\n\n";

$allPlans = $pdo->query('SELECT id, name, priceINR, priceMonthlyINR, priceYearlyINR, storageGB, isActive, hasOverride FROM "Plan" ORDER BY priceINR ASC')->fetchAll(PDO::FETCH_ASSOC);

if (empty($allPlans)) {
    echo "No plans found!\n";
    exit(1);
}

foreach ($allPlans as $p) {
    $status = $p['isActive'] ? '✓' : '✗';
    echo "$status Plan ID {$p['id']}: {$p['name']}\n";
    echo "   ├─ Price: ₹{$p['priceINR']}\n";
    echo "   ├─ Monthly: ₹{$p['priceMonthlyINR']} | Yearly: ₹{$p['priceYearlyINR']}\n";
    echo "   ├─ Storage: {$p['storageGB']} GB\n";
    echo "   └─ Override: " . ($p['hasOverride'] ? 'Yes' : 'No') . "\n\n";
}

echo "==========================\n";
echo "✓ Database cleanup complete!\n";

$pdo = null;
?>

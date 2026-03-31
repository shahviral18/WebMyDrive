<?php
/**
 * seed-plans.php — Seed or update pricing plans for WebMyDrive
 * Usage: php server-php/database/seed-plans.php
 */

declare(strict_types=1);

// Include the database config
$dbPath = __DIR__ . '/dev.db';

if (!file_exists($dbPath)) {
    echo "Error: Database not found at $dbPath\n";
    echo "Run: php server-php/database/migrate.php\n";
    exit(1);
}

$pdo = new PDO("sqlite:$dbPath", null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);
$pdo->exec('PRAGMA foreign_keys=ON;');

echo "Seeding/Updating Pricing Plans...\n";
echo "================================\n\n";

// New plans data
$plans = [
    [
        'name' => 'Cloud Storage – Basic',
        'priceINR' => 3000,  // Base price before discount
        'priceMonthlyINR' => 3000,
        'priceYearlyINR' => 36000,
        'storageGB' => 500,
        'maxUsers' => 1,
        'features' => json_encode([
            '500 GB Combined Storage',
            '1 User',
            'Standard Support',
            '₹3000 +GST – 10% OFF',
            'Coupon: tds20'
        ]),
        'isActive' => 1,
        'hasOverride' => 1,
        'googleSKU' => 'basic_500gb',
    ],
    [
        'name' => 'Cloud Storage – Professional',
        'priceINR' => 5000,  // Base price before discount
        'priceMonthlyINR' => 5000,
        'priceYearlyINR' => 60000,
        'storageGB' => 5000,  // 5 TB
        'maxUsers' => 5,
        'features' => json_encode([
            '5 TB Combined Storage',
            'Up to 5 Users',
            'Priority Support',
            '₹5000 +GST – 20% OFF',
            'Coupon: tds20'
        ]),
        'isActive' => 1,
        'hasOverride' => 1,
        'googleSKU' => 'professional_5tb',
    ],
    [
        'name' => 'Cloud Storage – Premium',
        'priceINR' => 9000,  // Base price before discount
        'priceMonthlyINR' => 9000,
        'priceYearlyINR' => 108000,
        'storageGB' => 50000,  // 50 TB
        'maxUsers' => 20,
        'features' => json_encode([
            '50 TB Combined Storage',
            'Up to 20 Users',
            '24/7 Premium Support',
            'Advanced Admin Controls',
            '₹9000 +GST – 40% OFF',
            'Coupon: tds40',
            'Best Seller ⭐'
        ]),
        'isActive' => 1,
        'hasOverride' => 1,
        'googleSKU' => 'premium_50tb',
    ],
    [
        'name' => 'Cloud Storage – Enterprise',
        'priceINR' => 15000,  // Base price before discount
        'priceMonthlyINR' => 15000,
        'priceYearlyINR' => 180000,
        'storageGB' => 100000,  // 100 TB
        'maxUsers' => 100,
        'features' => json_encode([
            '100 TB Combined Storage',
            'Unlimited Users',
            'Dedicated Account Manager',
            'Custom SLA',
            'White-label Options',
            '₹15000 +GST – 40% OFF',
            'Coupon: tds40'
        ]),
        'isActive' => 1,
        'hasOverride' => 1,
        'googleSKU' => 'enterprise_100tb',
    ],
];

$now = date('Y-m-d H:i:s');

// First, check if the Plan table has the required columns
try {
    $pdo->query('SELECT priceMonthlyINR FROM "Plan" LIMIT 1');
} catch (Exception $e) {
    // Columns might not exist, let's add them if needed
    echo "Migrating Plan table schema...\n";
    
    // Add missing columns if they don't exist
    $alterStatements = [
        'ALTER TABLE "Plan" ADD COLUMN priceINR REAL',
        'ALTER TABLE "Plan" ADD COLUMN priceMonthlyINR REAL',
        'ALTER TABLE "Plan" ADD COLUMN priceYearlyINR REAL',
        'ALTER TABLE "Plan" ADD COLUMN storageGB INTEGER',
        'ALTER TABLE "Plan" ADD COLUMN features TEXT',
        'ALTER TABLE "Plan" ADD COLUMN hasOverride INTEGER DEFAULT 0',
        'ALTER TABLE "Plan" RENAME COLUMN storage TO storageGB_old',
        'ALTER TABLE "Plan" RENAME COLUMN isVisible TO isActive',
    ];
    
    foreach ($alterStatements as $stmt) {
        try {
            $pdo->exec($stmt);
            echo "  ✓ Applied: $stmt\n";
        } catch (Exception $e) {
            // Column might already exist, skip
        }
    }
    echo "\n";
}

// Upsert plans
foreach ($plans as $plan) {
    $name = $plan['name'];
    
    // Check if plan exists
    $check = $pdo->prepare('SELECT id FROM "Plan" WHERE name = ?');
    $check->execute([$name]);
    $existing = $check->fetch();
    
    if ($existing) {
        // Update existing plan
        $stmt = $pdo->prepare(
            'UPDATE "Plan" SET 
                priceINR = ?,
                priceMonthlyINR = ?,
                priceYearlyINR = ?,
                storageGB = ?,
                maxUsers = ?,
                features = ?,
                isActive = ?,
                hasOverride = ?,
                googleSKU = ?,
                updatedAt = ?
            WHERE name = ?'
        );
        $stmt->execute([
            $plan['priceINR'],
            $plan['priceMonthlyINR'],
            $plan['priceYearlyINR'],
            $plan['storageGB'],
            $plan['maxUsers'],
            $plan['features'],
            $plan['isActive'],
            $plan['hasOverride'],
            $plan['googleSKU'],
            $now,
            $name
        ]);
        echo "✓ Updated: {$name}\n";
    } else {
        // Insert new plan
        $stmt = $pdo->prepare(
            'INSERT INTO "Plan" (
                name, price, priceINR, priceMonthlyINR, priceYearlyINR,
                storageGB, maxUsers, features, isActive, hasOverride,
                googleSKU, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $name,
            $plan['priceINR'],  // price field (for backward compatibility)
            $plan['priceINR'],
            $plan['priceMonthlyINR'],
            $plan['priceYearlyINR'],
            $plan['storageGB'],
            $plan['maxUsers'],
            $plan['features'],
            $plan['isActive'],
            $plan['hasOverride'],
            $plan['googleSKU'],
            $now,
            $now
        ]);
        echo "✓ Inserted: {$name}\n";
    }
}

// Delete old plans that are not in our list (optional - comment out if you want to keep old plans)
echo "\nCleaning up old plans...\n";
$newPlanNames = array_map(fn($p) => $p['name'], $plans);
$placeholders = implode(',', array_fill(0, count($newPlanNames), '?'));
$deleteStmt = $pdo->prepare("DELETE FROM \"Plan\" WHERE name NOT IN ($placeholders) AND name NOT LIKE 'Starter%' AND name NOT LIKE 'Professional%' AND name NOT LIKE 'Enterprise%'");
$deleteStmt->execute($newPlanNames);

// Display final plans
echo "\n================================\n";
echo "Final Plans in Database:\n";
echo "================================\n\n";

$allPlans = $pdo->query('SELECT id, name, priceINR, storageGB, isActive FROM "Plan" ORDER BY priceINR ASC')->fetchAll(PDO::FETCH_ASSOC);
foreach ($allPlans as $p) {
    $status = $p['isActive'] ? '✓' : '✗';
    echo "$status {$p['name']}\n";
    echo "  └─ Price: ₹{$p['priceINR']} | Storage: {$p['storageGB']} GB | ID: {$p['id']}\n\n";
}

echo "================================\n";
echo "✓ Plans seeded successfully!\n";

$pdo = null;
?>

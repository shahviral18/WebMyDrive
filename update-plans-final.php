<?php
// Update plans in the database with correct TechnoDoc data

$dbPath = __DIR__ . '/server-php/database/dev.db';

if (!file_exists($dbPath)) {
    die("Database not found at: $dbPath\n");
}

$db = new SQLite3($dbPath);
$db->busyTimeout(5000);

// Plans to update
$plans = [
    [
        'id' => 1,
        'name' => 'Cloud Storage – Basic',
        'price' => 3000,
        'monthlyPrice' => 250,
        'yearlyPrice' => 3000,
        'storage' => 500,
        'storageGB' => 500,
        'maxUsers' => 5,
        'discount' => '10% OFF',
        'coupon' => 'tds20',
        'isBestSeller' => 0
    ],
    [
        'id' => 2,
        'name' => 'Cloud Storage – Professional',
        'price' => 5000,
        'monthlyPrice' => 417,
        'yearlyPrice' => 5000,
        'storage' => 5000,
        'storageGB' => 5000,
        'maxUsers' => 25,
        'discount' => '20% OFF',
        'coupon' => 'tds20',
        'isBestSeller' => 0
    ],
    [
        'id' => 3,
        'name' => 'Cloud Storage – Premium',
        'price' => 9000,
        'monthlyPrice' => 750,
        'yearlyPrice' => 9000,
        'storage' => 50000,
        'storageGB' => 50000,
        'maxUsers' => 100,
        'discount' => '40% OFF',
        'coupon' => 'tds40',
        'isBestSeller' => 1
    ],
    [
        'id' => 4,
        'name' => 'Cloud Storage – Enterprise',
        'price' => 15000,
        'monthlyPrice' => 1250,
        'yearlyPrice' => 15000,
        'storage' => 100000,
        'storageGB' => 100000,
        'maxUsers' => 1000,
        'discount' => '40% OFF',
        'coupon' => 'tds40',
        'isBestSeller' => 0
    ]
];

try {
    $db->exec('BEGIN TRANSACTION');
    
    // Delete existing plans (keep id sequence)
    $result = $db->exec('DELETE FROM "Plan"');
    echo "Cleared existing plans\n";
    
    // Insert new plans
    foreach ($plans as $plan) {
        $stmt = $db->prepare('INSERT INTO "Plan" (id, name, price, monthlyPrice, yearlyPrice, storage, storageGB, maxUsers, discount, coupon, isBestSeller, isVisible, createdAt, updatedAt) 
                            VALUES (:id, :name, :price, :monthlyPrice, :yearlyPrice, :storage, :storageGB, :maxUsers, :discount, :coupon, :isBestSeller, 1, datetime("now"), datetime("now"))');
        
        $stmt->bindValue(':id', $plan['id'], SQLITE3_INTEGER);
        $stmt->bindValue(':name', $plan['name'], SQLITE3_TEXT);
        $stmt->bindValue(':price', $plan['price'], SQLITE3_INTEGER);
        $stmt->bindValue(':monthlyPrice', $plan['monthlyPrice'], SQLITE3_INTEGER);
        $stmt->bindValue(':yearlyPrice', $plan['yearlyPrice'], SQLITE3_INTEGER);
        $stmt->bindValue(':storage', $plan['storage'], SQLITE3_INTEGER);
        $stmt->bindValue(':storageGB', $plan['storageGB'], SQLITE3_INTEGER);
        $stmt->bindValue(':maxUsers', $plan['maxUsers'], SQLITE3_INTEGER);
        $stmt->bindValue(':discount', $plan['discount'], SQLITE3_TEXT);
        $stmt->bindValue(':coupon', $plan['coupon'], SQLITE3_TEXT);
        $stmt->bindValue(':isBestSeller', $plan['isBestSeller'], SQLITE3_INTEGER);
        
        $result = $stmt->execute();
        if ($result) {
            echo "✓ Inserted: {$plan['name']} - ₹{$plan['price']} ({$plan['discount']})\n";
        } else {
            throw new Exception("Failed to insert plan: {$plan['name']}");
        }
    }
    
    $db->exec('COMMIT');
    echo "\n✓ All plans updated successfully!\n";
    
    // Verify the updates
    echo "\n📋 Current plans in database:\n";
    $result = $db->query('SELECT id, name, price, monthlyPrice, yearlyPrice, storageGB, discount, coupon, isBestSeller FROM "Plan" ORDER BY id');
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $bestSeller = $row['isBestSeller'] ? ' (⭐ BEST SELLER)' : '';
        echo "Plan {$row['id']}: {$row['name']}{$bestSeller}\n";
        echo "  - Price: ₹{$row['price']} (Monthly: ₹{$row['monthlyPrice']}, Yearly: ₹{$row['yearlyPrice']})\n";
        echo "  - Storage: {$row['storageGB']} GB\n";
        echo "  - Discount: {$row['discount']} | Coupon: {$row['coupon']}\n";
    }
    
} catch (Exception $e) {
    $db->exec('ROLLBACK');
    echo "❌ Error: {$e->getMessage()}\n";
    exit(1);
} finally {
    $db->close();
}
?>

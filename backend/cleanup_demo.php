<?php
try {
    $dbPath = __DIR__ . '/database/dev.db';
    $db = new PDO("sqlite:$dbPath");
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $tablesToClear = [
        'AuditLog',
        'ReferralLog',
        'ReferralLink',
        'DistributorWalletTx',
        'DistributorSale',
        'Distributor',
        'CheckoutSession',
        'Subscription',
        'Order',
        'Workspace',
        'SecurityLink'
    ];

    foreach ($tablesToClear as $table) {
        try {
            $db->exec("DELETE FROM \"$table\"");
            echo "Cleared $table\n";
        } catch (Exception $e) {
            echo "Error clearing $table: " . $e->getMessage() . "\n";
        }
    }

    // Delete users except admin
    $db->prepare('DELETE FROM "User" WHERE email != ?')->execute(['admin@webmydrive.com']);
    echo "Cleared Users except admin\n";

    // Show plans
    echo "\n--- PLANS REMAINING ---\n";
    $plans = $db->query("SELECT id, name FROM Plan")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($plans as $p) {
        echo "ID: {$p['id']} | Name: {$p['name']}\n";
    }

    // Reset sequences
    $db->exec("DELETE FROM sqlite_sequence");
    echo "Reset sequences\n";

} catch (Exception $e) {
    echo "Critical Error: " . $e->getMessage();
}

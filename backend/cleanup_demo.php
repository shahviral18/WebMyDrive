<?php
/**
 * cleanup_demo.php — Reset demo MySQL database to clean state.
 * Preserves admin user, plans, and config. Clears all transactional data.
 *
 * Usage: php backend/cleanup_demo.php
 */

declare(strict_types=1);

require __DIR__ . '/config/env.php';
require __DIR__ . '/config/database.php';

header('Content-Type: text/plain; charset=utf-8');

echo "=== Cleanup Demo Data ===\n\n";

$tables = [
    'AuditLog', 'ReferralLog', 'ReferralLink', 'DistributorWalletTx',
    'DistributorSale', 'Distributor', 'CheckoutSession', 'Subscription',
    'Order', 'Workspace', 'SecurityLink',
];

foreach ($tables as $t) {
    $count = Database::count("\"$t\"");
    Database::execute("DELETE FROM \"$t\"");
    echo "Cleared $t ($count rows)\n";
}

// Delete all users except admin
$count = Database::execute('DELETE FROM "User" WHERE email != :e', [':e' => 'admin@webmydrive.com']);
echo "Deleted $count non-admin users\n";

echo "\nDone. Run mysql-seed.php to re-create demo accounts.\n";

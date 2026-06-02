<?php
$isCli = (PHP_SAPI === 'cli');
if (!$isCli) header('Content-Type: text/plain');

define('BASE_PATH', '/home1/wmdadmin/public_html/demo1/backend');
require BASE_PATH . '/helpers/Logger.php';
require BASE_PATH . '/config/env.php';
require BASE_PATH . '/config/database.php';
require BASE_PATH . '/services/GoogleWorkspaceService.php';
require BASE_PATH . '/helpers/Request.php';
require BASE_PATH . '/helpers/Response.php';
require BASE_PATH . '/helpers/JwtHelper.php';
require BASE_PATH . '/helpers/Router.php';
require BASE_PATH . '/services/AuditService.php';
require BASE_PATH . '/services/ConfigService.php';
require BASE_PATH . '/services/ReferralLinkService.php';
require BASE_PATH . '/services/ReferralService.php';
require BASE_PATH . '/services/DistributorService.php';
require BASE_PATH . '/services/RazorpayService.php';
require BASE_PATH . '/services/SubscriptionService.php';
require BASE_PATH . '/services/PaymentHandler.php';
require BASE_PATH . '/middleware/AuthMiddleware.php';
require BASE_PATH . '/controllers/AdminController.php';

echo "Bootstrap OK\n";

// Test upsertPlan with a sample payload
$ctrl = new AdminController();
$body = [
    'id' => 1,
    'name' => 'Test Plan',
    'price' => 237.5,
    'priceINR' => 237.5,
    'priceMonthlyINR' => 237.5,
    'storageGB' => 500,
    'isActive' => true,
    'sortOrder' => 1,
    'googleOrgUnit' => null,
    'features' => null,
];

$req = new stdClass();
$req->body = $body;
$req->params = [];
$req->query = [];
$req->user = ['userId' => 1, 'role' => 'ADMIN'];

try {
    ob_start();
    $ctrl->upsertPlan($req);
    $out = ob_get_clean();
    echo "upsertPlan output: $out\n";
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . ":" . $e->getLine() . "\n";
    echo $e->getTraceAsString() . "\n";
}

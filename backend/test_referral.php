<?php
declare(strict_types=1);
define('BASE_PATH', __DIR__);
require BASE_PATH . '/helpers/Logger.php';
require BASE_PATH . '/config/env.php';
require BASE_PATH . '/config/database.php';
require BASE_PATH . '/helpers/JwtHelper.php';
require BASE_PATH . '/helpers/Request.php';
require BASE_PATH . '/helpers/Response.php';
require BASE_PATH . '/helpers/Router.php';
require BASE_PATH . '/services/AuditService.php';
require BASE_PATH . '/services/ConfigService.php';
require BASE_PATH . '/services/ReferralLinkService.php';
require BASE_PATH . '/services/ReferralService.php';

try {
    $data = ReferralService::getUserReferralHistory(1);
    var_dump($data);
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}

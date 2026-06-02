<?php
define('BASE_PATH', dirname(__DIR__));
require BASE_PATH . '/helpers/Logger.php';
require BASE_PATH . '/config/env.php';
require BASE_PATH . '/config/database.php';
require BASE_PATH . '/services/GoogleWorkspaceService.php';

header('Content-Type: application/json');

$email = 'testviralshah@webmydrive.com';

// Test storage
try {
    $storage = GoogleWorkspaceService::getStorageInfo($email);
    echo json_encode(['storage' => $storage]);
} catch (Throwable $e) {
    echo json_encode(['storage_error' => $e->getMessage()]);
}

echo "\n";

// Test shared drives
try {
    $drives = GoogleWorkspaceService::getSharedDrives($email);
    echo json_encode(['shared_drives' => $drives]);
} catch (Throwable $e) {
    echo json_encode(['drives_error' => $e->getMessage()]);
}

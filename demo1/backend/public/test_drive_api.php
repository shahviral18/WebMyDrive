<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
if (!hash_equals('CMQ0LSJR84JZIH9PARSR5X9XYU2TPREV', $_GET['token'] ?? '')) {
    http_response_code(403); exit;
}

define('BASE_PATH', dirname(__DIR__));
require BASE_PATH . '/config/env.php';

$autoload = '/home1/wmdadmin/google_api/vendor/autoload.php';
if (!file_exists($autoload)) {
    echo json_encode(['error' => 'autoload not found']); exit;
}
require_once $autoload;

$credsFile = '/home1/wmdadmin/google_api/credentials.json';
$testEmail = 'testviralshah@webmydrive.com';

$result = [];

// Test 1: Admin Directory (existing — should work)
try {
    $client = new Google_Client();
    $client->setAuthConfig($credsFile);
    $client->setScopes(['https://www.googleapis.com/auth/admin.directory.user']);
    $client->setSubject('admin@webmydrive.com');
    $svc = new Google_Service_Directory($client);
    $u = $svc->users->get($testEmail, ['projection' => 'basic']);
    $result['directory_api'] = ['ok' => true, 'name' => $u->getName()->getFullName()];
} catch (Throwable $e) {
    $result['directory_api'] = ['ok' => false, 'error' => $e->getMessage()];
}

// Test 2: Drive API — impersonate user
try {
    $client2 = new Google_Client();
    $client2->setAuthConfig($credsFile);
    $client2->setScopes(['https://www.googleapis.com/auth/drive.readonly']);
    $client2->setSubject($testEmail);
    $drive = new Google_Service_Drive($client2);
    $about = $drive->about->get(['fields' => 'storageQuota,user']);
    $q = $about->getStorageQuota();
    $result['drive_api'] = [
        'ok'    => true,
        'user'  => $about->getUser()->getEmailAddress(),
        'used'  => $q->getUsage(),
        'limit' => $q->getLimit(),
    ];
} catch (Throwable $e) {
    $result['drive_api'] = ['ok' => false, 'error' => $e->getMessage()];
}

// Test 3: Drive list — shared drives
try {
    $client3 = new Google_Client();
    $client3->setAuthConfig($credsFile);
    $client3->setScopes(['https://www.googleapis.com/auth/drive.readonly']);
    $client3->setSubject($testEmail);
    $drive3 = new Google_Service_Drive($client3);
    $driveList = $drive3->drives->listDrives(['pageSize' => 10, 'fields' => 'drives(id,name)']);
    $result['shared_drives'] = [
        'ok'     => true,
        'count'  => count($driveList->getDrives()),
        'drives' => array_map(fn($d) => $d->getName(), $driveList->getDrives()),
    ];
} catch (Throwable $e) {
    $result['shared_drives'] = ['ok' => false, 'error' => $e->getMessage()];
}

echo json_encode($result, JSON_PRETTY_PRINT);

<?php
define('BASE_PATH', dirname(__DIR__));
require BASE_PATH . '/helpers/Logger.php';
require BASE_PATH . '/config/env.php';
require BASE_PATH . '/config/database.php';
require BASE_PATH . '/services/GoogleWorkspaceService.php';

header('Content-Type: application/json');

$email = 'testviralshah@webmydrive.com';
$results = [];

// Test storage with full exception
try {
    $creds = '/home1/wmdadmin/google_api/credentials.json';
    require_once '/home1/wmdadmin/google_api/vendor/autoload.php';
    
    $client = new Google\Client();
    $client->setAuthConfig($creds);
    $client->setScopes(['https://www.googleapis.com/auth/drive.readonly']);
    $client->setSubject($email);
    
    $drive = new Google\Service\Drive($client);
    $about = $drive->about->get(['fields' => 'storageQuota,user']);
    $quota = $about->getStorageQuota();
    $results['storage'] = [
        'used' => $quota->getUsage(),
        'limit' => $quota->getLimit(),
        'driveUsage' => $quota->getUsageInDrive(),
    ];
    $results['user'] = $about->getUser()->getEmailAddress();
} catch (Throwable $e) {
    $results['storage_error'] = $e->getMessage();
    $results['storage_error_class'] = get_class($e);
}

// Test shared drives
try {
    $client2 = new Google\Client();
    $client2->setAuthConfig($creds);
    $client2->setScopes(['https://www.googleapis.com/auth/drive.readonly']);
    $client2->setSubject($email);
    
    $drive2 = new Google\Service\Drive($client2);
    $drivesResult = $drive2->drives->listDrives(['fields' => 'drives(id,name,kind)']);
    $results['shared_drives_count'] = count($drivesResult->getDrives());
    $results['shared_drives'] = array_map(fn($d) => ['id'=>$d->getId(),'name'=>$d->getName()], $drivesResult->getDrives());
} catch (Throwable $e) {
    $results['drives_error'] = $e->getMessage();
}

echo json_encode($results, JSON_PRETTY_PRINT);

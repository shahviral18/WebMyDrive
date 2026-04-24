<?php
declare(strict_types=1);
$isCli = (PHP_SAPI === 'cli');
$token = $isCli ? ($argv[1] ?? '') : ($_GET['token'] ?? '');
if ($token !== 'CMQ0LSJR84JZIH9PARSR5X9XYU2TPREV') { echo 'Forbidden'; exit; }

$path = $isCli ? ($argv[2] ?? 'webmydrive.com/A - Basic - 500GB') : ($_GET['path'] ?? 'webmydrive.com/A - Basic - 500GB');

require_once '/home1/wmdadmin/google_api/vendor/autoload.php';

$client = new Google_Client();
$client->setApplicationName('WebMyDrive');
$client->setAuthConfig('/home1/wmdadmin/google_api/credentials.json');
$client->setSubject('admin@webmydrive.com');

// Try with orgunit scope
$client->setScopes(['https://www.googleapis.com/auth/admin.directory.orgunit.readonly']);
$service = new Google_Service_Directory($client);

echo "Testing OU path: $path\n";
try {
    $result = $service->orgunits->get('my_customer', $path);
    echo "SUCCESS: " . json_encode(['name'=>$result->getName(),'path'=>$result->getOrgUnitPath()]) . "\n";
} catch (Throwable $e) {
    echo "ERROR with orgunit scope: " . $e->getMessage() . "\n";
}

// Also try listing all OUs to see what paths exist
echo "\nListing all OUs:\n";
$client2 = new Google_Client();
$client2->setApplicationName('WebMyDrive');
$client2->setAuthConfig('/home1/wmdadmin/google_api/credentials.json');
$client2->setSubject('admin@webmydrive.com');
$client2->setScopes(['https://www.googleapis.com/auth/admin.directory.orgunit.readonly']);
$svc2 = new Google_Service_Directory($client2);
try {
    $list = $svc2->orgunits->listOrgunits('my_customer', ['type' => 'all']);
    foreach ($list->getOrganizationUnits() as $ou) {
        echo "  " . $ou->getOrgUnitPath() . "\n";
    }
} catch (Throwable $e) {
    echo "List error: " . $e->getMessage() . "\n";
    // Fallback: try with user scope
    echo "\nFallback: test with user scope only:\n";
    $client3 = new Google_Client();
    $client3->setApplicationName('WebMyDrive');
    $client3->setAuthConfig('/home1/wmdadmin/google_api/credentials.json');
    $client3->setSubject('admin@webmydrive.com');
    $client3->setScopes(['https://www.googleapis.com/auth/admin.directory.user']);
    $svc3 = new Google_Service_Directory($client3);
    try {
        $users = $svc3->users->listUsers(['customer'=>'my_customer','maxResults'=>1]);
        echo "User scope works. Total users: " . count($users->getUsers()) . "\n";
    } catch (Throwable $e2) {
        echo "User scope error: " . $e2->getMessage() . "\n";
    }
}

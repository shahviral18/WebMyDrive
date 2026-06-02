<?php
$token = $_GET['token'] ?? '';
if ($token !== 'CMQ0LSJR84JZIH9PARSR5X9XYU2TPREV') { http_response_code(403); die('Forbidden'); }

require_once '/home1/wmdadmin/secure_config/db_config.php';
$pdo = new PDO("mysql:host={$db_host};dbname={$db_name};charset=utf8mb4", $db_user, $db_pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::MYSQL_ATTR_INIT_COMMAND => "SET sql_mode='ANSI_QUOTES'"]);

// Get the approved application for testviralshah
$app = $pdo->query("SELECT * FROM `DistributorApplication` WHERE status='APPROVED' ORDER BY id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
echo "Application: " . json_encode($app) . "\n\n";

if (!$app) { echo "No approved application found\n"; exit; }

$linkedUserId = (int)$app['linkedUserId'];
$user = $pdo->prepare("SELECT * FROM `User` WHERE id=?");
$user->execute([$linkedUserId]);
$user = $user->fetch(PDO::FETCH_ASSOC);
echo "User: id={$user['id']}, name={$user['name']}, email={$user['email']}\n\n";

// Check if Distributor already exists
$existing = $pdo->prepare("SELECT id FROM `Distributor` WHERE email=? OR linkedUserId=?");
$existing->execute([$app['accountEmail'], $linkedUserId]);
$existing = $existing->fetch(PDO::FETCH_ASSOC);

if ($existing) {
    echo "Distributor already exists: id={$existing['id']}\n";
} else {
    $name = trim(($app['firstName'] ?? '') . ' ' . ($app['lastName'] ?? '')) ?: $user['name'];
    $refCode = strtoupper(substr(preg_replace('/[^A-Z0-9]/', '', strtoupper($name)), 0, 6)) . rand(10, 99);
    $now = date('Y-m-d H:i:s');
    
    $stmt = $pdo->prepare(
        'INSERT INTO `Distributor` (name, email, displayEmail, passwordHash, referralCode, walletBalance, status, passwordResetRequired, linkedUserId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 0, "ACTIVE", 0, ?, ?, ?)'
    );
    $stmt->execute([$name, $app['accountEmail'], $app['accountEmail'], $user['passwordHash'], $refCode, $linkedUserId, $now, $now]);
    $distId = $pdo->lastInsertId();
    echo "Created Distributor: id=$distId, name=$name, email={$app['accountEmail']}, refCode=$refCode\n";
    
    // Create a ReferralLink for this distributor
    $linkCode = 'DIST_' . strtoupper(substr($refCode, 0, 8));
    $stmt2 = $pdo->prepare(
        "INSERT INTO `ReferralLink` (entityId, entityType, code, isActive, createdAt, updatedAt) VALUES (?, 'DISTRIBUTOR', ?, 1, ?, ?)"
    );
    $stmt2->execute([$distId, $linkCode, $now, $now]);
    echo "Created ReferralLink: $linkCode\n";
}

// Show current Distributor list
$rows = $pdo->query("SELECT id, name, email, referralCode, linkedUserId FROM `Distributor`")->fetchAll(PDO::FETCH_ASSOC);
echo "\nAll distributors:\n";
foreach ($rows as $r) echo json_encode($r) . "\n";

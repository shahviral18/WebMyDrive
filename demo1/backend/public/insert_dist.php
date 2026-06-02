<?php
$t = $_GET['token'] ?? '';
if ($t !== 'CMQ0LSJR84JZIH9PARSR5X9XYU2TPREV') { http_response_code(403); die('Forbidden'); }
error_reporting(E_ALL); ini_set('display_errors',1);

require_once '/home1/wmdadmin/secure_config/db_config.php';
$pdo = new PDO("mysql:host={$db_host};dbname={$db_name};charset=utf8mb4", $db_user, $db_pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

// Get user passwordHash
$user = $pdo->query("SELECT id, name, passwordHash FROM `User` WHERE id=3")->fetch(PDO::FETCH_ASSOC);

$now = date('Y-m-d H:i:s');
$stmt = $pdo->prepare("INSERT INTO `Distributor` (name, email, displayEmail, passwordHash, referralCode, walletBalance, status, passwordResetRequired, linkedUserId, createdAt, updatedAt) VALUES (?,?,?,?,?,0,'ACTIVE',0,?,?,?)");
$stmt->execute(['Viral Shah', 'testviralshah@webmydrive.com', 'testviralshah@webmydrive.com', $user['passwordHash'], 'VIRAL24', 3, $now, $now]);
$distId = $pdo->lastInsertId();
echo "Distributor created: id=$distId\n";

// Create ReferralLink
$stmt2 = $pdo->prepare("INSERT INTO `ReferralLink` (entityId, entityType, code, isActive, createdAt, updatedAt) VALUES (?,'DISTRIBUTOR','TVIRAL24',1,?,?)");
$stmt2->execute([$distId, $now, $now]);
echo "ReferralLink created\n";

// Verify
$r = $pdo->query("SELECT id, name, email, referralCode, linkedUserId FROM `Distributor`")->fetchAll(PDO::FETCH_ASSOC);
foreach ($r as $row) echo json_encode($row) . "\n";

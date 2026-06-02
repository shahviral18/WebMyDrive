<?php
$t = $_GET['token'] ?? '';
if ($t !== 'CMQ0LSJR84JZIH9PARSR5X9XYU2TPREV') { http_response_code(403); die('Forbidden'); }
require_once '/home1/wmdadmin/secure_config/db_config.php';
$pdo = new PDO("mysql:host={$db_host};dbname={$db_name};charset=utf8mb4", $db_user, $db_pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$rows = $pdo->query("SELECT id, name, email, referralCode, linkedUserId FROM `Distributor`")->fetchAll(PDO::FETCH_ASSOC);
foreach ($rows as $r) echo json_encode($r) . "\n";

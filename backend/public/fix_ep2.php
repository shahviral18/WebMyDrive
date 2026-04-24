<?php
declare(strict_types=1);
$isCli = (PHP_SAPI === 'cli');
$token = $isCli ? ($argv[1] ?? '') : ($_GET['token'] ?? '');
if ($token !== 'CMQ0LSJR84JZIH9PARSR5X9XYU2TPREV') { echo 'Forbidden'; exit; }

$secureConfig = '/home1/wmdadmin/secure_config/db_config.php';
require $secureConfig;

$pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

// Read before
$before = $pdo->query("SELECT id, name, priceINR FROM Plan WHERE id = 5")->fetch(PDO::FETCH_ASSOC);
echo "BEFORE: " . json_encode($before) . "\n";

// Update
$pdo->exec("UPDATE Plan SET priceINR = 21000 WHERE id = 5");
$rows = $pdo->query("SELECT ROW_COUNT() as n")->fetchColumn();

// Read after
$after = $pdo->query("SELECT id, name, priceINR FROM Plan WHERE id = 5")->fetch(PDO::FETCH_ASSOC);
echo "AFTER: " . json_encode($after) . "\n";
echo "rows_changed=$rows\n";

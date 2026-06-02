<?php
declare(strict_types=1);
$isCli = (PHP_SAPI === 'cli');
$token = $isCli ? ($argv[1] ?? '') : ($_GET['token'] ?? '');
if ($token !== 'CMQ0LSJR84JZIH9PARSR5X9XYU2TPREV') { echo 'Forbidden'; exit; }

$secureConfig = '/home1/wmdadmin/secure_config/db_config.php';
if (file_exists($secureConfig)) {
    require $secureConfig;
    echo "Loaded: $secureConfig\n";
} else {
    echo "MISSING: $secureConfig\n";
}

// Check what variables were defined
foreach (['db_host','db_name','db_user','db_pass','DB_HOST','DB_NAME','DB_USER','DB_PASS'] as $k) {
    $v = isset($$k) ? $$k : (defined($k) ? constant($k) : 'NOT SET');
    echo "$k = $v\n";
}

// Try connecting
$h = isset($db_host) ? $db_host : (defined('DB_HOST') ? DB_HOST : '');
$n = isset($db_name) ? $db_name : (defined('DB_NAME') ? DB_NAME : '');
$u = isset($db_user) ? $db_user : (defined('DB_USER') ? DB_USER : '');
$p = isset($db_pass) ? $db_pass : (defined('DB_PASS') ? DB_PASS : '');
echo "Connecting to: host=$h dbname=$n\n";
try {
    $pdo = new PDO("mysql:host=$h;dbname=$n;charset=utf8mb4", $u, $p, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $row = $pdo->query("SELECT id, name, priceINR, updatedAt FROM \`Plan\` WHERE id=5")->fetch(PDO::FETCH_ASSOC);
    echo "Plan id=5: " . json_encode($row) . "\n";
} catch (Exception $e) { echo "Error: " . $e->getMessage() . "\n"; }

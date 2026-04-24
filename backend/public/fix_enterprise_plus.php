<?php
/**
 * fix_enterprise_plus.php — One-shot: set Enterprise Plus priceINR = 21000
 * CLI: php fix_enterprise_plus.php CMQ0LSJR84JZIH9PARSR5X9XYU2TPREV
 */
declare(strict_types=1);

$isCli = (PHP_SAPI === 'cli');
$token = $isCli ? ($argv[1] ?? '') : ($_GET['token'] ?? '');
if ($token !== 'CMQ0LSJR84JZIH9PARSR5X9XYU2TPREV') {
    if (!$isCli) http_response_code(403);
    echo 'Forbidden'; exit;
}

$secureConfig = '/home1/wmdadmin/secure_config/db_config.php';
if (file_exists($secureConfig)) {
    require $secureConfig;
} else {
    $envFile = dirname(__DIR__) . '/.env';
    if (file_exists($envFile)) {
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
            [$k, $v] = explode('=', $line, 2);
            if (!defined(trim($k))) define(trim($k), trim($v));
        }
    }
    $db_host = defined('DB_HOST') ? DB_HOST : 'localhost';
    $db_name = defined('DB_NAME') ? DB_NAME : '';
    $db_user = defined('DB_USER') ? DB_USER : '';
    $db_pass = defined('DB_PASS') ? DB_PASS : '';
}

try {
    $pdo = new PDO(
        "mysql:host=$db_host;dbname=$db_name;charset=utf8mb4",
        $db_user, $db_pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    echo 'DB connect failed: ' . $e->getMessage(); exit;
}

$stmt = $pdo->prepare("UPDATE `Plan` SET priceINR = 21000, updatedAt = NOW() WHERE id = 5 AND name LIKE '%Enterprise Plus%'");
$stmt->execute();
$rows = $stmt->rowCount();
echo $rows > 0
    ? "OK: Enterprise Plus priceINR updated to 21000 ($rows row affected)\n"
    : "WARN: No rows updated — check that plan id=5 name contains 'Enterprise Plus'\n";

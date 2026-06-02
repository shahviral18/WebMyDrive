<?php
/**
 * migrate_plans_v2.php — One-shot migration: PromoCode table
 * Token-gated.
 * Web: https://webmydrive.com/demo1/backend/public/migrate_plans_v2.php?token=CMQ0LSJR84JZIH9PARSR5X9XYU2TPREV
 * CLI: php migrate_plans_v2.php CMQ0LSJR84JZIH9PARSR5X9XYU2TPREV
 */
declare(strict_types=1);

$isCli = (PHP_SAPI === 'cli');
$token = $isCli ? ($argv[1] ?? '') : ($_GET['token'] ?? '');
if ($token !== 'CMQ0LSJR84JZIH9PARSR5X9XYU2TPREV') {
    if (!$isCli) http_response_code(403);
    echo 'Forbidden'; exit;
}

if (!$isCli) header('Content-Type: text/plain');

// Try secure config first, fall back to env constants
$secureConfig = '/home1/wmdadmin/secure_config/db_config.php';
if (file_exists($secureConfig)) {
    require $secureConfig;
} else {
    // Read from .env file directly to avoid framework bootstrap in CLI
    $envFile = dirname(__DIR__) . '/.env';
    if (file_exists($envFile)) {
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            if (str_starts_with(trim($line), '#')) continue;
            if (!str_contains($line, '=')) continue;
            [$k, $v] = explode('=', $line, 2);
            $k = trim($k); $v = trim($v);
            if (!defined($k)) define($k, $v);
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

$steps = [];
function run(PDO $pdo, string $sql, string $label): void {
    global $steps;
    try {
        $pdo->exec($sql);
        $steps[] = "OK: $label";
    } catch (PDOException $e) {
        $msg = $e->getMessage();
        if (str_contains($msg, 'already exists') || str_contains($msg, 'Duplicate')) {
            $steps[] = "SKIP (already exists): $label";
        } else {
            $steps[] = "ERROR: $label — $msg";
        }
    }
}

// ── Create PromoCode table ────────────────────────────────────────────────────
run($pdo, "
CREATE TABLE IF NOT EXISTS \`PromoCode\` (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  code           VARCHAR(100) NOT NULL,
  name           VARCHAR(255) NULL,
  discountPercent DECIMAL(5,2) NOT NULL DEFAULT 0,
  applicablePlans JSON NULL COMMENT 'NULL = all plans; JSON array of planIds = specific plans',
  status         VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  usesLimit      INT NULL COMMENT 'NULL = unlimited',
  usesCount      INT NOT NULL DEFAULT 0,
  expiresAt      DATETIME NULL,
  createdAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_promo_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
", 'Create PromoCode table');

echo implode("\n", $steps) . "\n\nDone.\n";

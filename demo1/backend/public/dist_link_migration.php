<?php
/**
 * One-shot migration: adds linkedUserId column to Distributor table.
 * Token gate: CMQ0LSJR84JZIH9PARSR5X9XYU2TPREV
 */

$token = $_GET['token'] ?? '';
if ($token !== 'CMQ0LSJR84JZIH9PARSR5X9XYU2TPREV') {
    http_response_code(403);
    exit('Forbidden');
}

require_once '/home1/wmdadmin/secure_config/db_config.php';

try {
    $pdo = new PDO(
        "mysql:host={$db_host};dbname={$db_name};charset=utf8mb4",
        $db_user,
        $db_pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    http_response_code(500);
    exit('DB connection failed: ' . $e->getMessage());
}

// Check if column already exists
$stmt = $pdo->prepare(
    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'Distributor' AND COLUMN_NAME = 'linkedUserId'"
);
$stmt->execute([':db' => $db_name]);
$exists = (int) $stmt->fetchColumn();

if ($exists) {
    echo "Column linkedUserId already exists in Distributor table. Nothing to do.\n";
    exit;
}

$pdo->exec('ALTER TABLE `Distributor` ADD COLUMN `linkedUserId` INT DEFAULT NULL');
echo "Success: linkedUserId column added to Distributor table.\n";

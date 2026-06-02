<?php
$token = $_GET['token'] ?? '';
if ($token !== 'CMQ0LSJR84JZIH9PARSR5X9XYU2TPREV') { http_response_code(403); die('Forbidden'); }
define('BASE_PATH', __DIR__ . '/..');
require BASE_PATH . '/config/env.php';
require BASE_PATH . '/config/database.php';
$pdo = Database::getConnection();

$pdo->exec("
    CREATE TABLE IF NOT EXISTS `PendingCheckout` (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        referenceNumber VARCHAR(100) NOT NULL UNIQUE,
        zohoSessionId   VARCHAR(200),
        planId          INT NOT NULL,
        amount          DECIMAL(10,2) NOT NULL,
        billingPeriod   VARCHAR(20) NOT NULL DEFAULT 'yearly',
        customerEmail   VARCHAR(255) NOT NULL,
        customerName    VARCHAR(255),
        customerPhone   VARCHAR(50),
        checkoutMeta    TEXT,
        status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        zohoPaymentId   VARCHAR(200),
        createdUserId   INT,
        createdAt       DATETIME NOT NULL DEFAULT NOW(),
        updatedAt       DATETIME NOT NULL DEFAULT NOW(),
        INDEX idx_ref (referenceNumber),
        INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

echo json_encode(['ok' => true, 'message' => 'PendingCheckout table created']);

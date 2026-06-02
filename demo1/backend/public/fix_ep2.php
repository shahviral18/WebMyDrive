<?php
$token = $_GET['token'] ?? '';
if ($token !== 'CMQ0LSJR84JZIH9PARSR5X9XYU2TPREV') { http_response_code(403); die('Forbidden'); }
define('BASE_PATH', __DIR__ . '/..');
require BASE_PATH . '/config/env.php';
require BASE_PATH . '/config/database.php';
$pdo = Database::getConnection();
$stmt = $pdo->prepare('UPDATE `Plan` SET hasOverride=1, updatedAt=NOW() WHERE id=5');
$stmt->execute();
echo json_encode(['updated' => $stmt->rowCount(), 'ok' => true]);

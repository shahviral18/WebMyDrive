<?php
$token = $_GET['token'] ?? '';
if ($token !== 'CMQ0LSJR84JZIH9PARSR5X9XYU2TPREV') { http_response_code(403); die('Forbidden'); }

define('BASE_PATH', __DIR__ . '/..');
require BASE_PATH . '/config/env.php';
require BASE_PATH . '/config/database.php';

$pdo = Database::getConnection();
$stmt = $pdo->query('SELECT id, name, price, priceINR, priceMonthlyINR, storageGB FROM `Plan` WHERE id=5');
$row = $stmt->fetch(PDO::FETCH_ASSOC);
echo json_encode($row);

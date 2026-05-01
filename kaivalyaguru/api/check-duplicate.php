<?php
require_once dirname(__DIR__) . '/db.php';

header('Content-Type: application/json');

$mobile = trim($_GET['mobile'] ?? '');
$email  = trim($_GET['email']  ?? '');

if ($mobile) {
    $stmt = db()->prepare('SELECT id FROM kg_entries WHERE mobile = ? LIMIT 1');
    $stmt->execute([$mobile]);
    echo json_encode(['exists' => (bool) $stmt->fetch()]);
    exit;
}

if ($email) {
    $stmt = db()->prepare('SELECT id FROM kg_entries WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    echo json_encode(['exists' => (bool) $stmt->fetch()]);
    exit;
}

echo json_encode(['exists' => false]);

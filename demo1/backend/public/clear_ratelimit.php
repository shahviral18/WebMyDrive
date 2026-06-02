<?php
$pdo = new PDO(
    'mysql:host=localhost;dbname=wmdadmin_webmydrive;charset=utf8mb4',
    'wmdadmin_wmd',
    'tHNOUPKVQgah5oTWcwwjb2LX'
);
$stmt = $pdo->prepare("DELETE FROM AuditLog WHERE action = 'LOGIN_ATTEMPT' AND createdAt > DATE_SUB(NOW(), INTERVAL 2 HOUR)");
$stmt->execute();
echo json_encode(['cleared' => $stmt->rowCount()]);

<?php
$pdo = new PDO('mysql:host=localhost;dbname=wmdadmin_webmydrive;charset=utf8mb4','wmdadmin_wmd','tHNOUPKVQgah5oTWcwwjb2LX');
$hash = password_hash('Welcome@123', PASSWORD_BCRYPT);
$stmt = $pdo->prepare("UPDATE Distributor SET passwordHash=? WHERE email='testviralshah@webmydrive.com'");
$stmt->execute([$hash]);
echo json_encode(['updated'=>$stmt->rowCount()]);

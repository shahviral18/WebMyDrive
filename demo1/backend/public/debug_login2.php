<?php
$pdo = new PDO('mysql:host=localhost;dbname=wmdadmin_webmydrive;charset=utf8mb4','wmdadmin_wmd','tHNOUPKVQgah5oTWcwwjb2LX', [PDO::MYSQL_ATTR_INIT_COMMAND => "SET sql_mode='ANSI_QUOTES'"]);
$stmt = $pdo->prepare('SELECT id, email, isDisabled, passwordResetRequired, role, walletBalance FROM "User" WHERE email = :e');
$stmt->execute([':e' => 'testviralshah@webmydrive.com']);
$user = $stmt->fetch(PDO::FETCH_ASSOC);
echo json_encode($user);

<?php
$pdo = new PDO('mysql:host=localhost;dbname=wmdadmin_webmydrive;charset=utf8mb4','wmdadmin_wmd','tHNOUPKVQgah5oTWcwwjb2LX', [PDO::MYSQL_ATTR_INIT_COMMAND => "SET sql_mode='ANSI_QUOTES'"]);
$stmt = $pdo->prepare('SELECT id, email, passwordHash FROM "User" WHERE email = :e');
$stmt->execute([':e' => 'testviralshah@webmydrive.com']);
$user = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$user) { echo "USER NOT FOUND with ANSI_QUOTES"; exit; }
echo "found user id=".$user['id']."\n";
echo "hash len=".strlen($user['passwordHash'])."\n";
echo "verify=".( password_verify('Welcome@123', $user['passwordHash']) ? 'YES' : 'NO' )."\n";

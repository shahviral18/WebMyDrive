<?php
$pdo = new PDO('mysql:host=localhost;dbname=wmdadmin_webmydrive;charset=utf8mb4','wmdadmin_wmd','tHNOUPKVQgah5oTWcwwjb2LX',[PDO::MYSQL_ATTR_INIT_COMMAND=>"SET sql_mode='ANSI_QUOTES'",PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);

$email = 'testviralshah@webmydrive.com';
$password = 'Welcome@123';

$stmt = $pdo->prepare('SELECT * FROM "User" WHERE email = :e');
$stmt->execute([':e' => $email]);
$user = $stmt->fetch();

if (!$user) { echo "FAIL: user not found"; exit; }
echo "found id=".$user['id']."\n";
echo "hashLen=".strlen($user['passwordHash']??'')."\n";
echo "verify=".(password_verify($password,$user['passwordHash']??'')?'YES':'NO')."\n";
echo "isDisabled=".var_export($user['isDisabled']??'N/A',true)."\n";
echo "role=".$user['role']."\n";

// check distributor match too
$stmt2 = $pdo->prepare('SELECT id FROM "Distributor" WHERE email = :e');
$stmt2->execute([':e'=>$email]);
$dist = $stmt2->fetch();
echo "distributor_match=".($dist?'YES':'NO')."\n";

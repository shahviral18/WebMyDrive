<?php
$pdo = new PDO('mysql:host=localhost;dbname=wmdadmin_webmydrive;charset=utf8mb4','wmdadmin_wmd','tHNOUPKVQgah5oTWcwwjb2LX');
$stmt = $pdo->prepare("SELECT passwordHash FROM User WHERE email = 'testviralshah@webmydrive.com'");
$stmt->execute();
$row = $stmt->fetch(PDO::FETCH_ASSOC);
$hash = $row['passwordHash'];
$passwords = ['Welcome@123', 'Test@1234'];
foreach ($passwords as $p) {
    echo $p . ': ' . (password_verify($p, $hash) ? 'MATCH' : 'no') . "\n";
}
echo 'hash: ' . $hash;

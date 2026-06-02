<?php
$pdo = new PDO('mysql:host=localhost;dbname=wmdadmin_webmydrive;charset=utf8mb4','wmdadmin_wmd','tHNOUPKVQgah5oTWcwwjb2LX');
$stmt = $pdo->prepare("SELECT id, email, displayEmail, LEFT(passwordHash,20) as hashStart, passwordHash IS NULL as noHash, LENGTH(passwordHash) as hashLen FROM User WHERE email LIKE '%testviralshah%' OR displayEmail LIKE '%testviralshah%'");
$stmt->execute();
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));

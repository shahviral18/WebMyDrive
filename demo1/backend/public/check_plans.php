<?php
$pdo = new PDO('mysql:host=localhost;dbname=wmdadmin_webmydrive;charset=utf8mb4','wmdadmin_wmd','tHNOUPKVQgah5oTWcwwjb2LX');
$stmt = $pdo->query("SELECT id, name, price, monthlyPrice, yearlyPrice, priceMonthlyINR, priceINR, sortOrder FROM Plan WHERE isActive=1 ORDER BY sortOrder, id");
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT);

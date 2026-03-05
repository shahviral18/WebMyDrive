<?php
$dbPath = __DIR__ . '/dev.db';
$pdo = new PDO("sqlite:$dbPath");
$hash = password_hash('admin123', PASSWORD_BCRYPT, ['cost' => 10]);
$pdo->prepare('UPDATE "User" SET passwordHash = ? WHERE email = ?')->execute([$hash, 'admin@webmydrive.com']);
echo "Password updated successfully.\n";

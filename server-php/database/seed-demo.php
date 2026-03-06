<?php
/**
 * seed-demo.php — Add demo User and Distributor accounts
 * Usage: php server-php/database/seed-demo.php
 */

declare(strict_types=1);

$dbPath = __DIR__ . '/dev.db';

if (!file_exists($dbPath)) {
    die("❌ Database not found at: $dbPath\nRun migrate.php first.\n");
}

$pdo = new PDO("sqlite:$dbPath", null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);
$pdo->exec('PRAGMA foreign_keys=ON;');

$password = 'admin123';
$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);

// ── Demo User ─────────────────────────────────────────────────────────────────
$check = $pdo->prepare('SELECT id FROM "User" WHERE email = ?');
$check->execute(['user@webmydrive.com']);
if (!$check->fetch()) {
    $pdo->prepare(
        'INSERT INTO "User" (name, email, displayEmail, passwordHash, role, referralCode, walletBalance, passwordResetRequired, first_login, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, datetime(\'now\'), datetime(\'now\'))'
    )->execute(['Demo User', 'user@webmydrive.com', 'demo@webmydrive.com', $hash, 'USER', 'DEMOUSER']);
    echo "✅ Demo USER created: user@webmydrive.com / admin123\n";
} else {
    // Update password in case it changed
    $pdo->prepare('UPDATE "User" SET passwordHash = ?, updatedAt = datetime(\'now\') WHERE email = ?')
        ->execute([$hash, 'user@webmydrive.com']);
    echo "ℹ️  Demo USER already exists — password reset to: admin123\n";
}

// ── Demo Distributor ──────────────────────────────────────────────────────────
$check2 = $pdo->prepare('SELECT id FROM "Distributor" WHERE email = ?');
$check2->execute(['distributor@webmydrive.com']);
if (!$check2->fetch()) {
    $pdo->prepare(
        'INSERT INTO "Distributor" (name, email, displayEmail, passwordHash, referralCode, walletBalance, status, passwordResetRequired, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 0, \'ACTIVE\', 0, datetime(\'now\'), datetime(\'now\'))'
    )->execute(['Demo Distributor', 'distributor@webmydrive.com', 'partner@webmydrive.com', $hash, 'DEMODIST']);
    echo "✅ Demo DISTRIBUTOR created: distributor@webmydrive.com / admin123\n";
} else {
    $pdo->prepare('UPDATE "Distributor" SET passwordHash = ?, updatedAt = datetime(\'now\') WHERE email = ?')
        ->execute([$hash, 'distributor@webmydrive.com']);
    echo "ℹ️  Demo DISTRIBUTOR already exists — password reset to: admin123\n";
}

echo "\n🎉 Done! Demo credentials:\n";
echo "──────────────────────────────────────────\n";
echo "ADMIN       : admin@webmydrive.com / admin123\n";
echo "USER        : user@webmydrive.com  / admin123\n";
echo "DISTRIBUTOR : distributor@webmydrive.com / admin123\n";
echo "──────────────────────────────────────────\n";

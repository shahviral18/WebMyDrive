<?php
// Uses the backend's own .env loader — same as the live app
require_once __DIR__ . '/../config/env.php';

$pdo = new PDO(
    "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
    DB_USER, DB_PASS,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

echo "<pre>\n=== Admin User Check ===\n\n";

// Check existing admin users
$admins = $pdo->query(
    "SELECT id, name, email, role, passwordResetRequired, isDisabled, createdAt
     FROM `User` WHERE role IN ('ADMIN','SUPERADMIN')"
)->fetchAll(PDO::FETCH_ASSOC);

if (empty($admins)) {
    echo "No ADMIN/SUPERADMIN users found. Creating one...\n\n";
    $hash = password_hash('Admin@2026!', PASSWORD_BCRYPT, ['cost' => 10]);
    $pdo->prepare(
        "INSERT INTO `User` (name, email, passwordHash, role, referralCode, walletBalance,
         passwordResetRequired, first_login, createdAt, updatedAt)
         VALUES ('Super Admin','admin@webmydrive.com',:hash,'SUPERADMIN','ADMIN2026',0,0,0,NOW(),NOW())"
    )->execute([':hash' => $hash]);
    echo "✅ Created: admin@webmydrive.com / Admin@2026!\n";
} else {
    echo "Found " . count($admins) . " admin(s):\n";
    foreach ($admins as $a) {
        echo "  id={$a['id']} email={$a['email']} role={$a['role']} disabled={$a['isDisabled']}\n";
    }

    // Reset password for first admin found (ensure it's not disabled)
    $admin = $admins[0];
    $hash = password_hash('Admin@2026!', PASSWORD_BCRYPT, ['cost' => 10]);
    $pdo->prepare(
        "UPDATE `User` SET passwordHash=:h, passwordResetRequired=0, isDisabled=0 WHERE id=:id"
    )->execute([':h' => $hash, ':id' => $admin['id']]);
    echo "\n✅ Password reset to: Admin@2026! for {$admin['email']}\n";
}

// Also check for login 500 cause: missing first_login column
$cols = $pdo->query("SHOW COLUMNS FROM `User` LIKE 'first_login'")->fetchAll();
if (empty($cols)) {
    $pdo->exec("ALTER TABLE `User` ADD COLUMN `first_login` TINYINT(1) NOT NULL DEFAULT 0");
    echo "✅ Added missing first_login column\n";
} else {
    echo "✅ first_login column exists\n";
}

// Check AuditLog table (used by rate limiter)
$auditExists = $pdo->query(
    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='AuditLog'"
)->fetchColumn();
if (!$auditExists) {
    $pdo->exec("CREATE TABLE `AuditLog` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        userId INT NULL,
        ip VARCHAR(50) NULL,
        details TEXT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_al_ip_action (ip, action, createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    echo "✅ Created missing AuditLog table\n";
} else {
    echo "✅ AuditLog table exists\n";
}

echo "\n=== Done ===\n</pre>";

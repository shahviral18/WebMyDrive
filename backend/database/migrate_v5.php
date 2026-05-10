<?php
/**
 * migrate_v5.php — Invoice attachment system.
 *
 * Creates the `invoices` table for storing historical and system-generated
 * invoice records with optional PDF attachment.
 *
 * Run once on the production MySQL server via browser or CLI:
 *   php backend/database/migrate_v5.php
 *
 * Safe to re-run — all statements use IF NOT EXISTS.
 */

declare(strict_types=1);

$host   = getenv('DB_HOST')   ?: 'localhost';
$dbname = getenv('DB_NAME')   ?: 'webmydrive';
$user   = getenv('DB_USER')   ?: 'root';
$pass   = getenv('DB_PASS')   ?: '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
} catch (PDOException $e) {
    die("DB connection failed: " . $e->getMessage() . "\n");
}

$steps = [];

// ── Create invoices table ─────────────────────────────────────────────────────
$pdo->exec("
    CREATE TABLE IF NOT EXISTS `invoices` (
        `id`            INT AUTO_INCREMENT PRIMARY KEY,
        `userId`        INT NOT NULL,
        `orderId`       INT NULL,
        `invoiceNumber` VARCHAR(100) NOT NULL,
        `invoiceDate`   DATE NOT NULL,
        `dueDate`       DATE NULL,
        `paymentDate`   DATE NULL,
        `expiryDate`    DATE NULL,
        `renewalDate`   DATE NULL,
        `planName`      VARCHAR(255) NULL,
        `itemDetails`   TEXT NULL,
        `baseAmount`    DECIMAL(12,2) NULL,
        `gstAmount`     DECIMAL(12,2) NULL,
        `totalAmount`   DECIMAL(12,2) NULL,
        `currency`      VARCHAR(10) NOT NULL DEFAULT 'INR',
        `status`        VARCHAR(20) NOT NULL DEFAULT 'PAID',
        `pdfPath`       VARCHAR(500) NULL,
        `source`        VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
        `notes`         TEXT NULL,
        `createdBy`     INT NULL,
        `createdAt`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updatedAt`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT `fk_invoices_user` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");
$steps[] = "✅ Created `invoices` table (or already existed)";

// ── Summary ───────────────────────────────────────────────────────────────────
echo implode("\n", $steps) . "\n\nMigration v5 complete.\n";

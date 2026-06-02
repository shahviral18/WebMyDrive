<?php
/**
 * One-shot migration script — v3: Custom referral code support
 *
 * Adds `referralCodeChanges` to User table to track how many times
 * a user has changed their referral code (limit: 2).
 *
 * Usage: https://webmydrive.com/demo1/backend/public/migrate_v3.php?token=WMD_MIGRATE_V3_REF_CODE_CHANGES
 *
 * IMPORTANT: This script renames itself to migrate_v3.done after a successful run
 *            so it cannot be executed a second time.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

// ── Token guard ───────────────────────────────────────────────────────────────
$expected = 'WMD_MIGRATE_V3_REF_CODE_CHANGES';
$given    = $_GET['token'] ?? '';

if (!hash_equals($expected, $given)) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
define('BASE_PATH', dirname(__DIR__));
require BASE_PATH . '/config/env.php';

$dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME);
try {
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'DB connect failed: ' . $e->getMessage()]);
    exit;
}

// ── Migration statements ──────────────────────────────────────────────────────
$statements = [
    "ALTER TABLE `User` ADD COLUMN `referralCodeChanges` INT NOT NULL DEFAULT 0 AFTER `referralCode`",
];

$results = [];
foreach ($statements as $sql) {
    try {
        $pdo->exec($sql);
        $results[] = ['sql' => $sql, 'status' => 'added'];
    } catch (PDOException $e) {
        $results[] = ['sql' => $sql, 'status' => ($e->getCode() === '42S21') ? 'already_exists' : 'error', 'message' => $e->getMessage()];
    }
}

// ── Self-neutralize ───────────────────────────────────────────────────────────
$selfPath = __FILE__;
$donePath = str_replace('.php', '.done', $selfPath);
@rename($selfPath, $donePath);

echo json_encode([
    'success'  => true,
    'migrated' => $results,
    'note'     => 'Script has been neutralized (renamed to .done).',
], JSON_PRETTY_PRINT);

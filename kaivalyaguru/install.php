<?php
/**
 * Kaivalya Guru — DB Installer
 * ─────────────────────────────
 * 1. Upload this file to your server (same folder as config.php)
 * 2. Fill in DB_HOST, DB_NAME, DB_USER, DB_PASS in config.php first
 * 3. Open https://webmydrive.com/kaivalyaguru/install.php in your browser
 * 4. DELETE this file after successful installation
 */

// ── Simple access lock — change this before uploading ────────────────────────
define('INSTALL_KEY', 'kaivalya2025');

$key = $_GET['key'] ?? '';
if ($key !== INSTALL_KEY) {
    http_response_code(403);
    die('<h2 style="font-family:sans-serif;color:#c00">Access denied.<br><small>Add ?key=kaivalya2025 to the URL</small></h2>');
}

require_once __DIR__ . '/config.php';

$steps = [];

// ── Step 1: Connect (DB must already exist in cPanel MySQL Databases) ─────────
try {
    $dsn = 'mysql:host=' . DB_HOST . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $steps[] = ['ok', 'Connected to MySQL server as <strong>' . htmlspecialchars(DB_USER) . '</strong>'];
} catch (PDOException $e) {
    $steps[] = ['fail', 'Cannot connect to MySQL: ' . htmlspecialchars($e->getMessage())];
    render($steps); exit;
}

// ── Step 2: Select / create database ─────────────────────────────────────────
try {
    $pdo->exec('CREATE DATABASE IF NOT EXISTS `' . DB_NAME . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $pdo->exec('USE `' . DB_NAME . '`');
    $steps[] = ['ok', 'Database <strong>' . htmlspecialchars(DB_NAME) . '</strong> ready'];
} catch (PDOException $e) {
    // On shared hosting CREATE DATABASE may be denied — try USE only
    try {
        $pdo->exec('USE `' . DB_NAME . '`');
        $steps[] = ['warn', 'Could not auto-create database (shared hosting restriction). Using existing <strong>' . htmlspecialchars(DB_NAME) . '</strong>'];
    } catch (PDOException $e2) {
        $steps[] = ['fail', 'Database error: ' . htmlspecialchars($e2->getMessage()) . '<br><em>Create the database manually in cPanel → MySQL Databases, then re-run.</em>'];
        render($steps); exit;
    }
}

// ── Step 3: Create table ──────────────────────────────────────────────────────
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS kg_entries (
          id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          first_name   VARCHAR(100)  NOT NULL,
          last_name    VARCHAR(100)  NOT NULL,
          email        VARCHAR(255)  NOT NULL,
          mobile       VARCHAR(15)   NOT NULL,
          dob          DATE          NOT NULL,
          feedback     TEXT,
          coupon_code  VARCHAR(20)   DEFAULT NULL,
          prize        VARCHAR(255)  DEFAULT NULL,
          has_spun     TINYINT(1)    NOT NULL DEFAULT 0,
          created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_email  (email),
          UNIQUE KEY uq_mobile (mobile)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $steps[] = ['ok', 'Table <strong>kg_entries</strong> created (or already exists)'];
} catch (PDOException $e) {
    $steps[] = ['fail', 'Table creation failed: ' . htmlspecialchars($e->getMessage())];
    render($steps); exit;
}

// ── Step 4: Verify ────────────────────────────────────────────────────────────
try {
    $stmt = $pdo->query("SELECT COUNT(*) FROM kg_entries");
    $count = $stmt->fetchColumn();
    $steps[] = ['ok', "Table verified — <strong>{$count}</strong> existing entries"];
} catch (PDOException $e) {
    $steps[] = ['fail', 'Verification failed: ' . htmlspecialchars($e->getMessage())];
}

$steps[] = ['done', '✅ Installation complete! <strong>Delete install.php</strong> from your server now.'];

render($steps);

// ── Render ────────────────────────────────────────────────────────────────────
function render(array $steps): void {
    $icons = ['ok' => '✅', 'warn' => '⚠️', 'fail' => '❌', 'done' => ''];
    $colors = ['ok' => '#2E7D32', 'warn' => '#b45309', 'fail' => '#C62828', 'done' => '#1565C0'];
    echo '<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>KG Installer</title>
    <style>
      body{font-family:Arial,sans-serif;background:#f0f4ff;padding:40px 20px}
      .card{background:#fff;border-radius:12px;padding:32px 36px;max-width:560px;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,.1)}
      h2{color:#1565C0;margin-bottom:24px}
      .step{padding:10px 14px;margin-bottom:10px;border-radius:8px;font-size:.95rem;border-left:4px solid}
      .ok   {background:#f0fdf4;border-color:#2E7D32;color:#2E7D32}
      .warn {background:#fffbeb;border-color:#f59e0b;color:#b45309}
      .fail {background:#fef2f2;border-color:#C62828;color:#C62828}
      .done {background:#eff6ff;border-color:#1565C0;color:#1565C0;font-weight:700}
    </style></head><body><div class="card"><h2>Kaivalya Guru — DB Installer</h2>';
    foreach ($steps as [$type, $msg]) {
        echo "<div class=\"step {$type}\">{$icons[$type]} {$msg}</div>";
    }
    echo '</div></body></html>';
}

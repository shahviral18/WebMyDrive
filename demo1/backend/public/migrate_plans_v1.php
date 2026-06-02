<?php
/**
 * migrate_plans_v1.php — One-shot migration: Plans page DB additions
 * Token-gated. Self-renames to .done after success.
 * Run: https://webmydrive.com/demo1/backend/public/migrate_plans_v1.php?token=CMQ0LSJR84JZIH9PARSR5X9XYU2TPREV
 */
declare(strict_types=1);

if (($_GET['token'] ?? '') !== 'CMQ0LSJR84JZIH9PARSR5X9XYU2TPREV') {
    http_response_code(403); echo 'Forbidden'; exit;
}

header('Content-Type: text/plain');

define('BASE_PATH', dirname(__DIR__));
require BASE_PATH . '/config/env.php';

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $pdo->exec("SET sql_mode='ANSI_QUOTES'");
} catch (PDOException $e) {
    echo 'DB connect failed: ' . $e->getMessage(); exit;
}

$steps = [];

function run(PDO $pdo, string $sql, string $label): void {
    global $steps;
    try {
        $pdo->exec($sql);
        $steps[] = "OK: $label";
    } catch (PDOException $e) {
        $msg = $e->getMessage();
        // Duplicate column = already applied, treat as OK
        if (str_contains($msg, 'Duplicate column') || str_contains($msg, 'already exists')) {
            $steps[] = "SKIP (already exists): $label";
        } else {
            $steps[] = "FAIL: $label — $msg";
        }
    }
}

// ── Plan table ────────────────────────────────────────────────────────────────
run($pdo, 'ALTER TABLE "Plan" ADD COLUMN `sortOrder` INT NOT NULL DEFAULT 0', 'Plan.sortOrder');
run($pdo, 'ALTER TABLE "Plan" ADD COLUMN `googleOrgUnit` VARCHAR(255) NULL', 'Plan.googleOrgUnit');

// ── Order table ───────────────────────────────────────────────────────────────
run($pdo, 'ALTER TABLE "Order" ADD COLUMN `billingPeriod` VARCHAR(10) NOT NULL DEFAULT \'yearly\'', 'Order.billingPeriod');
run($pdo, 'ALTER TABLE "Order" ADD COLUMN `baseAmount` DECIMAL(12,2) NULL', 'Order.baseAmount');
run($pdo, 'ALTER TABLE "Order" ADD COLUMN `gstAmount` DECIMAL(12,2) NULL', 'Order.gstAmount');
run($pdo, 'ALTER TABLE "Order" ADD COLUMN `orderType` VARCHAR(20) NOT NULL DEFAULT \'NEW\'', 'Order.orderType');
run($pdo, 'ALTER TABLE "Order" ADD COLUMN `promoCode` VARCHAR(100) NULL', 'Order.promoCode');
run($pdo, 'ALTER TABLE "Order" ADD COLUMN `discountAmount` DECIMAL(12,2) NOT NULL DEFAULT 0', 'Order.discountAmount');
run($pdo, 'ALTER TABLE "Order" ADD COLUMN `fromPlanId` INT NULL', 'Order.fromPlanId');

// ── Workspace table ───────────────────────────────────────────────────────────
run($pdo, 'ALTER TABLE "Workspace" ADD COLUMN `billingPeriod` VARCHAR(10) NOT NULL DEFAULT \'yearly\'', 'Workspace.billingPeriod');
run($pdo, 'ALTER TABLE "Workspace" ADD COLUMN `nextPlanId` INT NULL', 'Workspace.nextPlanId');
run($pdo, 'ALTER TABLE "Workspace" ADD COLUMN `baseAmountPaid` DECIMAL(12,2) NULL', 'Workspace.baseAmountPaid');

// ── Subscription table ────────────────────────────────────────────────────────
run($pdo, 'ALTER TABLE "Subscription" ADD COLUMN `planId` INT NULL', 'Subscription.planId');
run($pdo, 'ALTER TABLE "Subscription" ADD COLUMN `billingPeriod` VARCHAR(10) NOT NULL DEFAULT \'yearly\'', 'Subscription.billingPeriod');

// ── Backfill existing Orders: derive baseAmount/gstAmount from amount ─────────
try {
    $updated = $pdo->exec('UPDATE "Order" SET baseAmount = ROUND(amount / 1.18, 2), gstAmount = ROUND(amount - (amount / 1.18), 2) WHERE baseAmount IS NULL AND amount > 0');
    $steps[] = "OK: Backfilled $updated Order rows with baseAmount/gstAmount";
} catch (PDOException $e) {
    $steps[] = 'FAIL: Order backfill — ' . $e->getMessage();
}

echo implode("\n", $steps) . "\n\nMigration complete.\n";

// Self-destruct
@rename(__FILE__, __FILE__ . '.done');

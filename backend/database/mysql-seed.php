<?php
/**
 * mysql-seed.php — Seed MySQL database with admin user, demo accounts, plans, and config.
 *
 * Usage (CLI):  php backend/database/mysql-seed.php
 *
 * Requires: mysql-schema.sql already imported via phpMyAdmin.
 */

declare(strict_types=1);

require __DIR__ . '/../config/env.php';
require __DIR__ . '/../config/database.php';

header('Content-Type: text/plain; charset=utf-8');

echo "=== WebMyDrive MySQL Seed ===\n\n";

// ── 1. Seed SUPERADMIN ──────────────────────────────────────────────────────
$email = 'admin@webmydrive.com';
$existing = Database::queryOne('SELECT id FROM "User" WHERE email = :e', [':e' => $email]);
if (!$existing) {
    $hash = password_hash('Admin@2026!', PASSWORD_BCRYPT, ['cost' => 10]);
    Database::insert(
        'INSERT INTO "User" (name, email, passwordHash, role, referralCode, walletBalance, passwordResetRequired, first_login, createdAt, updatedAt)
         VALUES (:name, :email, :hash, :role, :ref, 0, 0, 0, NOW(), NOW())',
        [':name' => 'Super Admin', ':email' => $email, ':hash' => $hash, ':role' => 'SUPERADMIN', ':ref' => 'ADMIN2026']
    );
    echo "Created SUPERADMIN: $email / Admin@2026!\n";
} else {
    echo "SUPERADMIN already exists, skipping.\n";
}

// ── 2. Seed demo USER ───────────────────────────────────────────────────────
$demoEmail = 'user@webmydrive.com';
$existing = Database::queryOne('SELECT id FROM "User" WHERE email = :e', [':e' => $demoEmail]);
if (!$existing) {
    $hash = password_hash('Admin@2026!', PASSWORD_BCRYPT, ['cost' => 10]);
    Database::insert(
        'INSERT INTO "User" (name, email, displayEmail, passwordHash, role, referralCode, walletBalance, passwordResetRequired, first_login, createdAt, updatedAt)
         VALUES (:name, :email, :display, :hash, :role, :ref, 0, 0, 0, NOW(), NOW())',
        [':name' => 'Demo User', ':email' => $demoEmail, ':display' => 'demo@webmydrive.com', ':hash' => $hash, ':role' => 'USER', ':ref' => 'DEMOUSER']
    );
    echo "Created demo USER: $demoEmail / Admin@2026!\n";
} else {
    echo "Demo USER already exists, skipping.\n";
}

// ── 3. Seed demo DISTRIBUTOR ────────────────────────────────────────────────
$distEmail = 'distributor@webmydrive.com';
$existing = Database::queryOne('SELECT id FROM "Distributor" WHERE email = :e', [':e' => $distEmail]);
if (!$existing) {
    $hash = password_hash('Admin@2026!', PASSWORD_BCRYPT, ['cost' => 10]);
    Database::insert(
        'INSERT INTO "Distributor" (name, email, displayEmail, passwordHash, referralCode, walletBalance, status, passwordResetRequired, createdAt, updatedAt)
         VALUES (:name, :email, :display, :hash, :ref, 0, :status, 0, NOW(), NOW())',
        [':name' => 'Demo Distributor', ':email' => $distEmail, ':display' => 'partner@webmydrive.com', ':hash' => $hash, ':ref' => 'DEMODIST', ':status' => 'ACTIVE']
    );
    echo "Created demo DISTRIBUTOR: $distEmail / Admin@2026!\n";
} else {
    echo "Demo DISTRIBUTOR already exists, skipping.\n";
}

// ── 4. Seed AdminConfig defaults ────────────────────────────────────────────
$configs = [
    ['user_referral_percent', '10'],
    ['distributor_referral_percent', '20'],
    ['promo_discount_percent', '15'],
    ['referral_credit_type', 'WALLET'],
    ['max_wallet_balance', '10000'],
];
foreach ($configs as [$k, $v]) {
    $exists = Database::queryOne('SELECT id FROM "AdminConfig" WHERE `key` = :k', [':k' => $k]);
    if (!$exists) {
        Database::insert(
            'INSERT INTO "AdminConfig" (`key`, value, updatedAt) VALUES (:k, :v, NOW())',
            [':k' => $k, ':v' => $v]
        );
        echo "Config: $k = $v\n";
    }
}

// ── 5. Seed Plans ───────────────────────────────────────────────────────────
$plans = [
    ['Cloud Storage - Basic',        3000, 3000, 36000,  500,   1,  'basic_500gb',       '["500 GB Combined Storage","1 User","Standard Support"]'],
    ['Cloud Storage - Professional',  5000, 5000, 60000,  5000,  5,  'professional_5tb',  '["5 TB Combined Storage","Up to 5 Users","Priority Support"]'],
    ['Cloud Storage - Premium',       9000, 9000, 108000, 50000, 20, 'premium_50tb',      '["50 TB Combined Storage","Up to 20 Users","24/7 Premium Support","Advanced Admin Controls"]'],
    ['Cloud Storage - Enterprise',   15000,15000, 180000,100000,100, 'enterprise_100tb',  '["100 TB Combined Storage","Unlimited Users","Dedicated Account Manager","Custom SLA","White-label Options"]'],
];
foreach ($plans as [$name, $price, $monthly, $yearly, $storage, $maxUsers, $sku, $features]) {
    $exists = Database::queryOne('SELECT id FROM "Plan" WHERE name = :n', [':n' => $name]);
    if (!$exists) {
        Database::insert(
            'INSERT INTO "Plan" (name, price, priceINR, priceMonthlyINR, priceYearlyINR, storage, storageGB, maxUsers, isVisible, isActive, hasOverride, googleSKU, features, createdAt, updatedAt)
             VALUES (:name, :price, :priceINR, :monthly, :yearly, :storage, :storageGB, :maxUsers, 1, 1, 1, :sku, :features, NOW(), NOW())',
            [':name' => $name, ':price' => $price, ':priceINR' => $price, ':monthly' => $monthly, ':yearly' => $yearly,
             ':storage' => $storage, ':storageGB' => $storage, ':maxUsers' => $maxUsers, ':sku' => $sku, ':features' => $features]
        );
        echo "Plan: $name\n";
    }
}

echo "\n=== Seed complete ===\n";
echo "\nCredentials (all accounts): Admin@2026!\n";
echo "  admin@webmydrive.com (SUPERADMIN)\n";
echo "  user@webmydrive.com (USER)\n";
echo "  distributor@webmydrive.com (DISTRIBUTOR)\n";

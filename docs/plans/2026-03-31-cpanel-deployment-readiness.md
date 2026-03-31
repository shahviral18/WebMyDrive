# cPanel Deployment Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the WebMyDrive app secure and deployable to test.webmydrive.com at `/home4/wmdtest/public_html/WebMyDrive/demo/1/` via cPanel API token.

**Architecture:** PHP backend sits inside `public_html` but all non-public directories are protected by `.htaccess` deny rules. Database credentials load from env with a `secure_config` fallback for production. Frontend builds with correct base path and env-based API URLs. Stripe references removed (only Razorpay / Zoho Payments). MySQL schema generated from existing SQLite migration.

**Tech Stack:** PHP 8.1+ (MySQL/PDO), React 18 + Vite + TypeScript, Razorpay payments, cPanel UAPI for deployment

**Test domain:** `https://test.webmydrive.com`  
**Deploy path:** `/home4/wmdtest/public_html/WebMyDrive/demo/1/`  
**cPanel user:** `wmdtest`

---

## Task 1: Fix database.php — Load credentials from env/secure_config

**Files:**
- Modify: `backend/config/database.php` (entire `getConnection()` method, lines 22-36)
- Modify: `backend/config/env.php:45-47` (add MySQL env vars)
- Modify: `backend/.env` (add DB_HOST, DB_NAME, DB_USER, DB_PASS)
- Modify: `backend/.env.example` (add DB_HOST, DB_NAME, DB_USER, DB_PASS)

**Step 1: Add MySQL env vars to `backend/config/env.php`**

Replace the SQLite DB_PATH section (lines 45-47) with:

```php
// ── Database (MySQL) ─────────────────────────────────────────────────────────
define('DB_HOST',     env('DB_HOST', 'localhost'));
define('DB_NAME',     env('DB_NAME', ''));
define('DB_USER',     env('DB_USER', ''));
define('DB_PASS',     env('DB_PASS', ''));
define('DB_CHARSET',  env('DB_CHARSET', 'utf8mb4'));
```

**Step 2: Update `backend/.env` with credential vars**

Replace DB_PATH line with:
```
DB_HOST=localhost
DB_NAME=wmdtest_webmydrive_db
DB_USER=wmdtest_webmydrive_user
DB_PASS=Webmydrive123
```

**Step 3: Update `backend/.env.example`**

Replace DB_PATH line with:
```
DB_HOST=localhost
DB_NAME=
DB_USER=
DB_PASS=
```

**Step 4: Rewrite `database.php` getConnection() to use env + secure_config fallback**

Replace lines 22-36 with:

```php
public static function getConnection(): PDO
{
    if (self::$instance === null) {
        // Priority: secure_config file (production) > env vars (dev/.env)
        $secureConfig = '/home4/wmdtest/secure_config/db_config.php';
        if (file_exists($secureConfig)) {
            require $secureConfig;
            // $secureConfig defines: $db_host, $db_name, $db_user, $db_pass
        } else {
            $db_host = DB_HOST;
            $db_name = DB_NAME;
            $db_user = DB_USER;
            $db_pass = DB_PASS;
        }

        if (empty($db_name) || empty($db_user)) {
            throw new RuntimeException('Database credentials not configured. Set DB_NAME/DB_USER in .env or create secure_config.');
        }

        $dsn = "mysql:host=$db_host;dbname=$db_name;charset=" . DB_CHARSET;
        self::$instance = new PDO($dsn, $db_user, $db_pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET sql_mode='ANSI_QUOTES'",
        ]);
    }

    return self::$instance;
}
```

**Step 5: Also update the comment at top of database.php**

Replace lines 1-8 (the docblock) with:
```php
<?php
/**
 * Database Layer — PDO / MySQL Singleton
 *
 * Loads credentials from secure_config (production) or .env (development).
 * All queries use PDO prepared statements — zero raw interpolation.
 */
```

**Step 6: Verify backend starts and health endpoint works**

Run: `cd backend && php -S localhost:4000 -t public router.php`
Then: `curl http://localhost:4000/api/health`
Expected: `{"status":"ok","timestamp":"...","env":"development"}`

**Step 7: Commit**

```bash
git add backend/config/database.php backend/config/env.php backend/.env backend/.env.example
git commit -m "fix(backend): load DB credentials from env/secure_config instead of hardcoding"
```

---

## Task 2: Create MySQL schema script for cPanel

**Files:**
- Create: `backend/database/mysql-schema.sql`
- Create: `backend/database/mysql-seed.php`

**Step 1: Create `backend/database/mysql-schema.sql`**

Convert the SQLite schema from `migrate.php` to MySQL syntax. Key conversions:
- `INTEGER PRIMARY KEY AUTOINCREMENT` -> `INT AUTO_INCREMENT PRIMARY KEY`
- `TEXT` stays `TEXT` (or `VARCHAR(255)` for indexed columns)
- `REAL` -> `DECIMAL(12,2)`
- `datetime('now')` -> `CURRENT_TIMESTAMP`
- `CREATE TABLE IF NOT EXISTS` works in MySQL
- `CREATE INDEX IF NOT EXISTS` does NOT work in MySQL 5.7 — use plain `CREATE INDEX` wrapped in a procedure or just run and ignore errors
- Remove `PRAGMA` statements
- Quoted identifiers with `"` work because we set `sql_mode='ANSI_QUOTES'`

```sql
-- WebMyDrive MySQL Schema
-- Import via phpMyAdmin or: mysql -u USER -p DB < mysql-schema.sql

SET sql_mode = 'ANSI_QUOTES';

CREATE TABLE IF NOT EXISTS "User" (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  name                  VARCHAR(255),
  email                 VARCHAR(255) NOT NULL UNIQUE,
  displayEmail          VARCHAR(255),
  passwordHash          VARCHAR(255),
  role                  VARCHAR(50) NOT NULL DEFAULT 'USER',
  referralCode          VARCHAR(100) UNIQUE,
  walletBalance         DECIMAL(12,2) NOT NULL DEFAULT 0,
  isDisabled            TINYINT NOT NULL DEFAULT 0,
  passwordResetRequired TINYINT NOT NULL DEFAULT 0,
  first_login           TINYINT NOT NULL DEFAULT 0,
  distributorId         INT,
  createdAt             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS "Plan" (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  price         DECIMAL(12,2),
  priceINR      DECIMAL(12,2),
  priceMonthlyINR DECIMAL(12,2),
  priceYearlyINR  DECIMAL(12,2),
  monthlyPrice  DECIMAL(12,2),
  yearlyPrice   DECIMAL(12,2),
  storage       INT NOT NULL DEFAULT 0,
  storageGB     INT,
  maxUsers      INT NOT NULL DEFAULT 0,
  isVisible     TINYINT NOT NULL DEFAULT 1,
  isActive      TINYINT NOT NULL DEFAULT 1,
  hasOverride   TINYINT NOT NULL DEFAULT 0,
  googleSKU     VARCHAR(100),
  features      TEXT,
  fields        TEXT,
  createdAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS "Workspace" (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  userId            INT NOT NULL,
  planId            INT,
  status            VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  renewalDate       DATETIME,
  googleCustomerId  VARCHAR(255),
  metadata          TEXT,
  createdAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES "User"(id),
  FOREIGN KEY (planId) REFERENCES "Plan"(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS "Order" (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  userId         INT NOT NULL,
  planId         INT,
  amount         DECIMAL(12,2) NOT NULL,
  currency       VARCHAR(10) NOT NULL DEFAULT 'INR',
  status         VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  paymentId      VARCHAR(255),
  gatewayTxId    VARCHAR(255),
  referralCode   VARCHAR(100),
  createdAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES "User"(id),
  FOREIGN KEY (planId) REFERENCES "Plan"(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS "Subscription" (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL UNIQUE,
  plan_name      VARCHAR(255) NOT NULL,
  payment_id     VARCHAR(255) NOT NULL UNIQUE,
  status         VARCHAR(50) NOT NULL DEFAULT 'active',
  start_date     DATETIME NOT NULL,
  end_date       DATETIME,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES "User"(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_subscription_user_id ON "Subscription"(user_id);
CREATE INDEX idx_subscription_status ON "Subscription"(status);
CREATE INDEX idx_subscription_end_date ON "Subscription"(end_date);

CREATE TABLE IF NOT EXISTS "CheckoutSession" (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  session_id         VARCHAR(255) NOT NULL UNIQUE,
  plan_id            VARCHAR(100) NOT NULL,
  plan_name          VARCHAR(255) NOT NULL,
  amount             DECIMAL(12,2) NOT NULL,
  customer_name      VARCHAR(255) NOT NULL,
  customer_email     VARCHAR(255) NOT NULL,
  customer_phone     VARCHAR(50),
  address            TEXT,
  city               VARCHAR(100),
  state              VARCHAR(100),
  zip_code           VARCHAR(20),
  country            VARCHAR(100) DEFAULT 'India',
  rzp_order_id       VARCHAR(255) NOT NULL,
  payment_id         VARCHAR(255),
  status             VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at         DATETIME,
  processed_at       DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_checkout_session_id ON "CheckoutSession"(session_id);
CREATE INDEX idx_checkout_status ON "CheckoutSession"(status);
CREATE INDEX idx_checkout_email ON "CheckoutSession"(customer_email);

CREATE TABLE IF NOT EXISTS "AdminConfig" (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  `key`     VARCHAR(255) NOT NULL UNIQUE,
  value     TEXT NOT NULL,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS "ReferralLink" (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  code       VARCHAR(100) NOT NULL UNIQUE,
  referrerId INT NOT NULL,
  role       VARCHAR(50) NOT NULL,
  status     VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  createdAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usedAt     DATETIME,
  updatedAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS "ReferralLog" (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  referrerId       INT NOT NULL,
  refereeId        INT,
  orderId          INT,
  amount           DECIMAL(12,2) NOT NULL,
  commissionEarned DECIMAL(12,2) NOT NULL DEFAULT 0,
  status           VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  type             VARCHAR(50),
  createdAt        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (referrerId) REFERENCES "User"(id),
  FOREIGN KEY (refereeId)  REFERENCES "User"(id),
  FOREIGN KEY (orderId)    REFERENCES "Order"(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS "Distributor" (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  name                  VARCHAR(255),
  email                 VARCHAR(255) NOT NULL UNIQUE,
  displayEmail          VARCHAR(255),
  passwordHash          VARCHAR(255),
  referralCode          VARCHAR(100) UNIQUE,
  walletBalance         DECIMAL(12,2) NOT NULL DEFAULT 0,
  status                VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  passwordResetRequired TINYINT NOT NULL DEFAULT 0,
  createdAt             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS "DistributorSale" (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  distributorId    INT NOT NULL,
  purchasingUserId INT NOT NULL,
  orderId          INT,
  commissionEarned DECIMAL(12,2) NOT NULL DEFAULT 0,
  status           VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
  resetDate        DATETIME,
  createdAt        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (distributorId)    REFERENCES "Distributor"(id),
  FOREIGN KEY (purchasingUserId) REFERENCES "User"(id),
  FOREIGN KEY (orderId)          REFERENCES "Order"(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS "DistributorWalletTx" (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  distributorId INT NOT NULL,
  amount        DECIMAL(12,2) NOT NULL,
  type          VARCHAR(50) NOT NULL,
  status        VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
  description   TEXT,
  createdAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (distributorId) REFERENCES "Distributor"(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS "SecurityLink" (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  token     VARCHAR(255) NOT NULL UNIQUE,
  userId    INT NOT NULL,
  role      VARCHAR(50) NOT NULL DEFAULT 'USER',
  type      VARCHAR(50) NOT NULL,
  status    VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  expiresAt DATETIME NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usedAt    DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS "AuditLog" (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  action    VARCHAR(255) NOT NULL,
  userId    INT,
  ip        VARCHAR(100),
  details   TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Step 2: Create `backend/database/mysql-seed.php`**

This script connects to MySQL (using the app's own config) and seeds admin + demo users + plans + config. Can be run via browser at `/backend/database/mysql-seed.php` or CLI.

```php
<?php
/**
 * mysql-seed.php — Seed MySQL database with admin user, demo accounts, plans, and config.
 *
 * Usage (CLI):  php backend/database/mysql-seed.php
 * Usage (browser): https://test.webmydrive.com/WebMyDrive/demo/1/backend/database/mysql-seed.php
 *                  (DELETE after use — this file should NOT remain on the server)
 *
 * Requires: mysql-schema.sql already imported via phpMyAdmin.
 */

declare(strict_types=1);

// Bootstrap: load env + database
require __DIR__ . '/../config/env.php';
require __DIR__ . '/../config/database.php';

header('Content-Type: text/plain; charset=utf-8');

echo "=== WebMyDrive MySQL Seed ===\n\n";

$pdo = Database::getConnection();

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
    $exists = Database::queryOne('SELECT id FROM "AdminConfig" WHERE "key" = :k', [':k' => $k]);
    if (!$exists) {
        Database::insert(
            'INSERT INTO "AdminConfig" ("key", value, updatedAt) VALUES (:k, :v, NOW())',
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
```

**Step 3: Commit**

```bash
git add backend/database/mysql-schema.sql backend/database/mysql-seed.php
git commit -m "feat(backend): add MySQL schema and seed script for cPanel deployment"
```

---

## Task 3: Protect backend directories with .htaccess

**Files:**
- Create: `backend/.htaccess` (root backend dir — denies direct access to all non-public dirs)

**Step 1: Create `backend/.htaccess`**

This sits at `backend/` level and blocks web access to everything except `backend/public/`:

```apache
# Deny direct web access to all backend directories except public/
# Only backend/public/ should be web-accessible (via its own .htaccess + index.php)

# Block access to PHP source files in this directory and subdirectories
<FilesMatch "\.php$">
    Require all denied
</FilesMatch>

# Block access to sensitive file types
<FilesMatch "\.(env|env\.example|sql|db|mjs|log|md|json)$">
    Require all denied
</FilesMatch>

# Block directory listings
Options -Indexes

# Block access to config, controllers, services, middleware, helpers, database, logs
RewriteEngine On
RewriteRule ^(config|controllers|services|middleware|helpers|database|logs)(/|$) - [F,L]
```

**Step 2: Verify `backend/public/.htaccess` already routes correctly** (it does — already verified)

**Step 3: Commit**

```bash
git add backend/.htaccess
git commit -m "fix(security): add .htaccess to block direct access to backend source directories"
```

---

## Task 4: Remove Stripe, clean up payment config

**Files:**
- Modify: `backend/config/env.php:60-62` (remove Stripe constants)
- Modify: `backend/.env` (remove STRIPE lines)
- Modify: `backend/.env.example` (remove STRIPE lines)
- Modify: `backend/public/index.php:177-201` (remove Stripe webhook route)

**Step 1: Remove Stripe constants from `backend/config/env.php`**

Delete lines 60-62:
```php
// ── Stripe ────────────────────────────────────────────────────────────────
define('STRIPE_SECRET_KEY',  env('STRIPE_SECRET_KEY', ''));
define('STRIPE_WEBHOOK_SECRET', env('STRIPE_WEBHOOK_SECRET', ''));
```

**Step 2: Remove STRIPE lines from `backend/.env`**

Delete:
```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

**Step 3: Remove STRIPE lines from `backend/.env.example`**

Delete the STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET lines.

**Step 4: Remove Stripe webhook route from `backend/public/index.php`**

Delete lines 177-201 (the entire `$router->post('/api/payment/webhook/stripe', ...)` block).

**Step 5: Remove 'STRIPE' from the audit log keywords in `AdminController.php`**

In `AdminController.php`, find the `$keywords` array that includes `'STRIPE'` and remove it.

**Step 6: Commit**

```bash
git add backend/config/env.php backend/.env backend/.env.example backend/public/index.php backend/controllers/AdminController.php
git commit -m "chore(backend): remove Stripe references, keep Razorpay only"
```

---

## Task 5: Fix hardcoded password in AuthController::setupWmdId

**Files:**
- Modify: `backend/controllers/AuthController.php:672`

**Step 1: Replace hardcoded password with request body input**

Find line 672:
```php
$passwordHash = password_hash('Test_1123', PASSWORD_BCRYPT);
```

Replace with:
```php
$password = $request->body['password'] ?? '';
if (strlen($password) < 8) {
    Response::error('Password must be at least 8 characters', 400);
}
$passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
```

**Step 2: Commit**

```bash
git add backend/controllers/AuthController.php
git commit -m "fix(auth): accept password from request body in setupWmdId instead of hardcoding"
```

---

## Task 6: Fix CORS double-header in index.php

**Files:**
- Modify: `backend/public/index.php:24-32`

**Step 1: Remove the early wildcard CORS headers**

Replace lines 24-32:
```php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
```

With:
```php
header("Content-Type: application/json");

// CORS is handled by Response::sendCorsHeaders() after bootstrap.
// Handle preflight early but with proper origin checking.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // Bootstrap must load first so CORS config is available
    define('BASE_PATH', dirname(__DIR__));
    require BASE_PATH . '/helpers/Logger.php';
    require BASE_PATH . '/config/env.php';
    require BASE_PATH . '/helpers/Response.php';
    Response::sendCorsHeaders();
    http_response_code(204);
    exit();
}
```

Then remove the duplicate `define('BASE_PATH', dirname(__DIR__));` that appears after the OPTIONS block (line 34), since it's now inside the conditional. Keep the one in the main flow.

**Step 2: Commit**

```bash
git add backend/public/index.php
git commit -m "fix(cors): remove wildcard CORS header, use proper origin checking for preflight"
```

---

## Task 7: Create frontend .env.production

**Files:**
- Create: `.env.production`

**Step 1: Create `.env.production` in project root**

```env
# Production build environment — test.webmydrive.com
# The API URL is empty because the frontend uses relative paths in production.
# Relative path resolves to: /WebMyDrive/demo/1/backend/public/api/*
VITE_API_URL=
VITE_ADMIN_API_URL=
VITE_GOOGLE_CLIENT_ID=
VITE_CLOUD_PLAN_MANAGER_URL=https://test.webmydrive.com
VITE_PURCHASE_SUCCESS_REDIRECT=https://test.webmydrive.com/WebMyDrive/demo/1/login
```

Note: `VITE_API_URL` is intentionally empty — `api.ts` already has fallback logic that constructs `{BASE_URL}/backend/public/api{endpoint}` when the URL is empty in production. This is correct for cPanel where backend sits alongside frontend.

**Step 2: Verify build works with production env**

Run: `npm run build -- --mode production`
Then inspect `dist/index.html` to confirm correct asset paths.

**Step 3: Commit**

```bash
git add .env.production
git commit -m "feat: add .env.production for test.webmydrive.com deployment"
```

---

## Task 8: Create backend .env.production template

**Files:**
- Create: `backend/.env.production`

**Step 1: Create `backend/.env.production`**

```env
NODE_ENV=production
PORT=4000
ALLOWED_ORIGINS=https://test.webmydrive.com

# Database — loaded from secure_config on cPanel, these are fallback
DB_HOST=localhost
DB_NAME=wmdtest_webmydrive_db
DB_USER=wmdtest_webmydrive_user
DB_PASS=Webmydrive123

# JWT — CHANGE THIS in production
JWT_SECRET=CHANGE_ME_TO_A_RANDOM_64_CHAR_STRING
JWT_EXPIRY=604800

# Google OAuth — pending setup
GOOGLE_CLIENT_ID=

# Razorpay — use test keys for test deployment
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# Site URL
SITE_URL=https://test.webmydrive.com/WebMyDrive/demo/1
LOG_DIR=/home4/wmdtest/public_html/WebMyDrive/demo/1/backend/logs
```

**Step 2: Add .env.production to .gitignore** (it contains real credentials)

Add to `backend/.gitignore` (or create it):
```
.env.production
logs/
```

**Step 3: Commit**

```bash
git add backend/.env.production backend/.gitignore
git commit -m "feat(backend): add .env.production template for cPanel deployment"
```

---

## Task 9: Fix broken dev utility scripts and standardize passwords

**Files:**
- Modify: `backend/cleanup_demo.php` (update to use MySQL via app config)
- Delete: `backend/clear_links.php` (broken, redundant)
- Modify: `e2e/auth.spec.ts` (standardize password)
- Modify: `e2e/admin-flows.spec.ts` (standardize password)
- Modify: `e2e/e2e-quality.spec.ts` (standardize password)
- Modify: `e2e/user-flows.spec.ts` (standardize password)
- Modify: `e2e/referral-wallet-flows.spec.ts` (standardize password)

**Step 1: Rewrite `backend/cleanup_demo.php` to use MySQL via app config**

```php
<?php
/**
 * cleanup_demo.php — Reset demo MySQL database to clean state.
 * Preserves admin user, plans, and config. Clears all transactional data.
 *
 * Usage: php backend/cleanup_demo.php
 */

declare(strict_types=1);

require __DIR__ . '/config/env.php';
require __DIR__ . '/config/database.php';

header('Content-Type: text/plain; charset=utf-8');

echo "=== Cleanup Demo Data ===\n\n";

$tables = [
    'AuditLog', 'ReferralLog', 'ReferralLink', 'DistributorWalletTx',
    'DistributorSale', 'Distributor', 'CheckoutSession', 'Subscription',
    'Order', 'Workspace', 'SecurityLink',
];

foreach ($tables as $t) {
    $count = Database::count("\"$t\"");
    Database::execute("DELETE FROM \"$t\"");
    echo "Cleared $t ($count rows)\n";
}

// Delete all users except admin
$count = Database::execute('DELETE FROM "User" WHERE email != :e', [':e' => 'admin@webmydrive.com']);
echo "Deleted $count non-admin users\n";

echo "\nDone. Run mysql-seed.php to re-create demo accounts.\n";
```

**Step 2: Delete `backend/clear_links.php`**

```bash
rm backend/clear_links.php
```

**Step 3: Standardize all e2e test passwords to `Admin@2026!`**

In each e2e test file, find and replace all admin/user passwords:
- `'admin'` -> `'Admin@2026!'` (admin login password)
- `'Admin@123'` -> `'Admin@2026!'`
- `'adminpassword'` -> `'Admin@2026!'`
- `'userpassword'` -> `'Admin@2026!'` (demo user password)

**Step 4: Commit**

```bash
git add backend/cleanup_demo.php e2e/
git rm backend/clear_links.php
git commit -m "fix: update dev utilities to MySQL, standardize test passwords to Admin@2026!"
```

---

## Task 10: Add rate limiting to auth endpoints

**Files:**
- Create: `backend/middleware/RateLimiter.php`
- Modify: `backend/public/index.php` (add require + apply to auth routes)

**Step 1: Create `backend/middleware/RateLimiter.php`**

Simple DB-backed rate limiter using the existing MySQL connection:

```php
<?php
declare(strict_types=1);

class RateLimiter
{
    /**
     * Check if request should be rate-limited.
     * Uses AuditLog table to count recent actions by IP.
     *
     * @param string $ip      Client IP
     * @param string $action  Action identifier (e.g., 'LOGIN_ATTEMPT')
     * @param int    $maxAttempts  Max attempts in window
     * @param int    $windowSeconds  Time window in seconds
     * @return bool  True if request is allowed, false if rate-limited
     */
    public static function check(string $ip, string $action, int $maxAttempts = 10, int $windowSeconds = 900): bool
    {
        $since = date('Y-m-d H:i:s', time() - $windowSeconds);
        $count = Database::scalar(
            'SELECT COUNT(*) FROM "AuditLog" WHERE ip = :ip AND action = :action AND createdAt > :since',
            [':ip' => $ip, ':action' => $action, ':since' => $since]
        );
        return (int) $count < $maxAttempts;
    }

    /**
     * Middleware factory: returns a closure that checks rate limit before proceeding.
     */
    public static function limit(string $action, int $maxAttempts = 10, int $windowSeconds = 900): Closure
    {
        return function (Request $req) use ($action, $maxAttempts, $windowSeconds) {
            $ip = $req->ip ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            if (!self::check($ip, $action, $maxAttempts, $windowSeconds)) {
                Response::error('Too many requests. Please try again later.', 429);
            }
        };
    }
}
```

**Step 2: Add require to `backend/public/index.php`**

After the AuthMiddleware require line, add:
```php
require BASE_PATH . '/middleware/RateLimiter.php';
```

**Step 3: Apply rate limiting to auth routes**

Update the login, register, and forgot-password routes to include rate limiter middleware:

```php
$router->post('/api/auth/register', [AuthController::class, 'register'], [RateLimiter::limit('REGISTER', 5, 900)]);
$router->post('/api/auth/login', [AuthController::class, 'login'], [RateLimiter::limit('LOGIN_ATTEMPT', 10, 900)]);
$router->post('/api/auth/forgot-password', [AuthController::class, 'forgotPassword'], [RateLimiter::limit('FORGOT_PASSWORD', 3, 900)]);
```

**Step 4: Commit**

```bash
git add backend/middleware/RateLimiter.php backend/public/index.php
git commit -m "feat(security): add rate limiting to auth endpoints (login, register, forgot-password)"
```

---

## Task 11: Add e2e npm scripts and fix start-php-backend.ps1

**Files:**
- Modify: `package.json` (add e2e scripts)
- Modify: `scripts/start-php-backend.ps1:47` (remove wrong router path line)

**Step 1: Add e2e scripts to `package.json`**

Add to the `"scripts"` section:
```json
"e2e": "playwright test",
"e2e:ui": "playwright test --ui",
"e2e:report": "playwright show-report"
```

**Step 2: Fix `scripts/start-php-backend.ps1`**

Remove line 47 (the wrong path):
```powershell
$arguments = @("-S", "$ServerHost`:$Port", "-t", "server-php/public", "server-php/router.php")
```

Keep line 48 (the correct path):
```powershell
$arguments = @("-S", "$ServerHost`:$Port", "-t", "backend/public", "backend/router.php")
```

**Step 3: Commit**

```bash
git add package.json scripts/start-php-backend.ps1
git commit -m "chore: add e2e npm scripts, fix backend start script path"
```

---

## Task 12: Create cPanel deployment script

**Files:**
- Create: `scripts/deploy-cpanel.sh`

**Step 1: Create `scripts/deploy-cpanel.sh`**

```bash
#!/usr/bin/env bash
# deploy-cpanel.sh — Deploy WebMyDrive to cPanel via API token
#
# Usage:
#   CPANEL_TOKEN=your_token ./scripts/deploy-cpanel.sh
#
# Requires: curl, npm/node
# Deploys to: /home4/wmdtest/public_html/WebMyDrive/demo/1/

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
HOST="${CPANEL_HOST:-test.webmydrive.com}"
USER="${CPANEL_USER:-wmdtest}"
TOKEN="${CPANEL_TOKEN:?Set CPANEL_TOKEN env var}"
AUTH="Authorization: cpanel ${USER}:${TOKEN}"
BASE="https://${HOST}:2083/execute/Fileman/upload_files"
DEST="public_html/WebMyDrive/demo/1"

echo "=== WebMyDrive cPanel Deployment ==="
echo "Target: ${HOST} -> ${DEST}"
echo ""

# ── Step 1: Build frontend ───────────────────────────────────────────────────
echo "[1/4] Building frontend..."
npm run build -- --mode production
echo "Build complete."

# ── Step 2: Upload frontend files ────────────────────────────────────────────
echo "[2/4] Uploading frontend..."

# Upload index.html, .htaccess, robots.txt
curl -s -k -H "$AUTH" \
  -F "dir=${DEST}" \
  -F "file-1=@dist/index.html" \
  -F "file-2=@.htaccess" \
  -F "overwrite=1" \
  "$BASE" > /dev/null

# Upload assets
for f in dist/assets/*; do
  fname=$(basename "$f")
  curl -s -k -H "$AUTH" \
    -F "dir=${DEST}/assets" \
    -F "file-1=@${f}" \
    -F "overwrite=1" \
    "$BASE" > /dev/null
  echo "  Uploaded: assets/$fname"
done

# Upload public/ files (Logo, favicon, etc.)
for f in public/*; do
  fname=$(basename "$f")
  curl -s -k -H "$AUTH" \
    -F "dir=${DEST}" \
    -F "file-1=@${f}" \
    -F "overwrite=1" \
    "$BASE" > /dev/null
  echo "  Uploaded: $fname"
done

echo "Frontend uploaded."

# ── Step 3: Upload backend ───────────────────────────────────────────────────
echo "[3/4] Uploading backend..."

# Upload backend public/ (entry point)
curl -s -k -H "$AUTH" \
  -F "dir=${DEST}/backend/public" \
  -F "file-1=@backend/public/index.php" \
  -F "file-2=@backend/public/.htaccess" \
  -F "overwrite=1" \
  "$BASE" > /dev/null
echo "  Uploaded: backend/public/"

# Upload backend directories
for dir in config controllers services middleware helpers; do
  for f in backend/${dir}/*.php; do
    [ -f "$f" ] || continue
    fname=$(basename "$f")
    curl -s -k -H "$AUTH" \
      -F "dir=${DEST}/backend/${dir}" \
      -F "file-1=@${f}" \
      -F "overwrite=1" \
      "$BASE" > /dev/null
    echo "  Uploaded: backend/${dir}/${fname}"
  done
done

# Upload backend .htaccess (security)
curl -s -k -H "$AUTH" \
  -F "dir=${DEST}/backend" \
  -F "file-1=@backend/.htaccess" \
  -F "overwrite=1" \
  "$BASE" > /dev/null
echo "  Uploaded: backend/.htaccess"

# Upload backend .env.production as .env
if [ -f "backend/.env.production" ]; then
  cp backend/.env.production /tmp/wmd-env-upload
  curl -s -k -H "$AUTH" \
    -F "dir=${DEST}/backend" \
    -F "file-1=@/tmp/wmd-env-upload;filename=.env" \
    -F "overwrite=1" \
    "$BASE" > /dev/null
  rm /tmp/wmd-env-upload
  echo "  Uploaded: backend/.env (from .env.production)"
fi

echo "Backend uploaded."

# ── Step 4: Verify ───────────────────────────────────────────────────────────
echo "[4/4] Verifying deployment..."
HEALTH=$(curl -s -k "https://${HOST}/WebMyDrive/demo/1/backend/public/api/health" 2>/dev/null || echo "FAILED")
echo "Health check: $HEALTH"

echo ""
echo "=== Deployment complete ==="
echo "Frontend: https://${HOST}/WebMyDrive/demo/1/"
echo "Backend:  https://${HOST}/WebMyDrive/demo/1/backend/public/api/health"
```

**Step 2: Make executable**

```bash
chmod +x scripts/deploy-cpanel.sh
```

**Step 3: Commit**

```bash
git add scripts/deploy-cpanel.sh
git commit -m "feat: add cPanel deployment script using UAPI token upload"
```

---

## Task 13: Update .gitignore for production files

**Files:**
- Modify: `.gitignore`

**Step 1: Add production/sensitive file patterns**

Append to `.gitignore`:
```
# Backend
backend/logs/
backend/.env.production
backend/database/dev.db

# Environment
.env.production
```

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: update .gitignore for production env files and logs"
```

---

## Execution Order Summary

| Task | Description | Depends On |
|------|-------------|------------|
| 1 | Fix database.php — env/secure_config credentials | - |
| 2 | Create MySQL schema + seed script | Task 1 |
| 3 | Protect backend dirs with .htaccess | - |
| 4 | Remove Stripe references | - |
| 5 | Fix hardcoded password in setupWmdId | - |
| 6 | Fix CORS double-header | - |
| 7 | Create frontend .env.production | - |
| 8 | Create backend .env.production | Task 1 |
| 9 | Fix dev utilities + standardize passwords | Task 1 |
| 10 | Add rate limiting | - |
| 11 | Add e2e scripts + fix start script | - |
| 12 | Create deployment script | Tasks 1-8 |
| 13 | Update .gitignore | - |

**Parallelizable:** Tasks 3, 4, 5, 6, 7, 10, 11 are all independent. Tasks 1 -> 2 -> 8 -> 9 are sequential. Task 12 should be last.

<?php
/**
 * migrate.php — Create SQLite schema for WebMyDrive PHP backend
 * Usage: php server-php/database/migrate.php
 */

declare(strict_types=1);

$dbDir = __DIR__;
$dbPath = $dbDir . '/dev.db';

if (!is_dir($dbDir))
  mkdir($dbDir, 0755, true);

echo "Creating database at: $dbPath\n";

$pdo = new PDO("sqlite:$dbPath", null, null, [
  PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);
$pdo->exec('PRAGMA journal_mode=WAL;');
$pdo->exec('PRAGMA foreign_keys=ON;');

$sql = <<<SQL

CREATE TABLE IF NOT EXISTS "User" (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT,
  email                 TEXT NOT NULL UNIQUE,
  displayEmail          TEXT,
  passwordHash          TEXT,
  role                  TEXT NOT NULL DEFAULT 'USER',
  referralCode          TEXT UNIQUE,
  walletBalance         REAL NOT NULL DEFAULT 0,
  isDisabled            INTEGER NOT NULL DEFAULT 0,
  passwordResetRequired INTEGER NOT NULL DEFAULT 0,
  first_login           INTEGER NOT NULL DEFAULT 0,
  distributorId         INTEGER,
  createdAt             TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "Plan" (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  price         REAL,
  monthlyPrice  REAL,
  yearlyPrice   REAL,
  storage       INTEGER NOT NULL DEFAULT 0,
  maxUsers      INTEGER NOT NULL DEFAULT 0,
  isVisible     INTEGER NOT NULL DEFAULT 1,
  googleSKU     TEXT,
  fields        TEXT,
  createdAt     TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "Workspace" (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  userId            INTEGER NOT NULL,
  planId            INTEGER,
  discount_percent  REAL NOT NULL DEFAULT 0,
  referred_by       INTEGER NULL,
  scheduled_plan_id INTEGER NULL,
  status            TEXT NOT NULL DEFAULT 'PENDING',
  renewalDate       TEXT,
  billingPeriod     TEXT NOT NULL DEFAULT 'yearly',
  autoRenew         INTEGER NOT NULL DEFAULT 0,
  mandateId         TEXT NULL,
  graceExpiry       TEXT NULL,
  googleCustomerId  TEXT,
  metadata          TEXT,
  createdAt         TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt         TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES "User"(id),
  FOREIGN KEY (planId) REFERENCES "Plan"(id)
);

CREATE TABLE IF NOT EXISTS "Order" (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  userId         INTEGER NOT NULL,
  planId         INTEGER,
  amount         REAL NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'INR',
  status         TEXT NOT NULL DEFAULT 'PENDING',
  paymentId      TEXT,
  gatewayTxId    TEXT,
  referralCode   TEXT,
  createdAt      TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES "User"(id),
  FOREIGN KEY (planId) REFERENCES "Plan"(id)
);

CREATE TABLE IF NOT EXISTS "Subscription" (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL UNIQUE,
  plan_name      TEXT NOT NULL,
  payment_id     TEXT NOT NULL UNIQUE,
  status         TEXT NOT NULL DEFAULT 'active',
  start_date     TEXT NOT NULL,
  end_date       TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES "User"(id)
);

CREATE INDEX IF NOT EXISTS idx_subscription_user_id ON "Subscription"(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_status ON "Subscription"(status);
CREATE INDEX IF NOT EXISTS idx_subscription_end_date ON "Subscription"(end_date);

CREATE TABLE IF NOT EXISTS "CheckoutSession" (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id         TEXT NOT NULL UNIQUE,
  plan_id            TEXT NOT NULL,
  plan_name          TEXT NOT NULL,
  amount             REAL NOT NULL,
  customer_name      TEXT NOT NULL,
  customer_email     TEXT NOT NULL,
  customer_phone     TEXT,
  address            TEXT,
  city               TEXT,
  state              TEXT,
  zip_code           TEXT,
  country            TEXT DEFAULT 'India',
  rzp_order_id       TEXT NOT NULL,
  payment_id         TEXT,
  status             TEXT NOT NULL DEFAULT 'PENDING',
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at         TEXT,
  processed_at       TEXT
);

CREATE INDEX IF NOT EXISTS idx_checkout_session_id ON "CheckoutSession"(session_id);
CREATE INDEX IF NOT EXISTS idx_checkout_status ON "CheckoutSession"(status);
CREATE INDEX IF NOT EXISTS idx_checkout_email ON "CheckoutSession"(customer_email);

CREATE TABLE IF NOT EXISTS "AdminConfig" (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  key       TEXT NOT NULL UNIQUE,
  value     TEXT NOT NULL,
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "ReferralLink" (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT NOT NULL UNIQUE,
  referrerId INTEGER NOT NULL,
  role       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'ACTIVE',
  createdAt  TEXT NOT NULL DEFAULT (datetime('now')),
  usedAt     TEXT,
  updatedAt  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "ReferralLog" (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  referrerId        INTEGER NOT NULL,
  refereeId         INTEGER,
  orderId           INTEGER,
  amount            REAL NOT NULL,
  commissionEarned  REAL NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'PENDING',
  type              TEXT,
  referralYear      INTEGER NOT NULL DEFAULT 1,
  referrer_credited INTEGER NOT NULL DEFAULT 1,
  createdAt         TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt         TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (referrerId) REFERENCES "User"(id),
  FOREIGN KEY (refereeId)  REFERENCES "User"(id),
  FOREIGN KEY (orderId)    REFERENCES "Order"(id)
);

CREATE TABLE IF NOT EXISTS "Distributor" (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT,
  email                 TEXT NOT NULL UNIQUE,
  displayEmail          TEXT,
  passwordHash          TEXT,
  referralCode          TEXT UNIQUE,
  walletBalance         REAL NOT NULL DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'ACTIVE',
  passwordResetRequired INTEGER NOT NULL DEFAULT 0,
  createdAt             TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "DistributorSale" (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  distributorId    INTEGER NOT NULL,
  purchasingUserId INTEGER NOT NULL,
  orderId          INTEGER,
  commissionEarned REAL NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'COMPLETED',
  resetDate        TEXT,
  createdAt        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (distributorId)    REFERENCES "Distributor"(id),
  FOREIGN KEY (purchasingUserId) REFERENCES "User"(id),
  FOREIGN KEY (orderId)          REFERENCES "Order"(id)
);

CREATE TABLE IF NOT EXISTS "DistributorWalletTx" (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  distributorId INTEGER NOT NULL,
  amount        REAL NOT NULL,
  type          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'COMPLETED',
  description   TEXT,
  createdAt     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (distributorId) REFERENCES "Distributor"(id)
);

CREATE TABLE IF NOT EXISTS "PromoCode" (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  code             TEXT    NOT NULL UNIQUE,
  name             TEXT,
  discountPercent  REAL    NOT NULL,
  applicablePlans  TEXT,
  status           TEXT    NOT NULL DEFAULT 'ACTIVE',
  usesLimit        INTEGER,
  usesCount        INTEGER NOT NULL DEFAULT 0,
  expiresAt        TEXT,
  createdAt        TEXT    NOT NULL DEFAULT (datetime('now')),
  updatedAt        TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_promocode_code   ON "PromoCode"(code);
CREATE INDEX IF NOT EXISTS idx_promocode_status ON "PromoCode"(status);

CREATE TABLE IF NOT EXISTS "DistributorPromoCode" (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  distributorId  INTEGER NOT NULL,
  promoCodeId    INTEGER NOT NULL,
  isFestive      INTEGER NOT NULL DEFAULT 0,
  isActive       INTEGER NOT NULL DEFAULT 1,
  assignedAt     TEXT    NOT NULL DEFAULT (datetime('now')),
  revokedAt      TEXT,
  assignedBy     INTEGER,
  note           TEXT,
  FOREIGN KEY (distributorId) REFERENCES "Distributor"(id),
  FOREIGN KEY (promoCodeId)   REFERENCES "PromoCode"(id)
);
CREATE INDEX IF NOT EXISTS idx_dpc_distributor ON "DistributorPromoCode"(distributorId);
CREATE INDEX IF NOT EXISTS idx_dpc_active      ON "DistributorPromoCode"(distributorId, isActive);

CREATE TABLE IF NOT EXISTS "PendingCheckout" (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  referenceNumber  TEXT NOT NULL UNIQUE,
  planId           INTEGER,
  amount           REAL NOT NULL,
  billingPeriod    TEXT NOT NULL DEFAULT 'yearly',
  customerEmail    TEXT NOT NULL,
  customerName     TEXT,
  customerPhone    TEXT,
  checkoutMeta     TEXT,
  promoCode        TEXT NULL,
  status           TEXT NOT NULL DEFAULT 'PENDING',
  zohoPaymentId    TEXT,
  createdUserId    INTEGER NULL,
  createdAt        TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "WalletTransaction" (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  userId      INTEGER NOT NULL,
  amount      REAL NOT NULL,
  type        TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'ADMIN',
  description TEXT,
  orderId     INTEGER NULL,
  expires_at  TEXT NULL,
  createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES "User"(id)
);

CREATE INDEX IF NOT EXISTS idx_wt_user    ON "WalletTransaction"(userId);
CREATE INDEX IF NOT EXISTS idx_wt_expires ON "WalletTransaction"(expires_at);

CREATE TABLE IF NOT EXISTS "Voucher" (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  value       REAL NOT NULL,
  created_by  INTEGER NOT NULL,
  used_by     INTEGER NULL,
  used_at     TEXT NULL,
  expires_at  TEXT NULL,
  status      TEXT NOT NULL DEFAULT 'ACTIVE',
  description TEXT,
  createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES "User"(id),
  FOREIGN KEY (used_by)    REFERENCES "User"(id)
);

CREATE INDEX IF NOT EXISTS idx_voucher_code   ON "Voucher"(code);
CREATE INDEX IF NOT EXISTS idx_voucher_status ON "Voucher"(status);

CREATE TABLE IF NOT EXISTS "SecurityLink" (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  token     TEXT NOT NULL UNIQUE,
  userId    INTEGER NOT NULL,
  role      TEXT NOT NULL DEFAULT 'USER',
  type      TEXT NOT NULL,
  status    TEXT NOT NULL DEFAULT 'ACTIVE',
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  usedAt    TEXT
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  action    TEXT NOT NULL,
  userId    INTEGER,
  ip        TEXT,
  details   TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

SQL;

$pdo->exec($sql);


echo "Schema created.\n";

// ── Seed admin user ────────────────────────────────────────────────────────────
$existing = $pdo->prepare('SELECT id FROM "User" WHERE email = ?');
$existing->execute(['admin@webmydrive.com']);
if (!$existing->fetch()) {
  $hash = password_hash('Admin@2026!', PASSWORD_BCRYPT, ['cost' => 10]);
  $pdo->prepare(
    'INSERT INTO "User" (name, email, passwordHash, role, referralCode, walletBalance, passwordResetRequired, first_login, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 0, 0, 0, datetime(\'now\'), datetime(\'now\'))'
  )->execute(['Super Admin', 'admin@webmydrive.com', $hash, 'SUPERADMIN', 'ADMIN2026']);
  echo "Seeded SUPERADMIN: admin@webmydrive.com / Admin@2026!\n";
} else {
  echo "Admin user already exists, skipping seed.\n";
}

// ── Seed default AdminConfig ───────────────────────────────────────────────────
$configs = [
  ['user_referral_percent', '10'],
  ['distributor_referral_percent', '20'],
  ['promo_discount_percent', '15'],
  ['referral_credit_type', 'WALLET'],
  ['max_wallet_balance', '10000'],
];
$ins = $pdo->prepare(
  'INSERT OR IGNORE INTO "AdminConfig" (key, value, updatedAt) VALUES (?, ?, datetime(\'now\'))'
);
foreach ($configs as [$k, $v]) {
  $ins->execute([$k, $v]);
}
echo "Default AdminConfig seeded.\n";

// ── Seed default Plans ─────────────────────────────────────────────────────────
$plans = [
  ['Starter', 99, 499, null, 30, 5, 1],
  ['Professional', 199, 999, null, 100, 25, 1],
  ['Enterprise', 499, 2499, null, 500, 100, 1],
];
$insPlan = $pdo->prepare(
  'INSERT OR IGNORE INTO "Plan" (name, monthlyPrice, yearlyPrice, price, storage, maxUsers, isVisible, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))'
);
foreach ($plans as [$name, $monthly, $yearly, $price, $storage, $maxUsers, $visible]) {
  // Check if plan with this name already exists
  $check = $pdo->prepare('SELECT id FROM "Plan" WHERE name = ?');
  $check->execute([$name]);
  if (!$check->fetch()) {
    $insPlan->execute([$name, $monthly, $yearly, $price ?? $monthly, $storage, $maxUsers, $visible]);
  }
}
echo "Default plans seeded.\n";

echo "\nMigration complete! Database ready at: $dbPath\n";

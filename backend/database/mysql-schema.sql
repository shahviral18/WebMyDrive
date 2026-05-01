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
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  price           DECIMAL(12,2),
  priceINR        DECIMAL(12,2),
  priceMonthlyINR DECIMAL(12,2),
  priceYearlyINR  DECIMAL(12,2),
  monthlyPrice    DECIMAL(12,2),
  yearlyPrice     DECIMAL(12,2),
  storage         INT NOT NULL DEFAULT 0,
  storageGB       INT,
  maxUsers        INT NOT NULL DEFAULT 0,
  isVisible       TINYINT NOT NULL DEFAULT 1,
  isActive        TINYINT NOT NULL DEFAULT 1,
  hasOverride     TINYINT NOT NULL DEFAULT 0,
  googleSKU       VARCHAR(100),
  features        TEXT,
  fields          TEXT,
  createdAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS "Workspace" (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  userId            INT NOT NULL,
  planId            INT,
  status            VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  renewalDate       DATETIME,
  billingPeriod     VARCHAR(20) NOT NULL DEFAULT 'yearly',
  autoRenew         TINYINT(1) NOT NULL DEFAULT 0,
  mandateId         VARCHAR(255) NULL,
  graceExpiry       DATETIME NULL,
  googleCustomerId  VARCHAR(255),
  metadata          TEXT,
  createdAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES "User"(id),
  FOREIGN KEY (planId) REFERENCES "Plan"(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Run on existing installs:
-- ALTER TABLE `Workspace`
--   ADD COLUMN `billingPeriod` VARCHAR(20) NOT NULL DEFAULT 'yearly' AFTER `renewalDate`,
--   ADD COLUMN `autoRenew`     TINYINT(1)  NOT NULL DEFAULT 0         AFTER `billingPeriod`,
--   ADD COLUMN `mandateId`     VARCHAR(255) NULL                      AFTER `autoRenew`,
--   ADD COLUMN `graceExpiry`   DATETIME    NULL                       AFTER `mandateId`;

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

CREATE TABLE IF NOT EXISTS "DistributorApplication" (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  accountEmail      VARCHAR(255) NOT NULL,
  linkedUserId      INT NULL,
  firstName         VARCHAR(100),
  lastName          VARCHAR(100),
  whatsapp          VARCHAR(50),
  recoveryEmail     VARCHAR(255),
  companyName       VARCHAR(255),
  panNumber         VARCHAR(20),
  aadharNumber      VARCHAR(20),
  panFilePath       VARCHAR(500),
  aadharFilePath    VARCHAR(500),
  addressLine1      VARCHAR(255),
  addressLine2      VARCHAR(255),
  area              VARCHAR(100),
  city              VARCHAR(100),
  state             VARCHAR(100),
  teamSize          VARCHAR(50),
  accountantName    VARCHAR(255),
  accountantPhone   VARCHAR(50),
  accountantEmail   VARCHAR(255),
  status            VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  reviewNotes       TEXT,
  createdAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (linkedUserId) REFERENCES "User"(id) ON DELETE SET NULL,
  INDEX idx_distapp_status (status),
  INDEX idx_distapp_email (accountEmail)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS "ExistingUser" (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  username          VARCHAR(255) NOT NULL UNIQUE,
  firstName         VARCHAR(100),
  lastName          VARCHAR(100),
  googleCreatedAt   DATETIME,
  recoveryEmail     VARCHAR(255),
  recoveryPhone     VARCHAR(50),
  status            VARCHAR(20) DEFAULT 'ACTIVE',
  twoStepStatus     VARCHAR(20),
  lastSignIn        DATETIME,
  ou                VARCHAR(255),
  activePlanId      INT NULL,
  previousPlanId    INT NULL,
  linkedUserId      INT NULL,
  googleCustomerId  VARCHAR(255),
  source            VARCHAR(50) DEFAULT 'imported',
  notes             TEXT,
  createdAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (activePlanId)   REFERENCES "Plan"(id) ON DELETE SET NULL,
  FOREIGN KEY (previousPlanId) REFERENCES "Plan"(id) ON DELETE SET NULL,
  FOREIGN KEY (linkedUserId)   REFERENCES "User"(id) ON DELETE SET NULL,
  INDEX idx_existinguser_status (status),
  INDEX idx_existinguser_activeplan (activePlanId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── v2 migration: user profile extension ──────────────────────────────────────
ALTER TABLE `User`
  ADD COLUMN IF NOT EXISTS `phone`         VARCHAR(50)  NULL AFTER `distributorId`,
  ADD COLUMN IF NOT EXISTS `country`       VARCHAR(100) NULL AFTER `phone`,
  ADD COLUMN IF NOT EXISTS `timezone`      VARCHAR(100) NULL AFTER `country`,
  ADD COLUMN IF NOT EXISTS `recoveryEmail` VARCHAR(255) NULL AFTER `timezone`,
  ADD COLUMN IF NOT EXISTS `recoveryPhone` VARCHAR(50)  NULL AFTER `recoveryEmail`,
  ADD COLUMN IF NOT EXISTS `storageUsed`   BIGINT NOT NULL DEFAULT 0 AFTER `recoveryPhone`,
  ADD COLUMN IF NOT EXISTS `storageLimit`  BIGINT NOT NULL DEFAULT 0 AFTER `storageUsed`;

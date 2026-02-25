-- CreateTable
CREATE TABLE "ReferralLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "referrerId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" DATETIME
);

-- CreateTable
CREATE TABLE "SecurityLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" DATETIME
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Distributor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "email" TEXT NOT NULL,
    "displayEmail" TEXT,
    "passwordHash" TEXT,
    "name" TEXT,
    "referralCode" TEXT,
    "walletBalance" REAL NOT NULL DEFAULT 0.0,
    "tier" TEXT NOT NULL DEFAULT 'Starter',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "joinDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resetDate" DATETIME,
    "revenueThisYear" REAL NOT NULL DEFAULT 0.0,
    "passwordResetRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Distributor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Distributor" ("createdAt", "email", "id", "joinDate", "name", "passwordHash", "referralCode", "resetDate", "revenueThisYear", "status", "tier", "updatedAt", "userId", "walletBalance") SELECT "createdAt", "email", "id", "joinDate", "name", "passwordHash", "referralCode", "resetDate", "revenueThisYear", "status", "tier", "updatedAt", "userId", "walletBalance" FROM "Distributor";
DROP TABLE "Distributor";
ALTER TABLE "new_Distributor" RENAME TO "Distributor";
CREATE UNIQUE INDEX "Distributor_userId_key" ON "Distributor"("userId");
CREATE UNIQUE INDEX "Distributor_email_key" ON "Distributor"("email");
CREATE UNIQUE INDEX "Distributor_referralCode_key" ON "Distributor"("referralCode");
CREATE INDEX "Distributor_status_idx" ON "Distributor"("status");
CREATE INDEX "Distributor_tier_idx" ON "Distributor"("tier");
CREATE INDEX "Distributor_resetDate_idx" ON "Distributor"("resetDate");
CREATE TABLE "new_Plan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "hasOverride" BOOLEAN NOT NULL DEFAULT false,
    "features" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priceINR" REAL,
    "storageGB" INTEGER NOT NULL DEFAULT 0,
    "maxUsers" INTEGER NOT NULL DEFAULT 0,
    "googleSKU" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Plan" ("createdAt", "features", "googleSKU", "id", "isActive", "maxUsers", "name", "price", "priceINR", "storageGB", "updatedAt") SELECT "createdAt", "features", "googleSKU", "id", "isActive", "maxUsers", "name", "price", "priceINR", "storageGB", "updatedAt" FROM "Plan";
DROP TABLE "Plan";
ALTER TABLE "new_Plan" RENAME TO "Plan";
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "displayEmail" TEXT,
    "passwordHash" TEXT,
    "referralCode" TEXT,
    "walletBalance" REAL NOT NULL DEFAULT 0.0,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "distributorId" INTEGER,
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,
    "passwordResetRequired" BOOLEAN NOT NULL DEFAULT false,
    "first_login" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "distributorId", "email", "id", "isDisabled", "name", "passwordHash", "referralCode", "role", "updatedAt", "walletBalance") SELECT "createdAt", "distributorId", "email", "id", "isDisabled", "name", "passwordHash", "referralCode", "role", "updatedAt", "walletBalance" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_referralCode_idx" ON "User"("referralCode");
CREATE INDEX "User_distributorId_idx" ON "User"("distributorId");
CREATE INDEX "User_role_idx" ON "User"("role");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ReferralLink_code_key" ON "ReferralLink"("code");

-- CreateIndex
CREATE INDEX "ReferralLink_code_idx" ON "ReferralLink"("code");

-- CreateIndex
CREATE INDEX "ReferralLink_referrerId_idx" ON "ReferralLink"("referrerId");

-- CreateIndex
CREATE INDEX "ReferralLink_role_idx" ON "ReferralLink"("role");

-- CreateIndex
CREATE INDEX "ReferralLink_status_idx" ON "ReferralLink"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityLink_token_key" ON "SecurityLink"("token");

-- CreateIndex
CREATE INDEX "SecurityLink_token_idx" ON "SecurityLink"("token");

-- CreateIndex
CREATE INDEX "SecurityLink_userId_idx" ON "SecurityLink"("userId");

-- CreateIndex
CREATE INDEX "SecurityLink_status_idx" ON "SecurityLink"("status");

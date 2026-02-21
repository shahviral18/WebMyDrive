-- CreateTable
CREATE TABLE "Distributor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "walletBalance" REAL NOT NULL DEFAULT 0.0,
    "tier" TEXT NOT NULL DEFAULT 'Starter',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "joinDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resetDate" DATETIME,
    "revenueThisYear" REAL NOT NULL DEFAULT 0.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Distributor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DistributorSale" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "distributorId" INTEGER NOT NULL,
    "purchasingUserId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "commissionRate" REAL NOT NULL,
    "commissionEarned" REAL NOT NULL,
    "saleYear" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DistributorSale_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DistributorSale_purchasingUserId_fkey" FOREIGN KEY ("purchasingUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DistributorSale_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DistributorWalletTx" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "distributorId" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DistributorWalletTx_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Plan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "features" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Plan" ("createdAt", "features", "id", "name", "price", "updatedAt") SELECT "createdAt", "features", "id", "name", "price", "updatedAt" FROM "Plan";
DROP TABLE "Plan";
ALTER TABLE "new_Plan" RENAME TO "Plan";
CREATE TABLE "new_ReferralLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "referrerUserId" INTEGER NOT NULL,
    "refereeUserId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "amount" REAL NOT NULL,
    "referralYear" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralLog_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReferralLog_refereeUserId_fkey" FOREIGN KEY ("refereeUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReferralLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ReferralLog" ("amount", "createdAt", "id", "orderId", "refereeUserId", "referrerUserId", "status") SELECT "amount", "createdAt", "id", "orderId", "refereeUserId", "referrerUserId", "status" FROM "ReferralLog";
DROP TABLE "ReferralLog";
ALTER TABLE "new_ReferralLog" RENAME TO "ReferralLog";
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "referralCode" TEXT,
    "walletBalance" REAL NOT NULL DEFAULT 0.0,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "distributorId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "passwordHash", "referralCode", "role", "updatedAt", "walletBalance") SELECT "createdAt", "email", "id", "name", "passwordHash", "referralCode", "role", "updatedAt", "walletBalance" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Distributor_userId_key" ON "Distributor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Distributor_email_key" ON "Distributor"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminConfig_key_key" ON "AdminConfig"("key");

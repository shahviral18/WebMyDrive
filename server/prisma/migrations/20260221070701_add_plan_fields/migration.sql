/*
  Warnings:

  - A unique constraint covering the columns `[orderId]` on the table `DistributorSale` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[orderId]` on the table `ReferralLog` will be added. If there are existing duplicate values, this will fail.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Plan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "features" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priceINR" REAL,
    "storageGB" INTEGER NOT NULL DEFAULT 0,
    "maxUsers" INTEGER NOT NULL DEFAULT 0,
    "googleSKU" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Plan" ("createdAt", "features", "id", "isActive", "name", "price", "updatedAt") SELECT "createdAt", "features", "id", "isActive", "name", "price", "updatedAt" FROM "Plan";
DROP TABLE "Plan";
ALTER TABLE "new_Plan" RENAME TO "Plan";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "DistributorSale_orderId_key" ON "DistributorSale"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralLog_orderId_key" ON "ReferralLog"("orderId");

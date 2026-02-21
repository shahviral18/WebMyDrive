/*
  Warnings:

  - A unique constraint covering the columns `[referralCode]` on the table `Distributor` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Distributor" ADD COLUMN "referralCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Distributor_referralCode_key" ON "Distributor"("referralCode");

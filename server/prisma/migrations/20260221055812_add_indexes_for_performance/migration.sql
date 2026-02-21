-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_actionName_idx" ON "AuditLog"("actionName");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Distributor_status_idx" ON "Distributor"("status");

-- CreateIndex
CREATE INDEX "Distributor_tier_idx" ON "Distributor"("tier");

-- CreateIndex
CREATE INDEX "Distributor_resetDate_idx" ON "Distributor"("resetDate");

-- CreateIndex
CREATE INDEX "DistributorSale_distributorId_idx" ON "DistributorSale"("distributorId");

-- CreateIndex
CREATE INDEX "DistributorSale_purchasingUserId_idx" ON "DistributorSale"("purchasingUserId");

-- CreateIndex
CREATE INDEX "DistributorSale_orderId_idx" ON "DistributorSale"("orderId");

-- CreateIndex
CREATE INDEX "DistributorWalletTx_distributorId_idx" ON "DistributorWalletTx"("distributorId");

-- CreateIndex
CREATE INDEX "DistributorWalletTx_type_idx" ON "DistributorWalletTx"("type");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_gatewayTxId_idx" ON "Order"("gatewayTxId");

-- CreateIndex
CREATE INDEX "ReferralLog_referrerUserId_idx" ON "ReferralLog"("referrerUserId");

-- CreateIndex
CREATE INDEX "ReferralLog_refereeUserId_idx" ON "ReferralLog"("refereeUserId");

-- CreateIndex
CREATE INDEX "ReferralLog_orderId_idx" ON "ReferralLog"("orderId");

-- CreateIndex
CREATE INDEX "ReferralLog_status_idx" ON "ReferralLog"("status");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_referralCode_idx" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "User_distributorId_idx" ON "User"("distributorId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Workspace_userId_idx" ON "Workspace"("userId");

-- CreateIndex
CREATE INDEX "Workspace_status_idx" ON "Workspace"("status");

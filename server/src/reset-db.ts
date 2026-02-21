/**
 * Production Reset Script
 * Wipes the database and leaves exactly ONE SuperAdmin account.
 * Run: npx ts-node --transpile-only src/reset-db.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
    console.log("🚨 WARNING: Wiping production database...");

    // Delete in correct order to respect foreign keys
    await prisma.distributorWalletTx.deleteMany({});
    await prisma.distributorSale.deleteMany({});
    await prisma.referralLog.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.workspace.deleteMany({});

    // Disconnect relationships before deleting
    await prisma.user.updateMany({ data: { distributorId: null } });
    await prisma.distributor.updateMany({ data: { userId: null } });

    await prisma.distributor.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.plan.deleteMany({});
    await prisma.adminConfig.deleteMany({});
    await prisma.auditLog.deleteMany({});

    console.log("🧹 Database empty.");

    // Seed EXACTLY ONE SuperAdmin
    const adminEmail = "admin@webmydrive.com";
    const adminPass = "Admin@123";
    const adminHash = await bcrypt.hash(adminPass, 10);

    const admin = await prisma.user.create({
        data: {
            name: "Super Admin",
            email: adminEmail,
            passwordHash: adminHash,
            role: "SUPERADMIN",
            referralCode: "ADMIN000"
        },
    });

    console.log("\n✅ Production SuperAdmin provisioned:");
    console.log(`   Email    : ${adminEmail}`);
    console.log(`   Password : ${adminPass}`);
    console.log(`   ID       : ${admin.id}\n`);

    console.log("System is ready for production use.");
}

main()
    .catch(e => { console.error("❌", e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());

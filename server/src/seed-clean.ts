import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🧹 Starting cleanup...\n");

    const before = {
        orders: await prisma.order.count(),
        users: await prisma.user.count(),
        distributors: await prisma.distributor.count(),
    };
    console.log("BEFORE →", before);

    // Delete deepest dependents first to satisfy FK constraints
    try { const r = await prisma.distributorWalletTx.deleteMany({}); console.log(`✅ DistributorWalletTx: ${r.count}`); } catch (e: any) { console.log("⚠️ ", e.message.split('\n')[0]); }
    try { const r = await prisma.distributorSale.deleteMany({}); console.log(`✅ DistributorSale: ${r.count}`); } catch (e: any) { console.log("⚠️ ", e.message.split('\n')[0]); }
    try { const r = await prisma.referralLog.deleteMany({}); console.log(`✅ ReferralLog: ${r.count}`); } catch (e: any) { console.log("⚠️ ", e.message.split('\n')[0]); }
    try { const r = await prisma.auditLog.deleteMany({}); console.log(`✅ AuditLog: ${r.count}`); } catch (e: any) { console.log("⚠️ ", e.message.split('\n')[0]); }
    try { const r = await prisma.order.deleteMany({}); console.log(`✅ Order: ${r.count}`); } catch (e: any) { console.log("⚠️ ", e.message.split('\n')[0]); }
    try { const r = await prisma.distributor.deleteMany({}); console.log(`✅ Distributor: ${r.count}`); } catch (e: any) { console.log("⚠️ ", e.message.split('\n')[0]); }
    try { const r = await prisma.workspace.deleteMany({}); console.log(`✅ Workspace: ${r.count}`); } catch (e: any) { console.log("⚠️ ", e.message.split('\n')[0]); }

    // Delete non-admin users last
    const users = await prisma.user.deleteMany({
        where: { role: { notIn: ["ADMIN", "SUPERADMIN"] } }
    });
    console.log(`✅ Non-admin users deleted: ${users.count}`);

    const remaining = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
    const afterOrders = await prisma.order.count();

    console.log("\nAFTER →");
    console.log("  Orders:", afterOrders);
    console.log("  Users:", remaining.map(u => `[${u.role}] ${u.email}`).join(", ") || "none");
    console.log("\n✅ Database cleaned!");
}

main()
    .catch(e => { console.error("❌", e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());

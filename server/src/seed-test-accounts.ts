/**
 * Seeds one test User and one test Distributor with known credentials.
 * Run: npx ts-node --transpile-only src/seed-test-accounts.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Seeding test accounts...\n");

    // ── Test User ─────────────────────────────────────────────────────────────
    const userEmail = "user@webmydrive.com";
    const userPass = "User@1234";
    const userHash = await bcrypt.hash(userPass, 10);

    const user = await prisma.user.upsert({
        where: { email: userEmail },
        update: { passwordHash: userHash },
        create: {
            name: "Test User",
            email: userEmail,
            passwordHash: userHash,
            role: "USER",
            referralCode: "TESTUSER01",
            walletBalance: 0,
        },
    });
    console.log(`✅ User created/updated`);
    console.log(`   Email    : ${userEmail}`);
    console.log(`   Password : ${userPass}`);
    console.log(`   ID       : ${user.id}\n`);

    // ── Test Distributor ──────────────────────────────────────────────────────
    const distEmail = "distributor@webmydrive.com";
    const distPass = "Dist@1234";
    const distHash = await bcrypt.hash(distPass, 10);

    const dist = await prisma.distributor.upsert({
        where: { email: distEmail },
        update: { passwordHash: distHash },
        create: {
            name: "Test Distributor",
            email: distEmail,
            passwordHash: distHash,
            tier: "Starter",
            status: "ACTIVE",
            walletBalance: 0,
            revenueThisYear: 0,
        },
    });
    console.log(`✅ Distributor created/updated`);
    console.log(`   Email    : ${distEmail}`);
    console.log(`   Password : ${distPass}`);
    console.log(`   ID       : ${dist.id}\n`);

    console.log("─────────────────────────────────────");
    console.log("Login at: http://192.168.2.6:6173/login");
    console.log("─────────────────────────────────────");
}

main()
    .catch(e => { console.error("❌", e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());

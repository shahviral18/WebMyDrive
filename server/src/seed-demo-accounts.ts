/**
 * Seeds demo accounts for the login page quick-fill buttons.
 * These accounts have first_login = false so they bypass the forced password change.
 * Run: npx ts-node --transpile-only src/seed-demo-accounts.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Seeding demo accounts...\n");

    const users = [
        { name: "Priya Sharma", email: "priya@webmydrive.com", pass: "priya123", ref: "PRIYA2026" },
        { name: "Amit Kumar", email: "amit@webmydrive.com", pass: "amit123", ref: "AMIT2026" },
    ];

    for (const u of users) {
        const hash = await bcrypt.hash(u.pass, 10);
        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: { passwordHash: hash, first_login: false, passwordResetRequired: false },
            create: {
                name: u.name,
                email: u.email,
                passwordHash: hash,
                role: "USER",
                referralCode: u.ref,
                walletBalance: 50.0,
                first_login: false,
                passwordResetRequired: false,
            },
        });
        console.log(`✅ User upserted: ${u.email} (ID: ${user.id})`);
    }

    // Demo distributor
    const distEmail = "partner@webmydrive.com";
    const distHash = await bcrypt.hash("partner123", 10);
    const dist = await prisma.distributor.upsert({
        where: { email: distEmail },
        update: { passwordHash: distHash, passwordResetRequired: false },
        create: {
            name: "Demo Partner",
            email: distEmail,
            passwordHash: distHash,
            referralCode: "PARTNER2026",
            tier: "Gold",
            status: "ACTIVE",
            walletBalance: 200.0,
            revenueThisYear: 5000.0,
        },
    });
    console.log(`✅ Distributor upserted: ${distEmail} (ID: ${dist.id})`);

    console.log("\n─────────────────────────────────────");
    console.log("Demo accounts ready!");
    console.log("─────────────────────────────────────");
}

main()
    .catch(e => { console.error("❌", e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());

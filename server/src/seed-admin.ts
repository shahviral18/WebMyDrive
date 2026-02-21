/**
 * Seed script: Creates a default SUPERADMIN user.
 * Run once: npx ts-node --transpile-only src/seed-admin.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
    const email = "admin@webmydrive.com";
    const password = "Admin@123";
    const name = "Super Admin";

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        // If user exists but not SUPERADMIN, upgrade them
        if (existing.role !== "SUPERADMIN") {
            await prisma.user.update({
                where: { email },
                data: { role: "SUPERADMIN", name },
            });
            console.log(`✅ Existing user upgraded to SUPERADMIN: ${email}`);
        } else {
            console.log(`ℹ️  Admin already exists: ${email} (role: ${existing.role})`);
        }
        return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: {
            email,
            name,
            passwordHash,
            role: "SUPERADMIN",
            referralCode: "ADMIN0001",
            walletBalance: 0,
        },
    });

    console.log("✅ Default admin created successfully!");
    console.log(`   Email   : ${user.email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role    : ${user.role}`);
    console.log(`   ID      : ${user.id}`);
}

main()
    .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());

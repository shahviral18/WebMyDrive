/**
 * Seed script: Creates/updates the 4 official WebMyDrive plans
 * matching webmydrive.com pricing (yearly billing).
 * 
 * Run: npx ts-node --transpile-only src/seed-plans.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLANS = [
    {
        name: "Cloud Storage - Basic",
        priceINR: 250,
        price: 250,
        priceMonthlyINR: 330,
        priceYearlyINR: 250,
        storageGB: 500,
        isActive: true,
        hasOverride: true,
        features: JSON.stringify([
            { label: "500 GB Combined storage", value: "Included" },
            { label: "Google Drive", value: "Included" },
            { label: "Google Photos", value: "Included" },
            { label: "Google Mails Login", value: "Included" },
            { label: "Self Help Portal Access", value: "Included" },
            { label: "Remote Support", value: "Included" },
        ]),
    },
    {
        name: "Cloud Storage - Professional",
        priceINR: 420,
        price: 420,
        priceMonthlyINR: 550,
        priceYearlyINR: 420,
        storageGB: 5120,
        isActive: true,
        hasOverride: true,
        features: JSON.stringify([
            { label: "5 TB Combined storage", value: "Included" },
            { label: "Google Drive", value: "Included" },
            { label: "Google Photos", value: "Included" },
            { label: "Google Mails Login", value: "Included" },
            { label: "Self Help Portal Access", value: "Included" },
            { label: "Remote Support", value: "Included" },
        ]),
    },
    {
        name: "Cloud Storage - Premium",
        priceINR: 750,
        price: 750,
        priceMonthlyINR: 1000,
        priceYearlyINR: 750,
        storageGB: 51200,
        isActive: true,
        hasOverride: true,
        features: JSON.stringify([
            { label: "50 TB Combined storage", value: "Included" },
            { label: "Google Drive", value: "Included" },
            { label: "Google Photos", value: "Included" },
            { label: "Google Mails Login", value: "Included" },
            { label: "Self Help Portal Access", value: "Included" },
            { label: "Remote Support", value: "Included" },
        ]),
    },
    {
        name: "Cloud Storage - Enterprise",
        priceINR: 1250,
        price: 1250,
        priceMonthlyINR: 1650,
        priceYearlyINR: 1250,
        storageGB: 102400,
        isActive: true,
        hasOverride: true,
        features: JSON.stringify([
            { label: "100 TB Combined storage", value: "Included" },
            { label: "Google Drive", value: "Included" },
            { label: "Google Photos", value: "Included" },
            { label: "Google Mails Login", value: "Included" },
            { label: "Self Help Portal Access", value: "Included" },
            { label: "Remote Support", value: "Included" },
        ]),
    },
];

async function main() {
    console.log("🌱 Seeding WebMyDrive plans (yearly & monthly billing)...\\n");
    // Ensure to clean up any old "Pro" plans to replace with "Professional"
    await prisma.plan.deleteMany({ where: { name: "Cloud Storage - Pro" } });

    for (const plan of PLANS) {
        const existing = await prisma.plan.findFirst({ where: { name: plan.name } });
        if (existing) {
            const updated = await prisma.plan.update({
                where: { id: existing.id },
                data: plan,
            });
            console.log(`✏️  Updated: ${updated.name} — ₹${updated.priceINR}/mo (yearly) | ₹${updated.priceMonthlyINR}/mo (monthly)`);
        } else {
            const created = await prisma.plan.create({ data: plan });
            console.log(`✅  Created: ${created.name} — ₹${created.priceINR}/mo (yearly) | ₹${created.priceMonthlyINR}/mo (monthly)`);
        }
    }

    console.log("\\n─────────────────────────────────────────────");
    console.log("All 4 plans are ready. Open /admin/plans to verify.");
    console.log("─────────────────────────────────────────────");
}

main()
    .catch(e => { console.error("❌", e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Seeding essential plans...");
    const plans = [
        {
            name: "Business Starter",
            price: 1500,
            priceINR: 1500,
            features: JSON.stringify(["30 GB Storage", "Professional email", "Standard Support"]),
            isActive: true,
            storageGB: 30,
            maxUsers: 1,
            googleSKU: "GOOGLE_STARTER"
        },
        {
            name: "Business Standard",
            price: 6000,
            priceINR: 6000,
            features: JSON.stringify(["2 TB Storage", "Video meetings (150 users)", "Enhanced Support"]),
            isActive: true,
            storageGB: 2048,
            maxUsers: 100,
            googleSKU: "GOOGLE_STANDARD"
        },
        {
            name: "Business Plus",
            price: 12000,
            priceINR: 12000,
            features: JSON.stringify(["5 TB Storage", "Video meetings (500 users)", "Premium Support", "Enhanced Security"]),
            isActive: true,
            storageGB: 5120,
            maxUsers: 500,
            googleSKU: "GOOGLE_PLUS"
        }
    ];

    for (const p of plans) {
        await prisma.plan.upsert({
            where: { id: 0 }, // dummy where for create
            update: {},
            create: p,
        } as any);
    }
    console.log("Done seeding plans.");
}

main().catch(console.error).finally(() => prisma.$disconnect());

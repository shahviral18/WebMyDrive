import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding mandatory plans...');

    const plans = [
        {
            name: 'Business Starter',
            price: 3000,
            features: JSON.stringify(['30 GB storage', 'Custom email', '100 participant video meetings']),
            isActive: true,
        },
        {
            name: 'Business Standard',
            price: 9360,
            features: JSON.stringify(['2 TB storage', 'Custom email', '150 participant video meetings + recording']),
            isActive: true,
        },
        {
            name: 'Business Plus',
            price: 15600,
            features: JSON.stringify(['5 TB storage', 'Custom email', '500 participant video meetings + recording + tracking']),
            isActive: true,
        }
    ];

    for (const p of plans) {
        await (prisma.plan as any).create({ data: p });
    }

    // Also seed a test user if not exists
    const bcrypt = require('bcrypt');
    const userEmail = "user@webmydrive.com";
    const userPass = "User@1234";
    const userHash = await bcrypt.hash(userPass, 10);

    await (prisma.user as any).upsert({
        where: { email: userEmail },
        update: {},
        create: {
            name: "Test User",
            email: userEmail,
            passwordHash: userHash,
            role: "USER",
            referralCode: "TESTUSER01",
        },
    });

    console.log('✅ Seeding complete.');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

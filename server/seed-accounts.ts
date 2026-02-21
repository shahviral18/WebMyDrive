import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding missing accounts...');

    const password = 'Password@123';
    const hash = await bcrypt.hash(password, 10);

    // 1. Admin
    await prisma.user.upsert({
        where: { email: 'admin@webmydrive.com' },
        update: { passwordHash: hash, role: 'SUPERADMIN' },
        create: {
            name: 'Admin User',
            email: 'admin@webmydrive.com',
            passwordHash: hash,
            role: 'SUPERADMIN',
            referralCode: 'ADMIN01',
        },
    });

    // 2. Priya (likely a user or admin)
    await prisma.user.upsert({
        where: { email: 'priya@webmydrive.com' },
        update: { passwordHash: hash },
        create: {
            name: 'Priya',
            email: 'priya@webmydrive.com',
            passwordHash: hash,
            role: 'USER',
            referralCode: 'PRIYA01',
        },
    });

    // 3. Partner (Distributor)
    await prisma.distributor.upsert({
        where: { email: 'partner@webmydrive.com' },
        update: { passwordHash: hash },
        create: {
            name: 'Partner Distributor',
            email: 'partner@webmydrive.com',
            passwordHash: hash,
            tier: 'Starter',
            status: 'ACTIVE',
            referralCode: 'PARTNER01',
        },
    });

    console.log('✅ Accounts seeded successfully!');
    console.log('Email: [any of the above]');
    console.log('Password: Password@123');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

/**
 * Replaces ALL existing plans with the 4 WebMyDrive plans from the official pricing page.
 * Run: node seed-plans.js
 */
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

const PLANS = [
    {
        name: 'Cloud Storage – Basic',
        price: 250,
        priceINR: 250,
        storageGB: 500,
        maxUsers: 1,
        features: JSON.stringify([
            '500 GB Combined Storage',
            'Google Drive',
            'Google Photos',
            'Google Mails Login',
            'Self Help Portal Access',
            'Remote Support',
        ]),
        isActive: true,
    },
    {
        name: 'Cloud Storage – Pro',
        price: 420,
        priceINR: 420,
        storageGB: 5120,   // 5 TB in GB
        maxUsers: 1,
        features: JSON.stringify([
            '5 TB Combined Storage',
            'Google Drive',
            'Google Photos',
            'Google Mails Login',
            'Self Help Portal Access',
            'Remote Support',
        ]),
        isActive: true,
    },
    {
        name: 'Cloud Storage – Premium',
        price: 750,
        priceINR: 750,
        storageGB: 51200,  // 50 TB in GB
        maxUsers: 1,
        features: JSON.stringify([
            '50 TB Combined Storage',
            'Google Drive',
            'Google Photos',
            'Google Mails Login',
            'Self Help Portal Access',
            'Remote Support',
        ]),
        isActive: true,
    },
    {
        name: 'Cloud Storage – Enterprise',
        price: 1250,
        priceINR: 1250,
        storageGB: 102400, // 100 TB in GB
        maxUsers: 1,
        features: JSON.stringify([
            '100 TB Combined Storage',
            'Google Drive',
            'Google Photos',
            'Google Mails Login',
            'Self Help Portal Access',
            'Remote Support',
        ]),
        isActive: true,
    },
];

async function main() {
    console.log('🗑  Removing existing plans...');

    // Unlink any workspaces from plans first (FK constraint)
    await prisma.workspace.updateMany({ data: { planId: null } });

    // Unlink any orders from plans
    await prisma.order.updateMany({ data: { planId: null } });

    // Now delete all plans
    const deleted = await prisma.plan.deleteMany({});
    console.log(`   Deleted ${deleted.count} existing plan(s)\n`);

    console.log('✅ Creating new plans:');
    for (const plan of PLANS) {
        const created = await prisma.plan.create({ data: plan });
        console.log(`   [ID ${created.id}] ${created.name} — ₹${created.price}/mo`);
    }

    console.log('\n🎉 Plans seeded successfully!');
}

main()
    .catch(e => { console.error('ERROR:', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());

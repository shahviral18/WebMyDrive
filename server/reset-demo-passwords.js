const { PrismaClient } = require('./node_modules/@prisma/client');
const bcrypt = require('./node_modules/bcrypt');

const prisma = new PrismaClient();

async function main() {
    const userAccounts = [
        { email: 'admin@webmydrive.com', pass: 'admin123' },
        { email: 'priya@webmydrive.com', pass: 'priya123' },
        { email: 'amit@webmydrive.com', pass: 'amit123' },
    ];
    const distAccounts = [
        { email: 'partner@webmydrive.com', pass: 'partner123' },
    ];

    for (const a of userAccounts) {
        const hash = await bcrypt.hash(a.pass, 10);
        const r = await prisma.user.updateMany({ where: { email: a.email }, data: { passwordHash: hash } });
        console.log(`[user]  ${a.email} → rows updated: ${r.count}`);
    }

    for (const a of distAccounts) {
        const hash = await bcrypt.hash(a.pass, 10);
        const r = await prisma.distributor.updateMany({ where: { email: a.email }, data: { passwordHash: hash } });
        console.log(`[dist]  ${a.email} → rows updated: ${r.count}`);
    }

    console.log('\nAll demo passwords reset successfully!');
}

main()
    .catch(e => { console.error('ERROR:', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());

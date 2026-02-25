const { PrismaClient } = require('./node_modules/@prisma/client');
const p = new PrismaClient();

async function main() {
    // Show all audit logs
    const logs = await p.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
    console.log('\n=== ALL AUDIT LOGS (latest 30) ===');
    logs.forEach(l => console.log(`  [${l.id}] actor=${l.actorId} | action=${l.actionName} | payload=${l.payloadJson}`));

    // Show referral logs with amounts
    const refs = await p.referralLog.findMany({
        include: {
            referrerUser: { select: { email: true } },
            refereeUser: { select: { email: true } },
        },
        orderBy: { createdAt: 'desc' }
    });
    console.log('\n=== ALL REFERRAL LOGS ===');
    refs.forEach(r => console.log(
        `  [${r.id}] ${r.referrerUser.email} → ${r.refereeUser?.email} | orderId=${r.orderId} | ₹${r.amount} | ${r.status} | yr=${r.referralYear}`
    ));
}

main()
    .catch(e => console.error('ERROR:', e.message))
    .finally(() => p.$disconnect().then(() => process.exit(0)));

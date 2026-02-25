const { PrismaClient } = require('./node_modules/@prisma/client');
const p = new PrismaClient();

async function main() {
    const users = await p.user.findMany({
        select: { id: true, email: true, referralCode: true, walletBalance: true }
    });
    console.log('\n=== USERS ===');
    users.forEach(u => console.log(`  [${u.id}] ${u.email} | code=${u.referralCode} | wallet=₹${u.walletBalance}`));

    const orders = await p.order.findMany({
        include: { user: { select: { email: true } }, plan: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }, take: 10
    });
    console.log('\n=== ORDERS (latest 10) ===');
    orders.forEach(o => console.log(`  [${o.id}] ${o.user.email} | ${o.plan?.name ?? 'no-plan'} | ₹${o.amount} | ${o.status}`));

    const refs = await p.referralLog.findMany({
        include: {
            referrerUser: { select: { email: true } },
            refereeUser: { select: { email: true } },
            order: { select: { id: true, amount: true, status: true } }
        },
        orderBy: { createdAt: 'desc' }, take: 20
    });
    console.log('\n=== REFERRAL LOGS ===');
    if (refs.length === 0) console.log('  (none)');
    refs.forEach(r => console.log(
        `  [${r.id}] referrer=${r.referrerUser.email} → referee=${r.refereeUser?.email} | ` +
        `orderId=${r.orderId} | ₹${r.amount} | status=${r.status} | year=${r.referralYear}`
    ));

    const auditPromos = await p.auditLog.findMany({
        where: { actionName: '[Order] CHECKOUT_PROMO_CODE' },
        orderBy: { createdAt: 'desc' }, take: 10
    });
    console.log('\n=== CHECKOUT PROMO AUDIT LOGS ===');
    if (auditPromos.length === 0) console.log('  (none — codes not being stored at checkout!)');
    auditPromos.forEach(a => console.log(`  [${a.id}] actor=${a.actorId} | payload=${a.payloadJson}`));
}

main()
    .catch(e => console.error('ERROR:', e.message))
    .finally(() => p.$disconnect().then(() => process.exit(0)));

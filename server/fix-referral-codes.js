const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

function makeCode(name, email) {
    const src = (name || '').trim() || email.split('@')[0];
    // Take first word of name only (e.g. "Amit " → "AMIT", "Partner Distributor" → "PARTNER")
    const firstWord = src.split(/\s+/)[0];
    const base = firstWord.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 12);
    return base + '2026';
}

async function run() {
    // Fix users
    const users = await p.user.findMany({ select: { id: true, name: true, email: true, referralCode: true } });
    for (const u of users) {
        const desired = makeCode(u.name, u.email);
        if (u.referralCode === desired) {
            console.log(`[SKIP user]  ${u.email} — already ${desired}`);
            continue;
        }
        const conflict = await p.user.findFirst({ where: { referralCode: desired, NOT: { id: u.id } } });
        if (conflict) {
            console.log(`[SKIP user]  ${u.email} — ${desired} already taken by another user`);
            continue;
        }
        await p.user.update({ where: { id: u.id }, data: { referralCode: desired } });
        console.log(`[UPDATED user]  ${u.email}  ${u.referralCode}  →  ${desired}`);
    }

    // Fix distributors
    const dists = await p.distributor.findMany({ select: { id: true, name: true, email: true, referralCode: true } });
    for (const d of dists) {
        const desired = makeCode(d.name, d.email);
        if (d.referralCode === desired) {
            console.log(`[SKIP dist]  ${d.email} — already ${desired}`);
            continue;
        }
        const conflict = await p.distributor.findFirst({ where: { referralCode: desired, NOT: { id: d.id } } });
        if (conflict) {
            console.log(`[SKIP dist]  ${d.email} — ${desired} collision`);
            continue;
        }
        await p.distributor.update({ where: { id: d.id }, data: { referralCode: desired } });
        console.log(`[UPDATED dist]  ${d.email}  ${d.referralCode}  →  ${desired}`);
    }

    console.log('\nDone!');
    await p.$disconnect();
    process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });

import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function run() {
    const users = await p.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            referralsUsedBy: { select: { id: true }, take: 1 }
        }
    });

    const combined = users.map(u => ({
        email: u.email,
        distributorId: u.distributorId,
        referralsUsedCount: u.referralsUsedBy?.length ?? 0,
        source: u.distributorId ? 'Distributor' : (u.referralsUsedBy && u.referralsUsedBy.length > 0 ? 'User Referral' : 'Direct'),
    }));

    console.log(JSON.stringify(combined, null, 2));
    await p.$disconnect();
}

run().catch(console.error);

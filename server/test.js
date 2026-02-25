const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const users = await prisma.user.findMany({ select: { name: true, referralCode: true } });
    const dists = await prisma.distributor.findMany({ select: { name: true, referralCode: true } });
    console.log('USERS:', users);
    console.log('DISTRIBUTORS:', dists);
}
main().finally(() => prisma.$disconnect());

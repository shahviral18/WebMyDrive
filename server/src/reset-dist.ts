import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    let user = await prisma.user.findUnique({ where: { id: 1 } });
    if (!user) {
        user = await prisma.user.create({
            data: { id: 1, email: "admin@test.com", passwordHash: "123", name: "User 1" }
        });
    }

    await prisma.distributor.deleteMany({});
    await prisma.distributor.create({
        data: {
            id: 1,
            userId: user.id,
            email: 'distributor@test.com',
            tier: 'Silver',
            status: 'ACTIVE',
            joinDate: new Date(),
            resetDate: new Date(new Date().getFullYear() + 1, 0, 1),
            revenueThisYear: 150000,
            walletBalance: 12500
        }
    });

    console.log("Distributor 1 created");
}
run().catch(console.error).finally(() => prisma.$disconnect());

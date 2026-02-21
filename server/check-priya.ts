import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPriya() {
    const email = 'priya@webmydrive.com';
    const user = await prisma.user.findUnique({ where: { email } });
    console.log("User:", user?.id, user?.role, user?.passwordHash ? "Has Password" : "No Password");

    const distributor = await prisma.distributor.findUnique({ where: { email } });
    console.log("Distributor:", distributor?.id, distributor?.passwordHash ? "Has Password" : "No Password");
}

checkPriya()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

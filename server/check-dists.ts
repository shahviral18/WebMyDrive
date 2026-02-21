import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDistributors() {
    const distributors = await prisma.distributor.findMany();
    console.log("Distributors:", distributors.map((d: any) => ({ email: d.email, name: d.name, hasPassword: !!d.passwordHash })));
}

checkDistributors()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

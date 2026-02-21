import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany();
    const distributors = await prisma.distributor.findMany();

    console.log('--- USERS ---');
    users.forEach(u => console.log(`${u.id}: ${u.email} [${u.role}]`));

    console.log('\n--- DISTRIBUTORS ---');
    distributors.forEach(d => console.log(`${d.id}: ${d.email} [${d.tier}]`));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function resetDistributor() {
    const email = 'partner@webmydrive.com';
    const passwordHash = await bcrypt.hash('password123', 10);
    await prisma.distributor.update({
        where: { email },
        data: { passwordHash }
    });
    console.log("Reset password for partner@webmydrive.com to password123");
}

resetDistributor()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

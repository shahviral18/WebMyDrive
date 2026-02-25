import { prisma } from '../models';

export class ReferralLinkService {
    static generateRandomCode(length = 8): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    static async getActiveLink(referrerId: number, role: 'USER' | 'DISTRIBUTOR') {
        let link = await prisma.referralLink.findFirst({
            where: { referrerId, role, status: 'ACTIVE' },
        });

        if (!link) {
            // Check if they have a base code
            let baseCode: string | null = null;
            if (role === 'USER') {
                const user = await prisma.user.findUnique({ where: { id: referrerId } });
                baseCode = user?.referralCode || null;
            } else {
                const dist = await prisma.distributor.findUnique({ where: { id: referrerId } });
                baseCode = dist?.referralCode || null;
            }

            // Fallback generation: Try their base code first if it doesn't exist
            let newCode = baseCode && baseCode.length > 0 ? baseCode : this.generateRandomCode();
            let isUnique = false;
            let counter = 0;
            while (!isUnique) {
                const suffix = counter > 0 ? `${counter}` : '';
                const testCode = `${newCode}${suffix}`;
                const existing = await prisma.referralLink.findUnique({ where: { code: testCode } });
                if (!existing) {
                    newCode = testCode;
                    isUnique = true;
                }
                counter++;
            }

            link = await prisma.referralLink.create({
                data: {
                    code: newCode,
                    referrerId,
                    role,
                    status: 'ACTIVE'
                }
            });
        }
        return link;
    }

    static async validateCode(code: string) {
        return prisma.referralLink.findFirst({
            where: { code, status: 'ACTIVE' }
        });
    }

    static async markUsedAndGenerateNew(code: string) {
        const link = await prisma.referralLink.findUnique({ where: { code } });
        if (!link || link.status !== 'ACTIVE') return null;

        await prisma.referralLink.update({
            where: { id: link.id },
            data: { status: 'USED', usedAt: new Date() }
        });

        return this.getActiveLink(link.referrerId, link.role as 'USER' | 'DISTRIBUTOR');
    }
}

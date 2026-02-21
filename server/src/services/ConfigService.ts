import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const DEFAULT_USER_REFERRAL_CONFIG = {
    referrerCreditRate: 0.05,
    referredDiscountRate: 0.025,
    decaySchedule: [0.05, 0.04, 0.03, 0.02, 0.01, 0],
    nudgeThreshold: 5,
    upgradeFeeDiscount: 0,
    allowNewReferrals: true,
    disableReferralsFromDate: null as string | null,
    existingReferralsOnDisable: "CONTINUE_DECAY" // CONTINUE_DECAY, STOP_IMMEDIATELY
};

export const DEFAULT_DISTRIBUTOR_CONFIG = {
    tiers: [
        { name: "Starter", threshold: 0, rate: 0.10 },
        { name: "Silver", threshold: 100000, rate: 0.15 },
        { name: "Gold", threshold: 300000, rate: 0.20 }
    ],
    annualFee: 5000,
    feeRefundTier: "Silver",
    tiersDroppedPerYear: 1,
    decayMultipliers: [1.0, 0.8, 0.6, 0.4, 0.2, 0],
    allowNewSignups: true,
    disableProgramFromDate: null as string | null,
    existingOnDisable: "CONTINUE" // CONTINUE, FREEZE, TERMINATE
};

export const DEFAULT_WALLET_CONFIG = {
    distributorMinBalance: 2000,
    payoutThreshold: 5000, // Available > 5000 means Balance > 7000? Wait. Doc says: "Payout threshold: Rs 5,000 (available amount above minimum balance)". This means payout is allowed if available amount reaches 5000. So balance >= 7000.
    lapseWalletForfeit: true
};

export class ConfigService {
    static async getConfig(key: string, defaultValue: any) {
        const config = await prisma.adminConfig.findUnique({ where: { key } });
        if (!config) return defaultValue;
        try {
            return JSON.parse(config.value);
        } catch {
            return defaultValue;
        }
    }

    static async setConfig(key: string, value: any) {
        await prisma.adminConfig.upsert({
            where: { key },
            update: { value: JSON.stringify(value) },
            create: { key, value: JSON.stringify(value) }
        });
    }

    static async getUserReferralConfig() {
        return this.getConfig('USER_REFERRAL_SETTINGS', DEFAULT_USER_REFERRAL_CONFIG);
    }

    static async getDistributorConfig() {
        return this.getConfig('DISTRIBUTOR_SETTINGS', DEFAULT_DISTRIBUTOR_CONFIG);
    }

    static async getWalletConfig() {
        return this.getConfig('WALLET_SETTINGS', DEFAULT_WALLET_CONFIG);
    }
}

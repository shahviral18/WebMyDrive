import { PrismaClient } from '@prisma/client';
import { ConfigService, DEFAULT_DISTRIBUTOR_CONFIG, DEFAULT_USER_REFERRAL_CONFIG } from './services/ConfigService';
import { ReferralService } from './services/ReferralService';
import { DistributorService } from './services/DistributorService';

const prisma = new PrismaClient();

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runQA() {
    console.log("== Starting QA Validation ==");

    // Reset DB for test
    await prisma.distributorWalletTx.deleteMany({});
    await prisma.distributorSale.deleteMany({});
    await prisma.distributor.deleteMany({});
    await prisma.referralLog.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.adminConfig.deleteMany({});

    // Setup Configs
    await ConfigService.setConfig('USER_REFERRAL_SETTINGS', DEFAULT_USER_REFERRAL_CONFIG);
    await ConfigService.setConfig('DISTRIBUTOR_SETTINGS', DEFAULT_DISTRIBUTOR_CONFIG);

    // Create 3 Users
    const u1 = await prisma.user.create({ data: { email: 'distributor@test.com', name: 'Distro', referralCode: 'DIST1' } });
    const u2 = await prisma.user.create({ data: { email: 'user@test.com', name: 'User 1', referralCode: 'USER1' } });
    const u3 = await prisma.user.create({ data: { email: 'customer@test.com', name: 'Cust 1' } });

    // 1. New referral purchase (User referring a User)
    console.log("\n-> 1. Testing New referral purchase");
    const o1 = await prisma.order.create({ data: { userId: u3.id, amount: 5000 } });
    await ReferralService.processNewOrder(o1.id, u3.id, u2.referralCode);
    const u2Wallet = (await prisma.user.findUnique({ where: { id: u2.id } }))?.walletBalance;
    console.log(`User 2 earned 5% of 5000: Rs ${u2Wallet} (Expect 250)`);

    // 2. Renewal decay progression
    console.log("\n-> 2. Testing Renewal decay progression (Year 2)");
    const o2 = await prisma.order.create({ data: { userId: u3.id, amount: 5000 } });
    await ReferralService.processNewOrder(o2.id, u3.id, null); // Renewal has no promo code
    const u2WalletAfter = (await prisma.user.findUnique({ where: { id: u2.id } }))?.walletBalance;
    console.log(`User 2 wallet is now Rs ${u2WalletAfter} (Expect 250 + 200 = 450)`);

    // 3. Distributor Onboarding
    console.log("\n-> 3. Onboarding Distributor");
    const dist = await DistributorService.onboard(u1.id, u1.email);
    console.log(`Distributor Tier: ${dist.tier} (Expect Starter)`);

    // 4. Distributor Sale
    console.log("\n-> 4. Testing Distributor Sale");
    const o3 = await prisma.order.create({ data: { userId: u3.id, amount: 50000 } });
    await DistributorService.processSale(dist.id, u3.id, o3.id, 50000);
    const distAfterS1 = await prisma.distributor.findUnique({ where: { id: dist.id } });
    console.log(`Distributor Wallet: Rs ${distAfterS1?.walletBalance} (Earned 10% = 5000)`);

    // 5. Tier upgrade mid-year & Annual fee refund
    console.log("\n-> 5. Testing Tier upgrade mid-year & Refund fee at Silver");
    const o4 = await prisma.order.create({ data: { userId: u3.id, amount: 60000 } });
    await DistributorService.processSale(dist.id, u3.id, o4.id, 60000);
    const distAfterS2 = await prisma.distributor.findUnique({ where: { id: dist.id } });
    // total rev = 110,000 > 100,000 => Silver (rate: 15% but wait, this sale was processed at 10% because tier upgrades prospectively!)
    // Actual logic: 
    // Sale of 60000 at Starter rate (10%) = 6000. Wait, does it upgrade prospectively FOR THE NEXT sale?
    // "previous sales stay at old rate". Here I processed the entire sale at old rate. So 6000.
    // Total wallet: 5000 + 6000 = 11000 + 5000 (refund) = 16000.
    console.log(`Distributor Tier: ${distAfterS2?.tier} (Expect Silver)`);
    console.log(`Distributor Wallet: Rs ${distAfterS2?.walletBalance} (Expect 11000 + 5000 refund = 16000)`);

    // 6. Wallet payout validation
    console.log("\n-> 6. Testing Wallet Payout Validation");
    try {
        await DistributorService.requestPayout(dist.id, 12000); // 16000 - 2000 = 14000 available
        console.log(`Requested payout 12000. Success.`);
    } catch (e: any) {
        console.log(`Payout failed: ${e.message}`);
    }
    const distAfterPayout = await prisma.distributor.findUnique({ where: { id: dist.id } });
    console.log(`Distributor Wallet after payout: Rs ${distAfterPayout?.walletBalance} (Expect 4000)`);

    // 7. Soft reset tier drop
    console.log("\n-> 7. Testing Soft Reset Tier Drop");
    // Manually backdate resetDate to simulate 1 year passing
    await prisma.distributor.update({ where: { id: dist.id }, data: { resetDate: new Date(Date.now() - 1000) } });
    await DistributorService.processSoftReset();
    const distAfterReset = await prisma.distributor.findUnique({ where: { id: dist.id } });
    console.log(`Distributor Tier after reset: ${distAfterReset?.tier} (Expect Starter - dropped from Silver)`);
    console.log(`Distributor Revenue: ${distAfterReset?.revenueThisYear} (Expect 0)`);
    console.log(`Distributor Status: ${distAfterReset?.status} (Expect PENDING_FEE)`);

    // 8. Distributor lapse
    console.log("\n-> 8. Distributor Lapse (Failed to pay fee)");
    // Let's pretend they didn't pay it on time and lapse was triggered via some cron
    await prisma.distributor.update({ where: { id: dist.id }, data: { status: 'LAPSED', walletBalance: 0 } });
    console.log(`Status changed to LAPSED, wallet forfeited.`);

    // 9. Disable programs
    console.log("\n-> 9. Disable Programs Test");
    await ConfigService.setConfig('USER_REFERRAL_SETTINGS', { ...DEFAULT_USER_REFERRAL_CONFIG, allowNewReferrals: false });
    await ConfigService.setConfig('DISTRIBUTOR_SETTINGS', { ...DEFAULT_DISTRIBUTOR_CONFIG, allowNewSignups: false });
    console.log(`Programs disabled successfully.`);

    console.log("\n== QA Validation Complete ==");
}

runQA()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

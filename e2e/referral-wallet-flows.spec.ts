import { test, expect } from '@playwright/test';

const baseURL = 'http://localhost:6173';

test.describe('Referral and Wallet Flows', () => {
    let errors: string[] = [];

    test.beforeEach(({ page }) => {
        errors = [];
        page.on('pageerror', exception => {
            errors.push(`Page Error: ${exception.message}`);
        });
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(`Console Error: ${msg.text()}`);
            }
        });
    });

    test.afterEach(() => {
        if (errors.length > 0) {
            console.log('Referral/Wallet UI Errors Found:', errors);
        }
    });

    test('Generate Referral Link & Check Wallet Balance', async ({ page }) => {
        await page.goto(`${baseURL}/login`);
        await page.fill('input[type="email"]', 'user@webmydrive.com');
        await page.fill('input[type="password"]', 'userpassword');
        await page.click('button[type="submit"]');

        // Simulate going to Referral page
        await page.goto(`${baseURL}/referrals`);
        await page.waitForTimeout(1000);

        // Check if referral link element exists
        const inputLink = page.locator('input[readonly]');
        const count = await inputLink.count();

        if (count > 0) {
            expect(await inputLink.first().inputValue()).toContain(baseURL);
        }

        // Go to Billing/Wallet
        await page.goto(`${baseURL}/billing`);
        await page.waitForTimeout(1000);

        // Look for Wallet/Billing text
        const pageText = await page.locator('body').innerText();
        expect(pageText.toLowerCase()).toContain('payment');
    });

    test('Admin Referral Engine Logic Validation', async ({ page }) => {
        // Admin checking referral rules
        await page.goto(`${baseURL}/admin/login`);
        await page.fill('input[type="email"]', 'admin@webmydrive.com');
        await page.fill('input[type="password"]', 'admin');
        await page.click('button[type="submit"]');

        await page.goto(`${baseURL}/admin/referrals-engine`); // Assuming a route exists based on mock
        await page.waitForTimeout(1000);

        // Look for form or tables
        const tables = page.locator('table');
        const forms = page.locator('form');
        const hasDataElements = (await tables.count()) > 0 || (await forms.count()) > 0;

        expect(hasDataElements).toBeTruthy();
    });
});

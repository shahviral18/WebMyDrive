import { test, expect } from '@playwright/test';

const baseURL = 'http://localhost:6173';

test.describe('Admin Flows', () => {
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
            console.log('Admin UI Errors Found:', errors);
        }
    });

    test('Admin Dashboard & Navigation', async ({ page }) => {
        await page.goto(`${baseURL}/admin/login`);
        await page.fill('input[type="email"]', 'admin@webmydrive.com');
        await page.fill('input[type="password"]', 'admin');
        await page.click('button[type="submit"]');

        await page.waitForTimeout(1000);
        await page.goto(`${baseURL}/admin/dashboard`);
        await expect(page.locator('h1').first()).toBeVisible();

        const routes = [
            '/admin/users',
            '/admin/billing',
            '/admin/referrals',
            '/admin/distributors',
            '/admin/settings',
            '/admin/audit-logs'
        ];

        for (const route of routes) {
            await page.goto(`${baseURL}${route}`);
            await page.waitForTimeout(500);

            // Ensure page rendered something (not a blank screen/crash)
            const bodyText = await page.locator('body').innerText();
            expect(bodyText.length).toBeGreaterThan(10);

            // Look for any 'dead' buttons that might be linked to '#'
            const deadLinks = page.locator('a[href="#"]');
            const count = await deadLinks.count();
            if (count > 0) {
                console.log(`Found ${count} dead links on ${route}`);
            }
        }
    });
});

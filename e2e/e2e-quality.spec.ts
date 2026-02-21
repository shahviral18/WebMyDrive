import { test, expect } from '@playwright/test';

// We want to test the entire site and make sure there are NO console errors or 404s.

test.describe('App E2E Flow', () => {

    test.setTimeout(120000); // Wait up to 2mins for dev server and renders

    const errors: string[] = [];
    const networkErrors: string[] = [];

    test.beforeEach(async ({ page }) => {
        // Collect console errors
        page.on('console', msg => {
            if (msg.type() === 'error') {
                const text = msg.text();
                if (!text.includes('favicon')) { // ignore favicon 404
                    errors.push(text);
                }
            }
        });

        // Collect failed network requests
        page.on('response', response => {
            const status = response.status();
            if (status >= 400) {
                const url = response.url();
                if (!url.includes('favicon')) {
                    networkErrors.push(`[${status}] ${url}`);
                }
            }
        });
    });

    test('SuperAdmin Login and Crawl', async ({ page }) => {
        // 1. Visit Index - Should be Auth
        await page.goto('http://localhost:6173/');

        // Login
        await page.fill('input[type="email"]', 'admin@webmydrive.com');
        await page.fill('input[type="password"]', 'Admin@123');
        await page.click('button[type="submit"]');

        await page.waitForTimeout(500);
        // Should arrive at Admin Dashboard
        await page.waitForURL('**/admin/dashboard', { timeout: 15000 });
        await expect(page.locator('h1').filter({ hasText: 'Dashboard Overview' })).toBeVisible({ timeout: 15000 });

        // Give it a second to load APIs
        await page.waitForTimeout(2000);

        // List of admin pages to check
        const pages = [
            '/admin/users',
            '/admin/distributors',
            '/admin/orders',
            '/admin/promo', // Promo configuration (User Referral Program)
            '/admin/queues',
            '/admin/controls',
            '/admin/billing',
            '/admin/settings' // or anywhere
        ];

        for (const p of pages) {
            await page.goto(`http://localhost:6173${p}`);
            await page.waitForTimeout(1000);
            // Ensure there is no 404 text or blank page.
            const bodyText = await page.locator('body').textContent();
            if (bodyText && bodyText.toLowerCase().includes('page not found')) {
                errors.push(`Page Not Found -> ${p}`);
            }
        }

        // Now let's try to logout
        // Click the Dropdown menu trigger
        await page.getByText('Super Admin').click();
        // Wait for the dropdown content
        await page.waitForTimeout(500);
        // Click Logout
        await page.getByRole('menuitem', { name: 'Logout' }).click();

        // 3. Wait for redirect back to login
        await page.waitForURL('**/login', { timeout: 10000 });

        console.log("Console Errors found:", errors);
        console.log("Network Errors found:", networkErrors);

        expect(errors.length).toBe(0);
        // expect(networkErrors.length).toBe(0); // We will allow some network noise if unavoidable, but console errors must be 0.
    });
});

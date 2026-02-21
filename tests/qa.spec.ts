import { test, expect } from '@playwright/test';

// Use standard local servers running on ports 4000 (backend) and 8080 (frontend react default is 8080 or 5173 for vite)
// WebMyDrive frontend running on http://localhost:8080

const BASE_URL = 'http://localhost:8080'; // Update this if vite runs on 5173

test.describe('WebMyDrive Production QA Suite', () => {

    test('1. Check Zero 404 Routes - Admin Redirects', async ({ page }) => {
        // Unbuilt admin route should redirect to Coming Soon or Dashboard
        await page.goto(`${BASE_URL}/admin/some-fake-path`);
        const bodyText = await page.innerText('body');
        expect(bodyText).toContain('Super Admin'); // or dashboard elements
        expect(bodyText).not.toContain('Oops! Page not found');
    });

    test('2. Verify Admin Dashboard Loads & is Dark Mode', async ({ page }) => {
        await page.goto(`${BASE_URL}/admin/dashboard`);
        const html = await page.locator('html');
        await expect(html).toHaveClass(/dark/);

        // Wait for charts/canvas
        await page.waitForSelector('.recharts-wrapper', { timeout: 10000 }).catch(() => null);

        // Check Admin Name
        await expect(page.locator('text=Super Admin')).toBeVisible();
    });

    test('3. Verify User Dashboard Access Control', async ({ page }) => {
        // Go to user layout
        await page.goto(`${BASE_URL}/user/dashboard`);
        // We should see "Welcome back" or similar
        const bodyText = await page.innerText('body');
        expect(bodyText).not.toContain('Distributor Partner');

        // Check referrals section
        await page.goto(`${BASE_URL}/user/referrals`);
        await expect(page.locator('text=Referrals & Rewards')).toBeVisible();
    });

    test('4. Full Distributor Wallet Validation', async ({ page }) => {
        await page.goto(`${BASE_URL}/distributor/payouts`);
        // Need to wait for data fetching
        await page.waitForTimeout(2000);

        // The wallet should be visible
        await expect(page.locator('text=Payouts')).toBeVisible();
    });

    test('5. Check Theme Toggles Removed', async ({ page }) => {
        await page.goto(`${BASE_URL}/admin/dashboard`);
        // We removed the sun/moon toggle, let's verify moon icon is missing
        const moonIcons = await page.locator('svg.lucide-moon').count();
        expect(moonIcons).toBe(0);
    });

});

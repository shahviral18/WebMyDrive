import { test, expect } from '@playwright/test';

test('take screenshot', async ({ page }) => {
    await page.goto('http://localhost:6173/');
    await page.fill('input[type="email"]', 'admin@webmydrive.com');
    await page.fill('input[type="password"]', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard');

    await page.goto('http://localhost:6173/admin/audit-logs');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'audit-logs-screenshot.png' });

    await page.goto('http://localhost:6173/admin/settings');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'settings-screenshot.png' });
});

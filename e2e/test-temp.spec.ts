import { test, expect } from '@playwright/test';

test('check page', async ({ page }) => {
    await page.goto('http://localhost:6173/');
    await page.fill('input[type="email"]', 'admin@webmydrive.com');
    await page.fill('input[type="password"]', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard');

    await page.goto('http://localhost:6173/admin/settings');
    await page.waitForTimeout(2000);
    const html1 = await page.locator('main').innerHTML();
    console.log("Settings HTML:", html1.substring(0, 500));

    await page.goto('http://localhost:6173/admin/audit-logs');
    await page.waitForTimeout(2000);
    const html2 = await page.locator('main').innerHTML();
    console.log("AuditLogs HTML:", html2.substring(0, 500));
});

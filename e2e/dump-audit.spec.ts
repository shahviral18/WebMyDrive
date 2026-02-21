import { test, expect } from '@playwright/test';

test('Dump Audit Logs HTML', async ({ page }) => {
    await page.goto('http://localhost:6173/admin/login');
    await page.fill('input[type="email"]', 'admin@webmydrive.com');
    await page.fill('input[type="password"]', 'admin123'); // Password was wrong in previous snippet too
    await page.click('button[type="submit"]');

    // Wait for the OTP inputs
    await page.waitForSelector('input[name=""]', { state: 'attached' }); // Assuming input-otp uses un-named inputs, let's just use keyboard
    await page.waitForTimeout(1000);
    await page.keyboard.type('123456');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/admin/dashboard');

    await page.goto('http://localhost:6173/admin/audit-logs');
    await page.waitForTimeout(3000);

    const html = await page.innerHTML('body');
    console.log("BODY HTML IS: ", html);
});

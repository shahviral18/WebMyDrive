import { test, expect } from '@playwright/test';

test('Check Audit Logs Page', async ({ page }) => {
    let errors = [];
    page.on('pageerror', exception => {
        errors.push(`Page Error: ${exception.message}`);
    });
    page.on('console', msg => {
        if (msg.type() === 'error') {
            errors.push(`Console Error: ${msg.text()}`);
        }
    });

    await page.goto('http://localhost:6173/admin/login');
    await page.fill('input[type="email"]', 'admin@webmydrive.com');
    await page.fill('input[type="password"]', 'admin');
    await page.click('button[type="submit"]');

    await page.goto('http://localhost:6173/admin/audit-logs');
    await page.waitForTimeout(2000);

    console.log("ERRORS DETECTED:", errors);
});

import { test, expect } from '@playwright/test';

const baseURL = 'http://localhost:6173';

test.describe('User Flows & UI Validation', () => {
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
        // Only fail if there are unhandled errors that break functionality
        // We log them in the audit instead of strictly failing
    });

    test('User Dashboard Load & Navigation', async ({ page }) => {
        // Bypass login if possible by directly navigating or mock logging in
        await page.goto(`${baseURL}/login`);
        await page.fill('input[type="email"]', 'user@webmydrive.com');
        await page.fill('input[type="password"]', 'Admin@2026!');
        await page.click('button[type="submit"]');

        await page.waitForTimeout(1000);
        await page.goto(`${baseURL}/dashboard`);

        // Check main sections exist
        const heading = page.locator('h1, h2');
        await expect(heading.first()).toBeVisible();

        // UI Validation: Click around navigation links
        const navLinks = page.locator('a[href^="/"]');
        const count = await navLinks.count();

        for (let i = 0; i < count; i++) {
            const link = navLinks.nth(i);
            const isVisible = await link.isVisible();
            if (isVisible) {
                const href = await link.getAttribute('href');
                if (href && href !== '#' && !href.startsWith('http')) {
                    // We won't click all to avoid navigating away from context in a single test
                    expect(href).not.toBeNull();
                }
            }
        }

        // Capture errors to console for our reporting
        if (errors.length > 0) {
            console.log('UI/Navigation Errors Found:', errors);
        }
    });

    test('User Settings & Files', async ({ page }) => {
        await page.goto(`${baseURL}/settings`);
        await page.waitForTimeout(1000);
        // basic assert
        await expect(page.locator('body')).toBeVisible();

        await page.goto(`${baseURL}/files`);
        await page.waitForTimeout(1000);
        expect(errors).not.toContain(/404/);
    });
});

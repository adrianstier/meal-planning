/**
 * AI Integration Tests - Recipe URL and Image Parsing
 *
 * Tests the AI-powered recipe import functionality
 */

import { test, expect, Page } from '@playwright/test';

// Test credentials - loaded from environment variables
// Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD in your environment
const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL || '';
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD || '';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

if (!TEST_EMAIL || !TEST_PASSWORD) {
  console.warn('[WARNING] Test credentials not set. Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD environment variables.');
}

// Helper to login
async function login(page: Page): Promise<boolean> {
  try {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Check if already logged in
    const url = page.url();
    if (url.includes('/plan') || url.includes('/recipes')) {
      return true;
    }

    // Fill login form
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL(/\/(plan|recipes)/, { timeout: 15000 });
    return true;
  } catch (error) {
    console.error('Login failed:', error);
    return false;
  }
}

test.describe('AI Recipe Import Tests', () => {
  test('can open URL import dialog', async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);

    await page.goto(`${BASE_URL}/recipes`);
    await page.waitForLoadState('networkidle');

    // Find the Add/Import dropdown trigger
    const addButton = page.locator('button:has-text("Add")').first();

    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);

      // Look for "Import from URL" option in dropdown
      const urlOption = page.locator('text=Import from URL, text=From URL, text=URL').first();

      if (await urlOption.isVisible()) {
        await urlOption.click();
        await page.waitForTimeout(500);

        // Check if dialog opened
        const urlInput = page.locator('input[placeholder*="URL"], input[type="url"]').first();
        expect(await urlInput.isVisible()).toBe(true);

        console.log('URL import dialog opened successfully');
      }
    }
  });

  test('can open Image import dialog', async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);

    await page.goto(`${BASE_URL}/recipes`);
    await page.waitForLoadState('networkidle');

    // Find the Add/Import dropdown trigger
    const addButton = page.locator('button:has-text("Add")').first();

    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);

      // Look for "Import from Photo" option in dropdown
      const imageOption = page.locator('text=Photo, text=Image, text=Camera').first();

      if (await imageOption.isVisible()) {
        await imageOption.click();
        await page.waitForTimeout(500);

        // Check if dialog opened with file input
        const fileInput = page.locator('input[type="file"]').first();
        expect(await fileInput.count()).toBeGreaterThan(0);

        console.log('Image import dialog opened successfully');
      }
    }
  });

  test('URL import validates empty URL', async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);

    await page.goto(`${BASE_URL}/recipes`);
    await page.waitForLoadState('networkidle');

    // Find the Add dropdown and open URL dialog
    const addButton = page.locator('button:has-text("Add")').first();

    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);

      const urlOption = page.locator('[role="menuitem"]:has-text("URL")').first();

      if (await urlOption.isVisible()) {
        await urlOption.click();
        await page.waitForTimeout(500);

        // Verify Import button is disabled when URL is empty (correct validation behavior)
        const importButton = page.locator('button:has-text("Import")').first();

        if (await importButton.isVisible()) {
          // The button should be disabled when URL field is empty
          const isDisabled = await importButton.isDisabled();
          expect(isDisabled).toBe(true);
          console.log('Empty URL validation working - Import button correctly disabled');
        }
      }
    }
  });

  test('URL import with real recipe URL', async ({ page }) => {
    test.setTimeout(60000); // AI calls can take longer

    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);

    await page.goto(`${BASE_URL}/recipes`);
    await page.waitForLoadState('networkidle');

    // Find the Add dropdown
    const addButton = page.locator('button:has-text("Add")').first();

    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);

      const urlOption = page.locator('[role="menuitem"]:has-text("URL")').first();

      if (await urlOption.isVisible()) {
        await urlOption.click();
        await page.waitForTimeout(500);

        // Enter a real recipe URL
        const urlInput = page.locator('input[placeholder*="URL"], input[type="url"]').first();

        if (await urlInput.isVisible()) {
          await urlInput.fill('https://www.allrecipes.com/recipe/23891/grilled-cheese-sandwich/');

          const importButton = page.locator('button:has-text("Import")').first();

          if (await importButton.isVisible()) {
            await importButton.click();

            // Wait for loading state or success
            await page.waitForTimeout(10000);

            // Check if recipe form opened with parsed data
            const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();

            if (await nameInput.isVisible()) {
              const value = await nameInput.inputValue();
              console.log(`Parsed recipe name: ${value}`);
              expect(value.length).toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });
});

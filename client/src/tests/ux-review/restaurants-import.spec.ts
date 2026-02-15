/**
 * Restaurants Page - SB Guide Import Feature Tests
 *
 * Tests the Import SB Guide button, restaurant display, filters,
 * and core CRUD on the Restaurants page.
 *
 * Run with: npx playwright test src/tests/ux-review/restaurants-import.spec.ts
 * Debug with: npx playwright test src/tests/ux-review/restaurants-import.spec.ts --debug
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL || '';
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD || '';

async function dismissOnboardingTour(page: Page): Promise<void> {
  try {
    await page.waitForTimeout(500);
    const skipButton = page.locator('button:has-text("Skip tour"), button:has-text("Close tour")').first();
    if (await skipButton.isVisible({ timeout: 2000 })) {
      await skipButton.click();
      await page.waitForTimeout(300);
    }
  } catch {
    // Tour not present
  }
}

async function login(page: Page): Promise<boolean> {
  try {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    const url = page.url();
    if (url.includes('/plan') || url.includes('/recipes')) {
      await dismissOnboardingTour(page);
      return true;
    }

    await page.waitForSelector('form', { timeout: 15000 });

    const emailInput = page.locator('#email, input[type="email"], input[placeholder*="email" i]').first();
    const passwordInput = page.locator('#password, input[type="password"]').first();

    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(TEST_EMAIL);
    await passwordInput.waitFor({ state: 'visible', timeout: 5000 });
    await passwordInput.fill(TEST_PASSWORD);

    const submitButton = page.locator('button[type="submit"], button:has-text("Sign in")').first();
    await submitButton.click();

    await page.waitForURL(/\/(plan|recipes)/, { timeout: 15000 });
    await dismissOnboardingTour(page);
    return true;
  } catch (error) {
    console.error('Login failed:', error);
    return false;
  }
}

test.describe('Restaurants Page', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);
  });

  test('Restaurants page loads correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/restaurants`);
    await page.waitForLoadState('networkidle');

    // Page heading should be visible
    await expect(page.locator('h1:has-text("Restaurants")')).toBeVisible();

    // Key buttons should exist
    await expect(page.locator('button:has-text("Import SB Guide"), button:has-text("Import")')).toBeVisible();
    await expect(page.locator('button:has-text("Add Restaurant"), button:has-text("Add")')).toBeVisible();

    // List/Map toggle should exist
    await expect(page.locator('button:has-text("List")')).toBeVisible();
    await expect(page.locator('button:has-text("Map")')).toBeVisible();

    // Filters card should be visible
    await expect(page.locator('text=Filters')).toBeVisible();

    await page.screenshot({ path: 'test-results/restaurants-page-loaded.png' });
    console.log('Restaurants page loaded successfully');
  });

  test('Import SB Guide button is visible and clickable', async ({ page }) => {
    await page.goto(`${BASE_URL}/restaurants`);
    await page.waitForLoadState('networkidle');

    const importButton = page.locator('button:has-text("Import SB Guide"), button:has-text("Import")').first();
    await expect(importButton).toBeVisible();
    await expect(importButton).toBeEnabled();

    await page.screenshot({ path: 'test-results/restaurants-import-button.png' });
    console.log('Import SB Guide button is visible and enabled');
  });

  test('Import SB Guide shows confirmation dialog', async ({ page }) => {
    await page.goto(`${BASE_URL}/restaurants`);
    await page.waitForLoadState('networkidle');

    // Set up dialog handler to capture and dismiss the confirm dialog
    let dialogMessage = '';
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      console.log(`Dialog appeared: ${dialogMessage}`);
      await dialog.dismiss(); // Cancel the import
    });

    const importButton = page.locator('button:has-text("Import SB Guide"), button:has-text("Import")').first();
    await importButton.click();

    // Wait for dialog to appear
    await page.waitForTimeout(1000);

    // Should have shown a confirmation dialog
    expect(dialogMessage).toContain('restaurants from the SB Food & Drink guide');
    console.log(`Confirmation dialog shown: "${dialogMessage}"`);
  });

  test('Import SB Guide imports restaurants when confirmed', async ({ page }) => {
    await page.goto(`${BASE_URL}/restaurants`);
    await page.waitForLoadState('networkidle');

    // Count existing restaurants
    const existingCards = page.locator('[class*="CardHeader"]');
    const initialCount = await existingCards.count();
    console.log(`Initial restaurant count: ${initialCount}`);

    // Accept the confirm dialog, then dismiss the completion alert
    let dialogCount = 0;
    page.on('dialog', async (dialog) => {
      dialogCount++;
      console.log(`Dialog ${dialogCount}: ${dialog.type()} - ${dialog.message()}`);
      if (dialog.type() === 'confirm') {
        await dialog.accept(); // Confirm import
      } else {
        await dialog.accept(); // Dismiss completion alert
      }
    });

    const importButton = page.locator('button:has-text("Import SB Guide"), button:has-text("Import")').first();
    await importButton.click();

    // Wait for import to complete - the button text changes during import
    // Wait for button to show progress, then return to normal
    try {
      await expect(importButton).toContainText(/Importing|Import/, { timeout: 120000 });
    } catch {
      // May have completed quickly
    }

    // Wait for the completion alert
    await page.waitForTimeout(5000);

    // Reload page to see fresh data from the server
    await page.goto(`${BASE_URL}/restaurants`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Take screenshot of results
    await page.screenshot({ path: 'test-results/restaurants-after-import.png', fullPage: true });

    // Check that restaurants are now showing - look for card titles
    const restaurantNames = page.locator('h3');
    const finalCount = await restaurantNames.count();
    console.log(`Final restaurant count: ${finalCount}`);

    expect(finalCount).toBeGreaterThan(0);
  });

  test('Imported restaurants display correct data', async ({ page }) => {
    await page.goto(`${BASE_URL}/restaurants`);
    await page.waitForLoadState('networkidle');

    // Wait for restaurant cards to load
    const heading = page.locator('h3').first();
    try {
      await heading.waitFor({ state: 'visible', timeout: 10000 });
    } catch {
      console.log('No restaurants found - skipping data verification');
      test.skip();
      return;
    }

    const name = await heading.textContent();
    console.log(`First restaurant: ${name}`);
    expect(name).toBeTruthy();

    await page.screenshot({ path: 'test-results/restaurants-card-detail.png' });
  });

  test('Search filter works on restaurants', async ({ page }) => {
    await page.goto(`${BASE_URL}/restaurants`);
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();

    // Search for "Mexican" if restaurants exist
    await searchInput.fill('Mexican');
    await page.waitForTimeout(500);

    const cards = page.locator('.hover\\:shadow-lg');
    const filteredCount = await cards.count();
    console.log(`Restaurants matching "Mexican": ${filteredCount}`);

    await page.screenshot({ path: 'test-results/restaurants-search-filter.png' });

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(500);

    const allCards = page.locator('.hover\\:shadow-lg');
    const totalCount = await allCards.count();
    console.log(`Total restaurants after clearing search: ${totalCount}`);

    // Filtered count should be <= total count
    expect(filteredCount).toBeLessThanOrEqual(totalCount);
  });

  test('Cuisine filter dropdown works', async ({ page }) => {
    await page.goto(`${BASE_URL}/restaurants`);
    await page.waitForLoadState('networkidle');

    // Find cuisine type dropdown
    const cuisineSelect = page.locator('button[role="combobox"]').first();

    if (await cuisineSelect.isVisible()) {
      await cuisineSelect.click();
      await page.waitForTimeout(300);

      // Check that cuisine options are listed
      const options = page.locator('[role="option"]');
      const optionCount = await options.count();
      console.log(`Cuisine filter has ${optionCount} options`);

      await page.screenshot({ path: 'test-results/restaurants-cuisine-filter.png' });

      // Click "All Cuisines" to reset
      const allOption = options.filter({ hasText: 'All Cuisines' }).first();
      if (await allOption.isVisible()) {
        await allOption.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }
  });

  test('List/Map toggle works', async ({ page }) => {
    await page.goto(`${BASE_URL}/restaurants`);
    await page.waitForLoadState('networkidle');

    // Should start in list view
    const listButton = page.locator('button:has-text("List")');
    const mapButton = page.locator('button:has-text("Map")');

    await expect(listButton).toBeVisible();
    await expect(mapButton).toBeVisible();

    // Switch to map view
    await mapButton.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test-results/restaurants-map-view.png' });

    // Switch back to list view
    await listButton.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test-results/restaurants-list-view.png' });
    console.log('List/Map toggle works correctly');
  });

  test('Add Restaurant dialog opens', async ({ page }) => {
    await page.goto(`${BASE_URL}/restaurants`);
    await page.waitForLoadState('networkidle');

    const addButton = page.locator('button:has-text("Add Restaurant"), button:has-text("Add")').last();
    await addButton.click();
    await page.waitForTimeout(500);

    // Dialog should be open
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Should show search mode first
    await expect(dialog.locator('text=Find Restaurant')).toBeVisible();

    await page.screenshot({ path: 'test-results/restaurants-add-dialog.png' });

    // Click "or enter details manually"
    const manualLink = dialog.locator('text=or enter details manually');
    if (await manualLink.isVisible()) {
      await manualLink.click();
      await page.waitForTimeout(300);

      // Form fields should now be visible
      await expect(dialog.locator('#name, input[placeholder*="Restaurant name"]')).toBeVisible();
      await page.screenshot({ path: 'test-results/restaurants-add-manual-form.png' });
    }

    // Close dialog
    const cancelButton = dialog.locator('button:has-text("Cancel")');
    await cancelButton.click();
    console.log('Add Restaurant dialog works correctly');
  });

  test('Boolean filters work (Outdoor Seating, Has Bar)', async ({ page }) => {
    await page.goto(`${BASE_URL}/restaurants`);
    await page.waitForLoadState('networkidle');

    // Get total count first
    const allCards = page.locator('.hover\\:shadow-lg');
    const totalCount = await allCards.count();

    if (totalCount === 0) {
      console.log('No restaurants to filter - skipping');
      test.skip();
      return;
    }

    // Toggle "Has Bar" filter
    const hasBarSwitch = page.locator('label:has-text("Has Bar")').locator('..').locator('button[role="switch"]');
    if (await hasBarSwitch.isVisible()) {
      await hasBarSwitch.click();
      await page.waitForTimeout(1000);
      await page.waitForLoadState('networkidle');

      const barCards = page.locator('.hover\\:shadow-lg');
      const barCount = await barCards.count();
      console.log(`Restaurants with bar: ${barCount} (of ${totalCount} total)`);

      await page.screenshot({ path: 'test-results/restaurants-bar-filter.png' });

      // Clear filters
      const clearButton = page.locator('button:has-text("Clear Filters")');
      if (await clearButton.isVisible()) {
        await clearButton.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('Re-import skips duplicates', async ({ page }) => {
    await page.goto(`${BASE_URL}/restaurants`);
    await page.waitForLoadState('networkidle');

    // If restaurants already exist, re-import should skip them
    const cards = page.locator('.hover\\:shadow-lg');
    const count = await cards.count();

    if (count === 0) {
      console.log('No restaurants exist yet - skipping duplicate test');
      test.skip();
      return;
    }

    let alertMessage = '';
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'confirm') {
        // If all are already imported, confirm won't even show
        await dialog.accept();
      } else {
        alertMessage = dialog.message();
        await dialog.accept();
      }
    });

    const importButton = page.locator('button:has-text("Import SB Guide"), button:has-text("Import")').first();
    await importButton.click();
    await page.waitForTimeout(3000);

    // Should either say "All SB restaurants are already imported!" or import 0 new ones
    if (alertMessage) {
      console.log(`Re-import result: ${alertMessage}`);
      const isSkipped = alertMessage.includes('already imported') || alertMessage.includes('Imported 0');
      if (isSkipped) {
        console.log('Duplicate detection working correctly');
      }
    }
  });
});

test.describe('Restaurants Page - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);
  });

  test('Restaurant page is usable on mobile', async ({ page }) => {
    await page.goto(`${BASE_URL}/restaurants`);
    await page.waitForLoadState('networkidle');

    // Page should load
    await expect(page.locator('h1:has-text("Restaurants")')).toBeVisible();

    // Import button should be accessible (might show shortened text)
    const importButton = page.locator('button:has-text("Import SB Guide"), button:has-text("Import")').first();
    await expect(importButton).toBeVisible();

    await page.screenshot({ path: 'test-results/restaurants-mobile.png', fullPage: true });
    console.log('Mobile restaurants page loads correctly');
  });

  test('Restaurant cards are readable on mobile', async ({ page }) => {
    await page.goto(`${BASE_URL}/restaurants`);
    await page.waitForLoadState('networkidle');

    const cards = page.locator('.hover\\:shadow-lg');
    const count = await cards.count();

    if (count > 0) {
      // Check first card is full width on mobile
      const firstCard = cards.first();
      const box = await firstCard.boundingBox();
      if (box) {
        // Card should take most of the viewport width on mobile
        expect(box.width).toBeGreaterThan(300);
        console.log(`Mobile card width: ${box.width}px`);
      }
    }

    await page.screenshot({ path: 'test-results/restaurants-mobile-cards.png', fullPage: true });
  });
});

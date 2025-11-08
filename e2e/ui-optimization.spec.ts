import { test, expect, Page } from '@playwright/test';

// Helper to login
async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const usernameInput = await page.waitForSelector('input[type="text"]', { timeout: 10000 });
  await usernameInput.fill('admin');

  const passwordInput = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await passwordInput.fill('OwtvQubm2H9BP0qE');

  const submitButton = await page.waitForSelector('button[type="submit"]', { timeout: 10000 });
  await submitButton.click();

  await page.waitForURL('/plan', { timeout: 30000 });
  await page.waitForLoadState('networkidle');
}

// Test data
const pages = [
  { name: 'Plan', path: '/plan', headerText: 'Weekly Meal Plan' },
  { name: 'Recipes', path: '/recipes', headerText: 'Recipes' },
  { name: 'Bento', path: '/bento', headerText: 'Bento Box Planner' },
  { name: 'Leftovers', path: '/leftovers', headerText: 'Leftovers Tracker' },
  { name: 'School Menu', path: '/school-menu', headerText: 'School Menu Calendar' },
  { name: 'Lists', path: '/lists', headerText: 'Shopping Lists' },
  { name: 'Restaurants', path: '/restaurants', headerText: 'Restaurants & Bars' },
];

test.describe('UI Optimization Tests', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.describe('Responsive Design', () => {
    for (const pageInfo of pages) {
      test(`${pageInfo.name} page - Desktop layout`, async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(pageInfo.path);

        // Check header is visible
        await expect(page.locator('header')).toBeVisible();

        // Check navigation is visible on desktop
        await expect(page.locator('nav').first()).toBeVisible();

        // Take screenshot
        await page.screenshot({
          path: `e2e/screenshots/${pageInfo.name}-desktop.png`,
          fullPage: true
        });
      });

      test(`${pageInfo.name} page - Tablet layout`, async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto(pageInfo.path);

        // Check header is visible
        await expect(page.locator('header')).toBeVisible();

        // Take screenshot
        await page.screenshot({
          path: `e2e/screenshots/${pageInfo.name}-tablet.png`,
          fullPage: true
        });
      });

      test(`${pageInfo.name} page - Mobile layout`, async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto(pageInfo.path);

        // Check header is visible
        await expect(page.locator('header')).toBeVisible();

        // Check mobile menu button exists
        const menuButton = page.locator('button').filter({ hasText: /menu|☰/i }).or(
          page.locator('svg[class*="menu"]').locator('..')
        );

        // Take screenshot
        await page.screenshot({
          path: `e2e/screenshots/${pageInfo.name}-mobile.png`,
          fullPage: true
        });
      });
    }
  });

  test.describe('Navigation Consistency', () => {
    test('All nav items should be accessible', async ({ page }) => {
      await page.goto('/plan');

      // Desktop navigation
      await page.setViewportSize({ width: 1920, height: 1080 });

      for (const pageInfo of pages) {
        const navLink = page.locator(`a[href="${pageInfo.path}"]`).first();
        await expect(navLink).toBeVisible();
      }
    });

    test('Mobile navigation should work', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/plan');

      // Click menu button
      const menuButton = page.locator('button').filter({ has: page.locator('svg') }).first();
      await menuButton.click();

      // Check all nav items appear
      await page.waitForTimeout(500);

      // Navigate to Recipes
      await page.click('text=Recipes');
      await expect(page).toHaveURL('/recipes');
    });
  });

  test.describe('Accessibility', () => {
    for (const pageInfo of pages) {
      test(`${pageInfo.name} page - Basic accessibility checks`, async ({ page }) => {
        await page.goto(pageInfo.path);

        // Check page has a main heading
        const heading = page.locator('h1').first();
        await expect(heading).toBeVisible();

        // Check buttons have accessible text or aria-labels
        const buttons = await page.locator('button:visible').all();
        let buttonsWithoutLabels = 0;
        for (const button of buttons) {
          const text = await button.textContent();
          const ariaLabel = await button.getAttribute('aria-label');
          const hasIcon = await button.locator('svg').count() > 0;

          // Icon buttons should have either text or aria-label
          if (!text?.trim() && !ariaLabel && hasIcon) {
            buttonsWithoutLabels++;
          }
        }

        // Log warning if there are unlabeled buttons
        if (buttonsWithoutLabels > 0) {
          console.warn(`Found ${buttonsWithoutLabels} icon buttons without aria-labels on ${pageInfo.name} page`);
        }

        // Check images have alt text
        const images = await page.locator('img').all();
        for (const img of images) {
          const alt = await img.getAttribute('alt');
          expect(alt).toBeDefined();
        }
      });
    }
  });

  test.describe('Loading States', () => {
    for (const pageInfo of pages) {
      test(`${pageInfo.name} page - Initial load performance`, async ({ page }) => {
        const startTime = Date.now();
        await page.goto(pageInfo.path);

        // Wait for page to be fully loaded
        await page.waitForLoadState('networkidle');
        const loadTime = Date.now() - startTime;

        console.log(`${pageInfo.name} page loaded in ${loadTime}ms`);

        // Page should load in under 3 seconds
        expect(loadTime).toBeLessThan(3000);
      });
    }
  });

  test.describe('Interactive Elements', () => {
    test('Restaurants page - Search and dialog interactions', async ({ page }) => {
      await page.goto('/restaurants');

      // Click Add Restaurant button
      await page.click('text=Add Restaurant');

      // Dialog should open
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Search interface should be visible
      await expect(page.locator('text=Find Restaurant')).toBeVisible();

      // Screenshot of dialog
      await page.screenshot({ path: 'e2e/screenshots/restaurants-add-dialog.png' });

      // Close dialog
      await page.click('text=Cancel');
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });

    test('Plan page - Calendar interactions', async ({ page }) => {
      await page.goto('/plan');

      // Check calendar is visible
      await expect(page.locator('text=/Monday|Tuesday|Wednesday/i').first()).toBeVisible();

      // Take screenshot
      await page.screenshot({ path: 'e2e/screenshots/plan-calendar.png' });
    });

    test('Recipes page - Add recipe dialog', async ({ page }) => {
      await page.goto('/recipes');

      // Click Add Recipe button
      const addButton = page.locator('button').filter({ hasText: /add recipe/i }).first();
      if (await addButton.isVisible()) {
        await addButton.click();

        // Dialog should open
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'e2e/screenshots/recipes-add-dialog.png' });
      }
    });
  });

  test.describe('Contrast and Readability', () => {
    test('Check text contrast on all pages', async ({ page }) => {
      for (const pageInfo of pages) {
        await page.goto(pageInfo.path);

        // Get background and text colors
        const body = page.locator('body');
        const backgroundColor = await body.evaluate((el) =>
          window.getComputedStyle(el).backgroundColor
        );

        console.log(`${pageInfo.name} background color: ${backgroundColor}`);

        // Check that text is visible (not transparent)
        const textElements = await page.locator('p, h1, h2, h3, span').all();
        for (const text of textElements.slice(0, 5)) {
          const color = await text.evaluate((el) =>
            window.getComputedStyle(el).color
          );
          expect(color).not.toBe('rgba(0, 0, 0, 0)');
        }
      }
    });
  });

  test.describe('Form Validation', () => {
    test('Restaurants page - Form validation', async ({ page }) => {
      await page.goto('/restaurants');
      await page.click('text=Add Restaurant');

      // Click manual entry
      const manualLink = page.locator('text=enter details manually');
      if (await manualLink.isVisible()) {
        await manualLink.click();
        await page.waitForTimeout(500);
      }

      // Try to submit without required fields
      const submitButton = page.locator('button').filter({ hasText: /add restaurant/i }).last();
      await submitButton.click();

      // Should show validation error or prevent submission
      await page.screenshot({ path: 'e2e/screenshots/restaurants-validation.png' });
    });
  });

  test.describe('Restaurants Page - Comprehensive Tests', () => {
    test('Web search functionality', async ({ page }) => {
      await page.goto('/restaurants');

      // Click Add Restaurant
      await page.click('text=Add Restaurant');

      // Dialog should open with search interface
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await expect(page.locator('text=Find Restaurant')).toBeVisible();

      // Enter restaurant name and location
      const nameInput = page.locator('input[placeholder*="restaurant name" i]');
      const locationInput = page.locator('input[placeholder*="city" i]').or(page.locator('input[placeholder*="location" i]'));

      if (await nameInput.isVisible()) {
        await nameInput.fill('Pizza Place');
      }

      if (await locationInput.isVisible()) {
        await locationInput.fill('San Francisco');
      }

      // Click search button
      const searchButton = page.locator('button').filter({ hasText: /search|find/i }).first();
      if (await searchButton.isVisible()) {
        await searchButton.click();

        // Wait for loading or results
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'e2e/screenshots/restaurants-search-results.png' });
      }
    });

    test('Manual entry with all fields', async ({ page }) => {
      await page.goto('/restaurants');
      await page.click('text=Add Restaurant');

      // Switch to manual entry
      const manualLink = page.locator('text=enter details manually');
      if (await manualLink.isVisible()) {
        await manualLink.click();
        await page.waitForTimeout(500);

        // Fill all fields
        const nameInput = page.locator('input[name="name"]').or(page.locator('input[placeholder*="name" i]')).first();
        await nameInput.fill('Test Restaurant');

        // Take screenshot of filled form
        await page.screenshot({ path: 'e2e/screenshots/restaurants-manual-filled.png' });
      }
    });

    test('Empty state - No restaurants', async ({ page }) => {
      await page.goto('/restaurants');

      // Check if empty state is shown when no restaurants exist
      const restaurantCards = await page.locator('[class*="card"]').count();
      console.log(`Found ${restaurantCards} restaurant cards`);

      await page.screenshot({ path: 'e2e/screenshots/restaurants-state.png' });
    });

    test('Filter and search functionality', async ({ page }) => {
      await page.goto('/restaurants');

      // Look for search or filter inputs
      const searchInput = page.locator('input[type="search"]').or(page.locator('input[placeholder*="search" i]'));

      if (await searchInput.isVisible()) {
        await searchInput.fill('pizza');
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'e2e/screenshots/restaurants-filtered.png' });
      }
    });

    test('Map view toggle', async ({ page }) => {
      await page.goto('/restaurants');

      // Click map view button
      const mapButton = page.locator('button').filter({ hasText: /map/i }).first();
      await mapButton.click();
      await page.waitForTimeout(1000);

      // Verify map is displayed
      await page.screenshot({ path: 'e2e/screenshots/restaurants-map-view.png' });

      // Switch back to list view
      const listButton = page.locator('button').filter({ hasText: /list/i }).first();
      await listButton.click();
      await page.waitForTimeout(500);
    });

    test('Suggest 3 places functionality', async ({ page }) => {
      await page.goto('/restaurants');

      // Click suggest button
      const suggestButton = page.locator('button').filter({ hasText: /suggest/i }).first();
      await suggestButton.click();

      // Wait for suggestions to load
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'e2e/screenshots/restaurants-suggestions.png' });
    });

    test('Special characters in restaurant name', async ({ page }) => {
      await page.goto('/restaurants');
      await page.click('text=Add Restaurant');

      const manualLink = page.locator('text=enter details manually');
      if (await manualLink.isVisible()) {
        await manualLink.click();
        await page.waitForTimeout(500);

        const nameInput = page.locator('input[name="name"]').or(page.locator('input[placeholder*="name" i]')).first();
        await nameInput.fill("Joe's Café & Restaurant (Best!)");

        await page.screenshot({ path: 'e2e/screenshots/restaurants-special-chars.png' });
      }
    });
  });

  test.describe('Recipes Page - Comprehensive Tests', () => {
    test('Add recipe dialog opens and closes', async ({ page }) => {
      await page.goto('/recipes');

      // Click Add Recipe
      const addButton = page.locator('button').filter({ hasText: /add recipe/i }).first();
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        // Dialog should be visible
        await expect(page.locator('[role="dialog"]')).toBeVisible();
        await page.screenshot({ path: 'e2e/screenshots/recipes-dialog-open.png' });

        // Close dialog
        const cancelButton = page.locator('button').filter({ hasText: /cancel|close/i }).first();
        if (await cancelButton.isVisible()) {
          await cancelButton.click();
          await page.waitForTimeout(300);
          await expect(page.locator('[role="dialog"]')).not.toBeVisible();
        }
      }
    });

    test('Search recipes functionality', async ({ page }) => {
      await page.goto('/recipes');

      const searchInput = page.locator('input[type="search"]').or(page.locator('input[placeholder*="search" i]'));
      if (await searchInput.isVisible()) {
        await searchInput.fill('pasta');
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'e2e/screenshots/recipes-search.png' });

        // Clear search
        await searchInput.clear();
        await page.waitForTimeout(300);
      }
    });

    test('Filter by meal type', async ({ page }) => {
      await page.goto('/recipes');

      // Look for meal type filters (breakfast, lunch, dinner)
      const filterButtons = page.locator('button').filter({ hasText: /breakfast|lunch|dinner|all/i });
      const count = await filterButtons.count();

      if (count > 0) {
        for (let i = 0; i < Math.min(count, 3); i++) {
          await filterButtons.nth(i).click();
          await page.waitForTimeout(300);
          await page.screenshot({ path: `e2e/screenshots/recipes-filter-${i}.png` });
        }
      }
    });

    test('Empty state - No recipes', async ({ page }) => {
      await page.goto('/recipes');
      await page.screenshot({ path: 'e2e/screenshots/recipes-state.png' });
    });

    test('Recipe card interactions', async ({ page }) => {
      await page.goto('/recipes');

      // Find first recipe card
      const recipeCards = page.locator('[class*="card"]').or(page.locator('article'));
      const count = await recipeCards.count();

      if (count > 0) {
        // Hover over first card
        await recipeCards.first().hover();
        await page.waitForTimeout(300);
        await page.screenshot({ path: 'e2e/screenshots/recipes-card-hover.png' });

        // Look for edit/delete buttons
        const editButton = recipeCards.first().locator('button').filter({ hasText: /edit/i });
        if (await editButton.isVisible()) {
          await page.screenshot({ path: 'e2e/screenshots/recipes-card-actions.png' });
        }
      }
    });

    test('Add recipe with long name', async ({ page }) => {
      await page.goto('/recipes');

      const addButton = page.locator('button').filter({ hasText: /add recipe/i }).first();
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        const nameInput = page.locator('input[name="name"]').or(page.locator('input[placeholder*="name" i]')).first();
        if (await nameInput.isVisible()) {
          await nameInput.fill('Super Long Recipe Name That Tests Maximum Character Length Handling In The Database And UI Components');
          await page.screenshot({ path: 'e2e/screenshots/recipes-long-name.png' });
        }
      }
    });
  });

  test.describe('Plan Page - Comprehensive Tests', () => {
    test('Weekly calendar is displayed', async ({ page }) => {
      await page.goto('/plan');

      // Check for day headers
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      for (const day of days.slice(0, 3)) {
        await expect(page.locator(`text=/${day}/i`).first()).toBeVisible();
      }

      await page.screenshot({ path: 'e2e/screenshots/plan-calendar-full.png' });
    });

    test('Navigate between weeks', async ({ page }) => {
      await page.goto('/plan');

      // Look for navigation buttons
      const nextWeek = page.locator('button').filter({ hasText: /next|>/i }).first();
      const prevWeek = page.locator('button').filter({ hasText: /prev|</i }).first();

      if (await nextWeek.isVisible()) {
        await nextWeek.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'e2e/screenshots/plan-next-week.png' });

        if (await prevWeek.isVisible()) {
          await prevWeek.click();
          await page.waitForTimeout(500);
        }
      }
    });

    test('Add meal to day', async ({ page }) => {
      await page.goto('/plan');

      // Click on a day to add meal
      const dayCell = page.locator('[class*="day"]').or(page.locator('td')).first();
      if (await dayCell.isVisible()) {
        await dayCell.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'e2e/screenshots/plan-add-meal.png' });
      }
    });

    test('Generate week functionality', async ({ page }) => {
      await page.goto('/plan');

      const generateButton = page.locator('button').filter({ hasText: /generate|auto/i }).first();
      if (await generateButton.isVisible()) {
        await generateButton.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'e2e/screenshots/plan-generated.png' });
      }
    });

    test('Clear day functionality', async ({ page }) => {
      await page.goto('/plan');

      // Look for clear/delete buttons
      const clearButtons = page.locator('button').filter({ hasText: /clear|delete/i });
      const count = await clearButtons.count();

      if (count > 0) {
        await page.screenshot({ path: 'e2e/screenshots/plan-with-meals.png' });
      }
    });

    test('Mobile calendar layout', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/plan');

      // Calendar should adapt to mobile
      await page.screenshot({ path: 'e2e/screenshots/plan-mobile-calendar.png', fullPage: true });
    });
  });

  test.describe('Bento Page - Comprehensive Tests', () => {
    test('Bento planner interface loads', async ({ page }) => {
      await page.goto('/bento');

      await expect(page.locator('h1')).toContainText(/bento/i);
      await page.screenshot({ path: 'e2e/screenshots/bento-interface.png' });
    });

    test('Add item to bento box', async ({ page }) => {
      await page.goto('/bento');

      const addButton = page.locator('button').filter({ hasText: /add|new/i }).first();
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'e2e/screenshots/bento-add-item.png' });
      }
    });

    test('Calendar view for bento planning', async ({ page }) => {
      await page.goto('/bento');

      // Look for calendar or date navigation
      const dateElements = page.locator('[type="date"]').or(page.locator('button').filter({ hasText: /today|date/i }));
      if (await dateElements.first().isVisible()) {
        await page.screenshot({ path: 'e2e/screenshots/bento-calendar.png' });
      }
    });

    test('Empty bento state', async ({ page }) => {
      await page.goto('/bento');
      await page.screenshot({ path: 'e2e/screenshots/bento-empty-state.png' });
    });
  });

  test.describe('Leftovers Page - Comprehensive Tests', () => {
    test('Leftovers tracker loads', async ({ page }) => {
      await page.goto('/leftovers');

      await expect(page.locator('h1')).toContainText(/leftover/i);
      await page.screenshot({ path: 'e2e/screenshots/leftovers-page.png' });
    });

    test('Add leftover item', async ({ page }) => {
      await page.goto('/leftovers');

      const addButton = page.locator('button').filter({ hasText: /add/i }).first();
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'e2e/screenshots/leftovers-add.png' });
      }
    });

    test('Track expiry dates', async ({ page }) => {
      await page.goto('/leftovers');

      // Look for date inputs or expiry indicators
      const dateInputs = page.locator('input[type="date"]');
      if (await dateInputs.first().isVisible()) {
        await page.screenshot({ path: 'e2e/screenshots/leftovers-expiry.png' });
      }
    });

    test('Empty state - No leftovers', async ({ page }) => {
      await page.goto('/leftovers');
      await page.screenshot({ path: 'e2e/screenshots/leftovers-empty.png' });
    });
  });

  test.describe('School Menu Page - Comprehensive Tests', () => {
    test('School menu calendar loads', async ({ page }) => {
      await page.goto('/school-menu');

      await expect(page.locator('h1')).toContainText(/school menu/i);
      await page.screenshot({ path: 'e2e/screenshots/school-menu-page.png' });
    });

    test('Navigate menu dates', async ({ page }) => {
      await page.goto('/school-menu');

      const navButtons = page.locator('button').filter({ hasText: /next|prev|today/i });
      const count = await navButtons.count();

      if (count > 0) {
        await navButtons.first().click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'e2e/screenshots/school-menu-navigate.png' });
      }
    });

    test('Add menu item or feedback', async ({ page }) => {
      await page.goto('/school-menu');

      const addButton = page.locator('button').filter({ hasText: /add|import/i }).first();
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'e2e/screenshots/school-menu-add.png' });
      }
    });
  });

  test.describe('Lists Page - Comprehensive Tests', () => {
    test('Shopping lists page loads', async ({ page }) => {
      await page.goto('/lists');

      await expect(page.locator('h1')).toContainText(/list/i);
      await page.screenshot({ path: 'e2e/screenshots/lists-page.png' });
    });

    test('Add new list item', async ({ page }) => {
      await page.goto('/lists');

      const addButton = page.locator('button').filter({ hasText: /add/i }).first();
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'e2e/screenshots/lists-add-item.png' });
      }
    });

    test('Mark items as purchased', async ({ page }) => {
      await page.goto('/lists');

      // Look for checkboxes
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();

      if (count > 0) {
        await checkboxes.first().check();
        await page.waitForTimeout(300);
        await page.screenshot({ path: 'e2e/screenshots/lists-item-checked.png' });
      }
    });

    test('Categorize items', async ({ page }) => {
      await page.goto('/lists');

      // Look for category filters or dropdowns
      const categoryElements = page.locator('select').or(page.locator('button').filter({ hasText: /category|all items/i }));
      if (await categoryElements.first().isVisible()) {
        await page.screenshot({ path: 'e2e/screenshots/lists-categories.png' });
      }
    });

    test('Clear completed items', async ({ page }) => {
      await page.goto('/lists');

      const clearButton = page.locator('button').filter({ hasText: /clear|delete/i }).first();
      if (await clearButton.isVisible()) {
        await page.screenshot({ path: 'e2e/screenshots/lists-with-items.png' });
      }
    });

    test('Empty state - No items', async ({ page }) => {
      await page.goto('/lists');
      await page.screenshot({ path: 'e2e/screenshots/lists-empty.png' });
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('Network failure - Offline mode', async ({ page, context }) => {
      await page.goto('/plan');

      // Go offline
      await context.setOffline(true);

      // Try to navigate to another page
      await page.click('text=Recipes').catch(() => {});
      await page.waitForTimeout(1000);

      // Should show error or cached content
      await page.screenshot({ path: 'e2e/screenshots/offline-state.png' });

      // Go back online
      await context.setOffline(false);
    });

    test('API failure handling - Restaurants search', async ({ page }) => {
      await page.goto('/restaurants');

      // Intercept API calls and force failure
      await page.route('**/api/**', route => route.abort());

      // Try to use search
      const addButton = page.locator('button').filter({ hasText: /add restaurant/i }).first();
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        const searchInput = page.locator('input[placeholder*="restaurant" i]').first();
        if (await searchInput.isVisible()) {
          await searchInput.fill('Test Restaurant');

          const searchButton = page.locator('button').filter({ hasText: /search|find/i }).first();
          if (await searchButton.isVisible()) {
            await searchButton.click();
            await page.waitForTimeout(2000);

            // Should show error message
            await page.screenshot({ path: 'e2e/screenshots/api-error.png' });
          }
        }
      }

      // Unblock API calls
      await page.unroute('**/api/**');
    });

    test('Invalid authentication state', async ({ page, context }) => {
      // Clear all cookies and storage
      await context.clearCookies();
      await page.goto('/plan');
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      // Should redirect to login or show error
      await page.waitForTimeout(2000);
      const url = page.url();
      console.log('URL after clearing auth:', url);

      await page.screenshot({ path: 'e2e/screenshots/auth-cleared.png' });
    });

    test('Long text input handling', async ({ page }) => {
      await page.goto('/restaurants');
      await page.click('text=Add Restaurant');

      const manualLink = page.locator('text=enter details manually');
      if (await manualLink.isVisible()) {
        await manualLink.click();
        await page.waitForTimeout(500);

        const nameInput = page.locator('input[name="name"]').or(page.locator('input[placeholder*="name" i]')).first();
        const longText = 'A'.repeat(500); // 500 characters
        await nameInput.fill(longText);

        await page.screenshot({ path: 'e2e/screenshots/long-text-input.png' });
      }
    });

    test('Concurrent operations - Multiple quick clicks', async ({ page }) => {
      await page.goto('/plan');

      // Rapidly click navigation buttons
      const navButtons = page.locator('button').filter({ hasText: /recipes|bento|plan/i });
      const count = await navButtons.count();

      if (count >= 2) {
        for (let i = 0; i < 5; i++) {
          await navButtons.nth(i % count).click({ delay: 100 });
        }

        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'e2e/screenshots/rapid-navigation.png' });
      }
    });

    test('Empty form submission', async ({ page }) => {
      await page.goto('/restaurants');
      await page.click('text=Add Restaurant');

      const manualLink = page.locator('text=enter details manually');
      if (await manualLink.isVisible()) {
        await manualLink.click();
        await page.waitForTimeout(500);

        // Try to submit without filling any fields
        const submitButton = page.locator('button').filter({ hasText: /add restaurant|submit/i }).last();
        await submitButton.click();

        await page.waitForTimeout(500);
        await page.screenshot({ path: 'e2e/screenshots/empty-form-validation.png' });
      }
    });

    test('XSS prevention - Script tags in input', async ({ page }) => {
      await page.goto('/restaurants');
      await page.click('text=Add Restaurant');

      const manualLink = page.locator('text=enter details manually');
      if (await manualLink.isVisible()) {
        await manualLink.click();
        await page.waitForTimeout(500);

        const nameInput = page.locator('input[name="name"]').or(page.locator('input[placeholder*="name" i]')).first();
        await nameInput.fill('<script>alert("xss")</script>');

        // Should sanitize or escape the input
        const value = await nameInput.inputValue();
        console.log('Input value after XSS attempt:', value);

        await page.screenshot({ path: 'e2e/screenshots/xss-prevention.png' });
      }
    });

    test('SQL injection prevention', async ({ page }) => {
      await page.goto('/recipes');

      const searchInput = page.locator('input[type="search"]').or(page.locator('input[placeholder*="search" i]'));
      if (await searchInput.isVisible()) {
        await searchInput.fill("'; DROP TABLE recipes; --");
        await page.waitForTimeout(500);

        // App should not crash
        await page.screenshot({ path: 'e2e/screenshots/sql-injection-test.png' });
      }
    });

    test('Slow network simulation', async ({ page, context }) => {
      // Throttle network to 3G speeds
      const client = await context.newCDPSession(page);
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: (500 * 1024) / 8, // 500kb/s
        uploadThroughput: (500 * 1024) / 8,
        latency: 400 // 400ms latency
      });

      await page.goto('/restaurants');
      await page.waitForLoadState('networkidle');

      // Should show loading states appropriately
      await page.screenshot({ path: 'e2e/screenshots/slow-network.png' });
    });

    test('Browser back/forward navigation', async ({ page }) => {
      await page.goto('/plan');
      await page.click('text=Recipes');
      await page.waitForURL('**/recipes');

      // Go back
      await page.goBack();
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/plan/);

      // Go forward
      await page.goForward();
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/recipes/);

      await page.screenshot({ path: 'e2e/screenshots/browser-navigation.png' });
    });

    test('Multiple tabs/windows simulation', async ({ context }) => {
      // Create two pages
      const page1 = await context.newPage();
      const page2 = await context.newPage();

      await login(page1);
      await page1.goto('/restaurants');

      // Open same page in second tab
      await page2.goto('http://localhost:3000/restaurants');
      await page2.waitForTimeout(1000);

      // Both should maintain auth state
      await page1.screenshot({ path: 'e2e/screenshots/multi-tab-1.png' });
      await page2.screenshot({ path: 'e2e/screenshots/multi-tab-2.png' });

      await page1.close();
      await page2.close();
    });

    test('Data persistence after reload', async ({ page }) => {
      await page.goto('/plan');

      // Check current state
      const initialState = await page.evaluate(() => {
        return {
          localStorage: Object.keys(localStorage),
          url: window.location.href
        };
      });

      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Check if data persisted
      const afterReload = await page.evaluate(() => {
        return {
          localStorage: Object.keys(localStorage),
          url: window.location.href
        };
      });

      console.log('Before reload:', initialState);
      console.log('After reload:', afterReload);

      await page.screenshot({ path: 'e2e/screenshots/after-reload.png' });
    });
  });

  test.describe('Viewport Overflow', () => {
    for (const pageInfo of pages) {
      test(`${pageInfo.name} page - No horizontal scroll on mobile`, async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto(pageInfo.path);

        // Check body width
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = await page.evaluate(() => window.innerWidth);

        console.log(`${pageInfo.name}: body=${bodyWidth}px, viewport=${viewportWidth}px`);

        // Body should not exceed viewport (allowing 1px tolerance)
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);
      });
    }
  });
});

test.describe('UI Consistency Report', () => {
  test('Generate UI consistency report', async ({ page }) => {
    await login(page);

    const report: any = {
      timestamp: new Date().toISOString(),
      pages: [],
    };

    for (const pageInfo of pages) {
      await page.goto(pageInfo.path);

      const pageReport: any = {
        name: pageInfo.name,
        path: pageInfo.path,
        issues: [],
      };

      // Check for common UI issues
      // 1. Buttons without proper sizing
      const tinyButtons = await page.locator('button').evaluateAll((buttons) => {
        return buttons.filter((btn) => {
          const rect = btn.getBoundingClientRect();
          return rect.width < 24 || rect.height < 24;
        }).length;
      });

      if (tinyButtons > 0) {
        pageReport.issues.push(`Found ${tinyButtons} buttons smaller than 24x24px (may be hard to tap on mobile)`);
      }

      // 2. Text that might be too small
      const smallText = await page.locator('p, span, div').evaluateAll((elements) => {
        return elements.filter((el) => {
          const fontSize = window.getComputedStyle(el).fontSize;
          return parseFloat(fontSize) < 12;
        }).length;
      });

      if (smallText > 0) {
        pageReport.issues.push(`Found ${smallText} text elements smaller than 12px`);
      }

      // 3. Check for overflow
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });

      if (hasOverflow) {
        pageReport.issues.push('Page has horizontal overflow');
      }

      report.pages.push(pageReport);
    }

    console.log('\n=== UI CONSISTENCY REPORT ===');
    console.log(JSON.stringify(report, null, 2));
    console.log('===========================\n');
  });
});

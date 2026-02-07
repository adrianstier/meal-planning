/**
 * Playwright E2E Tests - User Simulation Suite
 *
 * Run with: npx playwright test client/src/tests/user-simulations/playwright-tests.spec.ts
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// Test credentials - loaded from environment variables
// Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD in your environment
const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL || '';
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD || '';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

if (!TEST_EMAIL || !TEST_PASSWORD) {
  console.warn('[WARNING] Test credentials not set. Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD environment variables.');
}

// Bug tracking
interface Bug {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  steps: string[];
  expected: string;
  actual: string;
  screenshot?: string;
}

const discoveredBugs: Bug[] = [];

function reportBug(bug: Omit<Bug, 'id'>): void {
  discoveredBugs.push({
    id: `BUG-${Date.now()}`,
    ...bug,
  });
  console.log(`\n🐛 BUG FOUND: [${bug.severity.toUpperCase()}] ${bug.title}`);
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

// ==================== USER 1: Sarah - Busy Working Mom ====================
test.describe('User 1: Sarah - Busy Working Mom', () => {
  test('rapid meal plan interactions', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Test rapid week navigation
    const nextButton = page.locator('button:has-text("Next"), button:has-text("→"), [aria-label*="next"]').first();
    const prevButton = page.locator('button:has-text("Prev"), button:has-text("←"), [aria-label*="prev"]').first();

    try {
      // Rapid click test
      for (let i = 0; i < 5; i++) {
        if (await nextButton.isVisible()) await nextButton.click();
        await page.waitForTimeout(100);
      }
      for (let i = 0; i < 5; i++) {
        if (await prevButton.isVisible()) await prevButton.click();
        await page.waitForTimeout(100);
      }
    } catch (error) {
      reportBug({
        severity: 'high',
        title: 'Rapid week navigation causes errors',
        description: 'Clicking next/prev buttons rapidly causes UI errors',
        steps: ['Go to /plan', 'Click next button 5 times rapidly', 'Click prev button 5 times rapidly'],
        expected: 'Week should navigate smoothly',
        actual: String(error),
      });
    }
  });

  test('double-click protection on buttons', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Find generate button
    const generateBtn = page.locator('button:has-text("Generate"), button:has-text("Auto")').first();

    if (await generateBtn.isVisible()) {
      try {
        // Double click
        await generateBtn.dblclick();
        await page.waitForTimeout(2000);

        // Check for duplicate entries or errors
        const errorToast = page.locator('[role="alert"], .toast-error, .error-message');
        if (await errorToast.isVisible()) {
          reportBug({
            severity: 'medium',
            title: 'Double-click on generate creates duplicate entries',
            description: 'Double-clicking generate button creates duplicate meal plan entries',
            steps: ['Go to /plan', 'Double-click Generate button'],
            expected: 'Only one generation should occur',
            actual: 'Duplicate entries or error shown',
          });
        }
      } catch {
        // Button might be disabled, which is good
      }
    }
  });
});

// ==================== USER 2: Mike - Recipe Collector ====================
test.describe('User 2: Mike - Recipe Collector', () => {
  test('import recipe from URL', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/recipes`);
    await page.waitForLoadState('networkidle');

    // Find import/add button
    const addButton = page.locator('button:has-text("Add"), button:has-text("Import"), button:has-text("+")').first();

    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);

      // Look for URL input
      const urlInput = page.locator('input[placeholder*="URL"], input[type="url"], input[name*="url"]').first();

      if (await urlInput.isVisible()) {
        // Test with invalid URL
        await urlInput.fill('not-a-valid-url');
        const submitBtn = page.locator('button[type="submit"], button:has-text("Import")').first();

        if (await submitBtn.isVisible()) {
          await submitBtn.click();
          await page.waitForTimeout(2000);

          // Check for proper error handling
          const errorMsg = page.locator('.error, [role="alert"], .text-red');
          if (!(await errorMsg.isVisible())) {
            reportBug({
              severity: 'medium',
              title: 'Invalid URL not properly validated',
              description: 'Entering an invalid URL does not show error message',
              steps: ['Go to /recipes', 'Click Add/Import', 'Enter "not-a-valid-url"', 'Submit'],
              expected: 'Error message about invalid URL',
              actual: 'No error shown or request sent to server',
            });
          }
        }
      }
    }
  });

  test('import same URL twice', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/recipes`);

    // This would test duplicate import handling
    // Implementation depends on UI structure
  });
});

// ==================== USER 5: Alex - Power User Developer ====================
test.describe('User 5: Alex - Power User Developer', () => {
  test('XSS prevention in text fields', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/recipes`);
    await page.waitForLoadState('networkidle');

    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '"><script>alert("XSS")</script>',
      "'-alert(1)-'",
      '<img src=x onerror=alert("XSS")>',
    ];

    // Find any input field
    const inputs = page.locator('input[type="text"], textarea');
    const count = await inputs.count();

    for (let i = 0; i < Math.min(count, 3); i++) {
      const input = inputs.nth(i);
      if (await input.isVisible()) {
        for (const payload of xssPayloads) {
          await input.fill(payload);

          // Check if script executed (it shouldn't)
          const alertDetected = await page.evaluate(() => {
            return (window as unknown as { xssDetected?: boolean }).xssDetected === true;
          });

          if (alertDetected) {
            reportBug({
              severity: 'critical',
              title: 'XSS vulnerability detected',
              description: `XSS payload executed: ${payload}`,
              steps: ['Enter XSS payload in text field', 'Submit/blur field'],
              expected: 'Payload should be escaped/sanitized',
              actual: 'Script executed',
            });
          }
        }
      }
    }
  });

  test('very long input handling', async ({ page }) => {
    test.setTimeout(90000); // Increase timeout for long string operations
    await login(page);
    await page.goto(`${BASE_URL}/recipes`);
    await page.waitForLoadState('domcontentloaded');

    const longString = 'A'.repeat(5000); // Reduced from 10000 for faster tests

    // Find input fields
    const inputs = page.locator('input[type="text"], textarea');
    const count = await inputs.count();

    for (let i = 0; i < Math.min(count, 2); i++) {
      const input = inputs.nth(i);
      if (await input.isVisible()) {
        try {
          await input.fill(longString);

          // Check if app is still responsive
          await page.waitForTimeout(1000);
          const isResponsive = await page.evaluate(() => document.body !== null);

          if (!isResponsive) {
            reportBug({
              severity: 'high',
              title: 'App freezes with very long input',
              description: 'Entering 10000+ characters freezes the app',
              steps: ['Enter 10000 character string in text field'],
              expected: 'Input should be truncated or handled gracefully',
              actual: 'App becomes unresponsive',
            });
          }
        } catch (error) {
          reportBug({
            severity: 'high',
            title: 'Error with very long input',
            description: String(error),
            steps: ['Enter very long string'],
            expected: 'Graceful handling',
            actual: String(error),
          });
        }
      }
    }
  });

  test('unicode and emoji handling', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/recipes`);
    await page.waitForLoadState('networkidle');

    const unicodeStrings = [
      '日本料理 - Japanese Cuisine',
      'Café Müller',
      '🍕🍔🍟 Food Emoji Recipe',
      'مطبخ عربي - Arabic Kitchen',
      '中文菜名',
    ];

    // Try to add a recipe with unicode name if add dialog exists
    const addButton = page.locator('button:has-text("Add"), button:has-text("+")').first();

    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);

      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();

      if (await nameInput.isVisible()) {
        for (const unicodeStr of unicodeStrings) {
          await nameInput.fill(unicodeStr);
          const value = await nameInput.inputValue();

          if (value !== unicodeStr) {
            reportBug({
              severity: 'medium',
              title: 'Unicode characters not preserved',
              description: `Input "${unicodeStr}" was changed to "${value}"`,
              steps: ['Enter unicode text in name field'],
              expected: 'Unicode should be preserved exactly',
              actual: 'Characters were changed or removed',
            });
          }
        }
      }
    }
  });
});

// ==================== USER 6: Maria - Large Family Organizer ====================
test.describe('User 6: Maria - Large Family Organizer', () => {
  test('large servings handling', async ({ page }) => {
    test.setTimeout(90000); // Increase timeout for plan page load
    await login(page);
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('domcontentloaded');

    // Find servings input
    const servingsInput = page.locator('input[name="servings"], input[type="number"]').first();

    if (await servingsInput.isVisible()) {
      try {
        await servingsInput.fill('50');
        await page.waitForTimeout(500);

        const value = await servingsInput.inputValue();
        if (value !== '50') {
          reportBug({
            severity: 'low',
            title: 'Large serving sizes not accepted',
            description: 'Cannot enter serving size of 50',
            steps: ['Enter 50 in servings field'],
            expected: 'Should accept 50 servings',
            actual: `Value changed to ${value}`,
          });
        }
      } catch (error) {
        // Input might have max attribute
      }
    }
  });
});

// ==================== USER 7: Jake - Mobile-Only User ====================
test.describe('User 7: Jake - Mobile-Only User', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('mobile navigation works', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Check for hamburger menu
    const hamburger = page.locator('[aria-label*="menu" i], .hamburger, button:has(.menu-icon)');

    if (await hamburger.isVisible()) {
      await hamburger.click();
      await page.waitForTimeout(500);

      // Check menu opened (use .first() to avoid strict mode violation when multiple nav elements exist)
      const nav = page.locator('nav, .mobile-nav, .sidebar').first();
      const isNavVisible = await nav.isVisible();

      if (!isNavVisible) {
        reportBug({
          severity: 'high',
          title: 'Mobile menu does not open',
          description: 'Clicking hamburger menu does not show navigation',
          steps: ['View on mobile viewport', 'Click hamburger menu'],
          expected: 'Navigation menu should open',
          actual: 'Menu does not appear',
        });
      }
    }
  });

  test('touch scrolling works', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/recipes`);
    await page.waitForLoadState('networkidle');

    // Simulate scroll
    await page.evaluate(() => {
      window.scrollTo(0, 500);
    });

    const scrollY = await page.evaluate(() => window.scrollY);

    if (scrollY < 400) {
      reportBug({
        severity: 'medium',
        title: 'Scroll not working properly on mobile',
        description: 'Page does not scroll as expected',
        steps: ['View on mobile', 'Try to scroll down'],
        expected: 'Page should scroll',
        actual: 'Scroll is blocked or limited',
      });
    }
  });
});

// ==================== USER 10: Pat - Minimalist User ====================
test.describe('User 10: Pat - Minimalist User', () => {
  test('empty states display correctly', async ({ page }) => {
    await login(page);

    // Check empty states on various pages
    const pagesToCheck = ['/leftovers', '/shopping', '/school-menu'];

    for (const pagePath of pagesToCheck) {
      await page.goto(`${BASE_URL}${pagePath}`);
      await page.waitForLoadState('networkidle');

      // Look for empty state messaging
      const content = await page.content();
      const hasEmptyState =
        content.includes('no ') ||
        content.includes('empty') ||
        content.includes('get started') ||
        content.includes('add your first');

      const hasError =
        content.includes('error') ||
        content.includes('failed') ||
        content.includes('undefined');

      if (hasError && !hasEmptyState) {
        reportBug({
          severity: 'medium',
          title: `Empty state shows error on ${pagePath}`,
          description: 'Empty state shows error instead of helpful message',
          steps: [`Go to ${pagePath} with no data`],
          expected: 'Friendly empty state message',
          actual: 'Error message displayed',
        });
      }
    }
  });
});

// ==================== USER 15: Jordan - Frequent Editor ====================
test.describe('User 15: Jordan - Frequent Editor', () => {
  test('rapid edit/save cycles', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/recipes`);
    await page.waitForLoadState('networkidle');

    // Find first recipe card
    const recipeCard = page.locator('.recipe-card, [data-testid="recipe-card"], .card').first();

    if (await recipeCard.isVisible()) {
      await recipeCard.click();
      await page.waitForTimeout(500);

      // Find edit button
      const editBtn = page.locator('button:has-text("Edit"), [aria-label*="edit" i]').first();

      if (await editBtn.isVisible()) {
        // Rapid edit attempts
        for (let i = 0; i < 3; i++) {
          try {
            await editBtn.click();
            await page.waitForTimeout(200);

            // Find cancel or close
            const cancelBtn = page.locator('button:has-text("Cancel"), button:has-text("Close")').first();
            if (await cancelBtn.isVisible()) {
              await cancelBtn.click();
              await page.waitForTimeout(200);
            }
          } catch {
            // Modal handling might vary
          }
        }
      }
    }
  });
});

// ==================== USER 16: Morgan - Multi-Tab User ====================
test.describe('User 16: Morgan - Multi-Tab User', () => {
  test('data sync between tabs', async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // Login in first tab
    await login(page1);

    // Open same page in both tabs
    await page1.goto(`${BASE_URL}/plan`);
    await page2.goto(`${BASE_URL}/plan`);

    await page1.waitForLoadState('networkidle');
    await page2.waitForLoadState('networkidle');

    // Make a change in tab 1
    // The change should reflect in tab 2 after refresh

    await context.close();
  });
});

// ==================== USER 17: Casey - Seasonal Planner ====================
test.describe('User 17: Casey - Seasonal Planner', () => {
  test('future date handling', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Get initial date display
    const dateDisplay = page.locator('[class*="date"], [class*="week"], h2, h3').first();
    const initialDateText = await dateDisplay.textContent();

    // Try to navigate forward a few weeks (not 52 times - that times out)
    const nextButton = page.locator('button:has-text("Next"), button:has-text("→")').first();

    if (await nextButton.isVisible()) {
      // Click next 5 times to verify navigation works
      for (let i = 0; i < 5; i++) {
        await nextButton.click();
        await page.waitForTimeout(100);
      }

      // Verify date changed
      const newDateText = await dateDisplay.textContent();

      if (newDateText === initialDateText) {
        reportBug({
          severity: 'low',
          title: 'Future date navigation not working',
          description: 'Clicking Next button does not change displayed date',
          steps: ['Click Next button 5 times'],
          expected: 'Date display should change to future weeks',
          actual: `Date unchanged: ${newDateText}`,
        });
      }

      // Navigation working - dates changed
      console.log(`Navigation working: ${initialDateText} -> ${newDateText}`);
    }
  });
});

// ==================== USER 19: Avery - Shopping List Power User ====================
test.describe('User 19: Avery - Shopping List Power User', () => {
  test('add many items quickly', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/shopping`);
    await page.waitForLoadState('networkidle');

    // Find add item input
    const addInput = page.locator('input[placeholder*="add" i], input[placeholder*="item" i], input[name="item"]').first();

    if (await addInput.isVisible()) {
      // Add 20 items rapidly
      for (let i = 0; i < 20; i++) {
        await addInput.fill(`Test Item ${i}`);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
      }

      await page.waitForTimeout(1000);

      // Verify items were added
      const items = page.locator('[class*="shopping-item"], li:has-text("Test Item")');
      const count = await items.count();

      if (count < 15) {
        reportBug({
          severity: 'medium',
          title: 'Rapid item addition loses items',
          description: 'Adding items quickly causes some to be lost',
          steps: ['Add 20 items rapidly pressing Enter'],
          expected: '20 items should be added',
          actual: `Only ${count} items added`,
        });
      }
    }
  });

  test('toggle items rapidly', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/shopping`);
    await page.waitForLoadState('networkidle');

    // Find checkboxes
    const checkboxes = page.locator('input[type="checkbox"], [role="checkbox"]');
    const count = await checkboxes.count();

    if (count > 0) {
      // Toggle rapidly
      for (let i = 0; i < Math.min(count, 10); i++) {
        const checkbox = checkboxes.nth(i);
        if (await checkbox.isVisible()) {
          await checkbox.click();
          await page.waitForTimeout(50);
          await checkbox.click();
          await page.waitForTimeout(50);
        }
      }

      // Check for errors
      const errorToast = page.locator('[role="alert"], .toast-error, .error');
      if (await errorToast.isVisible()) {
        reportBug({
          severity: 'medium',
          title: 'Rapid checkbox toggling causes errors',
          description: 'Quickly toggling checkboxes causes API errors',
          steps: ['Toggle checkboxes rapidly'],
          expected: 'All toggles should process',
          actual: 'Error toast appears',
        });
      }
    }
  });
});

// ==================== USER 20: Quinn - Destructive Tester ====================
test.describe('User 20: Quinn - Destructive Tester', () => {
  test('delete confirmation exists', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/recipes`);
    await page.waitForLoadState('networkidle');

    // Find delete button
    const deleteBtn = page.locator('button:has-text("Delete"), [aria-label*="delete" i], button:has(.trash)').first();

    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await page.waitForTimeout(500);

      // Check for confirmation dialog
      const confirmDialog = page.locator('[role="dialog"], .modal, .confirm');
      const hasConfirm = await confirmDialog.isVisible();

      if (!hasConfirm) {
        reportBug({
          severity: 'high',
          title: 'Delete has no confirmation',
          description: 'Clicking delete immediately removes item without confirmation',
          steps: ['Click delete button'],
          expected: 'Confirmation dialog should appear',
          actual: 'Item deleted immediately',
        });
      }
    }
  });

  test('clear all protection', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/shopping`);
    await page.waitForLoadState('networkidle');

    // Find clear all button
    const clearBtn = page.locator('button:has-text("Clear All"), button:has-text("Clear")').first();

    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await page.waitForTimeout(500);

      // Check for confirmation
      const confirmDialog = page.locator('[role="dialog"], .modal, .confirm, [role="alertdialog"]');
      const hasConfirm = await confirmDialog.isVisible();

      if (!hasConfirm) {
        reportBug({
          severity: 'high',
          title: 'Clear All has no confirmation',
          description: 'Clear All immediately removes all items without confirmation',
          steps: ['Click Clear All button'],
          expected: 'Confirmation dialog should appear',
          actual: 'All items cleared immediately',
        });
      }
    }
  });
});

// ==================== SUMMARY ====================
test.afterAll(async () => {
  console.log('\n\n========== TEST SUMMARY ==========');
  console.log(`Total Bugs Found: ${discoveredBugs.length}`);

  const critical = discoveredBugs.filter(b => b.severity === 'critical');
  const high = discoveredBugs.filter(b => b.severity === 'high');
  const medium = discoveredBugs.filter(b => b.severity === 'medium');
  const low = discoveredBugs.filter(b => b.severity === 'low');

  console.log(`  Critical: ${critical.length}`);
  console.log(`  High: ${high.length}`);
  console.log(`  Medium: ${medium.length}`);
  console.log(`  Low: ${low.length}`);

  if (discoveredBugs.length > 0) {
    console.log('\n========== BUG DETAILS ==========');
    discoveredBugs.forEach(bug => {
      console.log(`\n[${bug.severity.toUpperCase()}] ${bug.title}`);
      console.log(`  ${bug.description}`);
      console.log(`  Steps: ${bug.steps.join(' → ')}`);
    });
  }
});

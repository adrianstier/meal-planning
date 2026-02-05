/**
 * UX/UI Click Review - Recipes Page
 *
 * Comprehensive Playwright test to verify all clickable elements on the Recipes page.
 * Tests buttons, tabs, dropdowns, dialogs, and interactive elements.
 *
 * Run with: npx playwright test client/src/tests/ux-review/recipes-clicks.spec.ts
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

// Issue tracking
interface Issue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  element: string;
  description: string;
  expected: string;
  actual: string;
  consoleErrors?: string[];
}

const discoveredIssues: Issue[] = [];
let consoleErrors: string[] = [];

function reportIssue(issue: Omit<Issue, 'id'>): void {
  discoveredIssues.push({
    id: `ISSUE-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    ...issue,
  });
  console.log(`\n[${issue.severity.toUpperCase()}] ${issue.element}: ${issue.description}`);
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

// Setup console error monitoring
function setupConsoleMonitoring(page: Page): void {
  consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });
}

// Check for console errors after action
function checkConsoleErrors(element: string): void {
  if (consoleErrors.length > 0) {
    reportIssue({
      severity: 'high',
      element,
      description: 'Console errors detected after interaction',
      expected: 'No console errors',
      actual: `${consoleErrors.length} error(s) detected`,
      consoleErrors: [...consoleErrors],
    });
    consoleErrors = [];
  }
}

test.describe('Recipes Page - Comprehensive UX Click Review', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleMonitoring(page);
  });

  // ==================== HEADER SECTION ====================
  test.describe('Header Controls', () => {
    test('Select/Cancel button toggles selection mode', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      // Find the Select button
      const selectBtn = page.locator('button:has-text("Select")').first();

      if (await selectBtn.isVisible()) {
        // Click to enter select mode
        await selectBtn.click();
        await page.waitForTimeout(300);
        checkConsoleErrors('Select button');

        // Verify select mode is active (button should change to Cancel)
        const cancelBtn = page.locator('button:has-text("Cancel")').first();
        const isVisible = await cancelBtn.isVisible();

        if (!isVisible) {
          reportIssue({
            severity: 'medium',
            element: 'Select button',
            description: 'Select mode toggle may not be working correctly',
            expected: 'Button should change to "Cancel" when selection mode is active',
            actual: 'Cancel button not visible after clicking Select',
          });
        } else {
          // Click Cancel to exit select mode
          await cancelBtn.click();
          await page.waitForTimeout(300);
          checkConsoleErrors('Cancel button');

          // Verify we're back to normal mode
          const selectBtnAgain = page.locator('button:has-text("Select")').first();
          expect(await selectBtnAgain.isVisible()).toBe(true);
        }
      } else {
        reportIssue({
          severity: 'high',
          element: 'Select button',
          description: 'Select button not found in header',
          expected: 'Select button should be visible',
          actual: 'Button not found',
        });
      }
    });

    test('Add Recipe dropdown opens and shows all options', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      // Find the Add Recipe dropdown trigger
      const addBtn = page.locator('button:has-text("Add Recipe")').first();

      if (await addBtn.isVisible()) {
        await addBtn.click();
        await page.waitForTimeout(500);
        checkConsoleErrors('Add Recipe dropdown');

        // Check for all dropdown options
        const dropdownOptions = [
          { text: 'Add Manually', selector: 'text=Add Manually' },
          { text: 'Parse from Text', selector: 'text=Parse from Text' },
          { text: 'Parse from URL', selector: 'text=Parse from URL, text=URL' },
          { text: 'Parse from Image', selector: 'text=Parse from Image, text=Image' },
        ];

        for (const option of dropdownOptions) {
          const optionEl = page.locator(`[role="menuitem"]:has-text("${option.text.split(',')[0]}")`).first();
          const isVisible = await optionEl.isVisible().catch(() => false);

          if (!isVisible) {
            reportIssue({
              severity: 'medium',
              element: `Add Recipe dropdown - ${option.text}`,
              description: `Dropdown option "${option.text}" not visible`,
              expected: 'Option should be visible in dropdown',
              actual: 'Option not found or not visible',
            });
          }
        }

        // Close dropdown by clicking elsewhere
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      } else {
        reportIssue({
          severity: 'critical',
          element: 'Add Recipe button',
          description: 'Add Recipe button not found',
          expected: 'Add Recipe button should be visible in header',
          actual: 'Button not found',
        });
      }
    });
  });

  // ==================== ADD RECIPE DROPDOWN OPTIONS ====================
  test.describe('Add Recipe Dropdown Actions', () => {
    test('Add Manually opens dialog', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      const addBtn = page.locator('button:has-text("Add Recipe")').first();
      await addBtn.click();
      await page.waitForTimeout(300);

      const manualOption = page.locator('[role="menuitem"]:has-text("Add Manually")').first();
      if (await manualOption.isVisible()) {
        await manualOption.click();
        await page.waitForTimeout(500);
        checkConsoleErrors('Add Manually option');

        // Verify dialog opened
        const dialog = page.locator('[role="dialog"]').first();
        const dialogTitle = page.locator('[role="dialog"] h2:has-text("Add Recipe"), [role="dialog"] h2:has-text("Edit Recipe")').first();

        if (!(await dialog.isVisible())) {
          reportIssue({
            severity: 'high',
            element: 'Add Manually dialog',
            description: 'Dialog did not open after clicking Add Manually',
            expected: 'Add Recipe dialog should open',
            actual: 'Dialog not visible',
          });
        } else {
          // Test Cancel button in dialog
          const cancelBtn = page.locator('[role="dialog"] button:has-text("Cancel")').first();
          if (await cancelBtn.isVisible()) {
            await cancelBtn.click();
            await page.waitForTimeout(300);
            checkConsoleErrors('Add dialog Cancel button');
          }
        }
      }
    });

    test('Parse from Text opens dialog', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      const addBtn = page.locator('button:has-text("Add Recipe")').first();
      await addBtn.click();
      await page.waitForTimeout(300);

      const parseTextOption = page.locator('[role="menuitem"]:has-text("Parse from Text")').first();
      if (await parseTextOption.isVisible()) {
        await parseTextOption.click();
        await page.waitForTimeout(500);
        checkConsoleErrors('Parse from Text option');

        // Verify dialog opened with textarea
        const dialog = page.locator('[role="dialog"]').first();
        const textarea = page.locator('[role="dialog"] textarea').first();

        if (!(await dialog.isVisible())) {
          reportIssue({
            severity: 'high',
            element: 'Parse from Text dialog',
            description: 'Dialog did not open',
            expected: 'Parse Recipe dialog should open with textarea',
            actual: 'Dialog not visible',
          });
        } else if (!(await textarea.isVisible())) {
          reportIssue({
            severity: 'high',
            element: 'Parse from Text textarea',
            description: 'Textarea not found in dialog',
            expected: 'Textarea for pasting recipe should be visible',
            actual: 'Textarea not found',
          });
        }

        // Close dialog
        const cancelBtn = page.locator('[role="dialog"] button:has-text("Cancel")').first();
        if (await cancelBtn.isVisible()) {
          await cancelBtn.click();
          await page.waitForTimeout(300);
        }
      }
    });

    test('Parse from URL opens dialog', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      const addBtn = page.locator('button:has-text("Add Recipe")').first();
      await addBtn.click();
      await page.waitForTimeout(300);

      const urlOption = page.locator('[role="menuitem"]:has-text("URL")').first();
      if (await urlOption.isVisible()) {
        await urlOption.click();
        await page.waitForTimeout(500);
        checkConsoleErrors('Parse from URL option');

        // Verify dialog opened with URL input
        const dialog = page.locator('[role="dialog"]').first();
        const urlInput = page.locator('[role="dialog"] input[type="url"], [role="dialog"] input[placeholder*="URL"]').first();

        if (!(await dialog.isVisible())) {
          reportIssue({
            severity: 'high',
            element: 'Parse from URL dialog',
            description: 'Dialog did not open',
            expected: 'URL import dialog should open',
            actual: 'Dialog not visible',
          });
        } else if (!(await urlInput.isVisible())) {
          reportIssue({
            severity: 'high',
            element: 'Parse from URL input',
            description: 'URL input not found in dialog',
            expected: 'URL input field should be visible',
            actual: 'Input not found',
          });
        } else {
          // Test that Import button is disabled when URL is empty
          const importBtn = page.locator('[role="dialog"] button:has-text("Import")').first();
          if (await importBtn.isVisible()) {
            const isDisabled = await importBtn.isDisabled();
            if (!isDisabled) {
              reportIssue({
                severity: 'medium',
                element: 'Import button',
                description: 'Import button should be disabled when URL is empty',
                expected: 'Button disabled when no URL entered',
                actual: 'Button is enabled',
              });
            }
          }
        }

        // Close dialog
        const cancelBtn = page.locator('[role="dialog"] button:has-text("Cancel")').first();
        if (await cancelBtn.isVisible()) {
          await cancelBtn.click();
          await page.waitForTimeout(300);
        }
      }
    });

    test('Parse from Image opens dialog', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      const addBtn = page.locator('button:has-text("Add Recipe")').first();
      await addBtn.click();
      await page.waitForTimeout(300);

      const imageOption = page.locator('[role="menuitem"]:has-text("Image")').first();
      if (await imageOption.isVisible()) {
        await imageOption.click();
        await page.waitForTimeout(500);
        checkConsoleErrors('Parse from Image option');

        // Verify dialog opened with file input
        const dialog = page.locator('[role="dialog"]').first();
        const fileInput = page.locator('[role="dialog"] input[type="file"]').first();

        if (!(await dialog.isVisible())) {
          reportIssue({
            severity: 'high',
            element: 'Parse from Image dialog',
            description: 'Dialog did not open',
            expected: 'Image import dialog should open',
            actual: 'Dialog not visible',
          });
        } else if (await fileInput.count() === 0) {
          reportIssue({
            severity: 'high',
            element: 'Parse from Image file input',
            description: 'File input not found in dialog',
            expected: 'File input for image upload should be present',
            actual: 'File input not found',
          });
        }

        // Close dialog
        const cancelBtn = page.locator('[role="dialog"] button:has-text("Cancel")').first();
        if (await cancelBtn.isVisible()) {
          await cancelBtn.click();
          await page.waitForTimeout(300);
        }
      }
    });
  });

  // ==================== SEARCH AND FILTERS ====================
  test.describe('Search and Filter Controls', () => {
    test('Search input is focusable and accepts input', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      const searchInput = page.locator('input[placeholder*="Search"]').first();

      if (await searchInput.isVisible()) {
        await searchInput.click();
        await searchInput.fill('test search');
        await page.waitForTimeout(300);
        checkConsoleErrors('Search input');

        const value = await searchInput.inputValue();
        if (value !== 'test search') {
          reportIssue({
            severity: 'high',
            element: 'Search input',
            description: 'Search input does not accept text',
            expected: 'Input should contain "test search"',
            actual: `Input contains "${value}"`,
          });
        }

        // Clear the search
        await searchInput.clear();
      } else {
        reportIssue({
          severity: 'high',
          element: 'Search input',
          description: 'Search input not found',
          expected: 'Search input should be visible',
          actual: 'Input not found',
        });
      }
    });

    test('Prep time filter dropdown works', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      // Find prep time filter (has Clock icon)
      const prepTimeFilter = page.locator('button[role="combobox"]').filter({ has: page.locator('svg.lucide-clock') }).first();

      if (await prepTimeFilter.isVisible()) {
        await prepTimeFilter.click();
        await page.waitForTimeout(300);
        checkConsoleErrors('Prep time filter dropdown');

        // Check for options
        const options = ['All times', '15 min', '30 min', '60 min'];
        for (const optionText of options) {
          const option = page.locator(`[role="option"]:has-text("${optionText}")`).first();
          if (!(await option.isVisible())) {
            reportIssue({
              severity: 'medium',
              element: 'Prep time filter',
              description: `Option "${optionText}" not found`,
              expected: 'All filter options should be visible',
              actual: `Option "${optionText}" not found`,
            });
          }
        }

        // Select an option
        const option30 = page.locator('[role="option"]:has-text("30")').first();
        if (await option30.isVisible()) {
          await option30.click();
          await page.waitForTimeout(300);
          checkConsoleErrors('Prep time filter selection');
        }
      } else {
        reportIssue({
          severity: 'medium',
          element: 'Prep time filter',
          description: 'Prep time filter dropdown not found',
          expected: 'Filter dropdown should be visible',
          actual: 'Dropdown not found',
        });
      }
    });

    test('Difficulty filter dropdown works', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      // Find difficulty filter (has ChefHat icon)
      const difficultyFilter = page.locator('button[role="combobox"]').filter({ has: page.locator('svg.lucide-chef-hat') }).first();

      if (await difficultyFilter.isVisible()) {
        await difficultyFilter.click();
        await page.waitForTimeout(300);
        checkConsoleErrors('Difficulty filter dropdown');

        // Check for options
        const options = ['All levels', 'Easy', 'Medium', 'Hard'];
        for (const optionText of options) {
          const option = page.locator(`[role="option"]:has-text("${optionText}")`).first();
          if (!(await option.isVisible())) {
            reportIssue({
              severity: 'medium',
              element: 'Difficulty filter',
              description: `Option "${optionText}" not found`,
              expected: 'All filter options should be visible',
              actual: `Option "${optionText}" not found`,
            });
          }
        }

        // Close dropdown
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    });

    test('Tag filter dropdown works', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      // Find tag filter - third filter in the row
      const tagFilters = page.locator('button[role="combobox"]');
      const tagFilter = tagFilters.nth(2); // 0=prep time, 1=difficulty, 2=tag

      if (await tagFilter.isVisible()) {
        await tagFilter.click();
        await page.waitForTimeout(300);
        checkConsoleErrors('Tag filter dropdown');

        // Check for options
        const options = ['All recipes', 'Kid Favorites', 'Kid-friendly', 'Bento-friendly'];
        for (const optionText of options) {
          const option = page.locator(`[role="option"]:has-text("${optionText}")`).first();
          const isVisible = await option.isVisible().catch(() => false);
          if (!isVisible) {
            reportIssue({
              severity: 'low',
              element: 'Tag filter',
              description: `Option "${optionText}" not found`,
              expected: 'Filter option should be visible',
              actual: `Option "${optionText}" not visible`,
            });
          }
        }

        // Close dropdown
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    });

    test('Cuisine filter dropdown works', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      // Find cuisine filter - fourth filter
      const cuisineFilters = page.locator('button[role="combobox"]');
      const cuisineFilter = cuisineFilters.nth(3);

      if (await cuisineFilter.isVisible()) {
        await cuisineFilter.click();
        await page.waitForTimeout(300);
        checkConsoleErrors('Cuisine filter dropdown');

        // Check "All cuisines" option exists
        const allOption = page.locator('[role="option"]:has-text("All cuisines")').first();
        if (!(await allOption.isVisible())) {
          reportIssue({
            severity: 'low',
            element: 'Cuisine filter',
            description: '"All cuisines" option not found',
            expected: 'Default option should be visible',
            actual: 'Option not found',
          });
        }

        // Close dropdown
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    });

    test('Sort dropdown works', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      // Find sort dropdown (has ArrowUpDown icon)
      const sortFilter = page.locator('button[role="combobox"]').filter({ has: page.locator('svg.lucide-arrow-up-down') }).first();

      if (await sortFilter.isVisible()) {
        await sortFilter.click();
        await page.waitForTimeout(300);
        checkConsoleErrors('Sort dropdown');

        // Check for sort options
        const options = ['Sort by name', 'Sort by rating', 'Sort by time', 'Recently cooked'];
        for (const optionText of options) {
          const option = page.locator(`[role="option"]:has-text("${optionText}")`).first();
          const isVisible = await option.isVisible().catch(() => false);
          if (!isVisible) {
            reportIssue({
              severity: 'low',
              element: 'Sort dropdown',
              description: `Sort option "${optionText}" not found`,
              expected: 'Sort option should be visible',
              actual: `Option "${optionText}" not visible`,
            });
          }
        }

        // Close dropdown
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    });
  });

  // ==================== TABS ====================
  test.describe('Filter Tabs', () => {
    const tabs = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Favorites'];

    for (const tabName of tabs) {
      test(`${tabName} tab is clickable and changes content`, async ({ page }) => {
        const loggedIn = await login(page);
        expect(loggedIn).toBe(true);

        await page.goto(`${BASE_URL}/recipes`);
        await page.waitForLoadState('networkidle');

        const tab = page.locator(`[role="tablist"] button:has-text("${tabName}")`).first();

        if (await tab.isVisible()) {
          await tab.click();
          await page.waitForTimeout(300);
          checkConsoleErrors(`${tabName} tab`);

          // Verify tab is now active
          const isActive = await tab.getAttribute('data-state');
          if (isActive !== 'active') {
            reportIssue({
              severity: 'medium',
              element: `${tabName} tab`,
              description: 'Tab does not become active when clicked',
              expected: 'Tab should have data-state="active"',
              actual: `Tab has data-state="${isActive}"`,
            });
          }
        } else {
          reportIssue({
            severity: 'high',
            element: `${tabName} tab`,
            description: 'Tab not found',
            expected: `${tabName} tab should be visible`,
            actual: 'Tab not found',
          });
        }
      });
    }
  });

  // ==================== RECIPE CARDS ====================
  test.describe('Recipe Card Interactions', () => {
    test('Recipe card click opens view dialog', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      // Find first recipe card
      const recipeCard = page.locator('.group.flex.flex-col').first();

      if (await recipeCard.isVisible()) {
        await recipeCard.click();
        await page.waitForTimeout(500);
        checkConsoleErrors('Recipe card click');

        // Verify view dialog opened
        const dialog = page.locator('[role="dialog"]').first();
        if (!(await dialog.isVisible())) {
          reportIssue({
            severity: 'high',
            element: 'Recipe card',
            description: 'View dialog did not open on card click',
            expected: 'Recipe view dialog should open',
            actual: 'Dialog not visible',
          });
        } else {
          // Close dialog
          const closeBtn = page.locator('[role="dialog"] button:has-text("Close")').first();
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
            await page.waitForTimeout(300);
          }
        }
      } else {
        console.log('No recipe cards found - skipping card click test');
      }
    });

    test('Recipe card favorite button toggles favorite', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      // Find first recipe card's favorite button (in card header)
      const favoriteBtn = page.locator('.group.flex.flex-col button:has(svg.lucide-heart)').first();

      if (await favoriteBtn.isVisible()) {
        // Get initial state
        const heartIcon = favoriteBtn.locator('svg.lucide-heart');
        const initialFill = await heartIcon.getAttribute('class');

        await favoriteBtn.click();
        await page.waitForTimeout(500);
        checkConsoleErrors('Favorite button');

        // Verify state changed (heart fill toggles)
        const newFill = await heartIcon.getAttribute('class');
        if (initialFill === newFill) {
          // Check if there was a console error that might indicate the issue
          reportIssue({
            severity: 'medium',
            element: 'Favorite button',
            description: 'Favorite state may not have toggled',
            expected: 'Heart icon should change appearance',
            actual: 'Icon class unchanged (might be API delay)',
          });
        }
      } else {
        console.log('No recipe cards found - skipping favorite test');
      }
    });

    test('Recipe card Edit button opens edit dialog', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      // Find first recipe card's Edit button
      const editBtn = page.locator('.group.flex.flex-col button:has-text("Edit")').first();

      if (await editBtn.isVisible()) {
        await editBtn.click();
        await page.waitForTimeout(500);
        checkConsoleErrors('Edit button');

        // Verify edit dialog opened
        const dialog = page.locator('[role="dialog"]').first();
        const dialogTitle = page.locator('[role="dialog"] h2').first();

        if (!(await dialog.isVisible())) {
          reportIssue({
            severity: 'high',
            element: 'Edit button',
            description: 'Edit dialog did not open',
            expected: 'Edit Recipe dialog should open',
            actual: 'Dialog not visible',
          });
        } else {
          const title = await dialogTitle.textContent();
          if (!title?.includes('Edit')) {
            reportIssue({
              severity: 'medium',
              element: 'Edit dialog',
              description: 'Dialog title does not indicate edit mode',
              expected: 'Title should contain "Edit"',
              actual: `Title is "${title}"`,
            });
          }

          // Close dialog
          const cancelBtn = page.locator('[role="dialog"] button:has-text("Cancel")').first();
          if (await cancelBtn.isVisible()) {
            await cancelBtn.click();
            await page.waitForTimeout(300);
          }
        }
      } else {
        console.log('No recipe cards found - skipping edit test');
      }
    });

    test('Recipe card Tags button opens tag dialog', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      // Find first recipe card's Tags button (has Tags icon)
      const tagsBtn = page.locator('.group.flex.flex-col button:has(svg.lucide-tags)').first();

      if (await tagsBtn.isVisible()) {
        await tagsBtn.click();
        await page.waitForTimeout(500);
        checkConsoleErrors('Tags button');

        // Verify tag dialog opened
        const dialog = page.locator('[role="dialog"]').first();

        if (!(await dialog.isVisible())) {
          reportIssue({
            severity: 'medium',
            element: 'Tags button',
            description: 'Tag dialog did not open',
            expected: 'Add Tags dialog should open',
            actual: 'Dialog not visible',
          });
        } else {
          // Close dialog
          const cancelBtn = page.locator('[role="dialog"] button:has-text("Cancel")').first();
          if (await cancelBtn.isVisible()) {
            await cancelBtn.click();
            await page.waitForTimeout(300);
          }
        }
      } else {
        console.log('No recipe cards found - skipping tags test');
      }
    });

    test('Recipe card Delete button opens confirmation', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      // Find first recipe card's Delete button (has Trash icon)
      const deleteBtn = page.locator('.group.flex.flex-col button:has(svg.lucide-trash-2)').first();

      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        await page.waitForTimeout(500);
        checkConsoleErrors('Delete button');

        // Verify confirmation dialog opened
        const dialog = page.locator('[role="dialog"]').first();
        const confirmText = page.locator('[role="dialog"]:has-text("Are you sure"), [role="dialog"]:has-text("Delete")').first();

        if (!(await dialog.isVisible())) {
          reportIssue({
            severity: 'critical',
            element: 'Delete button',
            description: 'Delete confirmation dialog did not open',
            expected: 'Confirmation dialog should appear before deleting',
            actual: 'Dialog not visible - may delete without confirmation',
          });
        } else {
          // Cancel the delete
          const cancelBtn = page.locator('[role="dialog"] button:has-text("Cancel")').first();
          if (await cancelBtn.isVisible()) {
            await cancelBtn.click();
            await page.waitForTimeout(300);
          }
        }
      } else {
        console.log('No recipe cards found - skipping delete test');
      }
    });

    test('Star rating on recipe card is interactive', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      // Find star rating component on first card
      const starRating = page.locator('.group.flex.flex-col [class*="star"], .group.flex.flex-col button:has(svg)').first();

      if (await starRating.isVisible()) {
        // Click on rating area
        await starRating.click();
        await page.waitForTimeout(300);
        checkConsoleErrors('Star rating');
      } else {
        console.log('No star rating found on cards - may be expected if no recipes');
      }
    });
  });

  // ==================== VIEW DIALOG ====================
  test.describe('View Recipe Dialog', () => {
    test('View dialog shows recipe details and all buttons work', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      // Open a recipe
      const recipeCard = page.locator('.group.flex.flex-col').first();

      if (await recipeCard.isVisible()) {
        await recipeCard.click();
        await page.waitForTimeout(500);

        const dialog = page.locator('[role="dialog"]').first();
        if (await dialog.isVisible()) {
          // Check for Close button
          const closeBtn = page.locator('[role="dialog"] button:has-text("Close")').first();
          if (!(await closeBtn.isVisible())) {
            reportIssue({
              severity: 'medium',
              element: 'View dialog Close button',
              description: 'Close button not visible in view dialog',
              expected: 'Close button should be visible',
              actual: 'Button not found',
            });
          }

          // Check for star rating
          const starRating = page.locator('[role="dialog"] [class*="star"]').first();
          if (await starRating.isVisible()) {
            await starRating.click();
            await page.waitForTimeout(200);
            checkConsoleErrors('View dialog star rating');
          }

          // Check if source URL link works (if present)
          const sourceLink = page.locator('[role="dialog"] a[href*="http"]').first();
          if (await sourceLink.isVisible()) {
            const href = await sourceLink.getAttribute('href');
            if (!href?.startsWith('http')) {
              reportIssue({
                severity: 'low',
                element: 'Source URL link',
                description: 'Source URL link may be malformed',
                expected: 'Link should be a valid URL',
                actual: `Link href: ${href}`,
              });
            }
          }

          // Close dialog
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
            await page.waitForTimeout(300);
            checkConsoleErrors('View dialog close');
          }
        }
      } else {
        console.log('No recipes to test view dialog');
      }
    });
  });

  // ==================== BULK SELECTION ====================
  test.describe('Bulk Selection Mode', () => {
    test('Selection mode allows selecting multiple recipes', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      // Enter select mode
      const selectBtn = page.locator('button:has-text("Select")').first();
      if (await selectBtn.isVisible()) {
        await selectBtn.click();
        await page.waitForTimeout(300);

        // Click on recipe cards to select them
        const recipeCards = page.locator('.group.flex.flex-col');
        const cardCount = await recipeCards.count();

        if (cardCount >= 2) {
          await recipeCards.nth(0).click();
          await page.waitForTimeout(200);
          await recipeCards.nth(1).click();
          await page.waitForTimeout(300);
          checkConsoleErrors('Recipe selection');

          // Check if floating action bar appears
          const actionBar = page.locator('.fixed.bottom-6').first();
          if (!(await actionBar.isVisible())) {
            reportIssue({
              severity: 'medium',
              element: 'Selection action bar',
              description: 'Floating action bar did not appear after selecting recipes',
              expected: 'Action bar with delete option should appear',
              actual: 'Action bar not visible',
            });
          } else {
            // Test Deselect All button
            const deselectBtn = page.locator('.fixed.bottom-6 button:has-text("Deselect All")').first();
            if (await deselectBtn.isVisible()) {
              await deselectBtn.click();
              await page.waitForTimeout(300);
              checkConsoleErrors('Deselect All');
            }
          }
        }

        // Exit select mode
        const cancelBtn = page.locator('button:has-text("Cancel")').first();
        if (await cancelBtn.isVisible()) {
          await cancelBtn.click();
          await page.waitForTimeout(300);
        }
      }
    });

    test('Bulk delete shows confirmation dialog', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      // Enter select mode
      const selectBtn = page.locator('button:has-text("Select")').first();
      if (await selectBtn.isVisible()) {
        await selectBtn.click();
        await page.waitForTimeout(300);

        // Select at least one recipe
        const recipeCard = page.locator('.group.flex.flex-col').first();
        if (await recipeCard.isVisible()) {
          await recipeCard.click();
          await page.waitForTimeout(300);

          // Click Delete Selected
          const deleteBtn = page.locator('.fixed.bottom-6 button:has-text("Delete Selected")').first();
          if (await deleteBtn.isVisible()) {
            await deleteBtn.click();
            await page.waitForTimeout(500);
            checkConsoleErrors('Delete Selected button');

            // Verify confirmation dialog
            const dialog = page.locator('[role="dialog"]').first();
            if (!(await dialog.isVisible())) {
              reportIssue({
                severity: 'critical',
                element: 'Bulk delete',
                description: 'Bulk delete did not show confirmation',
                expected: 'Confirmation dialog should appear',
                actual: 'No dialog shown - may delete without confirmation',
              });
            } else {
              // Cancel
              const cancelBtn = page.locator('[role="dialog"] button:has-text("Cancel")').first();
              if (await cancelBtn.isVisible()) {
                await cancelBtn.click();
                await page.waitForTimeout(300);
              }
            }
          }
        }

        // Exit select mode
        const cancelModeBtn = page.locator('button:has-text("Cancel")').first();
        if (await cancelModeBtn.isVisible()) {
          await cancelModeBtn.click();
        }
      }
    });
  });

  // ==================== DRAG AND DROP ====================
  test.describe('Drag and Drop', () => {
    test('Recipe cards are draggable', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      const recipeCard = page.locator('.group.flex.flex-col').first();

      if (await recipeCard.isVisible()) {
        const draggable = await recipeCard.getAttribute('draggable');
        if (draggable !== 'true') {
          reportIssue({
            severity: 'low',
            element: 'Recipe card',
            description: 'Recipe card may not be draggable',
            expected: 'Card should have draggable="true"',
            actual: `draggable="${draggable}"`,
          });
        }
      }
    });
  });

  // ==================== FORM VALIDATION ====================
  test.describe('Form Validation', () => {
    test('Add Recipe form validates required fields', async ({ page }) => {
      const loggedIn = await login(page);
      expect(loggedIn).toBe(true);

      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');

      // Open Add dialog
      const addBtn = page.locator('button:has-text("Add Recipe")').first();
      await addBtn.click();
      await page.waitForTimeout(300);

      const manualOption = page.locator('[role="menuitem"]:has-text("Add Manually")').first();
      await manualOption.click();
      await page.waitForTimeout(500);

      // Find the Add Recipe button (submit)
      const submitBtn = page.locator('[role="dialog"] button:has-text("Add Recipe")').first();

      if (await submitBtn.isVisible()) {
        // Button should be disabled when name is empty
        const isDisabled = await submitBtn.isDisabled();
        if (!isDisabled) {
          reportIssue({
            severity: 'medium',
            element: 'Add Recipe form',
            description: 'Submit button not disabled when name is empty',
            expected: 'Button should be disabled until name is entered',
            actual: 'Button is enabled',
          });
        }
      }

      // Close dialog
      const cancelBtn = page.locator('[role="dialog"] button:has-text("Cancel")').first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      }
    });
  });
});

// ==================== SUMMARY ====================
test.afterAll(async () => {
  console.log('\n\n========================================');
  console.log('     RECIPES PAGE UX CLICK REVIEW');
  console.log('========================================\n');

  console.log(`Total Issues Found: ${discoveredIssues.length}`);

  const critical = discoveredIssues.filter((i) => i.severity === 'critical');
  const high = discoveredIssues.filter((i) => i.severity === 'high');
  const medium = discoveredIssues.filter((i) => i.severity === 'medium');
  const low = discoveredIssues.filter((i) => i.severity === 'low');

  console.log(`  Critical: ${critical.length}`);
  console.log(`  High: ${high.length}`);
  console.log(`  Medium: ${medium.length}`);
  console.log(`  Low: ${low.length}`);

  if (discoveredIssues.length > 0) {
    console.log('\n========================================');
    console.log('          ISSUE DETAILS');
    console.log('========================================\n');

    if (critical.length > 0) {
      console.log('\n--- CRITICAL ISSUES ---');
      critical.forEach((issue) => {
        console.log(`\n[${issue.id}] ${issue.element}`);
        console.log(`  Description: ${issue.description}`);
        console.log(`  Expected: ${issue.expected}`);
        console.log(`  Actual: ${issue.actual}`);
        if (issue.consoleErrors?.length) {
          console.log(`  Console Errors: ${issue.consoleErrors.join(', ')}`);
        }
      });
    }

    if (high.length > 0) {
      console.log('\n--- HIGH SEVERITY ISSUES ---');
      high.forEach((issue) => {
        console.log(`\n[${issue.id}] ${issue.element}`);
        console.log(`  Description: ${issue.description}`);
        console.log(`  Expected: ${issue.expected}`);
        console.log(`  Actual: ${issue.actual}`);
        if (issue.consoleErrors?.length) {
          console.log(`  Console Errors: ${issue.consoleErrors.join(', ')}`);
        }
      });
    }

    if (medium.length > 0) {
      console.log('\n--- MEDIUM SEVERITY ISSUES ---');
      medium.forEach((issue) => {
        console.log(`\n[${issue.id}] ${issue.element}`);
        console.log(`  Description: ${issue.description}`);
        console.log(`  Expected: ${issue.expected}`);
        console.log(`  Actual: ${issue.actual}`);
      });
    }

    if (low.length > 0) {
      console.log('\n--- LOW SEVERITY ISSUES ---');
      low.forEach((issue) => {
        console.log(`\n[${issue.id}] ${issue.element}`);
        console.log(`  Description: ${issue.description}`);
      });
    }
  } else {
    console.log('\nNo issues found! All clickable elements are working correctly.');
  }

  console.log('\n========================================');
  console.log('        END OF UX CLICK REVIEW');
  console.log('========================================\n');
});

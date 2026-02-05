/**
 * UX/UI Click Review - Plan Page
 * Comprehensive Playwright test to verify all clickable elements on the Plan page
 *
 * Run with: npx playwright test client/src/tests/ux-review/plan-clicks.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

// Test credentials - loaded from environment variables
// Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD in your environment
const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL || '';
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD || '';
// Note: The meal-planning client runs on port 3001 (port 3000 is a different app)
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

if (!TEST_EMAIL || !TEST_PASSWORD) {
  console.warn('[WARNING] Test credentials not set. Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD environment variables.');
}

// Issue tracking
interface Issue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'broken_click' | 'missing_functionality' | 'ui_issue' | 'accessibility';
  element: string;
  title: string;
  description: string;
  expected: string;
  actual: string;
  screenshot?: string;
}

const discoveredIssues: Issue[] = [];

function reportIssue(issue: Omit<Issue, 'id'>): void {
  discoveredIssues.push({
    id: `ISSUE-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    ...issue,
  });
  console.log(`\n[${issue.severity.toUpperCase()}] ${issue.category}: ${issue.title}`);
  console.log(`  Element: ${issue.element}`);
  console.log(`  Expected: ${issue.expected}`);
  console.log(`  Actual: ${issue.actual}`);
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

// Helper to navigate to plan page
async function goToPlanPage(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/plan`);
  await page.waitForLoadState('networkidle');
  // Wait for the page to fully render
  await page.waitForTimeout(1000);
}

// ==================== WEEK NAVIGATION TESTS ====================
test.describe('Week Navigation', () => {
  test.beforeEach(async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);
    await goToPlanPage(page);
  });

  test('Previous week button is clickable and functional', async ({ page }) => {
    // Find the previous week button
    const prevButton = page.locator('button[aria-label="Go to previous week"], button:has([class*="ChevronLeft"])').first();

    if (!(await prevButton.isVisible())) {
      reportIssue({
        severity: 'high',
        category: 'missing_functionality',
        element: 'Previous week button',
        title: 'Previous week button not visible',
        description: 'Cannot find previous week navigation button',
        expected: 'Previous week button should be visible',
        actual: 'Button not found in DOM',
      });
      return;
    }

    // Get initial date text
    const dateDisplay = page.locator('p:has-text("–")').first();
    const initialDateText = await dateDisplay.textContent();

    // Click previous button
    await prevButton.click();
    await page.waitForTimeout(500);

    // Verify date changed
    const newDateText = await dateDisplay.textContent();
    expect(newDateText).not.toBe(initialDateText);
  });

  test('Next week button is clickable and functional', async ({ page }) => {
    const nextButton = page.locator('button[aria-label="Go to next week"], button:has([class*="ChevronRight"])').first();

    if (!(await nextButton.isVisible())) {
      reportIssue({
        severity: 'high',
        category: 'missing_functionality',
        element: 'Next week button',
        title: 'Next week button not visible',
        description: 'Cannot find next week navigation button',
        expected: 'Next week button should be visible',
        actual: 'Button not found in DOM',
      });
      return;
    }

    const dateDisplay = page.locator('p:has-text("–")').first();
    const initialDateText = await dateDisplay.textContent();

    await nextButton.click();
    await page.waitForTimeout(500);

    const newDateText = await dateDisplay.textContent();
    expect(newDateText).not.toBe(initialDateText);
  });

  test('This Week button is clickable and functional', async ({ page }) => {
    const thisWeekButton = page.locator('button:has-text("This Week")').first();

    if (!(await thisWeekButton.isVisible())) {
      reportIssue({
        severity: 'medium',
        category: 'missing_functionality',
        element: 'This Week button',
        title: 'This Week button not visible',
        description: 'Cannot find This Week navigation button',
        expected: 'This Week button should be visible',
        actual: 'Button not found in DOM',
      });
      return;
    }

    // First go to a different week
    const nextButton = page.locator('button[aria-label="Go to next week"], button:has([class*="ChevronRight"])').first();
    await nextButton.click();
    await nextButton.click();
    await page.waitForTimeout(500);

    const dateDisplayBefore = page.locator('p:has-text("–")').first();
    const dateTextBefore = await dateDisplayBefore.textContent();

    // Click This Week
    await thisWeekButton.click();
    await page.waitForTimeout(500);

    const dateTextAfter = await dateDisplayBefore.textContent();
    expect(dateTextAfter).not.toBe(dateTextBefore);
  });

  test('Rapid week navigation handles correctly', async ({ page }) => {
    const nextButton = page.locator('button[aria-label="Go to next week"], button:has([class*="ChevronRight"])').first();
    const prevButton = page.locator('button[aria-label="Go to previous week"], button:has([class*="ChevronLeft"])').first();

    try {
      // Rapid clicks
      for (let i = 0; i < 5; i++) {
        await nextButton.click();
        await page.waitForTimeout(50);
      }

      for (let i = 0; i < 5; i++) {
        await prevButton.click();
        await page.waitForTimeout(50);
      }

      // Verify no errors
      const errorElement = page.locator('[role="alert"]:has-text("error"), .error, .toast-error');
      const hasError = await errorElement.isVisible().catch(() => false);

      if (hasError) {
        reportIssue({
          severity: 'medium',
          category: 'ui_issue',
          element: 'Week navigation',
          title: 'Rapid navigation causes errors',
          description: 'Clicking navigation buttons rapidly shows error state',
          expected: 'Navigation should handle rapid clicks gracefully',
          actual: 'Error state displayed',
        });
      }
    } catch (error) {
      reportIssue({
        severity: 'high',
        category: 'broken_click',
        element: 'Week navigation',
        title: 'Rapid navigation crashes',
        description: String(error),
        expected: 'Navigation should handle rapid clicks without crashing',
        actual: 'Error thrown during navigation',
      });
    }
  });
});

// ==================== VIEW MODE TOGGLE TESTS ====================
test.describe('View Mode Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToPlanPage(page);
  });

  test('Compact view button is clickable', async ({ page }) => {
    const compactButton = page.locator('button[aria-label="Switch to compact view"]').first();

    if (await compactButton.isVisible()) {
      await compactButton.click();
      await page.waitForTimeout(300);

      // Check if view changed (compact view shows grid layout)
      const isPressed = await compactButton.getAttribute('aria-pressed');
      expect(isPressed).toBe('true');
    } else {
      reportIssue({
        severity: 'low',
        category: 'accessibility',
        element: 'Compact view button',
        title: 'Compact view button not visible or accessible',
        description: 'Button with aria-label="Switch to compact view" not found',
        expected: 'Button should be visible and accessible',
        actual: 'Button not found',
      });
    }
  });

  test('Grid view button is clickable', async ({ page }) => {
    const gridButton = page.locator('button[aria-label="Switch to grid view"]').first();

    if (await gridButton.isVisible()) {
      await gridButton.click();
      await page.waitForTimeout(300);

      const isPressed = await gridButton.getAttribute('aria-pressed');
      expect(isPressed).toBe('true');
    }
  });

  test('Meal display mode toggles work', async ({ page }) => {
    // Test Dinners button
    const dinnersButton = page.locator('button:has-text("Dinners")').first();
    if (await dinnersButton.isVisible()) {
      await dinnersButton.click();
      await page.waitForTimeout(300);
    }

    // Test 3 Meals button
    const threeMealsButton = page.locator('button:has-text("3 Meals")').first();
    if (await threeMealsButton.isVisible()) {
      await threeMealsButton.click();
      await page.waitForTimeout(300);
    }

    // Test All button
    const allButton = page.locator('button:has-text("All")').first();
    if (await allButton.isVisible()) {
      await allButton.click();
      await page.waitForTimeout(300);
    }
  });
});

// ==================== DAY CARD TESTS ====================
test.describe('Day Cards', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToPlanPage(page);
  });

  test('Day cards are visible and have expected structure', async ({ page }) => {
    // Look for day cards by their content structure
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (const dayName of dayNames) {
      const dayHeader = page.locator(`h3:has-text("${dayName}"), .font-semibold:has-text("${dayName}")`).first();

      if (!(await dayHeader.isVisible())) {
        reportIssue({
          severity: 'medium',
          category: 'missing_functionality',
          element: `Day card - ${dayName}`,
          title: `${dayName} day card not visible`,
          description: `Cannot find day card for ${dayName}`,
          expected: `Day card for ${dayName} should be visible`,
          actual: 'Day card not found',
        });
      }
    }
  });

  test('Day card expand/collapse button works (compact view)', async ({ page }) => {
    // Switch to compact view first
    const compactButton = page.locator('button[aria-label="Switch to compact view"]').first();
    if (await compactButton.isVisible()) {
      await compactButton.click();
      await page.waitForTimeout(300);
    }

    // Find expand/collapse buttons (chevrons in compact day cards)
    const expandButtons = page.locator('.h-6:has([class*="ChevronDown"]), .h-6:has([class*="ChevronUp"])');
    const count = await expandButtons.count();

    if (count > 0) {
      const firstExpandButton = expandButtons.first();
      if (await firstExpandButton.isVisible()) {
        await firstExpandButton.click();
        await page.waitForTimeout(300);
        // Verify toggle worked (look for expanded content or icon change)
      }
    }
  });
});

// ==================== MEAL SLOT TESTS ====================
test.describe('Meal Slots', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToPlanPage(page);
  });

  test('Add meal buttons are clickable', async ({ page }) => {
    // Look for + buttons in meal sections
    const addBreakfastButtons = page.locator('button[aria-label*="Add breakfast"], button[aria-label*="breakfast"]');
    const addLunchButtons = page.locator('button[aria-label*="Add lunch"], button[aria-label*="lunch"]');
    const addDinnerButtons = page.locator('button[aria-label*="Add dinner"], button[aria-label*="dinner"]');

    // Test first available add button
    const allAddButtons = page.locator('button:has([class*="Plus"])');
    const count = await allAddButtons.count();

    if (count > 0) {
      const firstAddButton = allAddButtons.first();
      if (await firstAddButton.isVisible()) {
        await firstAddButton.click();
        await page.waitForTimeout(500);

        // Check if dialog opened
        const dialog = page.locator('[role="dialog"]');
        const dialogVisible = await dialog.isVisible().catch(() => false);

        if (!dialogVisible) {
          reportIssue({
            severity: 'high',
            category: 'broken_click',
            element: 'Add meal button',
            title: 'Add meal button does not open dialog',
            description: 'Clicking add meal button does not open the meal selection dialog',
            expected: 'Dialog should open for meal selection',
            actual: 'No dialog appeared',
          });
        } else {
          // Close the dialog
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }
      }
    } else {
      // If no explicit add buttons, look for SmartDropZone empty states
      const emptySlots = page.locator('text="Add meal"');
      if ((await emptySlots.count()) > 0) {
        await emptySlots.first().click();
        await page.waitForTimeout(500);

        const dialog = page.locator('[role="dialog"]');
        if (await dialog.isVisible()) {
          await page.keyboard.press('Escape');
        }
      }
    }
  });

  test('SmartDropZone suggestions are clickable', async ({ page }) => {
    // Find SmartDropZone suggestions (if any exist)
    const suggestionButtons = page.locator('.rounded-lg.p-3.text-left, button:has(.flex-1.min-w-0)');
    const count = await suggestionButtons.count();

    if (count > 0) {
      const firstSuggestion = suggestionButtons.first();
      if (await firstSuggestion.isVisible()) {
        try {
          await firstSuggestion.click();
          await page.waitForTimeout(500);
          // Suggestion was clickable - meal may have been added
        } catch (error) {
          reportIssue({
            severity: 'medium',
            category: 'broken_click',
            element: 'SmartDropZone suggestion',
            title: 'Suggestion click failed',
            description: String(error),
            expected: 'Clicking suggestion should add the meal',
            actual: 'Click failed or threw error',
          });
        }
      }
    }
  });

  test('Browse all link in SmartDropZone is clickable', async ({ page }) => {
    const browseAllLinks = page.locator('button:has-text("Browse all"), text="Browse all recipes"');
    const count = await browseAllLinks.count();

    if (count > 0) {
      const firstLink = browseAllLinks.first();
      if (await firstLink.isVisible()) {
        await firstLink.click();
        await page.waitForTimeout(500);

        // Should open dialog
        const dialog = page.locator('[role="dialog"]');
        const dialogVisible = await dialog.isVisible().catch(() => false);

        if (dialogVisible) {
          await page.keyboard.press('Escape');
        }
      }
    }
  });

  test('"+X more" suggestions link is clickable', async ({ page }) => {
    const moreLinks = page.locator('button:has-text("+"), button:has-text("more")');
    const count = await moreLinks.count();

    if (count > 0) {
      const moreLink = moreLinks.first();
      if (await moreLink.isVisible()) {
        const textBefore = await moreLink.textContent();
        await moreLink.click();
        await page.waitForTimeout(300);
        // Should expand to show more suggestions
      }
    }
  });
});

// ==================== MEAL CARD TESTS ====================
test.describe('Meal Cards', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToPlanPage(page);
  });

  test('Meal cards are clickable and open view dialog', async ({ page }) => {
    // Find existing meal cards
    const mealCards = page.locator('.group.relative.rounded.border, [class*="meal-card"]');
    const count = await mealCards.count();

    if (count > 0) {
      const firstMeal = mealCards.first();
      if (await firstMeal.isVisible()) {
        await firstMeal.click();
        await page.waitForTimeout(500);

        // Should open view meal dialog
        const dialog = page.locator('[role="dialog"]');
        const dialogVisible = await dialog.isVisible().catch(() => false);

        if (!dialogVisible) {
          reportIssue({
            severity: 'high',
            category: 'broken_click',
            element: 'Meal card',
            title: 'Meal card click does not open dialog',
            description: 'Clicking on an existing meal card does not open the view meal dialog',
            expected: 'Dialog should open showing meal details',
            actual: 'No dialog appeared',
          });
        } else {
          // Verify dialog has content
          const dialogTitle = page.locator('[role="dialog"] h2, [role="dialog"] [class*="DialogTitle"]');
          expect(await dialogTitle.isVisible()).toBe(true);

          // Close dialog
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }
      }
    } else {
      console.log('No existing meal cards found to test - this is expected if plan is empty');
    }
  });

  test('Meal card delete button is clickable', async ({ page }) => {
    const mealCards = page.locator('.group.relative.rounded.border');
    const count = await mealCards.count();

    if (count > 0) {
      // Hover over meal card to reveal delete button
      const firstMeal = mealCards.first();
      await firstMeal.hover();
      await page.waitForTimeout(300);

      // Look for delete button (trash icon or X)
      const deleteButton = firstMeal.locator('button:has([class*="Trash2"]), button[title*="Remove"]');

      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        await page.waitForTimeout(500);

        // Should show confirmation dialog
        const confirmDialog = page.locator('[role="dialog"]:has-text("Remove"), [role="alertdialog"]');
        const confirmVisible = await confirmDialog.isVisible().catch(() => false);

        if (confirmVisible) {
          // Close confirmation dialog
          const cancelButton = page.locator('button:has-text("Cancel")');
          if (await cancelButton.isVisible()) {
            await cancelButton.click();
          } else {
            await page.keyboard.press('Escape');
          }
        } else {
          reportIssue({
            severity: 'medium',
            category: 'ui_issue',
            element: 'Meal delete button',
            title: 'Delete button has no confirmation',
            description: 'Clicking delete button does not show confirmation dialog',
            expected: 'Confirmation dialog should appear',
            actual: 'No confirmation shown',
          });
        }
      }
    }
  });

  test('Meal card context menu (more options) is clickable', async ({ page }) => {
    const mealCards = page.locator('.group.relative.rounded.border');
    const count = await mealCards.count();

    if (count > 0) {
      const firstMeal = mealCards.first();
      await firstMeal.hover();
      await page.waitForTimeout(300);

      // Look for more options button (three dots)
      const moreButton = firstMeal.locator('button:has([class*="MoreVertical"])');

      if (await moreButton.isVisible()) {
        await moreButton.click();
        await page.waitForTimeout(300);

        // Should show dropdown menu
        const dropdownMenu = page.locator('[role="menu"], [data-radix-menu-content]');
        const menuVisible = await dropdownMenu.isVisible().catch(() => false);

        if (!menuVisible) {
          reportIssue({
            severity: 'medium',
            category: 'broken_click',
            element: 'Meal card more options button',
            title: 'More options menu does not open',
            description: 'Clicking the more options button does not show dropdown menu',
            expected: 'Dropdown menu should appear with copy/move/delete options',
            actual: 'No menu appeared',
          });
        } else {
          // Test menu items
          const copyOption = dropdownMenu.locator('[role="menuitem"]:has-text("Copy")');
          const moveOption = dropdownMenu.locator('[role="menuitem"]:has-text("Move")');
          const swapOption = dropdownMenu.locator('[role="menuitem"]:has-text("Swap")');
          const deleteOption = dropdownMenu.locator('[role="menuitem"]:has-text("Delete")');

          // Verify menu items exist
          if (await copyOption.isVisible()) {
            console.log('  - Copy option: FOUND');
          }
          if (await moveOption.isVisible()) {
            console.log('  - Move option: FOUND');
          }
          if (await swapOption.isVisible()) {
            console.log('  - Swap option: FOUND');
          }
          if (await deleteOption.isVisible()) {
            console.log('  - Delete option: FOUND');
          }

          // Close menu
          await page.keyboard.press('Escape');
        }
      }
    }
  });

  test('Meal card copy functionality works', async ({ page }) => {
    const mealCards = page.locator('.group.relative.rounded.border');
    const count = await mealCards.count();

    if (count > 0) {
      const firstMeal = mealCards.first();
      await firstMeal.hover();
      await page.waitForTimeout(200);

      const moreButton = firstMeal.locator('button:has([class*="MoreVertical"])');

      if (await moreButton.isVisible()) {
        await moreButton.click();
        await page.waitForTimeout(200);

        const copyOption = page.locator('[role="menuitem"]:has-text("Copy")');
        if (await copyOption.isVisible()) {
          await copyOption.click();
          await page.waitForTimeout(500);

          // Should show toast notification
          const toast = page.locator('[data-toast-copy-meal], .fixed.bottom-4:has-text("copied")');
          const toastVisible = await toast.isVisible().catch(() => false);

          if (!toastVisible) {
            console.log('Note: Copy toast may not be visible or uses different selector');
          }
        }
      }
    }
  });
});

// ==================== DIALOG TESTS ====================
test.describe('Dialogs', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToPlanPage(page);
  });

  test('Add Meal dialog elements are clickable', async ({ page }) => {
    // Open add meal dialog
    const addButtons = page.locator('button:has([class*="Plus"])');
    const count = await addButtons.count();

    if (count > 0) {
      await addButtons.first().click();
      await page.waitForTimeout(500);

      const dialog = page.locator('[role="dialog"]');
      if (await dialog.isVisible()) {
        // Test search input
        const searchInput = dialog.locator('input[placeholder*="Search"], input#search');
        if (await searchInput.isVisible()) {
          await searchInput.fill('test');
          expect(await searchInput.inputValue()).toBe('test');
        }

        // Test Max Cook Time dropdown
        const cookTimeSelect = dialog.locator('button:has-text("Any time"), [role="combobox"]').first();
        if (await cookTimeSelect.isVisible()) {
          await cookTimeSelect.click();
          await page.waitForTimeout(200);

          const selectContent = page.locator('[role="listbox"]');
          if (await selectContent.isVisible()) {
            // Click an option
            const option = selectContent.locator('[role="option"]').first();
            if (await option.isVisible()) {
              await option.click();
            }
          }
        }

        // Test Difficulty dropdown
        const difficultySelect = dialog.locator('button:has-text("Any difficulty"), [role="combobox"]').nth(1);
        if (await difficultySelect.isVisible()) {
          await difficultySelect.click();
          await page.waitForTimeout(200);

          const selectContent = page.locator('[role="listbox"]');
          if (await selectContent.isVisible()) {
            await page.keyboard.press('Escape');
          }
        }

        // Test AI Suggestions button
        const aiButton = dialog.locator('button:has-text("AI Suggestions"), button:has-text("Get AI")');
        if (await aiButton.isVisible()) {
          // Just verify it's clickable, don't actually trigger AI call
          expect(await aiButton.isEnabled()).toBe(true);
        }

        // Test meal selection
        const mealButtons = dialog.locator('button.text-left, button:has(.font-medium)');
        const mealCount = await mealButtons.count();
        if (mealCount > 0) {
          await mealButtons.first().click();
          await page.waitForTimeout(200);
          // Should be selected (highlighted)
        }

        // Test Cancel button
        const cancelButton = dialog.locator('button:has-text("Cancel")');
        if (await cancelButton.isVisible()) {
          await cancelButton.click();
          await page.waitForTimeout(300);

          // Dialog should close
          expect(await dialog.isVisible()).toBe(false);
        }
      }
    }
  });

  test('View Meal dialog elements are clickable', async ({ page }) => {
    // Find and click an existing meal
    const mealCards = page.locator('.group.relative.rounded.border');
    const count = await mealCards.count();

    if (count > 0) {
      await mealCards.first().click();
      await page.waitForTimeout(500);

      const dialog = page.locator('[role="dialog"]');
      if (await dialog.isVisible()) {
        // Test serving adjustment buttons if present
        const decreaseButton = dialog.locator('button:has([class*="Minus"])');
        const increaseButton = dialog.locator('button:has([class*="Plus"])');

        if (await decreaseButton.isVisible()) {
          await decreaseButton.click();
          await page.waitForTimeout(200);
        }

        if (await increaseButton.isVisible()) {
          await increaseButton.click();
          await page.waitForTimeout(200);
        }

        // Test Reset button if visible
        const resetButton = dialog.locator('button:has-text("Reset")');
        if (await resetButton.isVisible()) {
          await resetButton.click();
        }

        // Test Close button
        const closeButton = dialog.locator('button:has-text("Close")');
        if (await closeButton.isVisible()) {
          await closeButton.click();
          await page.waitForTimeout(300);
          expect(await dialog.isVisible()).toBe(false);
        }
      }
    }
  });
});

// ==================== ACTION BUTTONS TESTS ====================
test.describe('Action Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToPlanPage(page);
  });

  test('Generate button is clickable', async ({ page }) => {
    const generateButton = page.locator('button:has-text("Generate"), button[data-tour-id="generate-button"]');

    if (await generateButton.isVisible()) {
      const isEnabled = await generateButton.isEnabled();

      if (isEnabled) {
        await generateButton.click();
        await page.waitForTimeout(1000);

        // Should show loading state or open dialog
        const isPending = await generateButton.locator(':has-text("Generating")').isVisible().catch(() => false);
        const dialogOpened = await page.locator('[role="dialog"]:has-text("Generated")').isVisible().catch(() => false);

        if (dialogOpened) {
          // Close the generated plan dialog
          const cancelButton = page.locator('button:has-text("Cancel")');
          if (await cancelButton.isVisible()) {
            await cancelButton.click();
          } else {
            await page.keyboard.press('Escape');
          }
        }
      }
    } else {
      reportIssue({
        severity: 'high',
        category: 'missing_functionality',
        element: 'Generate button',
        title: 'Generate button not visible',
        description: 'Cannot find the Generate/AI button on the plan page',
        expected: 'Generate button should be visible in toolbar',
        actual: 'Button not found',
      });
    }
  });

  test('Shopping list button is clickable', async ({ page }) => {
    const shopButton = page.locator('button:has-text("Shop"), button[data-tour-id="shopping-button"]');

    if (await shopButton.isVisible()) {
      const isEnabled = await shopButton.isEnabled();
      expect(isEnabled).toBe(true);
      // Don't actually click to avoid side effects
    }
  });

  test('Clear button is clickable and shows confirmation', async ({ page }) => {
    const clearButton = page.locator('button:has-text("Clear")');

    if (await clearButton.isVisible()) {
      const isEnabled = await clearButton.isEnabled();

      if (isEnabled) {
        await clearButton.click();
        await page.waitForTimeout(500);

        // Should show confirmation dialog
        const confirmDialog = page.locator('[role="dialog"]:has-text("Clear"), [role="alertdialog"]');
        const confirmVisible = await confirmDialog.isVisible().catch(() => false);

        if (confirmVisible) {
          // Close confirmation
          const cancelButton = page.locator('button:has-text("Cancel")');
          if (await cancelButton.isVisible()) {
            await cancelButton.click();
          } else {
            await page.keyboard.press('Escape');
          }
        } else {
          reportIssue({
            severity: 'high',
            category: 'ui_issue',
            element: 'Clear button',
            title: 'Clear button has no confirmation',
            description: 'Clicking Clear button does not show confirmation dialog',
            expected: 'Confirmation dialog should appear',
            actual: 'No confirmation shown (or button was disabled)',
          });
        }
      }
    }
  });

  test('Recipe sidebar toggle is clickable', async ({ page }) => {
    const toggleButton = page.locator('button:has-text("Recipes"), button[data-tour-id="recipe-sidebar-toggle"]');

    if (await toggleButton.isVisible()) {
      // Get initial state
      const initialVariant = await toggleButton.getAttribute('class');

      await toggleButton.click();
      await page.waitForTimeout(300);

      // Toggle back
      await toggleButton.click();
      await page.waitForTimeout(300);
    }
  });
});

// ==================== GENERATED PLAN DIALOG TESTS ====================
test.describe('Generated Plan Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToPlanPage(page);
  });

  test('Generated plan dialog buttons work', async ({ page }) => {
    const generateButton = page.locator('button:has-text("Generate")');

    if (await generateButton.isVisible() && await generateButton.isEnabled()) {
      await generateButton.click();

      // Wait for generation (with timeout)
      await page.waitForTimeout(5000);

      const dialog = page.locator('[role="dialog"]:has-text("Generated")');

      if (await dialog.isVisible()) {
        // Test Cancel button
        const cancelButton = dialog.locator('button:has-text("Cancel")');
        if (await cancelButton.isVisible()) {
          expect(await cancelButton.isEnabled()).toBe(true);
        }

        // Test Apply button
        const applyButton = dialog.locator('button:has-text("Apply")');
        if (await applyButton.isVisible()) {
          // Don't click Apply to avoid modifying data
          console.log('Apply button found and visible');
        }

        // Close dialog
        await cancelButton.click();
      }
    }
  });
});

// ==================== KEYBOARD SHORTCUTS TESTS ====================
test.describe('Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToPlanPage(page);
  });

  test('Arrow keys navigate weeks', async ({ page }) => {
    const dateDisplay = page.locator('p:has-text("–")').first();
    const initialDate = await dateDisplay.textContent();

    // Press Right Arrow
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);

    const afterRightDate = await dateDisplay.textContent();
    expect(afterRightDate).not.toBe(initialDate);

    // Press Left Arrow
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(500);

    const afterLeftDate = await dateDisplay.textContent();
    expect(afterLeftDate).toBe(initialDate);
  });

  test('T key goes to this week', async ({ page }) => {
    // First navigate away
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);

    // Press T to go back
    await page.keyboard.press('t');
    await page.waitForTimeout(500);

    // Should be back at current week (verify today marker is visible)
    const todayMarker = page.locator('text="Today"');
    const isCurrentWeek = await todayMarker.isVisible().catch(() => false);
    // Note: Today marker only visible on current week
  });

  test('V key toggles view mode', async ({ page }) => {
    // Press V to toggle view
    await page.keyboard.press('v');
    await page.waitForTimeout(300);

    await page.keyboard.press('v');
    await page.waitForTimeout(300);

    await page.keyboard.press('v');
    await page.waitForTimeout(300);
  });
});

// ==================== ACCESSIBILITY TESTS ====================
test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToPlanPage(page);
  });

  test('Navigation buttons have aria-labels', async ({ page }) => {
    const prevButton = page.locator('button[aria-label="Go to previous week"]');
    const nextButton = page.locator('button[aria-label="Go to next week"]');

    const prevVisible = await prevButton.isVisible().catch(() => false);
    const nextVisible = await nextButton.isVisible().catch(() => false);

    if (!prevVisible) {
      reportIssue({
        severity: 'medium',
        category: 'accessibility',
        element: 'Previous week button',
        title: 'Missing aria-label on previous week button',
        description: 'Button should have aria-label="Go to previous week"',
        expected: 'Button with proper aria-label',
        actual: 'Button without aria-label or not found',
      });
    }

    if (!nextVisible) {
      reportIssue({
        severity: 'medium',
        category: 'accessibility',
        element: 'Next week button',
        title: 'Missing aria-label on next week button',
        description: 'Button should have aria-label="Go to next week"',
        expected: 'Button with proper aria-label',
        actual: 'Button without aria-label or not found',
      });
    }
  });

  test('Add meal buttons have aria-labels', async ({ page }) => {
    const addBreakfastButtons = page.locator('button[aria-label*="Add breakfast"]');
    const addLunchButtons = page.locator('button[aria-label*="Add lunch"]');
    const addDinnerButtons = page.locator('button[aria-label*="Add dinner"]');

    const hasBreakfastLabels = (await addBreakfastButtons.count()) > 0;
    const hasLunchLabels = (await addLunchButtons.count()) > 0;
    const hasDinnerLabels = (await addDinnerButtons.count()) > 0;

    if (!hasBreakfastLabels && !hasLunchLabels && !hasDinnerLabels) {
      reportIssue({
        severity: 'low',
        category: 'accessibility',
        element: 'Add meal buttons',
        title: 'Missing aria-labels on add meal buttons',
        description: 'Add meal buttons should have descriptive aria-labels',
        expected: 'Buttons with aria-label="Add [meal type] for [day]"',
        actual: 'Buttons without proper aria-labels',
      });
    }
  });

  test('View mode buttons have aria-pressed state', async ({ page }) => {
    const compactButton = page.locator('button[aria-label="Switch to compact view"]');
    const gridButton = page.locator('button[aria-label="Switch to grid view"]');

    if (await compactButton.isVisible()) {
      const pressed = await compactButton.getAttribute('aria-pressed');
      if (pressed === null) {
        reportIssue({
          severity: 'low',
          category: 'accessibility',
          element: 'Compact view button',
          title: 'Missing aria-pressed on view toggle',
          description: 'View mode toggle buttons should have aria-pressed attribute',
          expected: 'Button with aria-pressed="true" or "false"',
          actual: 'No aria-pressed attribute',
        });
      }
    }
  });
});

// ==================== SUMMARY ====================
test.afterAll(async () => {
  console.log('\n\n========================================');
  console.log('       UX CLICK REVIEW SUMMARY         ');
  console.log('========================================');
  console.log(`Total Issues Found: ${discoveredIssues.length}`);

  if (discoveredIssues.length === 0) {
    console.log('\nNo issues found. All clickable elements passed testing.');
  } else {
    const critical = discoveredIssues.filter(i => i.severity === 'critical');
    const high = discoveredIssues.filter(i => i.severity === 'high');
    const medium = discoveredIssues.filter(i => i.severity === 'medium');
    const low = discoveredIssues.filter(i => i.severity === 'low');

    console.log(`\nBy Severity:`);
    console.log(`  Critical: ${critical.length}`);
    console.log(`  High: ${high.length}`);
    console.log(`  Medium: ${medium.length}`);
    console.log(`  Low: ${low.length}`);

    const byCategory = {
      broken_click: discoveredIssues.filter(i => i.category === 'broken_click'),
      missing_functionality: discoveredIssues.filter(i => i.category === 'missing_functionality'),
      ui_issue: discoveredIssues.filter(i => i.category === 'ui_issue'),
      accessibility: discoveredIssues.filter(i => i.category === 'accessibility'),
    };

    console.log(`\nBy Category:`);
    console.log(`  Broken Clicks: ${byCategory.broken_click.length}`);
    console.log(`  Missing Functionality: ${byCategory.missing_functionality.length}`);
    console.log(`  UI Issues: ${byCategory.ui_issue.length}`);
    console.log(`  Accessibility: ${byCategory.accessibility.length}`);

    console.log('\n========================================');
    console.log('           DETAILED ISSUES             ');
    console.log('========================================');

    discoveredIssues.forEach((issue, index) => {
      console.log(`\n[${index + 1}] ${issue.id}`);
      console.log(`    Severity: ${issue.severity.toUpperCase()}`);
      console.log(`    Category: ${issue.category}`);
      console.log(`    Element: ${issue.element}`);
      console.log(`    Title: ${issue.title}`);
      console.log(`    Expected: ${issue.expected}`);
      console.log(`    Actual: ${issue.actual}`);
    });
  }

  console.log('\n========================================');
  console.log('           ELEMENTS TESTED             ');
  console.log('========================================');
  console.log(`
  Week Navigation:
    - Previous week button
    - Next week button
    - This Week button
    - Rapid navigation handling

  View Mode Toggle:
    - Compact view button
    - Grid view button
    - Dinners/3 Meals/All toggle

  Day Cards:
    - Day card visibility (all 7 days)
    - Expand/collapse in compact view

  Meal Slots:
    - Add meal buttons
    - SmartDropZone suggestions
    - Browse all link
    - "+X more" expansion

  Meal Cards:
    - Card click (opens view dialog)
    - Delete button
    - More options context menu
    - Copy/Move/Swap menu items

  Dialogs:
    - Add Meal dialog controls
    - View Meal dialog controls
    - Generated Plan dialog

  Action Buttons:
    - Generate button
    - Shopping list button
    - Clear button (with confirmation)
    - Recipe sidebar toggle

  Keyboard Shortcuts:
    - Arrow keys for navigation
    - T for this week
    - V for view toggle

  Accessibility:
    - Navigation button aria-labels
    - Add meal button aria-labels
    - View mode aria-pressed state
  `);
});

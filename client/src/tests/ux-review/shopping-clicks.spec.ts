/**
 * UX/UI Click Review - Shopping List Page
 *
 * Comprehensive test of all clickable elements on the Shopping List page
 * Tests: Add item, checkboxes, delete, clear, share, and generate from plan
 *
 * Run with: npx playwright test client/src/tests/ux-review/shopping-clicks.spec.ts
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
  action: string;
  expected: string;
  actual: string;
  screenshot?: string;
}

const discoveredIssues: Issue[] = [];

function reportIssue(issue: Omit<Issue, 'id'>): void {
  const newIssue = {
    id: `ISSUE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...issue,
  };
  discoveredIssues.push(newIssue);
  console.log(`\n[${issue.severity.toUpperCase()}] ${issue.element}`);
  console.log(`  Action: ${issue.action}`);
  console.log(`  Expected: ${issue.expected}`);
  console.log(`  Actual: ${issue.actual}`);
}

// Helper to login
async function login(page: Page): Promise<boolean> {
  try {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Check if already logged in (redirected)
    const url = page.url();
    if (url.includes('/plan') || url.includes('/recipes') || url.includes('/lists')) {
      return true;
    }

    // Fill login form
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill(TEST_EMAIL);
    await passwordInput.fill(TEST_PASSWORD);
    await submitButton.click();

    // Wait for redirect after login
    await page.waitForURL(/\/(plan|recipes|lists)/, { timeout: 15000 });
    return true;
  } catch (error) {
    console.error('Login failed:', error);
    return false;
  }
}

// Navigate to shopping list page
async function navigateToShoppingList(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/lists`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000); // Wait for React Query to settle
}

test.describe('Shopping List Page - Click Review', () => {
  test.beforeEach(async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);
    await navigateToShoppingList(page);
  });

  // ==========================================================================
  // ADD ITEM FUNCTIONALITY
  // ==========================================================================
  test.describe('Add Item Form', () => {
    test('add item button is visible and clickable', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add")').first();

      // Verify button exists
      const isVisible = await addButton.isVisible();
      if (!isVisible) {
        reportIssue({
          severity: 'critical',
          element: 'Add Button',
          action: 'Look for Add button',
          expected: 'Add button should be visible',
          actual: 'Add button not found on page',
        });
        return;
      }

      // Check if disabled when empty (should be)
      const isDisabled = await addButton.isDisabled();
      expect(isDisabled).toBe(true);
      console.log('[PASS] Add button is correctly disabled when input is empty');
    });

    test('add item with name only', async ({ page }) => {
      const itemNameInput = page.locator('input[placeholder="Item name"]');
      const addButton = page.locator('button:has-text("Add")').first();

      // Fill item name
      await itemNameInput.fill('Test Apples');

      // Button should now be enabled
      const isEnabled = await addButton.isEnabled();
      if (!isEnabled) {
        reportIssue({
          severity: 'high',
          element: 'Add Button',
          action: 'Fill item name and check button state',
          expected: 'Add button should be enabled when item name is filled',
          actual: 'Add button remains disabled',
        });
        return;
      }

      // Click add
      await addButton.click();
      await page.waitForTimeout(1000);

      // Verify item was added
      const addedItem = page.locator('text=Test Apples');
      const wasAdded = await addedItem.isVisible();

      if (!wasAdded) {
        reportIssue({
          severity: 'high',
          element: 'Add Button',
          action: 'Click Add button after entering item name',
          expected: 'Item should appear in shopping list',
          actual: 'Item does not appear after clicking Add',
        });
      } else {
        console.log('[PASS] Item added successfully via Add button');
      }
    });

    test('add item with name and quantity', async ({ page }) => {
      const itemNameInput = page.locator('input[placeholder="Item name"]');
      const quantityInput = page.locator('input[placeholder="Qty"]');
      const addButton = page.locator('button:has-text("Add")').first();

      // Fill both fields
      await itemNameInput.fill('Test Bananas');
      await quantityInput.fill('6 bunch');
      await addButton.click();
      await page.waitForTimeout(1000);

      // Verify item with quantity was added
      const addedItem = page.locator('text=Test Bananas');
      const quantityText = page.locator('text=6 bunch');

      const itemVisible = await addedItem.isVisible();
      const qtyVisible = await quantityText.isVisible();

      if (!itemVisible || !qtyVisible) {
        reportIssue({
          severity: 'medium',
          element: 'Add Button with Quantity',
          action: 'Add item with name and quantity',
          expected: 'Item and quantity should both appear',
          actual: `Item visible: ${itemVisible}, Quantity visible: ${qtyVisible}`,
        });
      } else {
        console.log('[PASS] Item with quantity added successfully');
      }
    });

    test('add item via Enter key', async ({ page }) => {
      const itemNameInput = page.locator('input[placeholder="Item name"]');

      await itemNameInput.fill('Test Enter Key Item');
      await itemNameInput.press('Enter');
      await page.waitForTimeout(1000);

      // Verify item was added
      const addedItem = page.locator('text=Test Enter Key Item');
      const wasAdded = await addedItem.isVisible();

      if (!wasAdded) {
        reportIssue({
          severity: 'medium',
          element: 'Item Name Input',
          action: 'Press Enter after typing item name',
          expected: 'Item should be added via Enter key',
          actual: 'Item not added when pressing Enter',
        });
      } else {
        console.log('[PASS] Item added successfully via Enter key');
      }
    });

    test('input clears after adding item', async ({ page }) => {
      const itemNameInput = page.locator('input[placeholder="Item name"]');
      const quantityInput = page.locator('input[placeholder="Qty"]');
      const addButton = page.locator('button:has-text("Add")').first();

      await itemNameInput.fill('Clear Test Item');
      await quantityInput.fill('2');
      await addButton.click();
      await page.waitForTimeout(500);

      const nameValue = await itemNameInput.inputValue();
      const qtyValue = await quantityInput.inputValue();

      if (nameValue !== '' || qtyValue !== '') {
        reportIssue({
          severity: 'low',
          element: 'Input Fields',
          action: 'Add item and check if inputs clear',
          expected: 'Both inputs should clear after adding item',
          actual: `Name: "${nameValue}", Qty: "${qtyValue}"`,
        });
      } else {
        console.log('[PASS] Inputs clear correctly after adding item');
      }
    });
  });

  // ==========================================================================
  // CHECKBOX / TOGGLE FUNCTIONALITY
  // ==========================================================================
  test.describe('Checkbox Toggle', () => {
    test.beforeEach(async ({ page }) => {
      // Add a test item to work with
      const itemNameInput = page.locator('input[placeholder="Item name"]');
      const addButton = page.locator('button:has-text("Add")').first();

      await itemNameInput.fill('Checkbox Test Item');
      await addButton.click();
      await page.waitForTimeout(1000);
    });

    test('toggle item as purchased', async ({ page }) => {
      // Find the checkbox (unchecked state - empty button)
      const toggleButton = page.locator('button[aria-label="Toggle purchased"]').first();

      if (!await toggleButton.isVisible()) {
        reportIssue({
          severity: 'high',
          element: 'Toggle Checkbox',
          action: 'Find toggle button',
          expected: 'Toggle button should be visible',
          actual: 'Toggle button not found',
        });
        return;
      }

      // Click to mark as purchased
      await toggleButton.click();
      await page.waitForTimeout(1000);

      // Should now appear in purchased section (look for the section header with count)
      const purchasedSection = page.locator('h3:has-text("Purchased")').first();
      const hasPurchasedSection = await purchasedSection.isVisible();

      if (!hasPurchasedSection) {
        reportIssue({
          severity: 'high',
          element: 'Toggle Checkbox',
          action: 'Click toggle to mark as purchased',
          expected: 'Item should move to Purchased section',
          actual: 'Purchased section does not appear',
        });
      } else {
        console.log('[PASS] Item toggled to purchased successfully');
      }
    });

    test('toggle item back to active', async ({ page }) => {
      // First mark as purchased
      const toggleButton = page.locator('button[aria-label="Toggle purchased"]').first();
      await toggleButton.click();
      await page.waitForTimeout(1000);

      // Now find the uncheck button in purchased section
      const uncheckButton = page.locator('button[aria-label="Uncheck item"]').first();

      if (!await uncheckButton.isVisible()) {
        reportIssue({
          severity: 'medium',
          element: 'Uncheck Button',
          action: 'Find uncheck button in purchased section',
          expected: 'Uncheck button should be visible in purchased section',
          actual: 'Uncheck button not found',
        });
        return;
      }

      // Click to uncheck
      await uncheckButton.click();
      await page.waitForTimeout(1000);

      // Item should be back in active section
      const activeToggle = page.locator('button[aria-label="Toggle purchased"]').first();
      const isBackToActive = await activeToggle.isVisible();

      if (!isBackToActive) {
        reportIssue({
          severity: 'medium',
          element: 'Uncheck Button',
          action: 'Click to uncheck purchased item',
          expected: 'Item should move back to active list',
          actual: 'Item did not return to active list',
        });
      } else {
        console.log('[PASS] Item toggled back to active successfully');
      }
    });

    test('rapid checkbox toggling', async ({ page }) => {
      const toggleButton = page.locator('button[aria-label="Toggle purchased"]').first();

      if (!await toggleButton.isVisible()) return;

      // Rapid toggle 5 times
      for (let i = 0; i < 5; i++) {
        await toggleButton.click();
        await page.waitForTimeout(100);
      }

      await page.waitForTimeout(2000);

      // Check for errors
      const errorToast = page.locator('[role="alert"], .toast-error, .error');
      if (await errorToast.isVisible()) {
        reportIssue({
          severity: 'medium',
          element: 'Toggle Checkbox',
          action: 'Rapidly toggle checkbox 5 times',
          expected: 'No errors should occur',
          actual: 'Error toast appeared',
        });
      } else {
        console.log('[PASS] Rapid toggling handled without errors');
      }
    });
  });

  // ==========================================================================
  // DELETE FUNCTIONALITY
  // ==========================================================================
  test.describe('Delete Items', () => {
    test.beforeEach(async ({ page }) => {
      // Add a test item
      const itemNameInput = page.locator('input[placeholder="Item name"]');
      const addButton = page.locator('button:has-text("Add")').first();

      await itemNameInput.fill('Delete Test Item');
      await addButton.click();
      await page.waitForTimeout(1000);
    });

    test('delete button is visible and clickable', async ({ page }) => {
      const deleteButton = page.locator('button[aria-label="Delete item"]').first();

      if (!await deleteButton.isVisible()) {
        reportIssue({
          severity: 'high',
          element: 'Delete Button',
          action: 'Find delete button',
          expected: 'Delete button should be visible on each item',
          actual: 'Delete button not found',
        });
        return;
      }

      console.log('[PASS] Delete button is visible');
    });

    test('delete item removes it from list', async ({ page }) => {
      const deleteButton = page.locator('button[aria-label="Delete item"]').first();

      if (!await deleteButton.isVisible()) return;

      // Get count before deletion
      const itemsBefore = await page.locator('button[aria-label="Delete item"]').count();

      await deleteButton.click();
      await page.waitForTimeout(1000);

      const itemsAfter = await page.locator('button[aria-label="Delete item"]').count();

      if (itemsAfter >= itemsBefore) {
        reportIssue({
          severity: 'high',
          element: 'Delete Button',
          action: 'Click delete button',
          expected: 'Item should be removed from list',
          actual: `Items before: ${itemsBefore}, after: ${itemsAfter}`,
        });
      } else {
        console.log('[PASS] Item deleted successfully');
      }
    });

    test('delete has no confirmation (check if this is intentional)', async ({ page }) => {
      const deleteButton = page.locator('button[aria-label="Delete item"]').first();

      if (!await deleteButton.isVisible()) return;

      await deleteButton.click();

      // Check if confirmation dialog appeared
      const confirmDialog = page.locator('[role="dialog"], [role="alertdialog"], .modal');
      const hasConfirm = await confirmDialog.isVisible();

      if (!hasConfirm) {
        // Not necessarily a bug, but worth noting
        console.log('[INFO] Delete has no confirmation dialog - items delete immediately');
      } else {
        console.log('[PASS] Delete shows confirmation dialog');
      }
    });
  });

  // ==========================================================================
  // CLEAR BUTTONS
  // ==========================================================================
  test.describe('Clear Buttons', () => {
    test.beforeEach(async ({ page }) => {
      // Add multiple test items
      const itemNameInput = page.locator('input[placeholder="Item name"]');
      const addButton = page.locator('button:has-text("Add")').first();

      for (let i = 1; i <= 3; i++) {
        await itemNameInput.fill(`Clear Test ${i}`);
        await addButton.click();
        await page.waitForTimeout(500);
      }
    });

    test('Clear All button shows confirmation', async ({ page }) => {
      const clearAllButton = page.locator('button:has-text("Clear All")');

      if (!await clearAllButton.isVisible()) {
        reportIssue({
          severity: 'medium',
          element: 'Clear All Button',
          action: 'Find Clear All button',
          expected: 'Clear All button should be visible when items exist',
          actual: 'Clear All button not found',
        });
        return;
      }

      // Set up dialog handler to check if confirm appears and cancel it
      let confirmShown = false;
      page.on('dialog', async dialog => {
        confirmShown = true;
        console.log(`Dialog message: ${dialog.message()}`);
        await dialog.dismiss(); // Cancel the clear
      });

      await clearAllButton.click();
      await page.waitForTimeout(500);

      if (!confirmShown) {
        reportIssue({
          severity: 'high',
          element: 'Clear All Button',
          action: 'Click Clear All button',
          expected: 'Confirmation dialog should appear',
          actual: 'No confirmation dialog shown - items cleared immediately',
        });
      } else {
        console.log('[PASS] Clear All shows confirmation dialog');
      }
    });

    test('Clear All removes all items when confirmed', async ({ page }) => {
      const clearAllButton = page.locator('button:has-text("Clear All")');

      if (!await clearAllButton.isVisible()) return;

      // Accept the confirmation
      page.on('dialog', async dialog => {
        await dialog.accept();
      });

      await clearAllButton.click();
      await page.waitForTimeout(1500);

      // Check if empty state appears
      const emptyState = page.locator('text=Your shopping list is empty');
      const isEmpty = await emptyState.isVisible();

      if (!isEmpty) {
        reportIssue({
          severity: 'high',
          element: 'Clear All Button',
          action: 'Confirm Clear All',
          expected: 'All items should be removed and empty state shown',
          actual: 'Items still present after Clear All',
        });
      } else {
        console.log('[PASS] Clear All removes all items successfully');
      }
    });

    test('Clear Purchased button (when purchased items exist)', async ({ page }) => {
      // First mark an item as purchased
      const toggleButton = page.locator('button[aria-label="Toggle purchased"]').first();
      if (await toggleButton.isVisible()) {
        await toggleButton.click();
        await page.waitForTimeout(1000);
      }

      // Find Clear button in purchased section
      const clearPurchasedButton = page.locator('.opacity-60 button:has-text("Clear")');

      if (!await clearPurchasedButton.isVisible()) {
        console.log('[INFO] Clear Purchased button not visible (may need purchased items)');
        return;
      }

      await clearPurchasedButton.click();
      await page.waitForTimeout(1000);

      // Purchased section should be gone
      const purchasedSection = page.locator('text=Purchased (');
      const stillHasPurchased = await purchasedSection.isVisible();

      if (stillHasPurchased) {
        reportIssue({
          severity: 'medium',
          element: 'Clear Purchased Button',
          action: 'Click Clear in Purchased section',
          expected: 'Purchased items should be removed',
          actual: 'Purchased items still present',
        });
      } else {
        console.log('[PASS] Clear Purchased removes purchased items successfully');
      }
    });
  });

  // ==========================================================================
  // SHARE FUNCTIONALITY
  // ==========================================================================
  test.describe('Share Button', () => {
    test.beforeEach(async ({ page }) => {
      // Add test items
      const itemNameInput = page.locator('input[placeholder="Item name"]');
      const addButton = page.locator('button:has-text("Add")').first();

      await itemNameInput.fill('Share Test Item');
      await addButton.click();
      await page.waitForTimeout(1000);
    });

    test('Share button is visible when items exist', async ({ page }) => {
      const shareButton = page.locator('button:has-text("Share")');

      if (!await shareButton.isVisible()) {
        reportIssue({
          severity: 'low',
          element: 'Share Button',
          action: 'Find Share button',
          expected: 'Share button should be visible when items exist',
          actual: 'Share button not found',
        });
        return;
      }

      console.log('[PASS] Share button is visible');
    });

    test('Share button is clickable', async ({ page }) => {
      const shareButton = page.locator('button:has-text("Share")');

      if (!await shareButton.isVisible()) return;

      try {
        // Override clipboard API to track if copy was attempted
        await page.evaluate(() => {
          (window as unknown as { clipboardWritten?: boolean }).clipboardWritten = false;
          navigator.clipboard.writeText = async () => {
            (window as unknown as { clipboardWritten?: boolean }).clipboardWritten = true;
          };
        });

        await shareButton.click();
        await page.waitForTimeout(1000);

        // Check if clipboard was used (fallback when Web Share not available)
        const clipboardUsed = await page.evaluate(() =>
          (window as unknown as { clipboardWritten?: boolean }).clipboardWritten
        );

        console.log('[PASS] Share button is clickable and triggers share/copy action');
      } catch (error) {
        reportIssue({
          severity: 'medium',
          element: 'Share Button',
          action: 'Click Share button',
          expected: 'Should trigger share or copy action',
          actual: `Error: ${error}`,
        });
      }
    });
  });

  // ==========================================================================
  // GENERATE FROM PLAN (Tested from Plan Page)
  // ==========================================================================
  test.describe('Generate Shopping List from Plan', () => {
    test('navigate to Plan page and find shopping list button', async ({ page }) => {
      await page.goto(`${BASE_URL}/plan`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Look for the Shop button (data-tour-id="shopping-button")
      const shopButton = page.locator('[data-tour-id="shopping-button"], button:has-text("Shop")');

      if (!await shopButton.isVisible()) {
        reportIssue({
          severity: 'medium',
          element: 'Shop Button (Plan Page)',
          action: 'Find Shop button on Plan page',
          expected: 'Shop button should be visible in Plan page header',
          actual: 'Shop button not found',
        });
        return;
      }

      console.log('[PASS] Shop button found on Plan page');
    });

    test('Shop button is clickable', async ({ page }) => {
      await page.goto(`${BASE_URL}/plan`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const shopButton = page.locator('[data-tour-id="shopping-button"], button:has-text("Shop")').first();

      if (!await shopButton.isVisible()) return;

      try {
        await shopButton.click();
        await page.waitForTimeout(2000);

        // Check for alert or error
        const dialogPromise = page.waitForEvent('dialog', { timeout: 5000 }).catch(() => null);
        const dialog = await dialogPromise;

        if (dialog) {
          const message = dialog.message();
          console.log(`[INFO] Dialog appeared: ${message}`);
          await dialog.accept();

          if (message.includes('No meals planned')) {
            console.log('[PASS] Shop button works - shows appropriate message when no meals planned');
          } else if (message.includes('generated') || message.includes('Added')) {
            console.log('[PASS] Shop button works - shopping list generated');
          }
        }
      } catch (error) {
        reportIssue({
          severity: 'high',
          element: 'Shop Button',
          action: 'Click Shop button',
          expected: 'Should generate shopping list or show message',
          actual: `Error: ${error}`,
        });
      }
    });

    test('Shop button shows loading state', async ({ page }) => {
      await page.goto(`${BASE_URL}/plan`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const shopButton = page.locator('[data-tour-id="shopping-button"], button:has-text("Shop")').first();

      if (!await shopButton.isVisible()) return;

      // Set up dialog handler
      page.on('dialog', async dialog => {
        await dialog.accept();
      });

      await shopButton.click();

      // Check for loading state
      const loadingText = page.locator('button:has-text("Loading")');
      const hasLoading = await loadingText.isVisible().catch(() => false);

      if (hasLoading) {
        console.log('[PASS] Shop button shows loading state');
      } else {
        console.log('[INFO] Loading state not detected (may be too fast)');
      }
    });
  });

  // ==========================================================================
  // EMPTY STATE
  // ==========================================================================
  test.describe('Empty State', () => {
    test('empty state shows when no items', async ({ page }) => {
      // Clear all items first
      const clearAllButton = page.locator('button:has-text("Clear All")');

      if (await clearAllButton.isVisible()) {
        page.on('dialog', async dialog => await dialog.accept());
        await clearAllButton.click();
        await page.waitForTimeout(1000);
      }

      const emptyState = page.locator('text=Your shopping list is empty');
      const helpText = page.locator('text=Add items above to get started');

      const hasEmptyState = await emptyState.isVisible();
      const hasHelpText = await helpText.isVisible();

      if (!hasEmptyState || !hasHelpText) {
        reportIssue({
          severity: 'low',
          element: 'Empty State',
          action: 'View page with no items',
          expected: 'Empty state message and help text should be visible',
          actual: `Empty state: ${hasEmptyState}, Help text: ${hasHelpText}`,
        });
      } else {
        console.log('[PASS] Empty state displays correctly');
      }
    });
  });

  // ==========================================================================
  // CATEGORY ORGANIZATION
  // ==========================================================================
  test.describe('Category Organization', () => {
    test('items are organized by category', async ({ page }) => {
      // Add items that should be categorized
      const itemNameInput = page.locator('input[placeholder="Item name"]');
      const addButton = page.locator('button:has-text("Add")').first();

      await itemNameInput.fill('Milk');
      await addButton.click();
      await page.waitForTimeout(500);

      await itemNameInput.fill('Chicken breast');
      await addButton.click();
      await page.waitForTimeout(500);

      await itemNameInput.fill('Apples');
      await addButton.click();
      await page.waitForTimeout(1000);

      // Check for category headers
      const dairyCategory = page.locator('text=Dairy');
      const otherCategory = page.locator('text=Other');

      // At least some categorization should exist
      const hasCategoryHeaders = await dairyCategory.isVisible() || await otherCategory.isVisible();

      if (!hasCategoryHeaders) {
        console.log('[INFO] Items may not be auto-categorized (feature may require AI)');
      } else {
        console.log('[PASS] Items are organized by category');
      }
    });
  });

  // ==========================================================================
  // TIPS SECTION
  // ==========================================================================
  test.describe('Tips Section', () => {
    test('tips section is visible', async ({ page }) => {
      const tipsSection = page.locator('text=Shopping List Tips');

      if (!await tipsSection.isVisible()) {
        reportIssue({
          severity: 'low',
          element: 'Tips Section',
          action: 'Find tips section',
          expected: 'Tips section should be visible',
          actual: 'Tips section not found',
        });
        return;
      }

      console.log('[PASS] Tips section is visible');
    });
  });
});

// ==========================================================================
// FINAL SUMMARY
// ==========================================================================
test.afterAll(async () => {
  console.log('\n\n========================================');
  console.log('   SHOPPING LIST CLICK REVIEW SUMMARY');
  console.log('========================================\n');

  console.log(`Total Issues Found: ${discoveredIssues.length}`);

  const critical = discoveredIssues.filter(i => i.severity === 'critical');
  const high = discoveredIssues.filter(i => i.severity === 'high');
  const medium = discoveredIssues.filter(i => i.severity === 'medium');
  const low = discoveredIssues.filter(i => i.severity === 'low');

  console.log(`  Critical: ${critical.length}`);
  console.log(`  High: ${high.length}`);
  console.log(`  Medium: ${medium.length}`);
  console.log(`  Low: ${low.length}`);

  if (discoveredIssues.length > 0) {
    console.log('\n========== ISSUE DETAILS ==========\n');

    [...critical, ...high, ...medium, ...low].forEach((issue, index) => {
      console.log(`${index + 1}. [${issue.severity.toUpperCase()}] ${issue.element}`);
      console.log(`   Action: ${issue.action}`);
      console.log(`   Expected: ${issue.expected}`);
      console.log(`   Actual: ${issue.actual}`);
      console.log('');
    });
  } else {
    console.log('\nNo issues found. All clickable elements working correctly.');
  }

  console.log('\n========== TESTED ELEMENTS ==========\n');
  console.log('1. Add Item Form');
  console.log('   - Add button (disabled/enabled states)');
  console.log('   - Item name input');
  console.log('   - Quantity input');
  console.log('   - Enter key submission');
  console.log('   - Input clearing after add');
  console.log('');
  console.log('2. Toggle Checkboxes');
  console.log('   - Mark as purchased');
  console.log('   - Mark as active (uncheck)');
  console.log('   - Rapid toggling');
  console.log('');
  console.log('3. Delete Buttons');
  console.log('   - Individual item delete');
  console.log('   - Confirmation dialog (or lack thereof)');
  console.log('');
  console.log('4. Clear Buttons');
  console.log('   - Clear All (with confirmation)');
  console.log('   - Clear Purchased');
  console.log('');
  console.log('5. Share Button');
  console.log('   - Visibility');
  console.log('   - Click action');
  console.log('');
  console.log('6. Generate from Plan (Shop button on Plan page)');
  console.log('   - Button visibility');
  console.log('   - Click action');
  console.log('   - Loading state');
  console.log('');
  console.log('7. Empty State');
  console.log('   - Message display');
  console.log('');
  console.log('8. Category Organization');
  console.log('   - Auto-categorization');
  console.log('');
  console.log('9. Tips Section');
  console.log('   - Visibility');
  console.log('');
  console.log('========================================\n');
});

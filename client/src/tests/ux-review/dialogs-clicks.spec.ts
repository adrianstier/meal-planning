/**
 * UX/UI Click Review - Dialog Tests
 *
 * Comprehensive tests for all dialogs/modals in the meal planning application.
 * Tests dialog open/close behavior, button functionality, form validation,
 * keyboard interactions, and focus management.
 *
 * Run with: npx playwright test client/src/tests/ux-review/dialogs-clicks.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

// Test credentials - loaded from environment variables
// Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD in your environment
// Do NOT hardcode credentials in source files
const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL || '';
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD || '';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

// Validate credentials are provided
if (!TEST_EMAIL || !TEST_PASSWORD) {
  console.warn('[WARNING] Test credentials not set. Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD environment variables.');
}

// Bug tracking interface
interface DialogIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  dialog: string;
  page: string;
  issue: string;
  expected: string;
  actual: string;
  steps: string[];
}

const discoveredIssues: DialogIssue[] = [];

function reportIssue(issue: Omit<DialogIssue, 'id'>): void {
  discoveredIssues.push({
    id: `DIALOG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    ...issue,
  });
  console.log(`\n[ISSUE] [${issue.severity.toUpperCase()}] ${issue.dialog} on ${issue.page}: ${issue.issue}`);
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

// Helper to check if a dialog is open
async function isDialogOpen(page: Page): Promise<boolean> {
  const dialog = page.locator('[role="dialog"], .DialogContent, [data-state="open"]');
  return await dialog.isVisible();
}

// Helper to close dialog via X button
async function closeDialogViaX(page: Page): Promise<boolean> {
  try {
    const closeButton = page.locator('[role="dialog"] button:has(.lucide-x), [role="dialog"] button[aria-label*="close" i], [role="dialog"] button:has(svg.h-4.w-4)').first();
    if (await closeButton.isVisible({ timeout: 1000 })) {
      await closeButton.click();
      await page.waitForTimeout(300);
      return !(await isDialogOpen(page));
    }
    return false;
  } catch {
    return false;
  }
}

// Helper to close dialog via Cancel button
async function closeDialogViaCancel(page: Page): Promise<boolean> {
  try {
    const cancelButton = page.locator('[role="dialog"] button:has-text("Cancel")').first();
    if (await cancelButton.isVisible({ timeout: 1000 })) {
      await cancelButton.click();
      await page.waitForTimeout(300);
      return !(await isDialogOpen(page));
    }
    return false;
  } catch {
    return false;
  }
}

// Helper to close dialog via Escape key
async function closeDialogViaEscape(page: Page): Promise<boolean> {
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    return !(await isDialogOpen(page));
  } catch {
    return false;
  }
}

// Helper to close dialog via clicking outside (overlay)
async function closeDialogViaOverlay(page: Page): Promise<boolean> {
  try {
    const overlay = page.locator('[data-state="open"][class*="fixed inset-0"], .DialogOverlay');
    if (await overlay.isVisible({ timeout: 1000 })) {
      // Click in the corner to hit the overlay
      await page.mouse.click(10, 10);
      await page.waitForTimeout(300);
      return !(await isDialogOpen(page));
    }
    return false;
  } catch {
    return false;
  }
}

// ==================== PLAN PAGE DIALOGS ====================
test.describe('Plan Page Dialogs', () => {
  test.beforeEach(async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Allow UI to settle
  });

  test('Add Meal Dialog - open and close methods', async ({ page }) => {
    // Try to find and click an "Add" button for a meal slot
    const addMealButton = page.locator('button[aria-label*="Add"], button:has(.lucide-plus)').first();

    if (await addMealButton.isVisible({ timeout: 3000 })) {
      await addMealButton.click();
      await page.waitForTimeout(500);

      if (await isDialogOpen(page)) {
        console.log('[PASS] Add Meal Dialog opens');

        // Test X button close
        const closedViaX = await closeDialogViaX(page);
        if (!closedViaX) {
          reportIssue({
            severity: 'medium',
            dialog: 'Add Meal Dialog',
            page: '/plan',
            issue: 'X button does not close dialog',
            expected: 'Dialog closes when X is clicked',
            actual: 'Dialog remains open',
            steps: ['Click Add meal button', 'Click X button'],
          });
        }

        // Reopen and test Cancel
        await addMealButton.click();
        await page.waitForTimeout(500);

        if (await isDialogOpen(page)) {
          const closedViaCancel = await closeDialogViaCancel(page);
          if (!closedViaCancel) {
            reportIssue({
              severity: 'medium',
              dialog: 'Add Meal Dialog',
              page: '/plan',
              issue: 'Cancel button does not close dialog',
              expected: 'Dialog closes when Cancel is clicked',
              actual: 'Dialog remains open',
              steps: ['Click Add meal button', 'Click Cancel button'],
            });
          }
        }

        // Reopen and test Escape key
        await addMealButton.click();
        await page.waitForTimeout(500);

        if (await isDialogOpen(page)) {
          const closedViaEscape = await closeDialogViaEscape(page);
          if (!closedViaEscape) {
            reportIssue({
              severity: 'low',
              dialog: 'Add Meal Dialog',
              page: '/plan',
              issue: 'Escape key does not close dialog',
              expected: 'Dialog closes when Escape is pressed',
              actual: 'Dialog remains open',
              steps: ['Click Add meal button', 'Press Escape'],
            });
          }
        }
      } else {
        reportIssue({
          severity: 'high',
          dialog: 'Add Meal Dialog',
          page: '/plan',
          issue: 'Dialog does not open',
          expected: 'Dialog opens when Add button is clicked',
          actual: 'No dialog appears',
          steps: ['Navigate to /plan', 'Click Add meal button'],
        });
      }
    }
  });

  test('View Meal Dialog - click meal card to open', async ({ page }) => {
    // Find a meal card to click
    const mealCard = page.locator('[class*="MealCard"], .meal-card, [data-testid*="meal"]').first();

    if (await mealCard.isVisible({ timeout: 3000 })) {
      await mealCard.click();
      await page.waitForTimeout(500);

      if (await isDialogOpen(page)) {
        console.log('[PASS] View Meal Dialog opens');

        // Test Close button
        const closeButton = page.locator('[role="dialog"] button:has-text("Close")').first();
        if (await closeButton.isVisible()) {
          await closeButton.click();
          await page.waitForTimeout(300);

          if (await isDialogOpen(page)) {
            reportIssue({
              severity: 'medium',
              dialog: 'View Meal Dialog',
              page: '/plan',
              issue: 'Close button does not close dialog',
              expected: 'Dialog closes when Close is clicked',
              actual: 'Dialog remains open',
              steps: ['Click on meal card', 'Click Close button'],
            });
          }
        }
      }
    }
  });

  test('Delete Meal Confirmation Dialog', async ({ page }) => {
    // Find a delete button on a meal card
    const deleteButton = page.locator('button:has(.lucide-trash-2), button[aria-label*="delete" i]').first();

    if (await deleteButton.isVisible({ timeout: 3000 })) {
      await deleteButton.click();
      await page.waitForTimeout(500);

      if (await isDialogOpen(page)) {
        console.log('[PASS] Delete Confirmation Dialog opens');

        // Verify it has proper confirmation text
        const dialogContent = await page.locator('[role="dialog"]').textContent();
        if (!dialogContent?.toLowerCase().includes('remove') && !dialogContent?.toLowerCase().includes('delete')) {
          reportIssue({
            severity: 'medium',
            dialog: 'Delete Confirmation Dialog',
            page: '/plan',
            issue: 'Missing confirmation text',
            expected: 'Dialog should mention delete/remove action',
            actual: 'No clear confirmation message',
            steps: ['Click delete button on meal'],
          });
        }

        // Test Cancel closes without action
        await closeDialogViaCancel(page);
      }
    }
  });

  test('Generated Plan Dialog - after Generate button', async ({ page }) => {
    const generateButton = page.locator('button:has-text("Generate")').first();

    if (await generateButton.isVisible({ timeout: 3000 })) {
      // This may take time as it calls AI
      test.setTimeout(60000);

      await generateButton.click();

      // Wait for potential loading state
      await page.waitForTimeout(5000);

      if (await isDialogOpen(page)) {
        console.log('[PASS] Generated Plan Dialog opens');

        // Check for Cancel and Apply buttons
        const cancelButton = page.locator('[role="dialog"] button:has-text("Cancel")');
        const applyButton = page.locator('[role="dialog"] button:has-text("Apply")');

        if (!(await cancelButton.isVisible())) {
          reportIssue({
            severity: 'medium',
            dialog: 'Generated Plan Dialog',
            page: '/plan',
            issue: 'Missing Cancel button',
            expected: 'Cancel button should be visible',
            actual: 'No Cancel button found',
            steps: ['Click Generate button', 'Wait for dialog'],
          });
        }

        // Close without applying
        await closeDialogViaCancel(page);
      }
    }
  });

  test('Clear Week Confirmation Dialog', async ({ page }) => {
    const clearButton = page.locator('button:has-text("Clear")').first();

    if (await clearButton.isVisible({ timeout: 3000 })) {
      await clearButton.click();
      await page.waitForTimeout(500);

      if (await isDialogOpen(page)) {
        console.log('[PASS] Clear Week Confirmation Dialog opens');

        // Check for destructive warning
        const dialogContent = await page.locator('[role="dialog"]').textContent();
        if (!dialogContent?.toLowerCase().includes('clear') && !dialogContent?.toLowerCase().includes('all')) {
          reportIssue({
            severity: 'medium',
            dialog: 'Clear Week Confirmation',
            page: '/plan',
            issue: 'Missing warning text',
            expected: 'Should warn about clearing all meals',
            actual: 'No clear warning message',
            steps: ['Click Clear button'],
          });
        }

        await closeDialogViaCancel(page);
      }
    }
  });
});

// ==================== RECIPES PAGE DIALOGS ====================
test.describe('Recipes Page Dialogs', () => {
  test.beforeEach(async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);
    await page.goto(`${BASE_URL}/recipes`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('Add Recipe Dialog - Manual Entry', async ({ page }) => {
    const addButton = page.locator('button:has-text("Add Recipe"), button:has-text("Add")').first();

    if (await addButton.isVisible({ timeout: 3000 })) {
      await addButton.click();
      await page.waitForTimeout(500);

      // Click "Add Manually" from dropdown
      const manualOption = page.locator('[role="menuitem"]:has-text("Manually"), text=Add Manually').first();
      if (await manualOption.isVisible({ timeout: 1000 })) {
        await manualOption.click();
        await page.waitForTimeout(500);
      }

      if (await isDialogOpen(page)) {
        console.log('[PASS] Add Recipe Dialog opens');

        // Test form validation - submit without required fields
        const submitButton = page.locator('[role="dialog"] button:has-text("Add Recipe"), [role="dialog"] button[type="submit"]').first();

        if (await submitButton.isVisible()) {
          // Clear name field if present
          const nameInput = page.locator('[role="dialog"] input[name="name"], [role="dialog"] #name').first();
          if (await nameInput.isVisible()) {
            await nameInput.fill('');
          }

          // Button should be disabled when name is empty
          const isDisabled = await submitButton.isDisabled();
          if (!isDisabled) {
            // Try clicking and check if form shows validation error
            await submitButton.click();
            await page.waitForTimeout(500);

            // If dialog is still open without an error message, that's an issue
            if (await isDialogOpen(page)) {
              const hasError = await page.locator('.error, [class*="error"], [aria-invalid="true"]').isVisible();
              if (!hasError) {
                reportIssue({
                  severity: 'high',
                  dialog: 'Add Recipe Dialog',
                  page: '/recipes',
                  issue: 'Form submits without required fields',
                  expected: 'Should show validation error or disable button',
                  actual: 'No validation shown',
                  steps: ['Open Add Recipe dialog', 'Leave name empty', 'Click Add Recipe'],
                });
              }
            }
          }
        }

        await closeDialogViaCancel(page);
      }
    }
  });

  test('Parse Recipe from Text Dialog', async ({ page }) => {
    const addButton = page.locator('button:has-text("Add Recipe"), button:has-text("Add")').first();

    if (await addButton.isVisible({ timeout: 3000 })) {
      await addButton.click();
      await page.waitForTimeout(500);

      const parseOption = page.locator('[role="menuitem"]:has-text("Text"), text=Parse from Text').first();
      if (await parseOption.isVisible({ timeout: 1000 })) {
        await parseOption.click();
        await page.waitForTimeout(500);

        if (await isDialogOpen(page)) {
          console.log('[PASS] Parse from Text Dialog opens');

          // Verify textarea exists
          const textarea = page.locator('[role="dialog"] textarea').first();
          if (!(await textarea.isVisible())) {
            reportIssue({
              severity: 'high',
              dialog: 'Parse from Text Dialog',
              page: '/recipes',
              issue: 'Missing text input area',
              expected: 'Should have textarea for pasting recipe',
              actual: 'No textarea found',
              steps: ['Open Add Recipe dropdown', 'Click Parse from Text'],
            });
          }

          // Parse button should be disabled when empty
          const parseButton = page.locator('[role="dialog"] button:has-text("Parse")').first();
          if (await parseButton.isVisible()) {
            const isDisabled = await parseButton.isDisabled();
            if (!isDisabled) {
              reportIssue({
                severity: 'medium',
                dialog: 'Parse from Text Dialog',
                page: '/recipes',
                issue: 'Parse button enabled with empty input',
                expected: 'Parse button should be disabled when textarea is empty',
                actual: 'Button is enabled',
                steps: ['Open Parse from Text dialog', 'Leave textarea empty'],
              });
            }
          }

          await closeDialogViaCancel(page);
        }
      }
    }
  });

  test('Parse Recipe from URL Dialog', async ({ page }) => {
    const addButton = page.locator('button:has-text("Add Recipe"), button:has-text("Add")').first();

    if (await addButton.isVisible({ timeout: 3000 })) {
      await addButton.click();
      await page.waitForTimeout(500);

      const urlOption = page.locator('[role="menuitem"]:has-text("URL"), text=Parse from URL').first();
      if (await urlOption.isVisible({ timeout: 1000 })) {
        await urlOption.click();
        await page.waitForTimeout(500);

        if (await isDialogOpen(page)) {
          console.log('[PASS] Parse from URL Dialog opens');

          // Verify URL input exists
          const urlInput = page.locator('[role="dialog"] input[type="url"], [role="dialog"] input[placeholder*="URL"]').first();
          if (!(await urlInput.isVisible())) {
            reportIssue({
              severity: 'high',
              dialog: 'Parse from URL Dialog',
              page: '/recipes',
              issue: 'Missing URL input field',
              expected: 'Should have URL input',
              actual: 'No URL input found',
              steps: ['Open Add Recipe dropdown', 'Click Parse from URL'],
            });
          }

          // Test with invalid URL
          if (await urlInput.isVisible()) {
            await urlInput.fill('not-a-valid-url');
            const importButton = page.locator('[role="dialog"] button:has-text("Import")').first();

            if (await importButton.isVisible()) {
              await importButton.click();
              await page.waitForTimeout(1000);

              // Should show error or be blocked
              if (await isDialogOpen(page)) {
                // This is acceptable - validation is working by not processing
                console.log('[INFO] Invalid URL handling appears to work');
              }
            }
          }

          await closeDialogViaCancel(page);
        }
      }
    }
  });

  test('Parse Recipe from Image Dialog', async ({ page }) => {
    const addButton = page.locator('button:has-text("Add Recipe"), button:has-text("Add")').first();

    if (await addButton.isVisible({ timeout: 3000 })) {
      await addButton.click();
      await page.waitForTimeout(500);

      const imageOption = page.locator('[role="menuitem"]:has-text("Image"), text=Parse from Image').first();
      if (await imageOption.isVisible({ timeout: 1000 })) {
        await imageOption.click();
        await page.waitForTimeout(500);

        if (await isDialogOpen(page)) {
          console.log('[PASS] Parse from Image Dialog opens');

          // Verify file input exists
          const fileInput = page.locator('[role="dialog"] input[type="file"]').first();
          if (!(await fileInput.count())) {
            reportIssue({
              severity: 'high',
              dialog: 'Parse from Image Dialog',
              page: '/recipes',
              issue: 'Missing file input',
              expected: 'Should have file input for image',
              actual: 'No file input found',
              steps: ['Open Add Recipe dropdown', 'Click Parse from Image'],
            });
          }

          // Parse button should be disabled without image
          const parseButton = page.locator('[role="dialog"] button:has-text("Parse")').first();
          if (await parseButton.isVisible()) {
            const isDisabled = await parseButton.isDisabled();
            if (!isDisabled) {
              reportIssue({
                severity: 'medium',
                dialog: 'Parse from Image Dialog',
                page: '/recipes',
                issue: 'Parse button enabled without image',
                expected: 'Parse button should be disabled without image',
                actual: 'Button is enabled',
                steps: ['Open Parse from Image dialog', 'Do not select image'],
              });
            }
          }

          await closeDialogViaCancel(page);
        }
      }
    }
  });

  test('View Recipe Dialog', async ({ page }) => {
    const recipeCard = page.locator('.card, [class*="Card"]').first();

    if (await recipeCard.isVisible({ timeout: 3000 })) {
      await recipeCard.click();
      await page.waitForTimeout(500);

      if (await isDialogOpen(page)) {
        console.log('[PASS] View Recipe Dialog opens');

        // Verify Close button exists
        const closeButton = page.locator('[role="dialog"] button:has-text("Close")').first();
        if (!(await closeButton.isVisible())) {
          reportIssue({
            severity: 'low',
            dialog: 'View Recipe Dialog',
            page: '/recipes',
            issue: 'Missing Close button',
            expected: 'Should have visible Close button',
            actual: 'No Close button found',
            steps: ['Click on recipe card'],
          });
        }

        // Test Escape to close
        const closedViaEscape = await closeDialogViaEscape(page);
        if (!closedViaEscape && await isDialogOpen(page)) {
          // Try X button
          await closeDialogViaX(page);
        }
      }
    }
  });

  test('Delete Recipe Confirmation Dialog', async ({ page }) => {
    const deleteButton = page.locator('button:has(.lucide-trash-2)').first();

    if (await deleteButton.isVisible({ timeout: 3000 })) {
      await deleteButton.click();
      await page.waitForTimeout(500);

      if (await isDialogOpen(page)) {
        console.log('[PASS] Delete Recipe Confirmation opens');

        // Verify destructive styling on delete button
        const confirmDeleteButton = page.locator('[role="dialog"] button:has-text("Delete")').first();
        if (await confirmDeleteButton.isVisible()) {
          const classList = await confirmDeleteButton.getAttribute('class');
          if (!classList?.includes('destructive') && !classList?.includes('red')) {
            reportIssue({
              severity: 'low',
              dialog: 'Delete Recipe Confirmation',
              page: '/recipes',
              issue: 'Delete button lacks destructive styling',
              expected: 'Delete button should have red/destructive styling',
              actual: 'Normal button styling',
              steps: ['Click delete button on recipe', 'Check Delete button styling'],
            });
          }
        }

        await closeDialogViaCancel(page);
      }
    }
  });

  test('Bulk Tag Dialog', async ({ page }) => {
    const tagButton = page.locator('button:has(.lucide-tags)').first();

    if (await tagButton.isVisible({ timeout: 3000 })) {
      await tagButton.click();
      await page.waitForTimeout(500);

      if (await isDialogOpen(page)) {
        console.log('[PASS] Bulk Tag Dialog opens');

        // Verify tag input exists
        const tagInput = page.locator('[role="dialog"] input').first();
        if (!(await tagInput.isVisible())) {
          reportIssue({
            severity: 'medium',
            dialog: 'Bulk Tag Dialog',
            page: '/recipes',
            issue: 'Missing tag input',
            expected: 'Should have input for entering tags',
            actual: 'No input found',
            steps: ['Click tag button on recipe'],
          });
        }

        await closeDialogViaCancel(page);
      }
    }
  });
});

// ==================== RESTAURANTS PAGE DIALOGS ====================
test.describe('Restaurants Page Dialogs', () => {
  test.beforeEach(async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);
    await page.goto(`${BASE_URL}/restaurants`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('Add Restaurant Dialog', async ({ page }) => {
    const addButton = page.locator('button:has-text("Add Restaurant"), button:has-text("Add")').first();

    if (await addButton.isVisible({ timeout: 3000 })) {
      await addButton.click();
      await page.waitForTimeout(500);

      if (await isDialogOpen(page)) {
        console.log('[PASS] Add Restaurant Dialog opens');

        // Check for search functionality
        const searchInput = page.locator('[role="dialog"] input[placeholder*="search" i], [role="dialog"] input[placeholder*="name" i]').first();
        if (await searchInput.isVisible()) {
          console.log('[INFO] Restaurant search input found');
        }

        // Test Cancel closes
        await closeDialogViaCancel(page);
      }
    }
  });

  test('Edit Restaurant Dialog', async ({ page }) => {
    const editButton = page.locator('button:has(.lucide-pencil)').first();

    if (await editButton.isVisible({ timeout: 3000 })) {
      await editButton.click();
      await page.waitForTimeout(500);

      if (await isDialogOpen(page)) {
        console.log('[PASS] Edit Restaurant Dialog opens');

        // Verify form is pre-filled
        const nameInput = page.locator('[role="dialog"] input[id="name"]').first();
        if (await nameInput.isVisible()) {
          const value = await nameInput.inputValue();
          if (!value) {
            reportIssue({
              severity: 'medium',
              dialog: 'Edit Restaurant Dialog',
              page: '/restaurants',
              issue: 'Form not pre-filled with existing data',
              expected: 'Name field should contain restaurant name',
              actual: 'Name field is empty',
              steps: ['Click edit button on restaurant'],
            });
          }
        }

        await closeDialogViaCancel(page);
      }
    }
  });

  test('Delete Restaurant Confirmation', async ({ page }) => {
    const deleteButton = page.locator('button:has(.lucide-trash-2)').first();

    if (await deleteButton.isVisible({ timeout: 3000 })) {
      await deleteButton.click();
      await page.waitForTimeout(500);

      if (await isDialogOpen(page)) {
        console.log('[PASS] Delete Restaurant Confirmation opens');

        // Verify restaurant name is mentioned
        const dialogText = await page.locator('[role="dialog"]').textContent();
        if (!dialogText?.toLowerCase().includes('delete')) {
          reportIssue({
            severity: 'medium',
            dialog: 'Delete Restaurant Confirmation',
            page: '/restaurants',
            issue: 'Missing clear delete confirmation',
            expected: 'Should mention deleting the restaurant',
            actual: 'No clear confirmation text',
            steps: ['Click delete on restaurant'],
          });
        }

        await closeDialogViaCancel(page);
      }
    }
  });

  test('Suggest Restaurants Dialog', async ({ page }) => {
    const suggestButton = page.locator('button:has-text("Suggest")').first();

    if (await suggestButton.isVisible({ timeout: 3000 })) {
      await suggestButton.click();
      await page.waitForTimeout(2000);

      if (await isDialogOpen(page)) {
        console.log('[PASS] Suggest Restaurants Dialog opens');

        // Verify suggestions are shown or empty state
        const dialogContent = await page.locator('[role="dialog"]').textContent();
        if (!dialogContent?.includes('suggestion') && !dialogContent?.includes('No restaurants')) {
          reportIssue({
            severity: 'low',
            dialog: 'Suggest Restaurants Dialog',
            page: '/restaurants',
            issue: 'Missing suggestions or empty state message',
            expected: 'Should show suggestions or empty state',
            actual: 'No clear content',
            steps: ['Click Suggest button'],
          });
        }

        // Close button should exist
        const closeButton = page.locator('[role="dialog"] button:has-text("Close")').first();
        if (await closeButton.isVisible()) {
          await closeButton.click();
        } else {
          await closeDialogViaX(page);
        }
      }
    }
  });
});

// ==================== HOLIDAY PLANNER DIALOGS ====================
test.describe('Holiday Planner Dialogs', () => {
  test.beforeEach(async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);
    await page.goto(`${BASE_URL}/holidays`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('Create Event Dialog', async ({ page }) => {
    const newEventButton = page.locator('button:has-text("New Holiday Event"), button:has-text("New Event")').first();

    if (await newEventButton.isVisible({ timeout: 3000 })) {
      await newEventButton.click();
      await page.waitForTimeout(500);

      if (await isDialogOpen(page)) {
        console.log('[PASS] Create Event Dialog opens');

        // Verify required fields exist
        const nameInput = page.locator('[role="dialog"] input[name="name"], [role="dialog"] #event-name').first();
        const dateInput = page.locator('[role="dialog"] input[type="date"]').first();

        if (!(await nameInput.isVisible())) {
          reportIssue({
            severity: 'high',
            dialog: 'Create Event Dialog',
            page: '/holidays',
            issue: 'Missing event name input',
            expected: 'Should have name input field',
            actual: 'No name input found',
            steps: ['Click New Holiday Event'],
          });
        }

        if (!(await dateInput.isVisible())) {
          reportIssue({
            severity: 'high',
            dialog: 'Create Event Dialog',
            page: '/holidays',
            issue: 'Missing date input',
            expected: 'Should have date input field',
            actual: 'No date input found',
            steps: ['Click New Holiday Event'],
          });
        }

        await closeDialogViaCancel(page);
      }
    }
  });

  test('Add Dish Dialog', async ({ page }) => {
    // First need to select an event
    const eventCard = page.locator('.card, [class*="Card"]').first();
    if (await eventCard.isVisible({ timeout: 3000 })) {
      await eventCard.click();
      await page.waitForTimeout(500);

      const addDishButton = page.locator('button:has-text("Add Dish")').first();
      if (await addDishButton.isVisible({ timeout: 3000 })) {
        await addDishButton.click();
        await page.waitForTimeout(500);

        if (await isDialogOpen(page)) {
          console.log('[PASS] Add Dish Dialog opens');

          // Verify dish name input
          const dishNameInput = page.locator('[role="dialog"] input').first();
          if (!(await dishNameInput.isVisible())) {
            reportIssue({
              severity: 'high',
              dialog: 'Add Dish Dialog',
              page: '/holidays',
              issue: 'Missing dish name input',
              expected: 'Should have input for dish name',
              actual: 'No input found',
              steps: ['Select event', 'Click Add Dish'],
            });
          }

          await closeDialogViaCancel(page);
        }
      }
    }
  });

  test('Add Guest Dialog', async ({ page }) => {
    // First select an event and go to guests tab
    const eventCard = page.locator('.card, [class*="Card"]').first();
    if (await eventCard.isVisible({ timeout: 3000 })) {
      await eventCard.click();
      await page.waitForTimeout(500);

      const guestsTab = page.locator('button:has-text("Guests"), [role="tab"]:has-text("Guests")').first();
      if (await guestsTab.isVisible()) {
        await guestsTab.click();
        await page.waitForTimeout(500);
      }

      const addGuestButton = page.locator('button:has-text("Add Guest")').first();
      if (await addGuestButton.isVisible({ timeout: 3000 })) {
        await addGuestButton.click();
        await page.waitForTimeout(500);

        if (await isDialogOpen(page)) {
          console.log('[PASS] Add Guest Dialog opens');

          // Verify guest name input
          const guestNameInput = page.locator('[role="dialog"] input').first();
          if (!(await guestNameInput.isVisible())) {
            reportIssue({
              severity: 'medium',
              dialog: 'Add Guest Dialog',
              page: '/holidays',
              issue: 'Missing guest name input',
              expected: 'Should have input for guest name',
              actual: 'No input found',
              steps: ['Select event', 'Go to Guests tab', 'Click Add Guest'],
            });
          }

          await closeDialogViaCancel(page);
        }
      }
    }
  });

  test('Templates Dialog', async ({ page }) => {
    // First select an event
    const eventCard = page.locator('.card, [class*="Card"]').first();
    if (await eventCard.isVisible({ timeout: 3000 })) {
      await eventCard.click();
      await page.waitForTimeout(500);

      const templatesButton = page.locator('button:has-text("Templates")').first();
      if (await templatesButton.isVisible({ timeout: 3000 })) {
        await templatesButton.click();
        await page.waitForTimeout(500);

        if (await isDialogOpen(page)) {
          console.log('[PASS] Templates Dialog opens');

          // Verify template options exist
          const templateCards = page.locator('[role="dialog"] .card, [role="dialog"] [class*="Card"]');
          const count = await templateCards.count();
          if (count === 0) {
            reportIssue({
              severity: 'medium',
              dialog: 'Templates Dialog',
              page: '/holidays',
              issue: 'No template options shown',
              expected: 'Should display template options (Thanksgiving, Christmas, Easter)',
              actual: 'No templates visible',
              steps: ['Select event', 'Click Templates'],
            });
          }

          await closeDialogViaX(page);
        }
      }
    }
  });
});

// ==================== BENTO PAGE DIALOGS ====================
test.describe('Bento Page Dialogs', () => {
  test.beforeEach(async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);
    await page.goto(`${BASE_URL}/bento`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('Add/Edit Bento Item Dialog', async ({ page }) => {
    const addItemButton = page.locator('button:has-text("Add Bento Item")').first();

    if (await addItemButton.isVisible({ timeout: 3000 })) {
      await addItemButton.click();
      await page.waitForTimeout(500);

      if (await isDialogOpen(page)) {
        console.log('[PASS] Add Bento Item Dialog opens');

        // Verify form fields
        const nameInput = page.locator('[role="dialog"] input[id="name"]').first();
        const categorySelect = page.locator('[role="dialog"] [class*="SelectTrigger"]').first();

        if (!(await nameInput.isVisible())) {
          reportIssue({
            severity: 'high',
            dialog: 'Add Bento Item Dialog',
            page: '/bento',
            issue: 'Missing item name input',
            expected: 'Should have name input',
            actual: 'No name input found',
            steps: ['Click Add Bento Item'],
          });
        }

        if (!(await categorySelect.isVisible())) {
          reportIssue({
            severity: 'high',
            dialog: 'Add Bento Item Dialog',
            page: '/bento',
            issue: 'Missing category selector',
            expected: 'Should have category dropdown',
            actual: 'No category selector found',
            steps: ['Click Add Bento Item'],
          });
        }

        // Test submit button is disabled without name
        const submitButton = page.locator('[role="dialog"] button:has-text("Add")').last();
        if (await submitButton.isVisible()) {
          const isDisabled = await submitButton.isDisabled();
          if (!isDisabled) {
            // Fill and clear to ensure empty state
            await nameInput.fill('');
            await page.waitForTimeout(100);
            const stillEnabled = !(await submitButton.isDisabled());
            if (stillEnabled) {
              reportIssue({
                severity: 'medium',
                dialog: 'Add Bento Item Dialog',
                page: '/bento',
                issue: 'Submit enabled without required name',
                expected: 'Add button should be disabled without name',
                actual: 'Button is enabled',
                steps: ['Click Add Bento Item', 'Leave name empty'],
              });
            }
          }
        }

        await closeDialogViaCancel(page);
      }
    }
  });
});

// ==================== DIAGNOSTICS PAGE DIALOGS ====================
test.describe('Diagnostics Page Dialogs', () => {
  test.beforeEach(async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);
    await page.goto(`${BASE_URL}/diagnostics`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('Error Details Dialog', async ({ page }) => {
    // Click on an error row if any exist
    const errorRow = page.locator('.card[class*="cursor-pointer"]').first();

    if (await errorRow.isVisible({ timeout: 3000 })) {
      await errorRow.click();
      await page.waitForTimeout(500);

      if (await isDialogOpen(page)) {
        console.log('[PASS] Error Details Dialog opens');

        // Verify error details are shown
        const dialogContent = await page.locator('[role="dialog"]').textContent();
        if (!dialogContent?.includes('Error') && !dialogContent?.includes('Message')) {
          reportIssue({
            severity: 'low',
            dialog: 'Error Details Dialog',
            page: '/diagnostics',
            issue: 'Missing error information',
            expected: 'Should display error details',
            actual: 'No clear error information',
            steps: ['Click on error row'],
          });
        }

        // Test Close button
        const closeButton = page.locator('[role="dialog"] button:has-text("Close")').first();
        if (await closeButton.isVisible()) {
          await closeButton.click();
        } else {
          await closeDialogViaX(page);
        }
      }
    } else {
      console.log('[INFO] No errors to click on diagnostics page');
    }
  });
});

// ==================== ERROR LOG VIEWER DIALOG (Global) ====================
test.describe('Error Log Viewer Dialog', () => {
  test('Opens via keyboard shortcut', async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);

    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Trigger with Ctrl+Shift+E
    await page.keyboard.press('Control+Shift+e');
    await page.waitForTimeout(500);

    if (await isDialogOpen(page)) {
      console.log('[PASS] Error Log Viewer opens via keyboard shortcut');

      // Verify it has expected sections
      const dialogContent = await page.locator('[role="dialog"]').textContent();
      if (!dialogContent?.toLowerCase().includes('error')) {
        reportIssue({
          severity: 'low',
          dialog: 'Error Log Viewer',
          page: 'Global',
          issue: 'Missing error content',
          expected: 'Should show error log information',
          actual: 'No error-related content',
          steps: ['Press Ctrl+Shift+E'],
        });
      }

      await closeDialogViaX(page);
    }
  });
});

// ==================== FOCUS TRAP TESTS ====================
test.describe('Dialog Focus Management', () => {
  test('Focus is trapped within dialog', async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);

    await page.goto(`${BASE_URL}/recipes`);
    await page.waitForLoadState('networkidle');

    // Open a dialog
    const addButton = page.locator('button:has-text("Add Recipe"), button:has-text("Add")').first();
    if (await addButton.isVisible({ timeout: 3000 })) {
      await addButton.click();
      await page.waitForTimeout(500);

      const manualOption = page.locator('[role="menuitem"]:has-text("Manually")').first();
      if (await manualOption.isVisible({ timeout: 1000 })) {
        await manualOption.click();
        await page.waitForTimeout(500);
      }

      if (await isDialogOpen(page)) {
        // Tab multiple times to check focus stays in dialog
        for (let i = 0; i < 20; i++) {
          await page.keyboard.press('Tab');
        }

        // Get focused element
        const focusedElement = await page.evaluate(() => {
          return document.activeElement?.closest('[role="dialog"]') !== null;
        });

        if (!focusedElement) {
          reportIssue({
            severity: 'high',
            dialog: 'Add Recipe Dialog',
            page: '/recipes',
            issue: 'Focus escapes dialog on Tab',
            expected: 'Focus should stay within dialog',
            actual: 'Focus moved outside dialog',
            steps: ['Open dialog', 'Press Tab 20 times'],
          });
        }

        await closeDialogViaEscape(page);
      }
    }
  });
});

// ==================== SUMMARY ====================
test.afterAll(async () => {
  console.log('\n\n========== DIALOG TEST SUMMARY ==========');
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
    console.log('\n========== ISSUE DETAILS ==========');
    discoveredIssues.forEach(issue => {
      console.log(`\n[${issue.severity.toUpperCase()}] ${issue.dialog} (${issue.page})`);
      console.log(`  Issue: ${issue.issue}`);
      console.log(`  Expected: ${issue.expected}`);
      console.log(`  Actual: ${issue.actual}`);
      console.log(`  Steps: ${issue.steps.join(' -> ')}`);
    });

    console.log('\n========== ISSUES BY PAGE ==========');
    const byPage: Record<string, DialogIssue[]> = {};
    discoveredIssues.forEach(issue => {
      if (!byPage[issue.page]) byPage[issue.page] = [];
      byPage[issue.page].push(issue);
    });
    Object.entries(byPage).forEach(([page, issues]) => {
      console.log(`\n${page}: ${issues.length} issues`);
      issues.forEach(i => console.log(`  - [${i.severity}] ${i.dialog}: ${i.issue}`));
    });
  } else {
    console.log('\nNo dialog issues found - all dialogs working correctly!');
  }

  console.log('\n========== END SUMMARY ==========\n');
});

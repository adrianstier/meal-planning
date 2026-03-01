/**
 * Test: Parse NYT Cooking recipe via AI URL parser
 */
import { test, expect, Page } from '@playwright/test';

const TEST_EMAIL = 'claudetest@mealplanner.dev';
const TEST_PASSWORD = 'ClaudeTest2024';
const BASE_URL = 'http://localhost:3001';
const RECIPE_URL = 'https://cooking.nytimes.com/recipes/767821616-chicken-and-white-bean-stew';

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  if (page.url().includes('/plan') || page.url().includes('/recipes')) return;
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(plan|recipes)/, { timeout: 15000 });
}

test('Parse NYT Cooking recipe URL via AI parser', async ({ page }) => {
  test.setTimeout(300000); // 5 minutes — AI import can take 2+ minutes

  // Capture console logs
  const consoleLogs: string[] = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

  await login(page);
  await page.goto(`${BASE_URL}/recipes`);
  await page.waitForLoadState('networkidle');

  // Open Add dropdown
  const addButton = page.locator('button:has-text("Add")').first();
  await expect(addButton).toBeVisible({ timeout: 10000 });
  await addButton.click();
  await page.waitForTimeout(500);

  // Click "From URL" menu item
  const urlOption = page.locator('[role="menuitem"]').filter({ hasText: /URL/ }).first();
  await expect(urlOption).toBeVisible();
  await urlOption.click();
  await page.waitForTimeout(500);

  // Fill the URL
  const urlInput = page.locator('input[type="url"], input[placeholder*="URL" i]').first();
  await expect(urlInput).toBeVisible();
  await urlInput.fill(RECIPE_URL);
  console.log(`Entered URL: ${RECIPE_URL}`);

  // Click Import
  const importButton = page.locator('button:has-text("Import Recipe")').first();
  await expect(importButton).toBeEnabled();
  await importButton.click();
  console.log('Clicked Import Recipe — waiting for AI...');

  // Handle browser alert dialogs (success/error)
  let dialogMessage = '';
  page.on('dialog', async (dialog) => {
    dialogMessage = dialog.message();
    console.log(`Dialog appeared: "${dialogMessage}"`);
    await dialog.accept();
  });

  // Wait for the import dialog to close or show a completion state
  // Poll every 5 seconds for up to 200 seconds
  let importCompleted = false;
  const startTime = Date.now();
  const maxWaitMs = 200000; // 200 seconds

  while (Date.now() - startTime < maxWaitMs) {
    const dialog = page.locator('[role="dialog"]');
    const dialogVisible = await dialog.isVisible().catch(() => false);

    if (!dialogVisible) {
      // Dialog closed = import done (auto-saved) or cancelled
      importCompleted = true;
      console.log('Import dialog closed — recipe likely saved');
      break;
    }

    const dialogText = await dialog.innerText().catch(() => '');
    if (dialogText.includes('saved') || dialogText.includes('error') || dialogText.includes('failed')
        || dialogText.includes('Success') || dialogText.includes('successfully')) {
      importCompleted = true;
      console.log(`Import completed with status text: ${dialogText.substring(0, 100)}`);
      break;
    }

    // Log progress
    if (dialogText.includes('Finalizing')) {
      console.log(`Still importing... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);
    }

    await page.waitForTimeout(5000);
  }

  if (!importCompleted) {
    console.log('Import did not complete within timeout — cancelling');
    // Try clicking Cancel or Close button
    const cancelButton = page.locator('[role="dialog"] button:has-text("Cancel")').first();
    const closeButton = page.locator('[role="dialog"] button:has-text("Close"), [role="dialog"] button[aria-label="Close"]').first();

    if (await cancelButton.isEnabled().catch(() => false)) {
      await cancelButton.click().catch(() => {});
    } else if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click().catch(() => {});
    }
    await page.waitForTimeout(1000);
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/nyt-recipe-final.png', fullPage: true });

  // Report results
  if (dialogMessage) {
    console.log(`\n=== PARSE RESULT ===`);
    console.log(`Dialog: ${dialogMessage}`);

    if (dialogMessage.toLowerCase().includes('saved') || dialogMessage.toLowerCase().includes('chicken')) {
      console.log('STATUS: SUCCESS — Recipe was parsed and saved');
    } else if (dialogMessage.toLowerCase().includes('failed') || dialogMessage.toLowerCase().includes('error')) {
      console.log('STATUS: FAILED — Parser returned error');
    } else {
      console.log('STATUS: UNKNOWN — Check dialog message');
    }
  } else {
    // Check page content for the recipe
    const pageText = await page.locator('body').innerText();
    const hasChicken = pageText.toLowerCase().includes('chicken');
    const hasBean = pageText.toLowerCase().includes('bean');

    console.log(`\n=== PARSE RESULT ===`);
    console.log(`No dialog appeared. Page contains "chicken": ${hasChicken}, "bean": ${hasBean}`);

    if (hasChicken && hasBean) {
      console.log('STATUS: SUCCESS — Recipe content visible on page');
    } else if (importCompleted) {
      console.log('STATUS: COMPLETED — Import dialog closed but recipe content not yet visible');
    } else {
      console.log('STATUS: TIMEOUT — AI import took too long, test cancelled the import');
    }
  }

  // Print relevant console logs
  const relevantLogs = consoleLogs.filter(l =>
    l.includes('parse') || l.includes('recipe') || l.includes('error') || l.includes('fail') || l.includes('success')
  );
  if (relevantLogs.length > 0) {
    console.log('\nRelevant console logs:');
    relevantLogs.forEach(l => console.log(`  ${l}`));
  }

  console.log('\nScreenshot: /tmp/nyt-recipe-final.png');
});

const { chromium } = require('playwright');

/**
 * End-to-End Test Suite for Recipe Parser Feature
 * Tests the complete flow of parsing a recipe from a URL
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:5001';
const TIMEOUT = 120000; // 2 minutes for parsing operations

// Test configuration
const TEST_CONFIG = {
  headless: process.env.HEADLESS !== 'false',
  slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
  screenshotOnFailure: true,
};

// Sample recipe URLs for testing
const TEST_RECIPES = {
  allrecipes: 'https://www.allrecipes.com/recipe/23600/worlds-best-lasagna/',
  budgetbytes: 'https://www.budgetbytes.com/one-pot-chicken-and-mushroom-rice/',
  seriouseats: 'https://www.seriouseats.com/the-best-classic-chili-recipe',
};

/**
 * Test results collector
 */
class TestResults {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.screenshots = [];
  }

  add(name, passed, error = null, screenshot = null) {
    this.tests.push({ name, passed, error, screenshot, timestamp: new Date().toISOString() });
    if (passed) this.passed++;
    else this.failed++;
  }

  summary() {
    console.log('\n' + '='.repeat(70));
    console.log('TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total Tests: ${this.tests.length}`);
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log('='.repeat(70));

    if (this.failed > 0) {
      console.log('\nFailed Tests:');
      this.tests
        .filter((t) => !t.passed)
        .forEach((t) => {
          console.log(`\n❌ ${t.name}`);
          console.log(`   Error: ${t.error}`);
          if (t.screenshot) console.log(`   Screenshot: ${t.screenshot}`);
        });
    }

    return this.failed === 0;
  }

  exportJson() {
    return JSON.stringify({
      summary: {
        total: this.tests.length,
        passed: this.passed,
        failed: this.failed,
      },
      tests: this.tests,
    }, null, 2);
  }
}

/**
 * Utility functions
 */
async function takeScreenshot(page, name) {
  const filename = `test-screenshots/${name}-${Date.now()}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  return filename;
}

async function login(page) {
  await page.goto(BASE_URL);
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
}

async function getConsoleLogs(page) {
  const logs = [];
  page.on('console', (msg) => {
    logs.push({
      type: msg.type(),
      text: msg.text(),
      timestamp: new Date().toISOString(),
    });
  });
  return logs;
}

/**
 * Test: Login Flow
 */
async function testLogin(page, results) {
  console.log('\n🧪 Testing: Login Flow');
  try {
    await page.goto(BASE_URL);
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Wait for redirect to plan page
    await page.waitForURL(/.*/, { timeout: 5000 });

    // Check if we're logged in (URL should change)
    const url = page.url();
    const isLoggedIn = !url.includes('/login');

    if (isLoggedIn) {
      console.log('   ✅ Login successful');
      results.add('Login Flow', true);
    } else {
      throw new Error('Login failed - still on login page');
    }
  } catch (error) {
    console.log('   ❌ Login failed:', error.message);
    const screenshot = await takeScreenshot(page, 'login-failed');
    results.add('Login Flow', false, error.message, screenshot);
  }
}

/**
 * Test: Navigate to Recipes Page
 */
async function testNavigateToRecipes(page, results) {
  console.log('\n🧪 Testing: Navigate to Recipes Page');
  try {
    // Click on Recipes navigation
    await page.click('text=Recipes');
    await page.waitForTimeout(1000);

    // Verify we're on the recipes page
    const hasAddButton = await page.locator('text=Add Recipe').count() > 0;

    if (hasAddButton) {
      console.log('   ✅ Navigation to Recipes page successful');
      results.add('Navigate to Recipes', true);
    } else {
      throw new Error('Recipes page did not load correctly');
    }
  } catch (error) {
    console.log('   ❌ Navigation failed:', error.message);
    const screenshot = await takeScreenshot(page, 'nav-recipes-failed');
    results.add('Navigate to Recipes', false, error.message, screenshot);
  }
}

/**
 * Test: Open Recipe Parser Dialog
 */
async function testOpenParserDialog(page, results) {
  console.log('\n🧪 Testing: Open Recipe Parser Dialog');
  try {
    // Click "Parse Recipe from URL" button
    await page.click('text=Parse Recipe from URL');
    await page.waitForTimeout(500);

    // Verify dialog is open
    const dialogVisible = await page.locator('input[placeholder*="https://"]').isVisible();

    if (dialogVisible) {
      console.log('   ✅ Parser dialog opened successfully');
      results.add('Open Parser Dialog', true);
    } else {
      throw new Error('Parser dialog did not open');
    }
  } catch (error) {
    console.log('   ❌ Failed to open parser dialog:', error.message);
    const screenshot = await takeScreenshot(page, 'dialog-open-failed');
    results.add('Open Parser Dialog', false, error.message, screenshot);
  }
}

/**
 * Test: Parse Recipe from URL
 */
async function testParseRecipe(page, results, recipeUrl, recipeName) {
  console.log(`\n🧪 Testing: Parse Recipe (${recipeName})`);

  // Collect console logs
  const consoleLogs = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('Parse result') || text.includes('error') || text.includes('Error')) {
      consoleLogs.push({
        type: msg.type(),
        text,
        timestamp: new Date().toISOString(),
      });
    }
  });

  try {
    // Enter recipe URL
    await page.fill('input[placeholder*="https://"]', recipeUrl);
    console.log(`   📝 Entered URL: ${recipeUrl}`);

    // Click Parse button
    await page.click('button:has-text("Parse")');
    console.log('   ⏳ Waiting for parse to complete...');

    // Wait for either success or error
    const result = await Promise.race([
      // Success: Dialog closes and Add Recipe dialog opens
      page.waitForSelector('input[placeholder*="https://"]', {
        state: 'hidden',
        timeout: TIMEOUT,
      }).then(() => 'success'),

      // Error: Alert appears
      page.waitForEvent('dialog', { timeout: TIMEOUT }).then(() => 'error'),

      // Timeout
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Parse timeout after 2 minutes')), TIMEOUT)
      ),
    ]);

    if (result === 'error') {
      throw new Error('Parse failed with alert');
    }

    // Wait a bit for data to populate
    await page.waitForTimeout(2000);

    // Check if Add Recipe dialog is open with data
    const nameField = await page.locator('input[placeholder="Recipe name"]');
    const nameValue = await nameField.inputValue();

    console.log(`   📄 Parsed recipe name: "${nameValue}"`);
    console.log(`   📋 Console logs: ${consoleLogs.length} relevant messages`);

    if (consoleLogs.length > 0) {
      console.log('   🔍 Recent console logs:');
      consoleLogs.slice(-5).forEach((log) => {
        console.log(`      [${log.type}] ${log.text}`);
      });
    }

    if (nameValue && nameValue.length > 0) {
      console.log(`   ✅ Recipe parsed successfully: "${nameValue}"`);
      results.add(`Parse Recipe (${recipeName})`, true);
      return true;
    } else {
      throw new Error('Recipe name field is empty after parse');
    }
  } catch (error) {
    console.log(`   ❌ Parse failed: ${error.message}`);
    console.log(`   📋 Captured ${consoleLogs.length} console logs`);

    if (consoleLogs.length > 0) {
      console.log('   🔍 Console logs:');
      consoleLogs.forEach((log) => {
        console.log(`      [${log.type}] ${log.text}`);
      });
    }

    const screenshot = await takeScreenshot(page, `parse-failed-${recipeName}`);
    results.add(`Parse Recipe (${recipeName})`, false, error.message, screenshot);

    // Dismiss any alert dialog
    page.on('dialog', async (dialog) => await dialog.dismiss());

    return false;
  }
}

/**
 * Test: Save Parsed Recipe
 */
async function testSaveRecipe(page, results) {
  console.log('\n🧪 Testing: Save Parsed Recipe');
  try {
    // Click "Add Recipe" button
    await page.click('button:has-text("Add Recipe")');
    await page.waitForTimeout(2000);

    // Verify recipe was added (dialog should close)
    const dialogClosed = await page.locator('input[placeholder="Recipe name"]').isHidden();

    if (dialogClosed) {
      console.log('   ✅ Recipe saved successfully');
      results.add('Save Parsed Recipe', true);
    } else {
      throw new Error('Dialog did not close after saving');
    }
  } catch (error) {
    console.log('   ❌ Save failed:', error.message);
    const screenshot = await takeScreenshot(page, 'save-failed');
    results.add('Save Parsed Recipe', false, error.message, screenshot);
  }
}

/**
 * Test: Verify Recipe Card Appears
 */
async function testRecipeCardAppears(page, results) {
  console.log('\n🧪 Testing: Verify Recipe Card Appears');
  try {
    // Wait for recipes to load
    await page.waitForTimeout(2000);

    // Count recipe items
    const recipeCount = await page.locator('[class*="recipe"]').count();

    if (recipeCount > 0) {
      console.log(`   ✅ Found ${recipeCount} recipe card(s)`);
      results.add('Recipe Card Appears', true);
    } else {
      throw new Error('No recipe cards found');
    }
  } catch (error) {
    console.log('   ❌ Verification failed:', error.message);
    const screenshot = await takeScreenshot(page, 'verify-card-failed');
    results.add('Recipe Card Appears', false, error.message, screenshot);
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🚀 Starting Recipe Parser E2E Tests');
  console.log(`📍 Testing against: ${BASE_URL}`);
  console.log(`⏱️  Timeout: ${TIMEOUT / 1000}s`);
  console.log(`👁️  Headless: ${TEST_CONFIG.headless}`);

  const browser = await chromium.launch({
    headless: TEST_CONFIG.headless,
    slowMo: TEST_CONFIG.slowMo,
  });

  const context = await browser.newContext();
  const page = await context.newPage();
  const results = new TestResults();

  try {
    // Run test suite
    await testLogin(page, results);
    await testNavigateToRecipes(page, results);
    await testOpenParserDialog(page, results);

    // Test parsing with first URL
    const parsed = await testParseRecipe(
      page,
      results,
      TEST_RECIPES.budgetbytes,
      'Budget Bytes'
    );

    if (parsed) {
      await testSaveRecipe(page, results);
      await testRecipeCardAppears(page, results);
    }
  } catch (error) {
    console.error('\n💥 Fatal error during tests:', error);
  } finally {
    await browser.close();
  }

  // Print summary
  const success = results.summary();

  // Export results
  const fs = require('fs');
  fs.writeFileSync(
    `test-results-${Date.now()}.json`,
    results.exportJson()
  );

  process.exit(success ? 0 : 1);
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runTests, TEST_RECIPES };

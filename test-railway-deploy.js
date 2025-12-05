const { chromium } = require('playwright');

async function testRailwayDeployment() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Testing Railway Deployment...\n');

  try {
    // Navigate to the deployed site
    await page.goto('https://web-production-09493.up.railway.app/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Login with admin credentials
    const usernameInput = await page.locator('input[placeholder*="username"]');
    const passwordInput = await page.locator('input[placeholder*="password"]');

    if (await usernameInput.count() > 0) {
      console.log('Logging in...');
      await usernameInput.fill('admin');
      await passwordInput.fill('OwtvQubm2H9BP0qE');
      await page.click('button:has-text("Sign in")');
      await page.waitForTimeout(3000);
    }

    // Navigate to recipes page
    await page.goto('https://web-production-09493.up.railway.app/recipes', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({ path: 'screenshots/railway-recipes-page.png', fullPage: true });
    console.log('Screenshot saved to screenshots/railway-recipes-page.png');

    // Check for redesign elements
    console.log('\n=== RAILWAY DEPLOYMENT CHECK ===\n');

    // Check header
    const recipeCollection = await page.locator('text="Recipe Collection"').count();
    console.log(`✓ "Recipe Collection" header: ${recipeCollection > 0 ? 'FOUND (NEW)' : 'NOT FOUND (OLD)'}`);

    // Check for violet gradient button
    const pageContent = await page.content();
    const hasVioletGradient = pageContent.includes('from-violet-600') || pageContent.includes('violet-600');
    console.log(`✓ Violet gradient styling: ${hasVioletGradient ? 'FOUND (NEW)' : 'NOT FOUND (OLD)'}`);

    // Check for violet themed tabs
    const violetElements = await page.locator('[class*="violet"]').count();
    console.log(`✓ Violet themed elements: ${violetElements > 0 ? `${violetElements} found (NEW)` : 'NOT FOUND (OLD)'}`);

    // Check for background gradient
    const hasBackgroundGradient = pageContent.includes('bg-gradient-to-b') || pageContent.includes('from-slate-50');
    console.log(`✓ Background gradient: ${hasBackgroundGradient ? 'FOUND (NEW)' : 'NOT FOUND (OLD)'}`);

    // Check for old title "Recipe Manager" or "My Recipes"
    const oldTitle = await page.locator('text="Recipe Manager"').count() + await page.locator('text="My Recipes"').count();
    console.log(`✓ Old title present: ${oldTitle > 0 ? 'YES (OLD VERSION)' : 'NO (NEW VERSION)'}`);

    console.log('\n=== DIAGNOSIS ===');
    if (recipeCollection > 0 && violetElements > 0) {
      console.log('✅ NEW VERSION IS DEPLOYED!');
    } else {
      console.log('❌ OLD VERSION IS STILL DEPLOYED');
      console.log('   The Railway deployment needs to be rebuilt with the latest changes.');
    }

    // Also check the meal plan page
    console.log('\n=== CHECKING MEAL PLAN PAGE ===');
    await page.goto('https://web-production-09493.up.railway.app/plan', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/railway-plan-page.png', fullPage: true });
    console.log('Screenshot saved to screenshots/railway-plan-page.png');

    const weeklyMealPlan = await page.locator('text="Weekly Meal Plan"').count();
    console.log(`✓ "Weekly Meal Plan" header: ${weeklyMealPlan > 0 ? 'FOUND (NEW)' : 'NOT FOUND (OLD)'}`);

    console.log('\nBrowser will stay open for 10 seconds...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'screenshots/railway-error.png' });
  } finally {
    await browser.close();
  }
}

// Create screenshots directory if needed
const fs = require('fs');
if (!fs.existsSync('screenshots')) {
  fs.mkdirSync('screenshots');
}

testRailwayDeployment();

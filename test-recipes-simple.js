const { chromium } = require('playwright');

async function testRecipesPage() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Testing Recipes Page Redesign...\n');

  try {
    // Navigate to login page first
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Login with demo credentials (username, not email)
    const usernameInput = await page.locator('input[placeholder*="username"]');
    const passwordInput = await page.locator('input[placeholder*="password"]');

    if (await usernameInput.count() > 0) {
      console.log('Logging in...');
      await usernameInput.fill('admin');
      await passwordInput.fill('OwtvQubm2H9BP0qE');
      await page.click('button:has-text("Sign in")');
      await page.waitForTimeout(3000);
    }

    // Now navigate to recipes page
    await page.goto('http://localhost:3000/recipes', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({ path: 'screenshots/recipes-page-redesign.png', fullPage: true });
    console.log('Screenshot saved to screenshots/recipes-page-redesign.png');

    // Check for key elements
    console.log('\n=== REDESIGN VERIFICATION ===\n');

    // Check header
    const recipeCollection = await page.locator('text="Recipe Collection"').count();
    console.log(`✓ "Recipe Collection" header: ${recipeCollection > 0 ? 'FOUND' : 'NOT FOUND'}`);

    // Check for recipe count
    const recipeCount = await page.locator('text=/\\d+ recipes?/').count();
    console.log(`✓ Recipe count display: ${recipeCount > 0 ? 'FOUND' : 'NOT FOUND'}`);

    // Check Add Recipe button
    const addButton = await page.locator('button:has-text("Add Recipe")').count();
    console.log(`✓ "Add Recipe" button: ${addButton > 0 ? 'FOUND' : 'NOT FOUND'}`);

    // Check tabs
    const tabs = await page.locator('[role="tab"]').count();
    console.log(`✓ Tab navigation: ${tabs > 0 ? `${tabs} tabs found` : 'NOT FOUND'}`);

    // Check for violet styling (by looking at class names)
    const violetElements = await page.locator('[class*="violet"]').count();
    console.log(`✓ Violet themed elements: ${violetElements > 0 ? `${violetElements} found` : 'NOT FOUND'}`);

    // Check page background gradient
    const pageContent = await page.content();
    const hasGradient = pageContent.includes('bg-gradient-to-b') || pageContent.includes('from-slate-50');
    console.log(`✓ Background gradient: ${hasGradient ? 'FOUND' : 'NOT FOUND'}`);

    // Check for rounded cards
    const roundedCards = await page.locator('[class*="rounded-xl"]').count();
    console.log(`✓ Rounded card design: ${roundedCards > 0 ? `${roundedCards} found` : 'NOT FOUND'}`);

    // Test hover on first recipe card
    console.log('\n=== TESTING HOVER EFFECTS ===');
    const firstCard = await page.locator('.group.flex.flex-col').first();
    if (await firstCard.count() > 0) {
      await firstCard.hover();
      await page.waitForTimeout(500);

      // Take screenshot with hover state
      await page.screenshot({ path: 'screenshots/recipes-hover-state.png', fullPage: false });
      console.log('✓ Hover state screenshot saved');

      // Check for floating favorite button
      const floatingFav = await page.locator('button.absolute.top-2.right-2').count();
      console.log(`✓ Floating favorite button: ${floatingFav > 0 ? 'VISIBLE' : 'NOT VISIBLE'}`);

      // Check for drag hint
      const dragHint = await page.locator('text="Drag to plan"').count();
      console.log(`✓ Drag hint overlay: ${dragHint > 0 ? 'VISIBLE' : 'NOT VISIBLE'}`);
    }

    console.log('\n=== SCREENSHOT SAVED ===');
    console.log('View: screenshots/recipes-page-redesign.png');
    console.log('\nBrowser will stay open for 10 seconds for manual inspection...');

    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'screenshots/recipes-error.png' });
  } finally {
    await browser.close();
  }
}

// Create screenshots directory if needed
const fs = require('fs');
if (!fs.existsSync('screenshots')) {
  fs.mkdirSync('screenshots');
}

testRecipesPage();

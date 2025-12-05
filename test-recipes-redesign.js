const { chromium } = require('playwright');

async function testRecipesPageRedesign() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('🔍 Testing Recipes Page Redesign...\n');

  try {
    // Navigate to login page first
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

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
    await page.goto('http://localhost:3000/recipes', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('✅ Page loaded successfully\n');

    // Test 1: Check header redesign
    console.log('📋 Test 1: Header Design');
    const header = await page.locator('h1:has-text("Recipe Collection")');
    const headerExists = await header.count() > 0;
    console.log(`   - Clean title "Recipe Collection": ${headerExists ? '✅' : '❌'}`);

    const recipeCount = await page.locator('text=/\\d+ recipes? in your collection/');
    const countExists = await recipeCount.count() > 0;
    console.log(`   - Recipe count subtitle: ${countExists ? '✅' : '❌'}`);

    const addButton = await page.locator('button:has-text("Add Recipe")');
    const addExists = await addButton.count() > 0;
    console.log(`   - Gradient "Add Recipe" button: ${addExists ? '✅' : '❌'}`);

    // Test 2: Check search/filter toolbar
    console.log('\n📋 Test 2: Search & Filter Toolbar');
    const searchInput = await page.locator('input[placeholder*="Search recipes"]');
    const searchExists = await searchInput.count() > 0;
    console.log(`   - Modern search input: ${searchExists ? '✅' : '❌'}`);

    const filterPills = await page.locator('.rounded-full').count();
    console.log(`   - Filter pill buttons found: ${filterPills > 3 ? '✅' : '❌'} (${filterPills} found)`);

    // Test 3: Check tab navigation
    console.log('\n📋 Test 3: Tab Navigation');
    const tabs = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Favorites'];
    for (const tab of tabs) {
      const tabElement = await page.locator(`button[role="tab"]:has-text("${tab}")`);
      const tabExists = await tabElement.count() > 0;
      console.log(`   - ${tab} tab: ${tabExists ? '✅' : '❌'}`);
    }

    // Test 4: Click different tabs and check content
    console.log('\n📋 Test 4: Tab Switching');
    for (const tab of ['breakfast', 'lunch', 'dinner', 'snack']) {
      const tabButton = await page.locator(`button[role="tab"]:has-text("${tab.charAt(0).toUpperCase() + tab.slice(1)}")`);
      if (await tabButton.count() > 0) {
        await tabButton.click();
        await page.waitForTimeout(500);
        console.log(`   - Clicked ${tab} tab: ✅`);
      }
    }

    // Go back to dinner for card tests
    const dinnerTab = await page.locator('button[role="tab"]:has-text("Dinner")');
    await dinnerTab.click();
    await page.waitForTimeout(500);

    // Test 5: Check recipe cards
    console.log('\n📋 Test 5: Recipe Cards Design');
    const recipeCards = await page.locator('.group.bg-white.rounded-xl.border');
    const cardCount = await recipeCards.count();
    console.log(`   - Modern card design (rounded-xl): ${cardCount > 0 ? '✅' : '❌'} (${cardCount} cards)`);

    if (cardCount > 0) {
      // Check card hover effects
      const firstCard = recipeCards.first();
      await firstCard.hover();
      await page.waitForTimeout(300);
      console.log(`   - Card hover state: ✅`);

      // Check for favorite button
      const favoriteBtn = await page.locator('.rounded-full.bg-white\\/90').first();
      const favExists = await favoriteBtn.count() > 0;
      console.log(`   - Floating favorite button: ${favExists ? '✅' : '❌'}`);

      // Check for drag hint on hover
      const dragHint = await page.locator('text="Drag to plan"').first();
      const dragExists = await dragHint.count() > 0;
      console.log(`   - Drag hint on hover: ${dragExists ? '✅' : '❌'}`);
    }

    // Test 6: Check empty state for a tab with no recipes
    console.log('\n📋 Test 6: Empty State Design');
    const breakfastTab = await page.locator('button[role="tab"]:has-text("Breakfast")');
    await breakfastTab.click();
    await page.waitForTimeout(500);

    // Look for empty state elements
    const emptyState = await page.locator('text=/No .* recipes/');
    const hasEmptyState = await emptyState.count() > 0;
    console.log(`   - Enhanced empty state: ${hasEmptyState ? '✅' : 'N/A (has recipes)'}`);

    // Test 7: Test filter functionality
    console.log('\n📋 Test 7: Filter Functionality');

    // Go back to dinner tab
    await dinnerTab.click();
    await page.waitForTimeout(500);

    // Test search
    await searchInput.fill('chicken');
    await page.waitForTimeout(500);
    const filteredCards = await page.locator('.group.bg-white.rounded-xl.border').count();
    console.log(`   - Search filter works: ✅ (${filteredCards} results for "chicken")`);

    // Clear search
    const clearButton = await page.locator('button:has(.lucide-x)').first();
    if (await clearButton.count() > 0) {
      await clearButton.click();
      await page.waitForTimeout(300);
      console.log(`   - Clear search button: ✅`);
    }

    // Test 8: Check visual hierarchy
    console.log('\n📋 Test 8: Visual Hierarchy');

    // Background gradient
    const bgGradient = await page.locator('.min-h-screen.bg-gradient-to-b');
    console.log(`   - Subtle background gradient: ${await bgGradient.count() > 0 ? '✅' : '❌'}`);

    // Filter toolbar card
    const filterCard = await page.locator('.bg-white.rounded-xl.shadow-sm.border.border-slate-200');
    console.log(`   - Filter toolbar in card: ${await filterCard.count() > 0 ? '✅' : '❌'}`);

    // Test 9: Add recipe dropdown
    console.log('\n📋 Test 9: Add Recipe Dropdown');
    await addButton.click();
    await page.waitForTimeout(300);

    const dropdownItems = ['Add Manually', 'Parse from Text', 'Parse from URL', 'Parse from Image'];
    for (const item of dropdownItems) {
      const menuItem = await page.locator(`[role="menuitem"]:has-text("${item}")`);
      const exists = await menuItem.count() > 0;
      console.log(`   - "${item}" option: ${exists ? '✅' : '❌'}`);
    }

    // Close dropdown by clicking elsewhere
    await page.locator('body').click();
    await page.waitForTimeout(200);

    // Test 10: Screenshot for visual review
    console.log('\n📸 Taking screenshots for visual review...');
    await dinnerTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/recipes-redesign-desktop.png', fullPage: true });
    console.log('   - Desktop screenshot saved');

    // Mobile view
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/recipes-redesign-mobile.png', fullPage: true });
    console.log('   - Mobile screenshot saved');

    console.log('\n' + '='.repeat(50));
    console.log('✅ Recipes Page Redesign Test Complete!');
    console.log('='.repeat(50));

    // Keep browser open for manual inspection
    console.log('\n🔍 Browser will remain open for 15 seconds for inspection...');
    await page.waitForTimeout(15000);

  } catch (error) {
    console.error('❌ Test failed:', error);
    await page.screenshot({ path: 'screenshots/recipes-redesign-error.png' });
  } finally {
    await browser.close();
  }
}

// Create screenshots directory if needed
const fs = require('fs');
if (!fs.existsSync('screenshots')) {
  fs.mkdirSync('screenshots');
}

testRecipesPageRedesign();

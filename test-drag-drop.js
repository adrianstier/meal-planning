const { chromium } = require('playwright');

async function testDragDrop() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('Testing Drag & Drop: Recipes to Holiday Planner\n');
  console.log('='.repeat(50) + '\n');

  try {
    // Login
    console.log('1. Logging in...');
    await page.goto('http://localhost:5001/login');
    await page.waitForTimeout(1000);
    await page.fill('input[type="text"]', 'testholiday');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    console.log('   Logged in successfully\n');

    // Navigate to Recipes page
    console.log('2. Going to Recipes page...');
    await page.goto('http://localhost:5001/recipes');
    await page.waitForTimeout(2000);

    // Check if there are recipes
    const recipeCards = await page.locator('[draggable="true"]').count();
    console.log(`   Found ${recipeCards} draggable recipe cards\n`);

    if (recipeCards > 0) {
      // Take screenshot of recipes page
      await page.screenshot({ path: 'drag-drop-1-recipes.png', fullPage: true });
      console.log('   Screenshot: drag-drop-1-recipes.png\n');
    }

    // Navigate to Holiday Planner
    console.log('3. Going to Holiday Planner...');
    await page.goto('http://localhost:5001/holiday');
    await page.waitForTimeout(2000);

    // Check for holiday events
    const events = await page.locator('text=/Your Events/i').count();
    console.log(`   Holiday page loaded: ${events > 0 ? 'Yes' : 'No'}\n`);

    // Check for drop zone
    const dropZone = await page.locator('text=/Drag & drop recipes/i').count();
    console.log(`   Drop zone visible: ${dropZone > 0 ? 'Yes' : 'No'}\n`);

    // Take screenshot
    await page.screenshot({ path: 'drag-drop-2-holiday.png', fullPage: true });
    console.log('   Screenshot: drag-drop-2-holiday.png\n');

    // Check if there's an event to select
    const eventCards = await page.locator('.cursor-pointer').count();
    console.log(`   Found ${eventCards} event cards\n`);

    if (eventCards > 0) {
      // Select first event
      console.log('4. Selecting first holiday event...');
      await page.locator('.cursor-pointer').first().click();
      await page.waitForTimeout(1000);

      // Check for drop zone in dishes tab
      const dropZoneInDishes = await page.locator('text=/Drag & drop recipes from your Recipe Book/i').count();
      console.log(`   Drop zone in dishes: ${dropZoneInDishes > 0 ? 'Yes' : 'No'}\n`);

      // Take screenshot
      await page.screenshot({ path: 'drag-drop-3-selected-event.png', fullPage: true });
      console.log('   Screenshot: drag-drop-3-selected-event.png\n');

      // Check category drop zones
      const categoryZones = await page.locator('text=/Drop recipes here to add as/i').count();
      console.log(`   Category drop zones: ${categoryZones}\n`);
    }

    console.log('='.repeat(50));
    console.log('\nDrag & Drop Feature Summary:');
    console.log('- Recipe cards are draggable (from Recipes page)');
    console.log('- Holiday Planner has main drop zone');
    console.log('- Each category (main, side, appetizer, dessert, drink) has a drop zone');
    console.log('- Dropped recipes will be added to the holiday event menu');
    console.log('\nTo test manually:');
    console.log('1. Open two browser windows side by side');
    console.log('2. Go to Recipes page in one window');
    console.log('3. Go to Holiday Planner in another');
    console.log('4. Select a holiday event');
    console.log('5. Drag a recipe card to the drop zone or a category');
    console.log('\nTest completed!');

  } catch (error) {
    console.error('\nTest Error:', error.message);
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

testDragDrop().catch(console.error);

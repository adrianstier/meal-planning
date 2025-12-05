const { chromium } = require('playwright');

async function testHolidayWithAuth() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('🎄 Testing Holiday Planner with proper authentication...\n');

  try {
    // Step 1: Navigate to login page
    console.log('Step 1: Navigating to login page...');
    await page.goto('http://localhost:3000/login');
    await page.waitForTimeout(2000);

    // Step 2: Login
    console.log('Step 2: Logging in...');
    await page.fill('input[type="text"]', 'adrian');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    await page.waitForURL('**/plan', { timeout: 10000 });
    console.log('✅ Login successful, now on plan page');

    // Step 3: Navigate to Holiday page
    console.log('\nStep 3: Navigating to Holiday Planner...');

    // Method 1: Try direct navigation
    await page.goto('http://localhost:3000/holiday');
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    if (!currentUrl.includes('/holiday')) {
      console.log('Direct navigation didn\'t work, trying via menu...');

      // Go back to plan page
      await page.goto('http://localhost:3000/plan');
      await page.waitForTimeout(2000);

      // Try the "More" dropdown
      const moreButton = await page.locator('button:has-text("More")').first();
      if (await moreButton.isVisible()) {
        console.log('Found "More" button, clicking...');
        await moreButton.click();
        await page.waitForTimeout(1000);

        // Look for Holiday Planner in dropdown
        const holidayMenuItem = await page.locator('text=/Holiday Planner/i').first();
        if (await holidayMenuItem.isVisible()) {
          console.log('Found Holiday Planner in menu, clicking...');
          await holidayMenuItem.click();
          await page.waitForTimeout(3000);
        }
      }

      // Try mobile menu if desktop menu didn't work
      const menuButton = await page.locator('button[aria-label*="menu"]').first();
      if (await menuButton.isVisible()) {
        console.log('Trying mobile menu...');
        await menuButton.click();
        await page.waitForTimeout(1000);

        const holidayLink = await page.locator('a[href="/holiday"]').first();
        if (await holidayLink.isVisible()) {
          console.log('Found Holiday link in mobile menu');
          await holidayLink.click();
          await page.waitForTimeout(3000);
        }
      }
    }

    // Final check
    const finalUrl = page.url();
    console.log(`\nFinal URL: ${finalUrl}`);

    if (finalUrl.includes('/holiday')) {
      console.log('✅ Successfully navigated to Holiday Planner!');

      // Test page functionality
      console.log('\n📋 Testing Holiday Planner features...');

      // Check for main elements
      const hasTitle = await page.isVisible('h1:has-text("Holiday"), h2:has-text("Holiday")');
      console.log(`Holiday title visible: ${hasTitle ? '✅' : '❌'}`);

      // Check for create event button
      const hasCreateButton = await page.isVisible('button:has-text("Create"), button:has-text("Add"), button:has-text("New")');
      console.log(`Create event button visible: ${hasCreateButton ? '✅' : '❌'}`);

      // Try to create a new event
      if (hasCreateButton) {
        console.log('\nTrying to create a new holiday event...');
        const createBtn = await page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("New")').first();
        await createBtn.click();
        await page.waitForTimeout(2000);

        // Check if dialog opened
        const dialogVisible = await page.isVisible('[role="dialog"]');
        console.log(`Dialog opened: ${dialogVisible ? '✅' : '❌'}`);

        if (dialogVisible) {
          // Fill in test event
          const nameInput = await page.locator('input[placeholder*="name"], input[placeholder*="Name"], input#name').first();
          if (await nameInput.isVisible()) {
            await nameInput.fill('Thanksgiving Dinner 2024');
            console.log('Filled event name');
          }

          // Close dialog
          const closeBtn = await page.locator('button:has-text("Cancel"), button:has-text("Close")').first();
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
          }
        }
      }

      await page.screenshot({ path: 'holiday-page-success.png', fullPage: true });
      console.log('\n📸 Screenshot saved as holiday-page-success.png');

    } else {
      console.log('❌ Failed to navigate to Holiday Planner');
      console.log('The page might not be accessible or there might be a routing issue');

      // Check console errors
      const logs = [];
      page.on('console', msg => logs.push(`${msg.type()}: ${msg.text()}`));

      if (logs.length > 0) {
        console.log('\nConsole logs:');
        logs.forEach(log => console.log(log));
      }
    }

  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await page.waitForTimeout(5000); // Keep browser open to see the result
    await browser.close();
    console.log('\n✅ Test complete!');
  }
}

testHolidayWithAuth().catch(console.error);
const { chromium } = require('playwright');

async function testHolidayPlanner() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('🎄 Testing Holiday Planner Complete Flow...\n');

  try {
    // Step 1: Go to login page
    console.log('Step 1: Navigating to login page...');
    await page.goto('http://localhost:3000/login');
    await page.waitForTimeout(2000);

    // Step 2: Login with our test user
    console.log('Step 2: Logging in with testholiday user...');
    await page.fill('input[placeholder*="username"], input[placeholder*="Username"], input[type="text"]', 'testholiday');
    await page.fill('input[placeholder*="password"], input[placeholder*="Password"], input[type="password"]', 'test123');

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for navigation
    await page.waitForTimeout(3000);

    const afterLoginUrl = page.url();
    console.log(`After login URL: ${afterLoginUrl}`);

    if (!afterLoginUrl.includes('/login')) {
      console.log('✅ Login successful!');
    } else {
      console.log('❌ Login failed, still on login page');
      // Try to see if there's an error message
      const errorMsg = await page.textContent('text=/error|invalid/i');
      if (errorMsg) {
        console.log(`Error message: ${errorMsg}`);
      }
    }

    // Step 3: Navigate to Holiday Planner
    console.log('\nStep 3: Navigating to Holiday Planner...');

    // Method 1: Direct URL
    await page.goto('http://localhost:3000/holiday');
    await page.waitForTimeout(3000);

    let currentUrl = page.url();
    console.log(`Current URL after direct navigation: ${currentUrl}`);

    if (!currentUrl.includes('/holiday')) {
      console.log('Direct navigation didn\'t work, trying menu...');

      // Go back to a known good page
      await page.goto('http://localhost:3000/plan');
      await page.waitForTimeout(2000);

      // Method 2: Try the More dropdown (desktop)
      const moreButton = await page.locator('button:has-text("More")').first();
      if (await moreButton.count() > 0 && await moreButton.isVisible()) {
        console.log('Found "More" button, clicking...');
        await moreButton.click();
        await page.waitForTimeout(1000);

        // Look for Holiday Planner option
        const holidayOption = await page.locator('a:has-text("Holiday Planner"), div:has-text("Holiday Planner")').first();
        if (await holidayOption.count() > 0) {
          console.log('Found Holiday Planner in dropdown, clicking...');
          await holidayOption.click();
          await page.waitForTimeout(3000);
        }
      } else {
        // Method 3: Try mobile menu
        console.log('Desktop menu not found, trying mobile menu...');
        const menuButton = await page.locator('button[aria-label*="menu"], button:has-text("Menu")').first();
        if (await menuButton.count() > 0 && await menuButton.isVisible()) {
          console.log('Found mobile menu button, clicking...');
          await menuButton.click();
          await page.waitForTimeout(1000);

          const holidayLink = await page.locator('a[href="/holiday"]').first();
          if (await holidayLink.count() > 0 && await holidayLink.isVisible()) {
            console.log('Found Holiday Planner link in mobile menu, clicking...');
            await holidayLink.click();
            await page.waitForTimeout(3000);
          }
        }
      }
    }

    // Final check
    currentUrl = page.url();
    console.log(`\nFinal URL: ${currentUrl}`);

    if (currentUrl.includes('/holiday')) {
      console.log('✅ Successfully on Holiday Planner page!');

      // Test Holiday Planner functionality
      console.log('\n📋 Testing Holiday Planner features...');

      // Check for page elements
      const pageTitle = await page.textContent('h1, h2');
      console.log(`Page title: ${pageTitle}`);

      // Look for create event button
      const createButton = await page.locator('button:has-text("Create"), button:has-text("New Event"), button:has-text("Add")').first();
      if (await createButton.count() > 0) {
        console.log('✅ Found create event button');

        // Try to create an event
        console.log('Creating a test holiday event...');
        await createButton.click();
        await page.waitForTimeout(2000);

        // Check if dialog opened
        const dialog = await page.locator('[role="dialog"], .modal, .dialog').first();
        if (await dialog.count() > 0 && await dialog.isVisible()) {
          console.log('✅ Event creation dialog opened');

          // Fill in the form
          await page.fill('input[name="name"], input[placeholder*="name"], #name', 'Christmas Dinner 2024');

          // Select event type if available
          const eventTypeSelect = await page.locator('select[name="event_type"], [role="combobox"]').first();
          if (await eventTypeSelect.count() > 0) {
            await eventTypeSelect.selectOption({ label: 'Christmas' });
          }

          // Set guest count
          const guestInput = await page.locator('input[name="guest_count"], input[placeholder*="guest"], input[type="number"]').first();
          if (await guestInput.count() > 0) {
            await guestInput.fill('10');
          }

          // Submit the form
          const submitButton = await page.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("Add"):not([aria-label])').last();
          if (await submitButton.count() > 0) {
            console.log('Submitting the form...');
            await submitButton.click();
            await page.waitForTimeout(2000);

            // Check if event was created
            const eventCard = await page.locator('text=/Christmas Dinner/i').first();
            if (await eventCard.count() > 0) {
              console.log('✅ Holiday event created successfully!');
            } else {
              console.log('⚠️ Event might not have been created');
            }
          }
        }
      }

      // Take screenshot of successful page
      await page.screenshot({ path: 'holiday-planner-success.png', fullPage: true });
      console.log('\n📸 Screenshot saved as holiday-planner-success.png');

    } else {
      console.log('❌ Failed to navigate to Holiday Planner page');
      console.log('Current page might be:', currentUrl);

      // Take screenshot of failure
      await page.screenshot({ path: 'holiday-planner-failure.png', fullPage: true });
    }

  } catch (error) {
    console.error('❌ Error during testing:', error);
    await page.screenshot({ path: 'holiday-planner-error.png', fullPage: true });
  } finally {
    await page.waitForTimeout(5000); // Keep browser open to see the result
    await browser.close();
    console.log('\n✅ Test complete!');
  }
}

testHolidayPlanner().catch(console.error);
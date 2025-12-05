const { chromium } = require('playwright');

async function testHolidayPlanner() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('🎄 Testing Holiday Planner Page...\n');

  try {
    // Navigate to the app
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);

    // Check if we need to login
    if (await page.isVisible('input[type="text"]')) {
      console.log('📝 Logging in...');
      await page.fill('input[type="text"]', 'adrian');
      await page.fill('input[type="password"]', 'test123');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
    }

    // Try to navigate to holiday planner
    console.log('🔍 Attempting to navigate to Holiday Planner...\n');

    // Method 1: Direct URL navigation
    console.log('Method 1: Direct URL navigation');
    await page.goto('http://localhost:3000/holiday');
    await page.waitForTimeout(3000);

    // Check current URL
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    // Check if we're on the holiday page
    const isOnHolidayPage = currentUrl.includes('/holiday');
    console.log(`On Holiday Page: ${isOnHolidayPage ? '✅ YES' : '❌ NO'}\n`);

    // Take screenshot
    await page.screenshot({ path: 'holiday-page-test.png', fullPage: true });

    if (!isOnHolidayPage) {
      console.log('❌ Direct navigation failed. Trying menu navigation...\n');

      // Method 2: Navigate via menu
      console.log('Method 2: Menu navigation');

      // Look for Holiday Planner in the navigation
      const holidayLink = await page.$('a[href="/holiday"]');
      if (holidayLink) {
        console.log('✅ Found Holiday Planner link in navigation');
        await holidayLink.click();
        await page.waitForTimeout(3000);
      } else {
        console.log('❌ Holiday Planner link not found in main navigation');

        // Check if it's in a dropdown menu
        console.log('Checking dropdown menus...');

        // Look for "More" dropdown
        const moreButton = await page.$('button:has-text("More")');
        if (moreButton) {
          console.log('Found "More" dropdown, clicking...');
          await moreButton.click();
          await page.waitForTimeout(1000);

          // Look for Holiday Planner in dropdown
          const dropdownHolidayLink = await page.$('a[href="/holiday"]:visible');
          if (dropdownHolidayLink) {
            console.log('✅ Found Holiday Planner in dropdown menu');
            await dropdownHolidayLink.click();
            await page.waitForTimeout(3000);
          } else {
            console.log('❌ Holiday Planner not found in dropdown');
          }
        }

        // Check mobile menu
        const mobileMenuButton = await page.$('button[aria-label*="menu"]');
        if (mobileMenuButton && await mobileMenuButton.isVisible()) {
          console.log('Checking mobile menu...');
          await mobileMenuButton.click();
          await page.waitForTimeout(1000);

          const mobileHolidayLink = await page.$('a[href="/holiday"]:visible');
          if (mobileHolidayLink) {
            console.log('✅ Found Holiday Planner in mobile menu');
            await mobileHolidayLink.click();
            await page.waitForTimeout(3000);
          }
        }
      }
    }

    // Final check
    const finalUrl = page.url();
    console.log(`\n📍 Final URL: ${finalUrl}`);

    // Check page content
    console.log('\n📄 Checking page content...');

    // Check for holiday-specific elements
    const hasHolidayTitle = await page.isVisible('text=/Holiday Planner|Holiday Meal Planning/i');
    const hasHolidayContent = await page.isVisible('text=/Thanksgiving|Christmas|Easter|Holiday/i');

    console.log(`Holiday Title Present: ${hasHolidayTitle ? '✅' : '❌'}`);
    console.log(`Holiday Content Present: ${hasHolidayContent ? '✅' : '❌'}`);

    // Check for error messages
    const hasError = await page.isVisible('text=/error|failed|not found/i');
    if (hasError) {
      console.log('⚠️ Error message detected on page');
      const errorText = await page.textContent('*:has-text(/error|failed|not found/i)');
      console.log(`Error: ${errorText}`);
    }

    // Take final screenshot
    await page.screenshot({ path: 'holiday-page-final.png', fullPage: true });
    console.log('\n📸 Screenshots saved');

    // Diagnostic information
    console.log('\n🔧 Diagnostic Information:');

    // Check console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console Error:', msg.text());
      }
    });

    // Check network failures
    page.on('requestfailed', request => {
      console.log('Request Failed:', request.url());
    });

    // Get page title
    const pageTitle = await page.title();
    console.log(`Page Title: ${pageTitle}`);

    // Check if we're being redirected
    const isRedirected = !finalUrl.includes('/holiday') && finalUrl !== 'http://localhost:3000/holiday';
    if (isRedirected) {
      console.log(`\n⚠️ Page is being redirected from /holiday to ${finalUrl}`);
    }

  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await page.waitForTimeout(5000); // Keep browser open to see the result
    await browser.close();
    console.log('\n✅ Test complete!');
  }
}

testHolidayPlanner().catch(console.error);
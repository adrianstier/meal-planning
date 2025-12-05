const { chromium } = require('playwright');

async function debugCreateEvent() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  // Capture console messages and errors
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text()
    });
    if (msg.type() === 'error') {
      console.log('❌ Console Error:', msg.text());
    }
  });

  // Capture network requests
  page.on('request', request => {
    if (request.url().includes('/api/holiday/events') && request.method() === 'POST') {
      console.log('\n📤 POST Request to:', request.url());
      console.log('Request Data:', request.postData());
    }
  });

  page.on('response', response => {
    if (response.url().includes('/api/holiday/events') && response.request().method() === 'POST') {
      console.log('\n📥 Response from:', response.url());
      console.log('Status:', response.status());
      response.text().then(body => {
        console.log('Response Body:', body);
      }).catch(() => {});
    }
  });

  console.log('🔍 Debug: Holiday Event Creation\n');
  console.log('='.repeat(50) + '\n');

  try {
    // Login
    console.log('📝 Logging in...');
    await page.goto('http://localhost:3000/login');
    await page.waitForTimeout(1000);

    await page.fill('input[type="text"]', 'testholiday');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    console.log('✅ Logged in\n');

    // Navigate to Holiday page
    console.log('🎄 Navigating to Holiday Planner...');
    await page.goto('http://localhost:3000/holiday');
    await page.waitForTimeout(2000);
    console.log('✅ On Holiday page\n');

    // Open create dialog
    console.log('🔧 Opening Create Event Dialog...');
    const createBtn = await page.locator('button:has-text("New Holiday Event")').first();
    await createBtn.click();
    await page.waitForTimeout(2000);

    const dialogOpen = await page.locator('[role="dialog"]').count() > 0;
    console.log(`Dialog opened: ${dialogOpen ? '✅' : '❌'}\n`);

    if (dialogOpen) {
      // Fill form with test data
      console.log('📋 Filling form...');

      // Fill name
      await page.fill('input[name="name"]', 'Test Christmas Party');
      console.log('✅ Filled name');

      // Select type - using select element directly
      const selectElement = await page.locator('select[name="event_type"]').first();
      if (await selectElement.count() > 0) {
        await selectElement.selectOption('christmas');
        console.log('✅ Selected Christmas');
      } else {
        // Try clicking the Select trigger for custom dropdown
        const selectTrigger = await page.locator('[id="event-type"]').first();
        if (await selectTrigger.count() > 0) {
          await selectTrigger.click();
          await page.waitForTimeout(500);
          await page.locator('[role="option"]:has-text("Christmas")').click();
          console.log('✅ Selected Christmas (custom dropdown)');
        }
      }

      // Set date
      await page.fill('input[name="event_date"]', '2024-12-25');
      console.log('✅ Set date');

      // Set time
      await page.fill('input[name="serving_time"]', '18:00');
      console.log('✅ Set time');

      // Set guest count
      await page.fill('input[name="guest_count"]', '15');
      console.log('✅ Set guest count\n');

      // Submit form
      console.log('💾 Submitting form...');
      const saveBtn = await page.locator('button:has-text("Save"), button:has-text("Create"):not([aria-label])').last();

      if (await saveBtn.count() > 0) {
        console.log('Found save button, clicking...');
        await saveBtn.click();

        // Wait for response
        await page.waitForTimeout(3000);

        // Check if dialog closed
        const dialogStillOpen = await page.locator('[role="dialog"]').count() > 0;
        console.log(`\nDialog still open: ${dialogStillOpen ? '❌ YES' : '✅ NO'}`);

        // Check if event was created
        const eventCard = await page.locator('text=/Test Christmas Party/i').first();
        const eventCreated = await eventCard.count() > 0;
        console.log(`Event card visible: ${eventCreated ? '✅ YES' : '❌ NO'}\n`);

        if (!eventCreated) {
          // Check for error messages
          const errorMsg = await page.locator('text=/error|failed/i').first();
          if (await errorMsg.count() > 0) {
            const errorText = await errorMsg.textContent();
            console.log('⚠️ Error message:', errorText);
          }
        }
      } else {
        console.log('❌ Save button not found');
      }
    }

    // Print console logs
    console.log('\n📋 Console Logs:');
    console.log('='.repeat(50));
    consoleLogs.slice(-10).forEach(log => {
      console.log(`[${log.type}] ${log.text}`);
    });

    // Take screenshot
    await page.screenshot({ path: 'holiday-debug-create.png', fullPage: true });
    console.log('\n📸 Screenshot saved as holiday-debug-create.png');

  } catch (error) {
    console.error('\n❌ Test Error:', error.message);
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
    console.log('\n✨ Debug complete');
  }
}

debugCreateEvent().catch(console.error);
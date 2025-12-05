const { chromium } = require('playwright');

async function comprehensiveHolidayTest() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  // Capture console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Capture network errors
  const networkErrors = [];
  page.on('requestfailed', request => {
    networkErrors.push({
      url: request.url(),
      error: request.failure().errorText
    });
  });

  console.log('🎄 COMPREHENSIVE HOLIDAY PLANNER TEST');
  console.log('=' .repeat(60) + '\n');

  const testResults = {
    passed: [],
    failed: [],
    warnings: []
  };

  try {
    // ==========================
    // TEST 1: Authentication
    // ==========================
    console.log('📋 TEST 1: Authentication & Navigation');
    console.log('-'.repeat(40));

    await page.goto('http://localhost:3000/login');
    await page.waitForTimeout(2000);

    // Try login
    await page.fill('input[type="text"]', 'testholiday');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    if (page.url().includes('/plan')) {
      testResults.passed.push('✅ Login successful');
      console.log('✅ Login successful');
    } else {
      testResults.failed.push('❌ Login failed');
      console.log('❌ Login failed');
    }

    // Navigate to Holiday page
    await page.goto('http://localhost:3000/holiday');
    await page.waitForTimeout(3000);

    if (page.url().includes('/holiday')) {
      testResults.passed.push('✅ Navigated to Holiday page');
      console.log('✅ Navigated to Holiday page');
    } else {
      testResults.failed.push('❌ Failed to navigate to Holiday page');
      console.log('❌ Failed to navigate to Holiday page');
      throw new Error('Cannot reach holiday page');
    }

    // ==========================
    // TEST 2: Page Elements
    // ==========================
    console.log('\n📋 TEST 2: Page Elements Check');
    console.log('-'.repeat(40));

    // Check title
    const title = await page.locator('h1:has-text("Holiday Meal Planner")').count();
    if (title > 0) {
      testResults.passed.push('✅ Page title exists');
      console.log('✅ Page title exists');
    } else {
      testResults.failed.push('❌ Page title missing');
      console.log('❌ Page title missing');
    }

    // Check description
    const desc = await page.locator('p:has-text("Thanksgiving"), p:has-text("Christmas"), p:has-text("holiday")').count();
    if (desc > 0) {
      testResults.passed.push('✅ Page description exists');
      console.log('✅ Page description exists');
    } else {
      testResults.warnings.push('⚠️ Page description might be missing');
      console.log('⚠️ Page description might be missing');
    }

    // ==========================
    // TEST 3: Create Event Button
    // ==========================
    console.log('\n📋 TEST 3: Create Event Button Functionality');
    console.log('-'.repeat(40));

    // Look for all possible create button variations
    const buttonSelectors = [
      'button:has-text("New Holiday Event")',
      'button:has-text("Create Event")',
      'button:has-text("New Event")',
      'button:has-text("Add Event")',
      'button:has([class*="Plus"])',
      'button[aria-label*="create"]',
      'button[aria-label*="add"]'
    ];

    let createButton = null;
    for (const selector of buttonSelectors) {
      const btn = await page.locator(selector).first();
      if (await btn.count() > 0 && await btn.isVisible()) {
        createButton = btn;
        console.log(`✅ Found create button with selector: ${selector}`);
        testResults.passed.push('✅ Create button found');
        break;
      }
    }

    if (!createButton) {
      console.log('❌ Create button not found with any selector');
      console.log('Searching for any buttons on page...');

      const allButtons = await page.locator('button').all();
      console.log(`Found ${allButtons.length} buttons total`);

      for (let i = 0; i < Math.min(5, allButtons.length); i++) {
        const text = await allButtons[i].textContent();
        console.log(`  Button ${i}: "${text}"`);
      }

      testResults.failed.push('❌ Create button not found');
    }

    // ==========================
    // TEST 4: Click Create Button
    // ==========================
    console.log('\n📋 TEST 4: Testing Create Event Dialog');
    console.log('-'.repeat(40));

    if (createButton) {
      console.log('Clicking create button...');

      try {
        await createButton.click();
        await page.waitForTimeout(3000);

        // Check if dialog opened
        const dialogSelectors = [
          '[role="dialog"]',
          '.modal',
          '.dialog',
          '[class*="dialog"]',
          '[class*="modal"]'
        ];

        let dialogFound = false;
        for (const selector of dialogSelectors) {
          const dialog = await page.locator(selector).first();
          if (await dialog.count() > 0 && await dialog.isVisible()) {
            dialogFound = true;
            console.log(`✅ Dialog opened with selector: ${selector}`);
            testResults.passed.push('✅ Dialog opened on button click');
            break;
          }
        }

        if (!dialogFound) {
          console.log('❌ No dialog appeared after clicking button');
          testResults.failed.push('❌ Dialog did not open');

          // Check if there are any error messages
          const errorMsg = await page.locator('text=/error|failed/i').first();
          if (await errorMsg.count() > 0) {
            const errorText = await errorMsg.textContent();
            console.log(`  Error message found: ${errorText}`);
          }
        }

      } catch (error) {
        console.log(`❌ Error clicking button: ${error.message}`);
        testResults.failed.push('❌ Error clicking create button');
      }
    }

    // ==========================
    // TEST 5: Form Elements
    // ==========================
    console.log('\n📋 TEST 5: Testing Form Elements');
    console.log('-'.repeat(40));

    // Check for form fields
    const formFields = {
      'Name input': ['input[name="name"]', 'input[placeholder*="name"]', 'input[id="name"]'],
      'Event type select': ['select[name="event_type"]', 'select[id="event_type"]', '[role="combobox"]'],
      'Date input': ['input[type="date"]', 'input[name="event_date"]'],
      'Time input': ['input[type="time"]', 'input[name="serving_time"]'],
      'Guest count': ['input[type="number"]', 'input[name="guest_count"]']
    };

    for (const [fieldName, selectors] of Object.entries(formFields)) {
      let found = false;
      for (const selector of selectors) {
        const field = await page.locator(selector).first();
        if (await field.count() > 0) {
          found = true;
          console.log(`✅ ${fieldName} found`);
          testResults.passed.push(`✅ ${fieldName} found`);
          break;
        }
      }
      if (!found) {
        console.log(`❌ ${fieldName} not found`);
        testResults.failed.push(`❌ ${fieldName} not found`);
      }
    }

    // ==========================
    // TEST 6: Edge Cases
    // ==========================
    console.log('\n📋 TEST 6: Edge Case Testing');
    console.log('-'.repeat(40));

    // Test 6.1: Empty form submission
    console.log('Testing empty form submission...');
    const saveButton = await page.locator('button:has-text("Save"), button:has-text("Create"):not([aria-label])').last();
    if (await saveButton.count() > 0) {
      await saveButton.click();
      await page.waitForTimeout(2000);

      // Check for validation error
      const validationError = await page.locator('text=/required|please|must/i').first();
      if (await validationError.count() > 0) {
        console.log('✅ Validation prevents empty submission');
        testResults.passed.push('✅ Form validation works');
      } else {
        console.log('⚠️ No validation error shown for empty form');
        testResults.warnings.push('⚠️ Form might allow empty submission');
      }
    }

    // Test 6.2: Invalid date
    console.log('Testing invalid date input...');
    const dateInput = await page.locator('input[type="date"]').first();
    if (await dateInput.count() > 0) {
      await dateInput.fill('1900-01-01');
      console.log('✅ Can enter past dates (might be valid for testing)');
      testResults.warnings.push('⚠️ Accepts very old dates');
    }

    // Test 6.3: Large guest count
    console.log('Testing large guest count...');
    const guestInput = await page.locator('input[type="number"]').first();
    if (await guestInput.count() > 0) {
      await guestInput.fill('999999');
      console.log('✅ Can enter large guest counts');
      testResults.warnings.push('⚠️ No maximum guest count limit');
    }

    // ==========================
    // TEST 7: API Integration
    // ==========================
    console.log('\n📋 TEST 7: API Integration Check');
    console.log('-'.repeat(40));

    // Monitor API calls
    const apiCalls = [];
    page.on('request', request => {
      if (request.url().includes('/api/holiday')) {
        apiCalls.push({
          method: request.method(),
          url: request.url()
        });
      }
    });

    // Trigger a page action that should call API
    await page.reload();
    await page.waitForTimeout(3000);

    if (apiCalls.length > 0) {
      console.log('✅ API calls detected:');
      apiCalls.forEach(call => {
        console.log(`  ${call.method} ${call.url}`);
      });
      testResults.passed.push('✅ API integration working');
    } else {
      console.log('⚠️ No API calls detected');
      testResults.warnings.push('⚠️ API might not be connected');
    }

    // ==========================
    // TEST 8: Console & Network Errors
    // ==========================
    console.log('\n📋 TEST 8: Error Detection');
    console.log('-'.repeat(40));

    if (consoleErrors.length > 0) {
      console.log('❌ Console errors detected:');
      consoleErrors.forEach(err => {
        console.log(`  ${err}`);
      });
      testResults.failed.push(`❌ ${consoleErrors.length} console errors`);
    } else {
      console.log('✅ No console errors');
      testResults.passed.push('✅ No console errors');
    }

    if (networkErrors.length > 0) {
      console.log('❌ Network errors detected:');
      networkErrors.forEach(err => {
        console.log(`  ${err.url}: ${err.error}`);
      });
      testResults.failed.push(`❌ ${networkErrors.length} network errors`);
    } else {
      console.log('✅ No network errors');
      testResults.passed.push('✅ No network errors');
    }

    // ==========================
    // TEST 9: Screenshots
    // ==========================
    console.log('\n📋 TEST 9: Documentation');
    console.log('-'.repeat(40));

    await page.screenshot({ path: 'holiday-comprehensive-test.png', fullPage: true });
    console.log('✅ Screenshot saved as holiday-comprehensive-test.png');

    // Take screenshot of specific elements
    const mainContent = await page.locator('main').first();
    if (await mainContent.count() > 0) {
      await mainContent.screenshot({ path: 'holiday-main-content.png' });
      console.log('✅ Main content screenshot saved');
    }

  } catch (error) {
    console.error('\n❌ Test Suite Error:', error.message);
    testResults.failed.push(`❌ Test suite error: ${error.message}`);
    await page.screenshot({ path: 'holiday-error-comprehensive.png', fullPage: true });
  } finally {
    // ==========================
    // FINAL REPORT
    // ==========================
    console.log('\n' + '=' .repeat(60));
    console.log('📊 COMPREHENSIVE TEST REPORT');
    console.log('=' .repeat(60));

    console.log(`\n✅ PASSED: ${testResults.passed.length} tests`);
    testResults.passed.forEach(test => console.log(`  ${test}`));

    console.log(`\n⚠️ WARNINGS: ${testResults.warnings.length} issues`);
    testResults.warnings.forEach(warning => console.log(`  ${warning}`));

    console.log(`\n❌ FAILED: ${testResults.failed.length} tests`);
    testResults.failed.forEach(test => console.log(`  ${test}`));

    // Overall assessment
    console.log('\n' + '=' .repeat(60));
    console.log('🔍 DIAGNOSIS');
    console.log('=' .repeat(60));

    const passRate = (testResults.passed.length / (testResults.passed.length + testResults.failed.length)) * 100;
    console.log(`Pass Rate: ${passRate.toFixed(1)}%`);

    if (passRate >= 80) {
      console.log('✅ Holiday Planner is mostly functional');
    } else if (passRate >= 50) {
      console.log('⚠️ Holiday Planner has some issues');
    } else {
      console.log('❌ Holiday Planner has significant problems');
    }

    // Specific recommendations
    console.log('\n📝 RECOMMENDATIONS:');
    if (testResults.failed.some(f => f.includes('Create button'))) {
      console.log('1. Fix the Create Event button - it may not be rendering or clickable');
      console.log('   - Check HolidayPlannerPage.tsx for button implementation');
      console.log('   - Verify onClick handlers are properly attached');
      console.log('   - Check for JavaScript errors preventing interaction');
    }
    if (testResults.failed.some(f => f.includes('Dialog'))) {
      console.log('2. Fix the dialog/modal component');
      console.log('   - Check dialog state management');
      console.log('   - Verify dialog component is imported correctly');
    }
    if (testResults.warnings.some(w => w.includes('validation'))) {
      console.log('3. Add proper form validation');
      console.log('   - Require necessary fields');
      console.log('   - Add date range validation');
      console.log('   - Limit guest count to reasonable numbers');
    }

    await page.waitForTimeout(5000);
    await browser.close();
    console.log('\n✨ Comprehensive test complete');
  }
}

comprehensiveHolidayTest().catch(console.error);
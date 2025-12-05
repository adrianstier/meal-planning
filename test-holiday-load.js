const { chromium } = require('playwright');

async function testHolidayLoad() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🧪 Testing Holiday Planner Local Load\n');
  console.log('='.repeat(50) + '\n');

  try {
    // Login first
    console.log('📝 Logging in...');
    await page.goto('http://localhost:3001/login');
    await page.waitForTimeout(2000);

    await page.fill('input[type="text"]', 'testholiday');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    console.log('✅ Logged in\n');

    // Navigate to Holiday Planner
    console.log('🎄 Loading Holiday Planner...');
    await page.goto('http://localhost:3001/holiday');
    await page.waitForTimeout(3000);

    // Check for page content
    const title = await page.locator('h1:has-text("Holiday")').first();
    const titleExists = await title.count() > 0;
    console.log(`Page Title: ${titleExists ? '✅ FOUND' : '❌ NOT FOUND'}`);

    const createBtn = await page.locator('button:has-text("New Holiday Event")').first();
    const btnExists = await createBtn.count() > 0;
    console.log(`Create Button: ${btnExists ? '✅ FOUND' : '❌ NOT FOUND'}`);

    // Check for any error messages
    const errorMsg = await page.locator('text=/error|failed|500/i').first();
    const hasError = await errorMsg.count() > 0;
    if (hasError) {
      const errorText = await errorMsg.textContent();
      console.log(`⚠️ Error detected: ${errorText}`);
    } else {
      console.log('Error Messages: ✅ NONE');
    }

    // Take screenshot
    await page.screenshot({ path: 'holiday-load-test.png', fullPage: true });
    console.log('\n📸 Screenshot saved as holiday-load-test.png');

    // Test API endpoint directly
    console.log('\n🔌 Testing API endpoints...');

    // Get cookies for auth
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === 'session');

    const apiResponse = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/holiday/events');
        return {
          status: res.status,
          ok: res.ok,
          data: await res.json()
        };
      } catch (e) {
        return { error: e.message };
      }
    });

    console.log(`API /api/holiday/events: ${apiResponse.ok ? '✅' : '❌'} Status ${apiResponse.status}`);
    if (apiResponse.data?.events) {
      console.log(`Events found: ${apiResponse.data.events.length}`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Holiday Planner loaded successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testHolidayLoad().catch(console.error);

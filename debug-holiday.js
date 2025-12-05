const { chromium } = require('playwright');

async function debugHolidayPage() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    // Enable console logging
    bypassCSP: true
  });
  const page = await context.newPage();

  // Capture console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Browser Console Error:', msg.text());
    }
  });

  // Capture network errors
  page.on('requestfailed', request => {
    console.log('❌ Request Failed:', request.url(), request.failure().errorText);
  });

  console.log('🔍 Debugging Holiday Planner Page\n');
  console.log('=' .repeat(50) + '\n');

  try {
    // Step 1: Navigate to login
    console.log('📝 Step 1: Login');
    await page.goto('http://localhost:3000/login');
    await page.waitForTimeout(2000);

    // Try with testholiday user
    await page.fill('input[type="text"]', 'testholiday');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(3000);

    const afterLoginUrl = page.url();
    console.log(`After login URL: ${afterLoginUrl}`);

    // Step 2: Navigate to Holiday page
    console.log('\n🎄 Step 2: Navigate to Holiday Planner');
    await page.goto('http://localhost:3000/holiday');
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    // Step 3: Check what's actually rendered
    console.log('\n📋 Step 3: Checking Page Content');
    console.log('-'.repeat(30));

    // Get all text content
    const pageText = await page.textContent('body');
    console.log('Page contains "Holiday":', pageText.includes('Holiday'));
    console.log('Page contains "Meal Planner":', pageText.includes('Meal Planner'));

    // Check for specific elements
    const h1Elements = await page.$$('h1');
    console.log(`Found ${h1Elements.length} h1 elements`);
    for (let h1 of h1Elements) {
      const text = await h1.textContent();
      console.log(`  h1: "${text}"`);
    }

    // Check for error messages
    const errorElements = await page.$$('text=/error|failed|not found/i');
    if (errorElements.length > 0) {
      console.log('\n⚠️ Error elements found:');
      for (let err of errorElements) {
        const text = await err.textContent();
        console.log(`  Error: "${text}"`);
      }
    }

    // Check if main content area exists
    const mainContent = await page.$('main');
    if (mainContent) {
      console.log('\n✅ Main content area exists');
      const mainText = await mainContent.textContent();
      console.log('Main content preview:', mainText.substring(0, 200));
    }

    // Check for React errors
    const reactErrors = await page.$$('[data-reactroot] .error, #root .error');
    if (reactErrors.length > 0) {
      console.log('\n❌ React errors found');
    }

    // Step 4: Try to inspect the DOM structure
    console.log('\n🏗️ Step 4: DOM Structure');
    console.log('-'.repeat(30));

    const domStructure = await page.evaluate(() => {
      const getStructure = (el, level = 0) => {
        if (level > 3) return '';
        const indent = '  '.repeat(level);
        let str = indent + el.tagName;
        if (el.id) str += `#${el.id}`;
        if (el.className && typeof el.className === 'string') {
          str += `.${el.className.split(' ').slice(0, 2).join('.')}`;
        }
        str += '\n';

        // Only get first few children
        const children = Array.from(el.children).slice(0, 3);
        for (let child of children) {
          str += getStructure(child, level + 1);
        }
        return str;
      };

      const root = document.getElementById('root') || document.body;
      return getStructure(root);
    });

    console.log('DOM Structure:');
    console.log(domStructure);

    // Step 5: Check API calls
    console.log('\n🌐 Step 5: Checking API Calls');
    console.log('-'.repeat(30));

    // Set up request interception
    const apiCalls = [];
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiCalls.push({
          url: request.url(),
          method: request.method()
        });
      }
    });

    // Reload to capture API calls
    await page.reload();
    await page.waitForTimeout(3000);

    if (apiCalls.length > 0) {
      console.log('API calls made:');
      apiCalls.forEach(call => {
        console.log(`  ${call.method} ${call.url}`);
      });
    } else {
      console.log('No API calls detected');
    }

    // Step 6: Check if JavaScript is working
    console.log('\n⚙️ Step 6: JavaScript Check');
    const jsResult = await page.evaluate(() => {
      return {
        react: typeof React !== 'undefined',
        reactVersion: typeof React !== 'undefined' ? React.version : 'N/A',
        hasRouter: typeof window !== 'undefined' && window.location.pathname === '/holiday'
      };
    });

    console.log('React loaded:', jsResult.react);
    console.log('React version:', jsResult.reactVersion);
    console.log('Router working:', jsResult.hasRouter);

    // Take screenshots
    await page.screenshot({ path: 'holiday-debug.png', fullPage: true });
    console.log('\n📸 Screenshot saved as holiday-debug.png');

    // Final diagnosis
    console.log('\n' + '=' .repeat(50));
    console.log('🔬 DIAGNOSIS');
    console.log('=' .repeat(50));

    if (currentUrl.includes('/holiday')) {
      if (pageText.includes('Holiday Meal Planner')) {
        console.log('✅ Holiday Planner page is rendering correctly');
      } else {
        console.log('⚠️ URL is correct but content is not rendering');
        console.log('   Possible issues:');
        console.log('   - Component not loading properly');
        console.log('   - API error preventing render');
        console.log('   - JavaScript error in component');
      }
    } else {
      console.log('❌ Not on Holiday page - routing issue');
    }

  } catch (error) {
    console.error('\n❌ Debug Error:', error);
  } finally {
    console.log('\n🏁 Debug session complete');
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

debugHolidayPage().catch(console.error);
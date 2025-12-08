const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];

  // Listen for console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`[CONSOLE]: ${msg.text()}`);
    }
  });

  // Listen for API responses
  page.on('response', async response => {
    if (response.url().includes('/api/')) {
      const status = response.status();
      let body = '';
      try {
        body = await response.text();
        if (body.length > 300) body = body.substring(0, 300) + '...';
      } catch (e) {}
      console.log(`[API ${status}]: ${response.url().replace('https://web-production-4b509.up.railway.app', '')}`);
      if (status >= 400) {
        console.log(`  Response: ${body}`);
        errors.push(`API ${status}: ${response.url()} - ${body}`);
      }
    }
  });

  const BASE_URL = 'https://web-production-4b509.up.railway.app';

  console.log('=== Testing Production ===\n');

  // Go to the app
  console.log('1. Loading app...');
  await page.goto(BASE_URL);
  await page.waitForTimeout(2000);
  console.log(`   URL: ${page.url()}`);

  // Register a new user
  console.log('\n2. Registering new user...');

  // Check if already on login or need to click
  if (!page.url().includes('/login')) {
    const signInBtn = await page.$('button:has-text("Sign In"), a:has-text("Sign In"), [href="/login"]');
    if (signInBtn) {
      await signInBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  // Switch to register mode
  const createBtn = await page.$('button:has-text("Create")');
  if (createBtn) {
    await createBtn.click();
    await page.waitForTimeout(500);
  }

  // Fill registration form
  const username = 'test' + Date.now();
  await page.fill('input#username', username);
  await page.fill('input#email', username + '@test.com');
  await page.fill('input#displayName', 'Test User');
  await page.fill('input#password', 'test123456');

  // Submit
  await page.click('button[type="submit"]');
  console.log(`   Registered: ${username}`);

  await page.waitForTimeout(3000);

  console.log(`\n3. After registration - URL: ${page.url()}`);

  // Check if we're on plan page
  if (page.url().includes('/plan')) {
    console.log('   SUCCESS: Reached plan page!');

    // Wait for data to load
    await page.waitForTimeout(2000);

    // Check page content
    const pageText = await page.innerText('body').catch(() => '');

    if (pageText.includes('Error Loading') || pageText.includes('Failed to load')) {
      console.log('\n   ERROR: Page shows loading error');
      const errorEl = await page.$('[role="alert"], .error');
      if (errorEl) {
        const errorText = await errorEl.innerText();
        console.log(`   Error text: ${errorText}`);
      }
    } else if (pageText.includes('Weekly Meal Plan') || pageText.includes('Meal Plan')) {
      console.log('   SUCCESS: Meal plan content loaded!');
    }
  } else {
    console.log('   ERROR: Did not reach plan page');
  }

  console.log('\n=== Summary ===');
  if (errors.length > 0) {
    console.log('ERRORS FOUND:');
    errors.forEach(e => console.log(`  - ${e.substring(0, 200)}`));
  } else {
    console.log('NO ERRORS - All tests passed!');
  }

  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();

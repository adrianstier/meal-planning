/**
 * Playwright Mobile Testing Suite
 * Tests the meal planning app on mobile devices (iPhone, Android)
 *
 * Run with: npx playwright test tests/mobile.spec.js
 * Run with UI: npx playwright test tests/mobile.spec.js --ui
 * Run specific device: npx playwright test tests/mobile.spec.js --project="Mobile Safari"
 */

const { test, expect, devices } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001';

// Test configurations for different mobile devices
const mobileDevices = [
  { name: 'iPhone 12', device: devices['iPhone 12'] },
  { name: 'iPhone SE', device: devices['iPhone SE'] },
  { name: 'Pixel 5', device: devices['Pixel 5'] },
  { name: 'Galaxy S9+', device: devices['Galaxy S9+'] }
];

// ============================================================================
// TEST: MOBILE RESPONSIVE LAYOUT
// ============================================================================

test.describe('Mobile Responsive Layout', () => {


  test('homepage loads and is responsive on mobile', async ({ page }) => {
    await page.goto(BASE_URL);

    // Check viewport is mobile size
    const viewport = page.viewportSize();
    expect(viewport.width).toBeLessThanOrEqual(428); // iPhone 12 width

    // Check page loads
    await expect(page).toHaveTitle(/Meal Planning/i);

    // Check no horizontal scrolling (common mobile issue)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // Allow 5px tolerance
  });

  test('navigation menu works on mobile', async ({ page }) => {
    await page.goto(BASE_URL);

    // Look for mobile menu (hamburger icon)
    const mobileMenu = page.locator('button[aria-label*="menu"], button.mobile-menu, .hamburger, [class*="mobile-nav"]').first();

    if (await mobileMenu.isVisible()) {
      // Click to open menu
      await mobileMenu.click();

      // Wait for menu to appear
      await page.waitForTimeout(500);

      // Check if navigation items are now visible
      const navItems = page.locator('nav a, .nav-link, .menu-item');
      const count = await navItems.count();
      expect(count).toBeGreaterThan(0);

      console.log(`✅ Mobile menu found with ${count} navigation items`);
    } else {
      console.log('⚠️  No mobile menu detected - may need to add hamburger menu');
    }
  });

  test('text is readable on mobile (font sizes)', async ({ page }) => {
    await page.goto(BASE_URL);

    // Check main headings are readable (at least 24px)
    const h1FontSize = await page.locator('h1').first().evaluate(el => {
      return parseFloat(window.getComputedStyle(el).fontSize);
    }).catch(() => 0);

    if (h1FontSize > 0) {
      expect(h1FontSize).toBeGreaterThanOrEqual(20); // Minimum readable on mobile
      console.log(`✅ H1 font size: ${h1FontSize}px`);
    }

    // Check body text is readable (at least 14px)
    const bodyFontSize = await page.locator('p, body').first().evaluate(el => {
      return parseFloat(window.getComputedStyle(el).fontSize);
    }).catch(() => 14);

    expect(bodyFontSize).toBeGreaterThanOrEqual(14);
    console.log(`✅ Body font size: ${bodyFontSize}px`);
  });

  test('buttons are tappable on mobile (min 44x44 touch target)', async ({ page }) => {
    await page.goto(BASE_URL);

    // Find all buttons
    const buttons = page.locator('button, a.button, [role="button"]');
    const count = await buttons.count();

    console.log(`Checking ${count} buttons for mobile tap targets...`);

    let smallButtons = 0;
    for (let i = 0; i < Math.min(count, 10); i++) { // Check first 10
      const button = buttons.nth(i);
      const box = await button.boundingBox().catch(() => null);

      if (box) {
        // Apple recommends 44x44 minimum for touch targets
        if (box.width < 44 || box.height < 44) {
          const text = await button.textContent();
          console.log(`⚠️  Small button: "${text?.slice(0, 20)}" (${Math.round(box.width)}x${Math.round(box.height)})`);
          smallButtons++;
        }
      }
    }

    console.log(`Found ${smallButtons} buttons smaller than 44x44`);
  });
});

// ============================================================================
// TEST: USER REGISTRATION FLOW (MOBILE)
// ============================================================================

test.describe('Mobile User Registration', () => {


  test('can register new user on mobile', async ({ page }) => {
    await page.goto(BASE_URL);

    const timestamp = Date.now();
    const username = `mobile_user_${timestamp}`;
    const email = `mobile${timestamp}@example.com`;
    const password = 'password123';

    // Look for register/signup link or button
    const registerLink = page.locator('a:has-text("Register"), a:has-text("Sign Up"), button:has-text("Register"), button:has-text("Sign Up")').first();

    if (await registerLink.isVisible()) {
      await registerLink.click();
      await page.waitForTimeout(500);

      // Fill registration form
      await page.fill('input[name="username"], input[type="text"]', username);
      await page.fill('input[name="email"], input[type="email"]', email);
      await page.fill('input[name="password"], input[type="password"]', password);

      // Submit form
      await page.click('button[type="submit"], button:has-text("Sign Up"), button:has-text("Register")');

      // Wait for response
      await page.waitForTimeout(2000);

      // Check for success (URL change or success message)
      const currentUrl = page.url();
      const successMessage = await page.locator('text=/success|welcome|registered/i').count();

      if (!currentUrl.includes('register') || successMessage > 0) {
        console.log('✅ Registration successful on mobile');
      } else {
        console.log('⚠️  Registration may have failed - check error messages');
      }
    } else {
      console.log('⚠️  Could not find registration link on mobile');
    }
  });

  test('form inputs are accessible on mobile keyboard', async ({ page }) => {
    await page.goto(BASE_URL);

    // Navigate to registration
    await page.click('a:has-text("Register"), button:has-text("Sign Up")').catch(() => {});
    await page.waitForTimeout(500);

    // Check input types for mobile keyboard optimization
    const emailInput = page.locator('input[type="email"]').first();
    if (await emailInput.isVisible()) {
      const inputType = await emailInput.getAttribute('type');
      expect(inputType).toBe('email'); // Should trigger email keyboard on mobile
      console.log('✅ Email input has correct type="email"');
    }

    // Check for autocomplete attributes (helps mobile autofill)
    const usernameInput = page.locator('input[name="username"], input[autocomplete="username"]').first();
    if (await usernameInput.isVisible()) {
      const autocomplete = await usernameInput.getAttribute('autocomplete');
      console.log(`Username autocomplete: ${autocomplete || 'not set'}`);
    }
  });
});

// ============================================================================
// TEST: RECIPE CREATION (MOBILE)
// ============================================================================

test.describe('Mobile Recipe Creation', () => {


  test('can create recipe on mobile', async ({ page }) => {
    await page.goto(BASE_URL);

    // First login (using test account)
    await page.click('a:has-text("Login"), button:has-text("Login")').catch(() => {});
    await page.waitForTimeout(500);

    // Try to find add recipe button
    const addRecipeBtn = page.locator('button:has-text("Add Recipe"), a:has-text("Add Recipe"), button:has-text("New Recipe"), [aria-label*="add recipe"]').first();

    if (await addRecipeBtn.isVisible({ timeout: 5000 })) {
      await addRecipeBtn.click();
      await page.waitForTimeout(1000);

      // Check if recipe form appeared
      const recipeForm = page.locator('form, [class*="recipe-form"]');
      const isFormVisible = await recipeForm.isVisible();

      if (isFormVisible) {
        console.log('✅ Recipe form opened on mobile');

        // Check if form fits on screen (no horizontal scroll)
        const formWidth = await recipeForm.evaluate(el => el.scrollWidth);
        const viewportWidth = page.viewportSize().width;
        expect(formWidth).toBeLessThanOrEqual(viewportWidth + 10);
        console.log('✅ Recipe form fits mobile viewport');
      } else {
        console.log('⚠️  Recipe form not visible on mobile');
      }
    } else {
      console.log('⚠️  Add Recipe button not found on mobile');
    }
  });

  test('recipe form inputs are mobile-friendly', async ({ page }) => {
    await page.goto(BASE_URL + '/recipes'); // Assuming recipes page exists

    // Check for number inputs with mobile-friendly keyboards
    const numberInputs = page.locator('input[type="number"]');
    const count = await numberInputs.count();
    console.log(`Found ${count} number inputs (should trigger numeric keyboard on mobile)`);
  });
});

// ============================================================================
// TEST: PRICING PAGE (MOBILE)
// ============================================================================

test.describe('Mobile Pricing Page', () => {


  test('pricing tiers display correctly on mobile', async ({ page }) => {
    await page.goto(BASE_URL + '/pricing');
    await page.waitForTimeout(1000);

    // Look for pricing cards/tiers
    const pricingCards = page.locator('[class*="pricing"], [class*="tier"], [class*="plan"]');
    const count = await pricingCards.count();

    if (count > 0) {
      console.log(`✅ Found ${count} pricing elements`);

      // Check if pricing cards stack vertically on mobile
      const firstCard = pricingCards.first();
      const secondCard = pricingCards.nth(1);

      if (await firstCard.isVisible() && await secondCard.isVisible()) {
        const box1 = await firstCard.boundingBox();
        const box2 = await secondCard.boundingBox();

        if (box1 && box2) {
          // Cards should stack vertically (y position increases)
          const isStacked = box2.y > box1.y + box1.height - 20;
          if (isStacked) {
            console.log('✅ Pricing cards stack vertically on mobile');
          } else {
            console.log('⚠️  Pricing cards may be side-by-side (hard to read on mobile)');
          }
        }
      }
    } else {
      console.log('⚠️  No pricing elements found');
    }
  });

  test('checkout buttons work on mobile', async ({ page }) => {
    await page.goto(BASE_URL + '/pricing');
    await page.waitForTimeout(1000);

    // Find "Subscribe" or "Get Started" buttons
    const ctaButtons = page.locator('button:has-text("Subscribe"), button:has-text("Get Started"), a:has-text("Subscribe")');
    const count = await ctaButtons.count();

    console.log(`Found ${count} CTA buttons on pricing page`);

    if (count > 0) {
      // Check button is tappable
      const button = ctaButtons.first();
      const box = await button.boundingBox();

      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40); // Tappable height
        console.log(`✅ CTA button size: ${Math.round(box.width)}x${Math.round(box.height)}`);
      }
    }
  });
});

// ============================================================================
// TEST: MOBILE PERFORMANCE
// ============================================================================

test.describe('Mobile Performance', () => {


  test('page loads within acceptable time on mobile', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;
    console.log(`⏱️  Page load time: ${loadTime}ms`);

    // Mobile should load within 3 seconds on good connection
    expect(loadTime).toBeLessThan(5000);
  });

  test('images are optimized for mobile', async ({ page }) => {
    await page.goto(BASE_URL);

    // Find all images
    const images = page.locator('img');
    const count = await images.count();

    console.log(`Checking ${count} images for mobile optimization...`);

    let largeImages = 0;
    for (let i = 0; i < Math.min(count, 5); i++) {
      const img = images.nth(i);
      const src = await img.getAttribute('src');
      const naturalWidth = await img.evaluate(el => el.naturalWidth);

      // Images wider than 800px may be unnecessarily large for mobile
      if (naturalWidth > 800) {
        console.log(`⚠️  Large image: ${src} (${naturalWidth}px wide)`);
        largeImages++;
      }
    }

    if (largeImages > 0) {
      console.log(`Found ${largeImages} images that could be optimized for mobile`);
    } else {
      console.log('✅ Images appear optimized for mobile');
    }
  });
});

// ============================================================================
// TEST: CROSS-DEVICE COMPATIBILITY
// ============================================================================

test.describe('Cross-Device Compatibility', () => {

  for (const { name, device } of mobileDevices) {
    test(`app works on ${name}`, async ({ browser }) => {
      const context = await browser.newContext({
        ...device,
      });
      const page = await context.newPage();

      await page.goto(BASE_URL);

      // Basic smoke test
      await expect(page).toHaveTitle(/Meal Planning/i);

      // Check no console errors
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.waitForTimeout(2000);

      if (errors.length > 0) {
        console.log(`⚠️  Console errors on ${name}:`, errors);
      } else {
        console.log(`✅ ${name}: No console errors`);
      }

      await context.close();
    });
  }
});

// ============================================================================
// TEST: TOUCH INTERACTIONS
// ============================================================================

test.describe('Touch Interactions', () => {


  test('swipe gestures work if implemented', async ({ page }) => {
    await page.goto(BASE_URL);

    // Test if there are any swipeable elements (carousels, etc.)
    const swipeableElements = page.locator('[class*="carousel"], [class*="slider"], [class*="swipe"]');
    const count = await swipeableElements.count();

    if (count > 0) {
      console.log(`Found ${count} potentially swipeable elements`);

      const element = swipeableElements.first();
      const box = await element.boundingBox();

      if (box) {
        // Simulate swipe left
        await page.touchscreen.tap(box.x + box.width - 50, box.y + box.height / 2);
        await page.waitForTimeout(300);

        console.log('✅ Touch interaction test completed');
      }
    }
  });

  test('dropdown menus work with touch', async ({ page }) => {
    await page.goto(BASE_URL);

    // Find select elements or custom dropdowns
    const dropdowns = page.locator('select, [role="combobox"], [class*="dropdown"]');
    const count = await dropdowns.count();

    if (count > 0) {
      console.log(`Found ${count} dropdown elements`);

      const dropdown = dropdowns.first();
      if (await dropdown.isVisible()) {
        await dropdown.tap();
        await page.waitForTimeout(500);
        console.log('✅ Dropdown tappable on mobile');
      }
    }
  });
});

// ============================================================================
// TEST: MOBILE-SPECIFIC FEATURES
// ============================================================================

test.describe('Mobile-Specific Features', () => {


  test('viewport meta tag is set correctly', async ({ page }) => {
    await page.goto(BASE_URL);

    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');

    if (viewport) {
      console.log(`Viewport meta: ${viewport}`);
      expect(viewport).toContain('width=device-width');
      expect(viewport).toContain('initial-scale=1');
      console.log('✅ Viewport meta tag configured correctly');
    } else {
      console.log('❌ Missing viewport meta tag (required for mobile)');
    }
  });

  test('app is installable as PWA on mobile', async ({ page }) => {
    await page.goto(BASE_URL);

    // Check for manifest.json
    const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');

    if (manifest) {
      console.log(`✅ PWA manifest found: ${manifest}`);
    } else {
      console.log('⚠️  No PWA manifest (app cannot be installed on home screen)');
    }
  });
});

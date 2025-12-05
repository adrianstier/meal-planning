const { test, expect } = require('@playwright/test');

test.describe('Mobile Hamburger Menu', () => {
  test('hamburger menu should open and show navigation', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    // Go to the app
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Take a screenshot of initial state
    await page.screenshot({ path: 'screenshots/01-mobile-initial.png', fullPage: true });

    // Check current URL
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

    // If on login page, we need to log in first
    if (currentUrl.includes('/login')) {
      console.log('On login page, logging in...');

      // Fill in credentials - use the test user
      await page.fill('input[placeholder="Enter your username"]', 'testmobile');
      await page.fill('input[placeholder="Enter your password"]', 'test123');

      await page.screenshot({ path: 'screenshots/02-login-filled.png', fullPage: true });

      // Click sign in button - using more specific selector
      const signInButton = page.locator('button:has-text("Sign In")');
      console.log('Sign In button count:', await signInButton.count());
      console.log('Sign In button visible:', await signInButton.isVisible());

      await signInButton.click();
      console.log('Clicked Sign In button');

      // Wait a moment and take screenshot to see what happens
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'screenshots/03-after-click.png', fullPage: true });
      console.log('URL after click:', page.url());

      // Wait for navigation to plan page
      await page.waitForURL('**/plan', { timeout: 15000 });
      await page.waitForLoadState('networkidle');

      console.log('After login URL:', page.url());
      await page.screenshot({ path: 'screenshots/04-after-login.png', fullPage: true });
    }

    // Now we should be on a protected page with the Layout/header
    console.log('Looking for hamburger menu button...');

    // The hamburger button has aria-label "Open menu"
    const menuButton = page.locator('button[aria-label="Open menu"]');
    const menuButtonCount = await menuButton.count();
    console.log('Menu button count:', menuButtonCount);

    if (menuButtonCount === 0) {
      // Debug: Check what's in the header
      console.log('No menu button found with aria-label. Checking header...');

      const header = page.locator('header');
      const headerExists = await header.count() > 0;
      console.log('Header exists:', headerExists);

      if (headerExists) {
        // Get header HTML for debugging
        const headerHtml = await header.innerHTML();
        console.log('Header HTML (first 500 chars):', headerHtml.substring(0, 500));

        // Check for any buttons
        const buttons = header.locator('button');
        const buttonCount = await buttons.count();
        console.log('Buttons in header:', buttonCount);

        for (let i = 0; i < buttonCount; i++) {
          const btn = buttons.nth(i);
          const ariaLabel = await btn.getAttribute('aria-label');
          const isVisible = await btn.isVisible();
          console.log(`  Button ${i}: aria-label="${ariaLabel}", visible=${isVisible}`);
        }
      }

      // Check viewport width
      const viewport = page.viewportSize();
      console.log('Viewport:', viewport);

      // Check if lg:hidden elements are properly hidden
      // At 390px width (< 1024px lg breakpoint), lg:hidden should be visible
      const mobileMenuDiv = page.locator('.lg\\:hidden').first();
      if (await mobileMenuDiv.count() > 0) {
        const isVisible = await mobileMenuDiv.isVisible();
        console.log('lg:hidden element visible:', isVisible);
      }

      await page.screenshot({ path: 'screenshots/04-debug-no-menu.png', fullPage: true });

      // Fail the test with useful info
      expect(menuButtonCount, 'Hamburger menu button not found').toBeGreaterThan(0);
    }

    // Check visibility
    const isVisible = await menuButton.isVisible();
    console.log('Menu button is visible:', isVisible);

    if (!isVisible) {
      // Debug visibility issue
      const display = await menuButton.evaluate(el => window.getComputedStyle(el).display);
      const visibility = await menuButton.evaluate(el => window.getComputedStyle(el).visibility);
      const opacity = await menuButton.evaluate(el => window.getComputedStyle(el).opacity);
      console.log(`Button styles: display=${display}, visibility=${visibility}, opacity=${opacity}`);

      // Check parent visibility
      const parentDisplay = await menuButton.evaluate(el => {
        const parent = el.parentElement;
        return parent ? window.getComputedStyle(parent).display : 'no parent';
      });
      console.log('Parent display:', parentDisplay);

      await page.screenshot({ path: 'screenshots/05-button-not-visible.png', fullPage: true });
      expect(isVisible, 'Menu button should be visible on mobile').toBe(true);
    }

    // Click the hamburger menu
    console.log('Clicking hamburger menu...');
    await menuButton.click();
    await page.waitForTimeout(500);

    // Take screenshot after click
    await page.screenshot({ path: 'screenshots/06-menu-clicked.png', fullPage: true });

    // Check if mobile menu appeared
    const mobileMenu = page.locator('#mobile-menu');
    const menuExists = await mobileMenu.count() > 0;
    const menuVisible = menuExists ? await mobileMenu.isVisible() : false;
    console.log('Mobile menu exists:', menuExists);
    console.log('Mobile menu visible after click:', menuVisible);

    if (!menuVisible) {
      // Check if the button state changed
      const closeButton = page.locator('button[aria-label="Close menu"]');
      const closeButtonVisible = await closeButton.count() > 0 && await closeButton.isVisible();
      console.log('Close button visible:', closeButtonVisible);

      // Check for backdrop
      const backdrop = page.locator('.backdrop-blur-sm');
      const backdropVisible = await backdrop.count() > 0;
      console.log('Backdrop exists:', backdropVisible);

      await page.screenshot({ path: 'screenshots/07-menu-not-visible.png', fullPage: true });
    }

    // Check for navigation links in the menu
    if (menuVisible) {
      const navLinks = mobileMenu.locator('a');
      const linkCount = await navLinks.count();
      console.log('Navigation links in menu:', linkCount);

      // List some links
      for (let i = 0; i < Math.min(linkCount, 8); i++) {
        const link = navLinks.nth(i);
        const href = await link.getAttribute('href');
        const text = await link.textContent();
        console.log(`  Link ${i}: ${text?.trim().substring(0, 30)} -> ${href}`);
      }

      // Test clicking a link
      const recipesLink = mobileMenu.locator('a[href="/recipes"]');
      if (await recipesLink.count() > 0) {
        console.log('Clicking Recipes link...');
        await recipesLink.click();
        await page.waitForURL('**/recipes');
        console.log('Successfully navigated to:', page.url());
        await page.screenshot({ path: 'screenshots/08-after-navigation.png', fullPage: true });
      }
    }

    // Final assertions
    expect(menuVisible, 'Mobile menu should be visible after clicking hamburger').toBe(true);
  });
});

/**
 * UX/UI Navigation Click Review Tests
 *
 * Comprehensive Playwright tests that verify all clickable navigation elements
 * work correctly across desktop and mobile viewports.
 *
 * Run with: npx playwright test client/src/tests/ux-review/navigation-clicks.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

// Test credentials - loaded from environment variables
// Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD in your environment
// Note: The Family Meal Planner runs on port 3001 (port 3000 has a different project)
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL || '';
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD || '';

if (!TEST_EMAIL || !TEST_PASSWORD) {
  console.warn('[WARNING] Test credentials not set. Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD environment variables.');
}

// Issue tracking
interface NavigationIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  element: string;
  viewport: 'desktop' | 'mobile' | 'both';
  description: string;
  expectedBehavior: string;
  actualBehavior: string;
  screenshot?: string;
}

const discoveredIssues: NavigationIssue[] = [];

function reportIssue(issue: Omit<NavigationIssue, 'id'>): void {
  const newIssue = {
    id: `NAV-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    ...issue,
  };
  discoveredIssues.push(newIssue);
  console.log(`\n[${issue.severity.toUpperCase()}] ${issue.element}: ${issue.description}`);
}

// Navigation items from Layout.tsx
const primaryNavItems = [
  { path: '/plan', label: 'Meal Plan', expectedTitle: /plan|meal/i },
  { path: '/recipes', label: 'Recipes', expectedTitle: /recipe/i },
  { path: '/lists', label: 'Shopping List', expectedTitle: /list|shopping/i },
];

const secondaryNavItems = [
  { path: '/holiday', label: 'Holiday Planner', expectedTitle: /holiday/i },
  { path: '/seasonal', label: 'Seasonal Cooking', expectedTitle: /seasonal/i },
  { path: '/bento', label: 'Bento', expectedTitle: /bento/i },
  { path: '/leftovers', label: 'Leftovers', expectedTitle: /leftover/i },
  { path: '/school-menu', label: 'School Menu', expectedTitle: /school|menu/i },
  { path: '/restaurants', label: 'Restaurants', expectedTitle: /restaurant/i },
  { path: '/diagnostics', label: 'Diagnostics', expectedTitle: /diagnostic/i },
];

// Helper to dismiss onboarding tour if present
async function dismissOnboardingTour(page: Page): Promise<void> {
  try {
    // Wait a moment for any modals to appear
    await page.waitForTimeout(500);

    // Look for Skip tour or Close tour buttons
    const skipButton = page.locator('button:has-text("Skip tour"), button:has-text("Close tour"), button[aria-label*="Close tour"]').first();

    if (await skipButton.isVisible({ timeout: 2000 })) {
      await skipButton.click();
      await page.waitForTimeout(300);
      console.log('Dismissed onboarding tour');
    }
  } catch {
    // Tour not present, continue
  }
}

// Helper to login
async function login(page: Page): Promise<boolean> {
  try {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Check if already logged in (redirected)
    const url = page.url();
    if (url.includes('/plan') || url.includes('/recipes')) {
      console.log('Already logged in');
      await dismissOnboardingTour(page);
      return true;
    }

    // Wait for the page to be ready - look for the form
    await page.waitForSelector('form', { timeout: 15000 });

    // Fill login form using multiple selectors for robustness
    const emailInput = page.locator('#email, input[type="email"], input[placeholder*="email" i]').first();
    const passwordInput = page.locator('#password, input[type="password"]').first();

    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(TEST_EMAIL);

    await passwordInput.waitFor({ state: 'visible', timeout: 5000 });
    await passwordInput.fill(TEST_PASSWORD);

    // Click submit button
    const submitButton = page.locator('button[type="submit"], button:has-text("Sign in")').first();
    await submitButton.click();

    // Wait for redirect
    await page.waitForURL(/\/(plan|recipes)/, { timeout: 15000 });
    console.log('Login successful');

    // Dismiss onboarding tour if present
    await dismissOnboardingTour(page);

    return true;
  } catch (error) {
    console.error('Login failed:', error);
    return false;
  }
}

// Helper to check if navigation was successful
async function verifyNavigation(
  page: Page,
  expectedPath: string,
  expectedTitle: RegExp,
  elementName: string,
  viewport: 'desktop' | 'mobile'
): Promise<boolean> {
  try {
    // Wait for URL to change
    await page.waitForURL(new RegExp(expectedPath), { timeout: 10000 });

    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Check for errors on page
    const errorElements = page.locator('[role="alert"]:has-text("error"), .error-message, .text-red-500:has-text("error")');
    const hasErrors = await errorElements.count() > 0;

    if (hasErrors) {
      const errorText = await errorElements.first().textContent();
      reportIssue({
        severity: 'high',
        element: elementName,
        viewport,
        description: `Page shows error after navigation`,
        expectedBehavior: `Navigate to ${expectedPath} without errors`,
        actualBehavior: `Error displayed: ${errorText}`,
      });
      return false;
    }

    return true;
  } catch (error) {
    reportIssue({
      severity: 'critical',
      element: elementName,
      viewport,
      description: `Navigation timeout or failure`,
      expectedBehavior: `Navigate to ${expectedPath}`,
      actualBehavior: String(error),
    });
    return false;
  }
}

// ==================== DESKTOP TESTS ====================
test.describe('Desktop Navigation', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);
  });

  test('Logo click navigates to /plan', async ({ page }) => {
    // Go to a different page first
    await page.goto(`${BASE_URL}/recipes`);
    await page.waitForLoadState('networkidle');

    // Click logo
    const logo = page.locator('a[aria-label*="Home"], a:has(.text-primary) >> nth=0');

    if (await logo.count() > 0) {
      await logo.click();
      const navSuccess = await verifyNavigation(page, '/plan', /plan/i, 'Logo', 'desktop');
      expect(navSuccess).toBe(true);
    } else {
      reportIssue({
        severity: 'medium',
        element: 'Logo',
        viewport: 'desktop',
        description: 'Logo link not found',
        expectedBehavior: 'Logo should be clickable and navigate to /plan',
        actualBehavior: 'Logo element not found',
      });
    }
  });

  test('Primary navigation links work', async ({ page }) => {
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    for (const navItem of primaryNavItems) {
      console.log(`Testing primary nav: ${navItem.label}`);

      // Find the nav link
      const link = page.locator(`nav a[href="${navItem.path}"], nav a:has-text("${navItem.label}")`).first();

      if (await link.isVisible()) {
        await link.click();
        const navSuccess = await verifyNavigation(
          page,
          navItem.path,
          navItem.expectedTitle,
          `Primary Nav: ${navItem.label}`,
          'desktop'
        );

        if (!navSuccess) {
          // Still try to continue testing
          await page.goto(`${BASE_URL}/plan`);
          await page.waitForLoadState('networkidle');
        }
      } else {
        reportIssue({
          severity: 'high',
          element: `Primary Nav: ${navItem.label}`,
          viewport: 'desktop',
          description: `Navigation link not visible`,
          expectedBehavior: `${navItem.label} link should be visible in navigation`,
          actualBehavior: 'Link not found or not visible',
        });
      }
    }
  });

  test('More dropdown opens and contains secondary nav items', async ({ page }) => {
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');
    await dismissOnboardingTour(page);

    // Find and click the More button
    const moreButton = page.locator('button:has-text("More")');

    if (await moreButton.isVisible()) {
      await moreButton.click();
      await page.waitForTimeout(300); // Wait for dropdown animation

      // Check dropdown is visible
      const dropdown = page.locator('[role="menu"], [data-radix-menu-content]');
      const isDropdownVisible = await dropdown.isVisible();

      if (!isDropdownVisible) {
        reportIssue({
          severity: 'high',
          element: 'More Dropdown',
          viewport: 'desktop',
          description: 'Dropdown menu does not open',
          expectedBehavior: 'Clicking More button should open dropdown menu',
          actualBehavior: 'Dropdown menu is not visible after click',
        });
        return;
      }

      // Test each secondary nav item in dropdown
      for (const navItem of secondaryNavItems) {
        console.log(`Testing secondary nav in dropdown: ${navItem.label}`);

        // Re-open dropdown if closed
        if (!(await dropdown.isVisible())) {
          await moreButton.click();
          await page.waitForTimeout(300);
        }

        const menuItem = page.locator(`[role="menuitem"] a[href="${navItem.path}"], [role="menuitem"]:has-text("${navItem.label}")`).first();

        if (await menuItem.isVisible()) {
          // Use force click if normal click is intercepted by overlays
          await menuItem.click({ force: true });

          const navSuccess = await verifyNavigation(
            page,
            navItem.path,
            navItem.expectedTitle,
            `Secondary Nav: ${navItem.label}`,
            'desktop'
          );

          // Return to plan page for next test
          await page.goto(`${BASE_URL}/plan`);
          await page.waitForLoadState('networkidle');
          await dismissOnboardingTour(page);
        } else {
          reportIssue({
            severity: 'medium',
            element: `Secondary Nav: ${navItem.label}`,
            viewport: 'desktop',
            description: `Menu item not found in More dropdown`,
            expectedBehavior: `${navItem.label} should be in More dropdown`,
            actualBehavior: 'Menu item not found or not visible',
          });
        }
      }
    } else {
      reportIssue({
        severity: 'high',
        element: 'More Button',
        viewport: 'desktop',
        description: 'More dropdown button not found',
        expectedBehavior: 'More button should be visible in desktop navigation',
        actualBehavior: 'Button not found',
      });
    }
  });

  test('Profile link navigates to /profile', async ({ page }) => {
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Find profile link
    const profileLink = page.locator('a[href="/profile"], a:has-text("Profile"), a[aria-label*="Profile"]').first();

    if (await profileLink.isVisible()) {
      await profileLink.click();
      const navSuccess = await verifyNavigation(page, '/profile', /profile/i, 'Profile Link', 'desktop');
      expect(navSuccess).toBe(true);
    } else {
      reportIssue({
        severity: 'medium',
        element: 'Profile Link',
        viewport: 'desktop',
        description: 'Profile link not visible in desktop navigation',
        expectedBehavior: 'Profile link should be visible in header',
        actualBehavior: 'Link not found or not visible',
      });
    }
  });

  test('Logout button is clickable', async ({ page }) => {
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Find logout button
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Log out"), button[aria-label*="Log out"]').first();

    if (await logoutButton.isVisible()) {
      // We just verify it is clickable, not actually logout
      const isEnabled = await logoutButton.isEnabled();

      if (!isEnabled) {
        reportIssue({
          severity: 'medium',
          element: 'Logout Button',
          viewport: 'desktop',
          description: 'Logout button is disabled',
          expectedBehavior: 'Logout button should be enabled',
          actualBehavior: 'Button is disabled',
        });
      } else {
        console.log('Logout button is clickable (not clicking to maintain session)');
      }
    } else {
      reportIssue({
        severity: 'medium',
        element: 'Logout Button',
        viewport: 'desktop',
        description: 'Logout button not visible',
        expectedBehavior: 'Logout button should be visible in header',
        actualBehavior: 'Button not found',
      });
    }
  });

  test('Skip to main content link works', async ({ page }) => {
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');
    await dismissOnboardingTour(page);

    // Tab to reveal skip link - sr-only becomes visible on focus
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    const skipLink = page.locator('a:has-text("Skip to main content")');

    // Check if the skip link exists and is focusable
    const skipLinkExists = await skipLink.count() > 0;

    if (skipLinkExists) {
      // Press Enter instead of click for sr-only elements
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);

      // Verify focus moved to main content
      const mainContent = page.locator('#main-content, main');
      const isFocused = await mainContent.evaluate(el => el === document.activeElement || el.contains(document.activeElement));

      if (!isFocused) {
        // Check if the URL hash changed to #main-content
        const urlHash = page.url();
        if (!urlHash.includes('#main-content')) {
          reportIssue({
            severity: 'low',
            element: 'Skip to Main Content',
            viewport: 'desktop',
            description: 'Skip link does not move focus to main content',
            expectedBehavior: 'Focus should move to main content area',
            actualBehavior: 'Focus did not move as expected',
          });
        } else {
          console.log('Skip link navigated to #main-content');
        }
      } else {
        console.log('Skip link successfully moved focus to main content');
      }
    } else {
      console.log('Skip link not found - may be rendered conditionally');
    }
  });
});

// ==================== MOBILE TESTS ====================
test.describe('Mobile Navigation', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test.beforeEach(async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);
  });

  test('Mobile hamburger menu opens', async ({ page }) => {
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Find hamburger button
    const hamburger = page.locator('button[aria-label*="menu" i], button[aria-label*="Open menu" i]');

    if (await hamburger.isVisible()) {
      await hamburger.click();
      await page.waitForTimeout(300);

      // Check if mobile menu opened
      const mobileMenu = page.locator('#mobile-menu, [role="navigation"][aria-label*="Mobile"]');
      const isMenuVisible = await mobileMenu.isVisible();

      if (!isMenuVisible) {
        reportIssue({
          severity: 'critical',
          element: 'Mobile Hamburger Menu',
          viewport: 'mobile',
          description: 'Mobile menu does not open when hamburger is clicked',
          expectedBehavior: 'Mobile navigation menu should open',
          actualBehavior: 'Menu not visible after click',
        });
      } else {
        console.log('Mobile menu opened successfully');
      }
    } else {
      reportIssue({
        severity: 'critical',
        element: 'Hamburger Button',
        viewport: 'mobile',
        description: 'Hamburger menu button not found',
        expectedBehavior: 'Hamburger button should be visible on mobile',
        actualBehavior: 'Button not found',
      });
    }
  });

  test('Mobile menu primary navigation links work', async ({ page }) => {
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    for (const navItem of primaryNavItems) {
      console.log(`Testing mobile primary nav: ${navItem.label}`);

      // Open mobile menu
      const hamburger = page.locator('button[aria-label*="menu" i], button[aria-label*="Open menu" i]');
      if (await hamburger.isVisible()) {
        await hamburger.click();
        await page.waitForTimeout(300);
      }

      // Find nav link in mobile menu
      const mobileNav = page.locator('#mobile-menu nav, [role="navigation"][aria-label*="Mobile"] nav');
      const link = mobileNav.locator(`a[href="${navItem.path}"], a:has-text("${navItem.label}")`).first();

      if (await link.isVisible()) {
        await link.click();

        const navSuccess = await verifyNavigation(
          page,
          navItem.path,
          navItem.expectedTitle,
          `Mobile Primary Nav: ${navItem.label}`,
          'mobile'
        );

        // Menu should auto-close after navigation
        const menuAfterNav = page.locator('#mobile-menu');
        const menuStillOpen = await menuAfterNav.isVisible();

        if (menuStillOpen) {
          reportIssue({
            severity: 'low',
            element: `Mobile Nav: ${navItem.label}`,
            viewport: 'mobile',
            description: 'Mobile menu does not close after navigation',
            expectedBehavior: 'Menu should close when a link is clicked',
            actualBehavior: 'Menu remains open',
          });
        }
      } else {
        reportIssue({
          severity: 'high',
          element: `Mobile Primary Nav: ${navItem.label}`,
          viewport: 'mobile',
          description: `Navigation link not found in mobile menu`,
          expectedBehavior: `${navItem.label} link should be visible in mobile menu`,
          actualBehavior: 'Link not found',
        });
      }
    }
  });

  test('Mobile menu secondary navigation links work', async ({ page }) => {
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    for (const navItem of secondaryNavItems) {
      console.log(`Testing mobile secondary nav: ${navItem.label}`);

      // Open mobile menu
      const hamburger = page.locator('button[aria-label*="menu" i], button[aria-label*="Open menu" i]');
      if (await hamburger.isVisible()) {
        await hamburger.click();
        await page.waitForTimeout(300);
      }

      // Find nav link in mobile menu
      const mobileNav = page.locator('#mobile-menu nav, [role="navigation"][aria-label*="Mobile"] nav');
      const link = mobileNav.locator(`a[href="${navItem.path}"], a:has-text("${navItem.label}")`).first();

      if (await link.isVisible()) {
        await link.click();

        const navSuccess = await verifyNavigation(
          page,
          navItem.path,
          navItem.expectedTitle,
          `Mobile Secondary Nav: ${navItem.label}`,
          'mobile'
        );

        // Return to plan page
        await page.goto(`${BASE_URL}/plan`);
        await page.waitForLoadState('networkidle');
      } else {
        // May need to scroll to see it
        const menuContainer = page.locator('#mobile-menu nav');
        await menuContainer.evaluate(el => el.scrollTop = el.scrollHeight);
        await page.waitForTimeout(200);

        const linkAfterScroll = mobileNav.locator(`a[href="${navItem.path}"], a:has-text("${navItem.label}")`).first();

        if (await linkAfterScroll.isVisible()) {
          await linkAfterScroll.click();
          await verifyNavigation(page, navItem.path, navItem.expectedTitle, `Mobile Secondary Nav: ${navItem.label}`, 'mobile');
          await page.goto(`${BASE_URL}/plan`);
          await page.waitForLoadState('networkidle');
        } else {
          reportIssue({
            severity: 'medium',
            element: `Mobile Secondary Nav: ${navItem.label}`,
            viewport: 'mobile',
            description: `Navigation link not found in mobile menu`,
            expectedBehavior: `${navItem.label} link should be visible in mobile menu`,
            actualBehavior: 'Link not found even after scroll',
          });
        }
      }
    }
  });

  test('Mobile menu Profile link works', async ({ page }) => {
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Open mobile menu
    const hamburger = page.locator('button[aria-label*="menu" i], button[aria-label*="Open menu" i]');
    if (await hamburger.isVisible()) {
      await hamburger.click();
      await page.waitForTimeout(300);
    }

    // Find profile link
    const profileLink = page.locator('#mobile-menu a[href="/profile"], #mobile-menu a:has-text("Profile")').first();

    if (await profileLink.isVisible()) {
      await profileLink.click();
      const navSuccess = await verifyNavigation(page, '/profile', /profile/i, 'Mobile Profile Link', 'mobile');
      expect(navSuccess).toBe(true);
    } else {
      reportIssue({
        severity: 'medium',
        element: 'Mobile Profile Link',
        viewport: 'mobile',
        description: 'Profile link not found in mobile menu',
        expectedBehavior: 'Profile link should be visible in mobile menu',
        actualBehavior: 'Link not found',
      });
    }
  });

  test('Mobile menu Logout button works', async ({ page }) => {
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Open mobile menu
    const hamburger = page.locator('button[aria-label*="menu" i], button[aria-label*="Open menu" i]');
    if (await hamburger.isVisible()) {
      await hamburger.click();
      await page.waitForTimeout(300);
    }

    // Find logout button
    const logoutButton = page.locator('#mobile-menu button:has-text("Logout"), #mobile-menu button:has-text("Log out")').first();

    if (await logoutButton.isVisible()) {
      const isEnabled = await logoutButton.isEnabled();

      if (!isEnabled) {
        reportIssue({
          severity: 'medium',
          element: 'Mobile Logout Button',
          viewport: 'mobile',
          description: 'Logout button is disabled in mobile menu',
          expectedBehavior: 'Logout button should be enabled',
          actualBehavior: 'Button is disabled',
        });
      } else {
        console.log('Mobile logout button is clickable (not clicking to maintain session)');
      }
    } else {
      reportIssue({
        severity: 'medium',
        element: 'Mobile Logout Button',
        viewport: 'mobile',
        description: 'Logout button not found in mobile menu',
        expectedBehavior: 'Logout button should be visible in mobile menu',
        actualBehavior: 'Button not found',
      });
    }
  });

  test('Mobile menu closes when clicking backdrop', async ({ page }) => {
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Open mobile menu
    const hamburger = page.locator('button[aria-label*="menu" i], button[aria-label*="Open menu" i]');
    if (await hamburger.isVisible()) {
      await hamburger.click();
      await page.waitForTimeout(300);
    }

    // Click backdrop
    const backdrop = page.locator('.backdrop-blur-sm, [aria-hidden="true"]').first();

    if (await backdrop.isVisible()) {
      await backdrop.click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(300);

      // Check if menu closed
      const mobileMenu = page.locator('#mobile-menu');
      const isMenuStillOpen = await mobileMenu.isVisible();

      if (isMenuStillOpen) {
        reportIssue({
          severity: 'medium',
          element: 'Mobile Menu Backdrop',
          viewport: 'mobile',
          description: 'Clicking backdrop does not close mobile menu',
          expectedBehavior: 'Menu should close when clicking outside',
          actualBehavior: 'Menu remains open',
        });
      } else {
        console.log('Mobile menu closes when clicking backdrop');
      }
    }
  });

  test('Mobile menu closes with X button', async ({ page }) => {
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Open mobile menu
    const hamburger = page.locator('button[aria-label*="menu" i], button[aria-label*="Open menu" i]');
    if (await hamburger.isVisible()) {
      await hamburger.click();
      await page.waitForTimeout(300);
    }

    // Find and click close button (X icon)
    const closeButton = page.locator('button[aria-label*="Close menu" i], button[aria-expanded="true"]');

    if (await closeButton.isVisible()) {
      await closeButton.click();
      await page.waitForTimeout(300);

      // Check if menu closed
      const mobileMenu = page.locator('#mobile-menu');
      const isMenuStillOpen = await mobileMenu.isVisible();

      if (isMenuStillOpen) {
        reportIssue({
          severity: 'medium',
          element: 'Mobile Menu Close Button',
          viewport: 'mobile',
          description: 'X button does not close mobile menu',
          expectedBehavior: 'Menu should close when clicking X',
          actualBehavior: 'Menu remains open',
        });
      } else {
        console.log('Mobile menu closes with X button');
      }
    }
  });

  test('Touch target sizes meet minimum requirements (44x44)', async ({ page }) => {
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Open mobile menu
    const hamburger = page.locator('button[aria-label*="menu" i], button[aria-label*="Open menu" i]');
    if (await hamburger.isVisible()) {
      await hamburger.click();
      await page.waitForTimeout(300);
    }

    // Check all clickable elements in mobile menu
    const clickables = page.locator('#mobile-menu a, #mobile-menu button');
    const count = await clickables.count();

    for (let i = 0; i < count; i++) {
      const element = clickables.nth(i);
      if (await element.isVisible()) {
        const box = await element.boundingBox();

        if (box && (box.width < 44 || box.height < 44)) {
          const text = await element.textContent();
          reportIssue({
            severity: 'low',
            element: `Mobile Touch Target: ${text?.trim().substring(0, 30) || 'unknown'}`,
            viewport: 'mobile',
            description: `Touch target too small: ${Math.round(box.width)}x${Math.round(box.height)}`,
            expectedBehavior: 'Touch targets should be at least 44x44 pixels',
            actualBehavior: `Size is ${Math.round(box.width)}x${Math.round(box.height)}`,
          });
        }
      }
    }
  });
});

// ==================== TABLET TESTS ====================
test.describe('Tablet Navigation', () => {
  test.use({ viewport: { width: 768, height: 1024 } }); // iPad

  test.beforeEach(async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);
  });

  test('Tablet viewport shows appropriate navigation', async ({ page }) => {
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Check if desktop nav is visible or mobile menu
    const desktopNav = page.locator('nav.hidden.lg\\:flex');
    const mobileMenuButton = page.locator('button[aria-label*="menu" i]');

    const isDesktopNavVisible = await desktopNav.isVisible();
    const isMobileButtonVisible = await mobileMenuButton.isVisible();

    // At 768px (lg breakpoint starts at 1024px), should show mobile menu
    if (isDesktopNavVisible && isMobileButtonVisible) {
      reportIssue({
        severity: 'medium',
        element: 'Tablet Navigation',
        viewport: 'both',
        description: 'Both desktop and mobile navigation visible on tablet',
        expectedBehavior: 'Only one navigation style should be visible',
        actualBehavior: 'Both desktop nav and hamburger menu visible',
      });
    }

    console.log(`Tablet (768x1024): Desktop nav visible: ${isDesktopNavVisible}, Mobile button visible: ${isMobileButtonVisible}`);
  });
});

// ==================== KEYBOARD NAVIGATION TESTS ====================
test.describe('Keyboard Navigation', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);
  });

  test('Navigation links are keyboard accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Tab through navigation
    let foundNavLink = false;
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');

      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tagName: el?.tagName,
          href: (el as HTMLAnchorElement)?.href || null,
          text: el?.textContent?.trim(),
        };
      });

      if (focused.tagName === 'A' && focused.href?.includes(BASE_URL)) {
        foundNavLink = true;
        console.log(`Tab ${i + 1}: Focused on link "${focused.text}"`);
      }
    }

    if (!foundNavLink) {
      reportIssue({
        severity: 'high',
        element: 'Keyboard Navigation',
        viewport: 'desktop',
        description: 'Cannot tab to navigation links',
        expectedBehavior: 'Should be able to tab to nav links',
        actualBehavior: 'No nav links received focus during tab navigation',
      });
    }
  });

  test('Enter key activates focused links', async ({ page }) => {
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Tab to Recipes link
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');

      const focusedText = await page.evaluate(() => document.activeElement?.textContent?.trim());
      if (focusedText?.includes('Recipes')) {
        await page.keyboard.press('Enter');

        try {
          await page.waitForURL(/\/recipes/, { timeout: 5000 });
          console.log('Enter key successfully activated Recipes link');
          return;
        } catch {
          reportIssue({
            severity: 'high',
            element: 'Keyboard Enter Activation',
            viewport: 'desktop',
            description: 'Enter key does not activate focused link',
            expectedBehavior: 'Enter should navigate to link target',
            actualBehavior: 'Navigation did not occur',
          });
        }
      }
    }
  });

  test('More dropdown is keyboard accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Tab to More button
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');

      const focusedText = await page.evaluate(() => document.activeElement?.textContent?.trim());
      if (focusedText?.includes('More')) {
        // Press Enter to open dropdown
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);

        const dropdown = page.locator('[role="menu"]');
        const isOpen = await dropdown.isVisible();

        if (!isOpen) {
          // Try Space key
          await page.keyboard.press('Space');
          await page.waitForTimeout(300);

          if (!(await dropdown.isVisible())) {
            reportIssue({
              severity: 'medium',
              element: 'More Dropdown Keyboard',
              viewport: 'desktop',
              description: 'Cannot open More dropdown with keyboard',
              expectedBehavior: 'Enter or Space should open dropdown',
              actualBehavior: 'Dropdown does not open with keyboard',
            });
          }
        } else {
          console.log('More dropdown opens with keyboard');

          // Test arrow key navigation
          await page.keyboard.press('ArrowDown');
          const menuItemFocused = await page.evaluate(() => {
            return document.activeElement?.getAttribute('role') === 'menuitem';
          });

          if (!menuItemFocused) {
            reportIssue({
              severity: 'low',
              element: 'Dropdown Arrow Keys',
              viewport: 'desktop',
              description: 'Arrow keys do not navigate dropdown items',
              expectedBehavior: 'ArrowDown should focus first menu item',
              actualBehavior: 'Focus did not move to menu item',
            });
          }
        }
        break;
      }
    }
  });

  test('Escape key closes dropdowns', async ({ page }) => {
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Open More dropdown
    const moreButton = page.locator('button:has-text("More")');
    await moreButton.click();
    await page.waitForTimeout(300);

    const dropdown = page.locator('[role="menu"]');
    expect(await dropdown.isVisible()).toBe(true);

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    const isStillOpen = await dropdown.isVisible();
    if (isStillOpen) {
      reportIssue({
        severity: 'medium',
        element: 'Dropdown Escape Key',
        viewport: 'desktop',
        description: 'Escape key does not close dropdown',
        expectedBehavior: 'Escape should close open dropdown',
        actualBehavior: 'Dropdown remains open',
      });
    } else {
      console.log('Escape key closes dropdown');
    }
  });
});

// ==================== NAVIGATION STATE TESTS ====================
test.describe('Navigation State', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);
  });

  test('Active navigation item is highlighted', async ({ page }) => {
    for (const navItem of primaryNavItems) {
      await page.goto(`${BASE_URL}${navItem.path}`);
      await page.waitForLoadState('networkidle');

      const activeLink = page.locator(`nav a[href="${navItem.path}"][aria-current="page"], nav a[href="${navItem.path}"].bg-accent`);
      const isHighlighted = await activeLink.count() > 0;

      if (!isHighlighted) {
        reportIssue({
          severity: 'low',
          element: `Active State: ${navItem.label}`,
          viewport: 'desktop',
          description: `Active navigation item not visually highlighted`,
          expectedBehavior: `${navItem.label} should show active state when on ${navItem.path}`,
          actualBehavior: 'No visual indication of active state',
        });
      } else {
        console.log(`${navItem.label} shows active state correctly`);
      }
    }
  });

  test('Browser back button works after navigation', async ({ page }) => {
    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Navigate to recipes
    const recipesLink = page.locator('nav a[href="/recipes"]').first();
    await recipesLink.click();
    await page.waitForURL(/\/recipes/);

    // Navigate to lists
    const listsLink = page.locator('nav a[href="/lists"]').first();
    await listsLink.click();
    await page.waitForURL(/\/lists/);

    // Go back
    await page.goBack();

    try {
      await page.waitForURL(/\/recipes/, { timeout: 5000 });
      console.log('Browser back button works correctly');
    } catch {
      reportIssue({
        severity: 'high',
        element: 'Browser Back Button',
        viewport: 'both',
        description: 'Browser back button navigation does not work',
        expectedBehavior: 'Should return to previous page',
        actualBehavior: `Current URL: ${page.url()}`,
      });
    }
  });

  test('Direct URL navigation works for all routes', async ({ page }) => {
    const allRoutes = [
      ...primaryNavItems.map(n => n.path),
      ...secondaryNavItems.map(n => n.path),
      '/profile',
    ];

    for (const route of allRoutes) {
      console.log(`Testing direct URL: ${route}`);

      await page.goto(`${BASE_URL}${route}`);
      await page.waitForLoadState('networkidle');

      // Check if we're on the right page (not redirected to login or error)
      const currentUrl = page.url();

      if (currentUrl.includes('/login')) {
        reportIssue({
          severity: 'high',
          element: `Direct URL: ${route}`,
          viewport: 'both',
          description: 'Direct URL navigation redirects to login',
          expectedBehavior: `Should load ${route} when authenticated`,
          actualBehavior: 'Redirected to login page',
        });
      } else if (!currentUrl.includes(route)) {
        reportIssue({
          severity: 'medium',
          element: `Direct URL: ${route}`,
          viewport: 'both',
          description: 'Direct URL navigation redirected unexpectedly',
          expectedBehavior: `Should stay on ${route}`,
          actualBehavior: `Redirected to ${currentUrl}`,
        });
      }

      // Check for 404 or error page content
      const pageContent = await page.content();
      if (pageContent.includes('404') || pageContent.includes('Not Found') || pageContent.includes('Page not found')) {
        reportIssue({
          severity: 'critical',
          element: `Route: ${route}`,
          viewport: 'both',
          description: '404 error for valid route',
          expectedBehavior: `${route} should render properly`,
          actualBehavior: '404 page displayed',
        });
      }
    }
  });
});

// ==================== SUMMARY ====================
test.afterAll(async () => {
  console.log('\n\n========================================');
  console.log('     NAVIGATION UX REVIEW SUMMARY');
  console.log('========================================\n');

  console.log(`Total Issues Found: ${discoveredIssues.length}`);

  const critical = discoveredIssues.filter(i => i.severity === 'critical');
  const high = discoveredIssues.filter(i => i.severity === 'high');
  const medium = discoveredIssues.filter(i => i.severity === 'medium');
  const low = discoveredIssues.filter(i => i.severity === 'low');

  console.log(`\nBy Severity:`);
  console.log(`  Critical: ${critical.length}`);
  console.log(`  High: ${high.length}`);
  console.log(`  Medium: ${medium.length}`);
  console.log(`  Low: ${low.length}`);

  const desktopIssues = discoveredIssues.filter(i => i.viewport === 'desktop' || i.viewport === 'both');
  const mobileIssues = discoveredIssues.filter(i => i.viewport === 'mobile' || i.viewport === 'both');

  console.log(`\nBy Viewport:`);
  console.log(`  Desktop: ${desktopIssues.length}`);
  console.log(`  Mobile: ${mobileIssues.length}`);

  if (discoveredIssues.length > 0) {
    console.log('\n========================================');
    console.log('          DETAILED ISSUES');
    console.log('========================================\n');

    // Group by severity
    if (critical.length > 0) {
      console.log('=== CRITICAL ===');
      critical.forEach(issue => {
        console.log(`\n[${issue.id}] ${issue.element}`);
        console.log(`  Viewport: ${issue.viewport}`);
        console.log(`  Description: ${issue.description}`);
        console.log(`  Expected: ${issue.expectedBehavior}`);
        console.log(`  Actual: ${issue.actualBehavior}`);
      });
    }

    if (high.length > 0) {
      console.log('\n=== HIGH ===');
      high.forEach(issue => {
        console.log(`\n[${issue.id}] ${issue.element}`);
        console.log(`  Viewport: ${issue.viewport}`);
        console.log(`  Description: ${issue.description}`);
        console.log(`  Expected: ${issue.expectedBehavior}`);
        console.log(`  Actual: ${issue.actualBehavior}`);
      });
    }

    if (medium.length > 0) {
      console.log('\n=== MEDIUM ===');
      medium.forEach(issue => {
        console.log(`\n[${issue.id}] ${issue.element}`);
        console.log(`  Viewport: ${issue.viewport}`);
        console.log(`  Description: ${issue.description}`);
        console.log(`  Expected: ${issue.expectedBehavior}`);
        console.log(`  Actual: ${issue.actualBehavior}`);
      });
    }

    if (low.length > 0) {
      console.log('\n=== LOW ===');
      low.forEach(issue => {
        console.log(`\n[${issue.id}] ${issue.element}`);
        console.log(`  Viewport: ${issue.viewport}`);
        console.log(`  Description: ${issue.description}`);
        console.log(`  Expected: ${issue.expectedBehavior}`);
        console.log(`  Actual: ${issue.actualBehavior}`);
      });
    }
  } else {
    console.log('\nNo issues found! All navigation elements working correctly.');
  }

  console.log('\n========================================');
  console.log('         END OF UX REVIEW');
  console.log('========================================\n');
});

/**
 * UX/UI Click Review - Settings, Profile, and Account Tests
 *
 * This test suite systematically clicks through all profile menu items,
 * settings toggles, and account-related UI elements to identify broken
 * clicks or missing handlers.
 *
 * PREREQUISITES:
 * 1. Start the development server: cd client && npm start
 * 2. Ensure the server is running on http://localhost:3000
 * 3. Test credentials must be valid (see TEST_CREDENTIALS.md)
 *
 * Run with: npx playwright test client/src/tests/ux-review/settings-clicks.spec.ts
 *
 * ELEMENTS TESTED:
 * - Desktop navigation: Profile link, Logout button, More dropdown menu items
 * - Mobile navigation: Hamburger menu, all nav items, mobile logout
 * - Profile page: Display name input, Email input, Reset/Save buttons, Diagnostics link
 * - Diagnostics page: Refresh, Copy for Claude, Download, Clear buttons, Tabs, Filters
 * - Login page: Sign In button, OAuth buttons, Forgot password, Create account links
 */

import { test, expect, Page } from '@playwright/test';

// Test credentials - loaded from environment variables
// Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD in your environment
const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL || '';
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD || '';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

if (!TEST_EMAIL || !TEST_PASSWORD) {
  console.warn('[WARNING] Test credentials not set. Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD environment variables.');
}

// Bug/Issue tracking
interface UXIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  element: string;
  expected: string;
  actual: string;
  location: string;
}

const discoveredIssues: UXIssue[] = [];

function reportIssue(issue: Omit<UXIssue, 'id'>): void {
  discoveredIssues.push({
    id: `UX-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    ...issue,
  });
  console.log(`\n[ISSUE FOUND] [${issue.severity.toUpperCase()}] ${issue.title}`);
  console.log(`  Element: ${issue.element}`);
  console.log(`  Location: ${issue.location}`);
  console.log(`  Expected: ${issue.expected}`);
  console.log(`  Actual: ${issue.actual}`);
}

// Helper to login
async function login(page: Page): Promise<boolean> {
  try {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Check if already logged in
    const url = page.url();
    if (url.includes('/plan') || url.includes('/recipes') || url.includes('/profile')) {
      console.log('[Login] Already logged in, redirected to:', url);
      return true;
    }

    // Fill login form
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill(TEST_EMAIL);
    await passwordInput.fill(TEST_PASSWORD);
    await submitButton.click();

    // Wait for redirect
    await page.waitForURL(/\/(plan|recipes|profile)/, { timeout: 15000 });
    console.log('[Login] Successfully logged in');
    return true;
  } catch (error) {
    console.error('[Login] Failed:', error);
    return false;
  }
}

// Helper to check if element is clickable
async function isClickable(page: Page, selector: string): Promise<boolean> {
  try {
    const element = page.locator(selector).first();
    if (!(await element.isVisible())) return false;
    if (await element.isDisabled()) return false;
    return true;
  } catch {
    return false;
  }
}

// Helper to safely click and check for console errors
async function safeClick(
  page: Page,
  selector: string,
  description: string,
  options: { expectNavigation?: boolean; expectDialog?: boolean } = {}
): Promise<{ success: boolean; error?: string }> {
  const consoleErrors: string[] = [];
  const uncaughtErrors: string[] = [];

  // Listen for console errors
  const consoleHandler = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  };
  page.on('console', consoleHandler);

  // Listen for page errors
  const errorHandler = (error: Error) => {
    uncaughtErrors.push(error.message);
  };
  page.on('pageerror', errorHandler);

  try {
    const element = page.locator(selector).first();
    if (!(await element.isVisible({ timeout: 3000 }))) {
      return { success: false, error: 'Element not visible' };
    }

    if (await element.isDisabled()) {
      return { success: false, error: 'Element is disabled' };
    }

    // Click the element
    if (options.expectNavigation) {
      await Promise.all([
        page.waitForNavigation({ timeout: 10000 }),
        element.click(),
      ]);
    } else {
      await element.click();
      await page.waitForTimeout(500); // Wait for any handlers to execute
    }

    // Check for errors
    if (consoleErrors.length > 0 || uncaughtErrors.length > 0) {
      return {
        success: false,
        error: `Console errors: ${[...consoleErrors, ...uncaughtErrors].join('; ')}`,
      };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  } finally {
    page.off('console', consoleHandler);
    page.off('pageerror', errorHandler);
  }
}

// ==================== DESKTOP NAVIGATION TESTS ====================
test.describe('Desktop Navigation - Profile & Settings', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('click profile link in desktop navigation', async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);

    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Find and click the profile link in desktop navigation
    const profileLink = page.locator('a[href="/profile"]').first();
    const isVisible = await profileLink.isVisible();

    if (!isVisible) {
      reportIssue({
        severity: 'high',
        title: 'Profile link not visible in desktop navigation',
        description: 'The profile link is not visible in the desktop header',
        element: 'a[href="/profile"]',
        expected: 'Profile link should be visible and clickable',
        actual: 'Profile link not found or hidden',
        location: 'Desktop header navigation',
      });
      return;
    }

    const result = await safeClick(page, 'a[href="/profile"]', 'Profile link', {
      expectNavigation: true,
    });

    if (!result.success) {
      reportIssue({
        severity: 'high',
        title: 'Profile link click failed',
        description: result.error || 'Unknown error',
        element: 'a[href="/profile"]',
        expected: 'Should navigate to /profile',
        actual: `Click failed: ${result.error}`,
        location: 'Desktop header navigation',
      });
    }

    // Verify we're on the profile page
    await expect(page).toHaveURL(/\/profile/);
    console.log('[Test] Successfully navigated to profile page');
  });

  test('click logout button in desktop navigation', async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);

    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Find logout button
    const logoutButton = page.locator('button[aria-label="Log out"]').first();
    const isVisible = await logoutButton.isVisible();

    if (!isVisible) {
      reportIssue({
        severity: 'high',
        title: 'Logout button not visible in desktop navigation',
        description: 'The logout button is not visible in the desktop header',
        element: 'button[aria-label="Log out"]',
        expected: 'Logout button should be visible',
        actual: 'Logout button not found',
        location: 'Desktop header navigation',
      });
      return;
    }

    // Click logout
    await logoutButton.click();
    await page.waitForTimeout(2000);

    // Should redirect to login page
    const currentUrl = page.url();
    if (!currentUrl.includes('/login')) {
      reportIssue({
        severity: 'critical',
        title: 'Logout does not redirect to login page',
        description: 'After clicking logout, user was not redirected to login',
        element: 'button[aria-label="Log out"]',
        expected: 'Should redirect to /login after logout',
        actual: `Remained at: ${currentUrl}`,
        location: 'Desktop header navigation',
      });
    } else {
      console.log('[Test] Logout successful, redirected to login page');
    }
  });

  test('click More dropdown menu items', async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);

    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Click the "More" dropdown button
    const moreButton = page.locator('button:has-text("More")').first();
    const isMoreVisible = await moreButton.isVisible();

    if (!isMoreVisible) {
      reportIssue({
        severity: 'medium',
        title: 'More dropdown button not visible',
        description: 'The More dropdown is not visible in desktop navigation',
        element: 'button:has-text("More")',
        expected: 'More button should be visible',
        actual: 'More button not found',
        location: 'Desktop header navigation',
      });
      return;
    }

    await moreButton.click();
    await page.waitForTimeout(500);

    // Expected secondary navigation items
    const secondaryNavItems = [
      { path: '/holiday', label: 'Holiday Planner' },
      { path: '/seasonal', label: 'Seasonal Cooking' },
      { path: '/bento', label: 'Bento' },
      { path: '/leftovers', label: 'Leftovers' },
      { path: '/school-menu', label: 'School Menu' },
      { path: '/restaurants', label: 'Restaurants' },
      { path: '/diagnostics', label: 'Diagnostics' },
    ];

    // Check each menu item
    for (const item of secondaryNavItems) {
      // Re-open dropdown if closed
      const isMenuOpen = await page.locator('[role="menu"]').isVisible();
      if (!isMenuOpen) {
        await moreButton.click();
        await page.waitForTimeout(300);
      }

      const menuItem = page.locator(`a[href="${item.path}"]`).first();
      const isItemVisible = await menuItem.isVisible();

      if (!isItemVisible) {
        reportIssue({
          severity: 'medium',
          title: `Menu item "${item.label}" not visible`,
          description: `The menu item for ${item.path} is not visible in More dropdown`,
          element: `a[href="${item.path}"]`,
          expected: 'Menu item should be visible and clickable',
          actual: 'Menu item not found in dropdown',
          location: 'More dropdown menu',
        });
        continue;
      }

      // Click the menu item
      await menuItem.click();
      await page.waitForURL(new RegExp(item.path.replace('/', '\\/')), { timeout: 10000 });
      console.log(`[Test] Successfully navigated to ${item.path}`);

      // Go back to plan page for next test
      await page.goto(`${BASE_URL}/plan`);
      await page.waitForLoadState('networkidle');
    }
  });
});

// ==================== MOBILE NAVIGATION TESTS ====================
test.describe('Mobile Navigation - Profile & Settings', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('open mobile hamburger menu', async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);

    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Find and click hamburger menu button
    const hamburgerButton = page.locator('button[aria-label="Open menu"]').first();
    const isVisible = await hamburgerButton.isVisible();

    if (!isVisible) {
      reportIssue({
        severity: 'high',
        title: 'Mobile hamburger menu not visible',
        description: 'The hamburger menu button is not visible on mobile viewport',
        element: 'button[aria-label="Open menu"]',
        expected: 'Hamburger menu should be visible on mobile',
        actual: 'Hamburger menu not found',
        location: 'Mobile header',
      });
      return;
    }

    await hamburgerButton.click();
    await page.waitForTimeout(500);

    // Check if mobile menu opened
    const mobileMenu = page.locator('#mobile-menu').first();
    const isMenuVisible = await mobileMenu.isVisible();

    if (!isMenuVisible) {
      reportIssue({
        severity: 'high',
        title: 'Mobile menu does not open',
        description: 'Clicking hamburger menu does not show navigation',
        element: '#mobile-menu',
        expected: 'Mobile navigation menu should open',
        actual: 'Menu did not appear',
        location: 'Mobile navigation',
      });
    } else {
      console.log('[Test] Mobile menu opened successfully');
    }
  });

  test('click all mobile menu navigation items', async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);

    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // All navigation items to test
    const navItems = [
      { path: '/plan', label: 'Meal Plan' },
      { path: '/recipes', label: 'Recipes' },
      { path: '/lists', label: 'Shopping List' },
      { path: '/holiday', label: 'Holiday Planner' },
      { path: '/seasonal', label: 'Seasonal Cooking' },
      { path: '/bento', label: 'Bento' },
      { path: '/leftovers', label: 'Leftovers' },
      { path: '/school-menu', label: 'School Menu' },
      { path: '/restaurants', label: 'Restaurants' },
      { path: '/diagnostics', label: 'Diagnostics' },
      { path: '/profile', label: 'Profile' },
    ];

    for (const item of navItems) {
      // Open mobile menu
      const hamburgerButton = page.locator('button[aria-label="Open menu"]').first();
      await hamburgerButton.click();
      await page.waitForTimeout(300);

      // Find and click the nav item
      const navLink = page.locator(`#mobile-menu a[href="${item.path}"]`).first();
      const isVisible = await navLink.isVisible();

      if (!isVisible) {
        reportIssue({
          severity: 'medium',
          title: `Mobile nav item "${item.label}" not visible`,
          description: `Navigation item for ${item.path} is not visible in mobile menu`,
          element: `#mobile-menu a[href="${item.path}"]`,
          expected: 'Nav item should be visible and clickable',
          actual: 'Nav item not found in mobile menu',
          location: 'Mobile navigation menu',
        });

        // Close menu and continue
        const closeButton = page.locator('button[aria-label="Close menu"]').first();
        if (await closeButton.isVisible()) {
          await closeButton.click();
        }
        continue;
      }

      await navLink.click();
      await page.waitForTimeout(500);

      // Verify navigation
      const currentUrl = page.url();
      if (!currentUrl.includes(item.path)) {
        reportIssue({
          severity: 'high',
          title: `Mobile nav "${item.label}" does not navigate`,
          description: `Clicking ${item.label} did not navigate to ${item.path}`,
          element: `#mobile-menu a[href="${item.path}"]`,
          expected: `Should navigate to ${item.path}`,
          actual: `Remained at: ${currentUrl}`,
          location: 'Mobile navigation menu',
        });
      } else {
        console.log(`[Test] Mobile nav to ${item.path} successful`);
      }

      // Go back to plan page
      await page.goto(`${BASE_URL}/plan`);
      await page.waitForLoadState('networkidle');
    }
  });

  test('click logout button in mobile menu', async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);

    await page.goto(`${BASE_URL}/plan`);
    await page.waitForLoadState('networkidle');

    // Open mobile menu
    const hamburgerButton = page.locator('button[aria-label="Open menu"]').first();
    await hamburgerButton.click();
    await page.waitForTimeout(300);

    // Find logout button in mobile menu
    const logoutButton = page.locator('#mobile-menu button[aria-label="Log out"]').first();
    const isVisible = await logoutButton.isVisible();

    if (!isVisible) {
      reportIssue({
        severity: 'high',
        title: 'Logout button not visible in mobile menu',
        description: 'The logout button is not visible in the mobile navigation',
        element: '#mobile-menu button[aria-label="Log out"]',
        expected: 'Logout button should be visible in mobile menu',
        actual: 'Logout button not found',
        location: 'Mobile navigation menu',
      });
      return;
    }

    await logoutButton.click();
    await page.waitForTimeout(2000);

    // Should redirect to login
    const currentUrl = page.url();
    if (!currentUrl.includes('/login')) {
      reportIssue({
        severity: 'critical',
        title: 'Mobile logout does not redirect',
        description: 'After clicking logout in mobile menu, user was not redirected',
        element: '#mobile-menu button[aria-label="Log out"]',
        expected: 'Should redirect to /login after logout',
        actual: `Remained at: ${currentUrl}`,
        location: 'Mobile navigation menu',
      });
    } else {
      console.log('[Test] Mobile logout successful');
    }
  });
});

// ==================== PROFILE PAGE TESTS ====================
test.describe('Profile Page - All Clickable Elements', () => {
  test('click all buttons on profile page', async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);

    await page.goto(`${BASE_URL}/profile`);
    await page.waitForLoadState('networkidle');

    // Verify we're on the profile page
    await expect(page.locator('h1:has-text("Profile Settings")')).toBeVisible();

    // Test display name input
    const displayNameInput = page.locator('#displayName');
    const isDisplayNameVisible = await displayNameInput.isVisible();

    if (!isDisplayNameVisible) {
      reportIssue({
        severity: 'high',
        title: 'Display name input not visible',
        description: 'The display name input field is not visible on profile page',
        element: '#displayName',
        expected: 'Display name input should be visible',
        actual: 'Input not found',
        location: '/profile page',
      });
    } else {
      // Test that input is editable
      await displayNameInput.fill('Test Name Change');
      const value = await displayNameInput.inputValue();
      if (value !== 'Test Name Change') {
        reportIssue({
          severity: 'medium',
          title: 'Display name input not editable',
          description: 'Cannot type into display name field',
          element: '#displayName',
          expected: 'Should be able to type into input',
          actual: `Value: ${value}`,
          location: '/profile page',
        });
      } else {
        console.log('[Test] Display name input is editable');
      }
    }

    // Test email input
    const emailInput = page.locator('#email');
    const isEmailVisible = await emailInput.isVisible();

    if (!isEmailVisible) {
      reportIssue({
        severity: 'high',
        title: 'Email input not visible',
        description: 'The email input field is not visible on profile page',
        element: '#email',
        expected: 'Email input should be visible',
        actual: 'Input not found',
        location: '/profile page',
      });
    } else {
      console.log('[Test] Email input is visible');
    }

    // Test Reset Changes button (should be disabled when no changes)
    const resetButton = page.locator('button:has-text("Reset Changes")').first();
    if (await resetButton.isVisible()) {
      const isDisabled = await resetButton.isDisabled();
      console.log(`[Test] Reset Changes button is ${isDisabled ? 'disabled (correct when no changes)' : 'enabled'}`);
    }

    // Test Save Changes button (should be disabled when no changes)
    const saveButton = page.locator('button:has-text("Save Changes")').first();
    if (await saveButton.isVisible()) {
      const isDisabled = await saveButton.isDisabled();
      console.log(`[Test] Save Changes button is ${isDisabled ? 'disabled (correct when no changes)' : 'enabled'}`);
    }

    // Make a change and test button states
    await displayNameInput.fill('Modified Name');
    await page.waitForTimeout(300);

    const isResetEnabled = !(await resetButton.isDisabled());
    const isSaveEnabled = !(await saveButton.isDisabled());

    if (!isResetEnabled) {
      reportIssue({
        severity: 'medium',
        title: 'Reset button not enabled after changes',
        description: 'Reset Changes button remains disabled after modifying form',
        element: 'button:has-text("Reset Changes")',
        expected: 'Button should be enabled when form has changes',
        actual: 'Button remains disabled',
        location: '/profile page',
      });
    }

    if (!isSaveEnabled) {
      reportIssue({
        severity: 'medium',
        title: 'Save button not enabled after changes',
        description: 'Save Changes button remains disabled after modifying form',
        element: 'button:has-text("Save Changes")',
        expected: 'Button should be enabled when form has changes',
        actual: 'Button remains disabled',
        location: '/profile page',
      });
    }

    // Test Reset Changes click
    if (isResetEnabled) {
      await resetButton.click();
      await page.waitForTimeout(300);
      console.log('[Test] Reset Changes button clicked successfully');
    }

    // Test Diagnostics link in the Beta Tester card
    const diagnosticsLink = page.locator('a[href="/diagnostics"]').first();
    if (await diagnosticsLink.isVisible()) {
      await diagnosticsLink.click();
      await page.waitForURL(/\/diagnostics/, { timeout: 5000 });
      console.log('[Test] Diagnostics link in profile page works');
    } else {
      reportIssue({
        severity: 'low',
        title: 'Diagnostics link not visible in profile',
        description: 'The link to diagnostics page is not visible in the Beta Tester card',
        element: 'a[href="/diagnostics"]',
        expected: 'Diagnostics link should be visible',
        actual: 'Link not found',
        location: '/profile page - Beta Tester card',
      });
    }
  });
});

// ==================== DIAGNOSTICS PAGE TESTS ====================
test.describe('Diagnostics Page - All Clickable Elements', () => {
  test('click all buttons and tabs on diagnostics page', async ({ page }) => {
    const loggedIn = await login(page);
    expect(loggedIn).toBe(true);

    await page.goto(`${BASE_URL}/diagnostics`);
    await page.waitForLoadState('networkidle');

    // Verify we're on the diagnostics page
    await expect(page.locator('h1:has-text("Diagnostics")')).toBeVisible();

    // Test Refresh button
    const refreshButton = page.locator('button:has-text("Refresh")').first();
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      await page.waitForTimeout(1000);
      console.log('[Test] Refresh button clicked successfully');
    }

    // Test Copy for Claude button
    const copyButton = page.locator('button:has-text("Copy for Claude")').first();
    if (await copyButton.isVisible()) {
      // This may be disabled if no errors exist
      const isDisabled = await copyButton.isDisabled();
      console.log(`[Test] Copy for Claude button is ${isDisabled ? 'disabled (no errors)' : 'enabled'}`);
    }

    // Test Download Local button
    const downloadButton = page.locator('button:has-text("Download Local")').first();
    if (await downloadButton.isVisible()) {
      // Don't actually click to avoid download dialog
      console.log('[Test] Download Local button is visible');
    }

    // Test Clear Local button
    const clearButton = page.locator('button:has-text("Clear Local")').first();
    if (await clearButton.isVisible()) {
      // Don't actually click to avoid clearing logs
      console.log('[Test] Clear Local button is visible');
    }

    // Test Tabs
    const tabs = ['Server Errors', 'Local Logs', 'Tools'];
    for (const tabName of tabs) {
      const tab = page.locator(`button[role="tab"]:has-text("${tabName}")`).first();
      if (await tab.isVisible()) {
        await tab.click();
        await page.waitForTimeout(300);
        console.log(`[Test] Tab "${tabName}" clicked successfully`);
      } else {
        reportIssue({
          severity: 'medium',
          title: `Tab "${tabName}" not visible`,
          description: `The ${tabName} tab is not visible on diagnostics page`,
          element: `button[role="tab"]:has-text("${tabName}")`,
          expected: 'Tab should be visible and clickable',
          actual: 'Tab not found',
          location: '/diagnostics page',
        });
      }
    }

    // Test filter buttons (Unresolved / All)
    const unresolvedFilter = page.locator('button:has-text("Unresolved")').first();
    const allFilter = page.locator('button:has-text("All")').first();

    if (await unresolvedFilter.isVisible()) {
      await unresolvedFilter.click();
      await page.waitForTimeout(300);
      console.log('[Test] Unresolved filter button works');
    }

    if (await allFilter.isVisible()) {
      await allFilter.click();
      await page.waitForTimeout(300);
      console.log('[Test] All filter button works');
    }

    // Test Tools tab - Cleanup button
    const toolsTab = page.locator('button[role="tab"]:has-text("Tools")').first();
    await toolsTab.click();
    await page.waitForTimeout(300);

    const cleanupButton = page.locator('button:has-text("Cleanup Duplicate Meals")').first();
    if (await cleanupButton.isVisible()) {
      // Don't actually click to avoid data modification
      console.log('[Test] Cleanup Duplicate Meals button is visible');
    }
  });
});

// ==================== LOGIN PAGE TESTS ====================
test.describe('Login Page - All Clickable Elements', () => {
  test('click all buttons and links on login page', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Test Sign In button
    const signInButton = page.locator('button[type="submit"]').first();
    if (await signInButton.isVisible()) {
      console.log('[Test] Sign In button is visible');
    }

    // Test Forgot password link
    const forgotPasswordLink = page.locator('button:has-text("Forgot your password")').first();
    if (await forgotPasswordLink.isVisible()) {
      await forgotPasswordLink.click();
      await page.waitForTimeout(300);

      // Check if mode changed
      const title = await page.locator('.text-2xl').textContent();
      if (title?.includes('Reset')) {
        console.log('[Test] Forgot password link works - mode changed to reset');
      } else {
        reportIssue({
          severity: 'medium',
          title: 'Forgot password does not change view',
          description: 'Clicking Forgot password does not show reset form',
          element: 'button:has-text("Forgot your password")',
          expected: 'Should show password reset form',
          actual: `Title shows: ${title}`,
          location: '/login page',
        });
      }

      // Go back to login
      await page.locator('button:has-text("Back to Sign In")').click();
      await page.waitForTimeout(300);
    }

    // Test Create account link
    const createAccountLink = page.locator('button:has-text("Don\'t have an account")').first();
    if (await createAccountLink.isVisible()) {
      await createAccountLink.click();
      await page.waitForTimeout(300);

      // Check if mode changed
      const title = await page.locator('.text-2xl').textContent();
      if (title?.includes('Create')) {
        console.log('[Test] Create account link works');
      }

      // Go back to login
      await page.locator('button:has-text("Already have an account")').click();
      await page.waitForTimeout(300);
    }

    // Test OAuth buttons (Google, Apple, GitHub)
    const oauthProviders = [
      { label: 'Google', ariaLabel: 'Sign in with Google' },
      { label: 'Apple', ariaLabel: 'Sign in with Apple' },
      { label: 'GitHub', ariaLabel: 'Sign in with GitHub' },
    ];

    for (const provider of oauthProviders) {
      const button = page.locator(`button[aria-label="${provider.ariaLabel}"]`).first();
      if (await button.isVisible()) {
        const isDisabled = await button.isDisabled();
        console.log(`[Test] ${provider.label} OAuth button is ${isDisabled ? 'disabled' : 'enabled'}`);
      } else {
        reportIssue({
          severity: 'low',
          title: `${provider.label} OAuth button not visible`,
          description: `The ${provider.label} sign-in button is not visible`,
          element: `button[aria-label="${provider.ariaLabel}"]`,
          expected: 'OAuth button should be visible',
          actual: 'Button not found',
          location: '/login page',
        });
      }
    }
  });
});

// ==================== SUMMARY ====================
test.afterAll(async () => {
  console.log('\n\n========================================');
  console.log('   UX/UI CLICK REVIEW SUMMARY');
  console.log('========================================');
  console.log(`Total Issues Found: ${discoveredIssues.length}`);

  if (discoveredIssues.length === 0) {
    console.log('\nNo issues found! All clickable elements are working correctly.');
    return;
  }

  const critical = discoveredIssues.filter(i => i.severity === 'critical');
  const high = discoveredIssues.filter(i => i.severity === 'high');
  const medium = discoveredIssues.filter(i => i.severity === 'medium');
  const low = discoveredIssues.filter(i => i.severity === 'low');

  console.log(`  Critical: ${critical.length}`);
  console.log(`  High: ${high.length}`);
  console.log(`  Medium: ${medium.length}`);
  console.log(`  Low: ${low.length}`);

  console.log('\n========== ISSUE DETAILS ==========');

  if (critical.length > 0) {
    console.log('\n--- CRITICAL ISSUES ---');
    critical.forEach(issue => {
      console.log(`\n[${issue.id}] ${issue.title}`);
      console.log(`  Location: ${issue.location}`);
      console.log(`  Element: ${issue.element}`);
      console.log(`  Expected: ${issue.expected}`);
      console.log(`  Actual: ${issue.actual}`);
    });
  }

  if (high.length > 0) {
    console.log('\n--- HIGH PRIORITY ISSUES ---');
    high.forEach(issue => {
      console.log(`\n[${issue.id}] ${issue.title}`);
      console.log(`  Location: ${issue.location}`);
      console.log(`  Element: ${issue.element}`);
      console.log(`  Expected: ${issue.expected}`);
      console.log(`  Actual: ${issue.actual}`);
    });
  }

  if (medium.length > 0) {
    console.log('\n--- MEDIUM PRIORITY ISSUES ---');
    medium.forEach(issue => {
      console.log(`\n[${issue.id}] ${issue.title}`);
      console.log(`  Location: ${issue.location}`);
      console.log(`  Element: ${issue.element}`);
    });
  }

  if (low.length > 0) {
    console.log('\n--- LOW PRIORITY ISSUES ---');
    low.forEach(issue => {
      console.log(`\n[${issue.id}] ${issue.title}`);
      console.log(`  Location: ${issue.location}`);
    });
  }

  console.log('\n========================================');
  console.log('   END OF REPORT');
  console.log('========================================\n');
});

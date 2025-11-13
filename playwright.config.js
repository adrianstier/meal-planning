/**
 * Playwright Configuration
 * Optimized for mobile testing with multiple devices
 *
 * Run tests: npx playwright test
 * Run mobile tests: npx playwright test tests/mobile.spec.js
 * Run with UI: npx playwright test --ui
 * Run specific device: npx playwright test --project="Mobile Safari"
 * Generate report: npx playwright show-report
 */

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // Test directory
  testDir: './tests',

  // Maximum time one test can run
  timeout: 60 * 1000,

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Number of parallel workers
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],

  // Shared settings for all tests
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env.BASE_URL || 'http://localhost:5001',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Record video on failure
    video: 'retain-on-failure',
  },

  // Configure projects for major browsers and mobile devices
  projects: [
    // Desktop browsers (for comparison)
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'Desktop Firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'Desktop Safari',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile devices - iOS
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 12'],
        // iPhone 12 specific settings
        viewport: { width: 390, height: 844 },
        userAgent: devices['iPhone 12'].userAgent,
      },
    },

    {
      name: 'iPhone SE',
      use: {
        ...devices['iPhone SE'],
        // Smaller iPhone for testing compact layouts
        viewport: { width: 375, height: 667 },
      },
    },

    {
      name: 'iPhone 13 Pro',
      use: {
        ...devices['iPhone 13 Pro'],
        viewport: { width: 390, height: 844 },
      },
    },

    {
      name: 'iPad Mini',
      use: {
        ...devices['iPad Mini'],
        // Tablet testing
        viewport: { width: 768, height: 1024 },
      },
    },

    // Mobile devices - Android
    {
      name: 'Pixel 5',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 393, height: 851 },
      },
    },

    {
      name: 'Galaxy S9+',
      use: {
        ...devices['Galaxy S9+'],
        viewport: { width: 412, height: 846 },
      },
    },

    {
      name: 'Galaxy Tab S4',
      use: {
        ...devices['Galaxy Tab S4'],
        // Android tablet
        viewport: { width: 712, height: 1138 },
      },
    },

    // Mobile landscape orientations
    {
      name: 'Mobile Safari Landscape',
      use: {
        ...devices['iPhone 12 landscape'],
        viewport: { width: 844, height: 390 },
      },
    },

    {
      name: 'Pixel 5 Landscape',
      use: {
        ...devices['Pixel 5 landscape'],
        viewport: { width: 851, height: 393 },
      },
    },
  ],

  // Run local dev server before starting tests
  webServer: {
    command: 'python3 app.py',
    url: 'http://localhost:5001',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});

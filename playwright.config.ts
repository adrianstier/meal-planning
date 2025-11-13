import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './',
  testMatch: ['**/*.spec.js', '**/e2e/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile devices - iOS
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'iphone-se',
      use: {
        ...devices['iPhone SE'],
        viewport: { width: 375, height: 667 },
      },
    },

    // Mobile devices - Android
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 393, height: 851 },
      },
    },
    {
      name: 'galaxy-s9',
      use: {
        ...devices['Galaxy S9+'],
        viewport: { width: 412, height: 846 },
      },
    },

    // Tablets
    {
      name: 'tablet',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 1024, height: 1366 },
      },
    },
    {
      name: 'tablet-android',
      use: {
        ...devices['Galaxy Tab S4'],
        viewport: { width: 712, height: 1138 },
      },
    },

    // Landscape orientations
    {
      name: 'mobile-landscape',
      use: {
        ...devices['iPhone 12 landscape'],
        viewport: { width: 844, height: 390 },
      },
    },
  ],

  webServer: {
    command: 'python3 app.py',
    url: 'http://localhost:5001',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});

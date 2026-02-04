import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests/user-simulations',
  fullyParallel: false, // Run sequentially to avoid auth conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for sequential execution
  reporter: [['html'], ['list']],
  timeout: 60000, // 60 second timeout per test
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

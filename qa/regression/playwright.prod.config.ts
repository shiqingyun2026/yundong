import { defineConfig, devices } from '@playwright/test'

const consoleProdBaseUrl = process.env.CONSOLE_PROD_BASE_URL || 'https://lindong-console.pages.dev'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: consoleProdBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'console-prod-chromium',
      testMatch: /console\.prod\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome']
      }
    }
  ],
  outputDir: './test-results/prod'
})

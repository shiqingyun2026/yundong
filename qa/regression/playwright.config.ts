import { defineConfig, devices } from '@playwright/test'

const frontendPort = Number(process.env.FRONTEND_PORT || 3000)
const consolePort = Number(process.env.CONSOLE_PORT || 3100)

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${frontendPort}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'frontend-chromium',
      testMatch: /frontend\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome']
      }
    },
    {
      name: 'console-chromium',
      testMatch: /console\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://127.0.0.1:${consolePort}`
      }
    }
  ],
  webServer: [
    {
      command: 'npm run dev',
      cwd: '../../frontend',
      url: `http://127.0.0.1:${frontendPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120000
    },
    {
      command: 'npm run dev',
      cwd: '../../console',
      url: `http://127.0.0.1:${consolePort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120000
    }
  ],
  outputDir: './test-results'
})

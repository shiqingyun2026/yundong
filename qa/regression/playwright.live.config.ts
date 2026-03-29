import { defineConfig, devices } from '@playwright/test'

const consoleApiPort = Number(process.env.CONSOLE_API_PORT || 8100)
const consolePort = Number(process.env.CONSOLE_PORT || 3101)

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${consolePort}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'console-live-chromium',
      testMatch: /console\.live\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome']
      }
    }
  ],
  webServer: [
    {
      command: `CONSOLE_API_PORT=${consoleApiPort} npm run console:dev`,
      cwd: '../../backend',
      url: `http://127.0.0.1:${consoleApiPort}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120000
    },
    {
      command: `VITE_API_BASE_URL=http://127.0.0.1:${consoleApiPort}/api/admin npx vite --port ${consolePort} --host 0.0.0.0`,
      cwd: '../../console',
      url: `http://127.0.0.1:${consolePort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120000
    }
  ],
  outputDir: './test-results/live'
})

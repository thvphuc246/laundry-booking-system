import { defineConfig } from '@playwright/test'
import { API_PORT, E2E_ENV, WEB_PORT } from './e2e/env'

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  globalSetup: './e2e/global-setup.ts',
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: 'en-US',
    timezoneId: 'Europe/Helsinki',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'bun e2e/server.ts',
      url: `http://localhost:${API_PORT}/api/me`,
      env: E2E_ENV,
      reuseExistingServer: false,
    },
    {
      command: `bun x vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { API_PORT: String(API_PORT) },
      reuseExistingServer: false,
    },
  ],
})

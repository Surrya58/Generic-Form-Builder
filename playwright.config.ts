import { defineConfig, devices } from '@playwright/test'

// Defaults to 5173; override with PW_PORT to reuse an already-running dev server
// (e.g. PW_PORT=5174 when 5173 is taken).
const PORT = Number(process.env.PW_PORT ?? 5173)
const BASE_URL = `http://localhost:${String(PORT)}`

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${String(PORT)} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
  },
})

import { defineConfig, devices } from '@playwright/test'

// Defaults to 5173; override with PW_PORT to reuse an already-running dev server
// (e.g. PW_PORT=5174 when 5173 is taken).
const PORT = Number(process.env.PW_PORT ?? 5173)
const BASE_URL = `http://localhost:${String(PORT)}`

// Slow each browser action down by this many ms so a headed run is watchable
// by a human (see the `test:e2e:watch` / `:headed` / `:open` scripts). 0 = full speed.
const SLOW_MO = Number(process.env.PW_SLOWMO ?? 0)
// Auto-open the HTML report when the run finishes (set by `test:e2e:watch`).
const HTML_OPEN = process.env.PW_OPEN_REPORT ? 'always' : 'never'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Always emit the HTML report (so `npm run test:e2e:report` can show the
  // step-by-step trace), plus the live list reporter locally.
  reporter: process.env.CI ? [['html']] : [['list'], ['html', { open: HTML_OPEN }]],
  use: {
    baseURL: BASE_URL,
    // Locally, record a trace + video + screenshots for every test so each
    // test.step() is replayable in the UI / report. Lean in CI.
    trace: process.env.CI ? 'on-first-retry' : 'on',
    video: process.env.CI ? 'retain-on-failure' : 'on',
    screenshot: 'only-on-failure',
    launchOptions: { slowMo: SLOW_MO },
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

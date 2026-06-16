import type { Page } from '@playwright/test'

/**
 * Keep the browser window open after a test finishes, instead of letting
 * Playwright tear it down — useful for visually inspecting the final state.
 *
 * Enabled by the PW_KEEP_OPEN env var (see the `test:e2e:open` npm script).
 * It calls page.pause(), which holds the run open and launches the Playwright
 * Inspector; close the window or press "Resume" there to finish the test.
 *
 * No-op in normal/CI runs, so it never hangs an unattended suite.
 */
export async function keepOpenIfRequested(page: Page): Promise<void> {
  if (process.env.PW_KEEP_OPEN) {
    await page.pause()
  }
}

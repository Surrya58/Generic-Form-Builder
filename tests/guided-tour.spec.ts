import { expect, test } from '@playwright/test'
import { keepOpenIfRequested } from './helpers'

/**
 * A narrated, end-to-end walkthrough of the whole product — built to be WATCHED.
 *
 *   npm run test:e2e:ui      → live, in the Playwright UI (stays open; click to replay steps)
 *   npm run test:e2e:headed  → watch the real browser drive the steps
 *   npm run test:e2e:open    → watch, and the browser STAYS OPEN at the end for inspection
 *   npm run test:e2e:report  → open the HTML report (each test.step is a replayable snapshot)
 *
 * Every action is wrapped in test.step(...) so the labels appear in the UI,
 * the trace, and the HTML report — making the flow self-documenting.
 */
test('guided tour: build → validate → preview → fill → submit → PDF', async ({ page }) => {
  await test.step('1. Open the app on the Forms list', async () => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Forms' })).toBeVisible()
  })

  await test.step('2. Start a new form and give it a title', async () => {
    await page.getByRole('button', { name: 'New form' }).click()
    await page.getByRole('textbox', { name: 'Template title' }).fill('Customer Feedback')
  })

  await test.step('3. Add a Single line text field from the palette', async () => {
    await page.getByRole('button', { name: 'Single line text' }).click()
  })

  await test.step('4. Saving without a label is blocked — error summary AND a red border on the field', async () => {
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('alert')).toContainText(/missing a label/i)
    // The offending field card is flagged invalid (the red-border fix).
    await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible()
  })

  await test.step('5. Give the field a label — the red border clears live', async () => {
    await page.getByLabel('Label').fill('What did you think?')
    await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0)
  })

  await test.step('6. Preview opens a centered dialog showing the field', async () => {
    await page.getByRole('button', { name: 'Preview' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('What did you think?')).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toBeHidden()
  })

  await test.step('7. Save the template (Save then disables — no unsaved changes)', async () => {
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  await test.step('8. Go back to the list; the saved form is there', async () => {
    await page.getByRole('button', { name: /Templates/ }).click()
    await expect(page.getByText('Customer Feedback')).toBeVisible()
  })

  await test.step('9. Start a response and submit it', async () => {
    await page.getByRole('button', { name: 'New response' }).click()
    await expect(page.getByRole('heading', { name: 'Customer Feedback' })).toBeVisible()
    await page.getByRole('textbox', { name: /What did you think/ }).fill('Loved it!')
    await page.getByRole('button', { name: 'Submit' }).click()
  })

  await test.step('10. The response is recorded with a PDF download', async () => {
    await expect(page.getByText('1 response')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible()
  })

  // With PW_KEEP_OPEN (the test:e2e:open script), pause here so the browser
  // stays open for inspection instead of closing.
  await keepOpenIfRequested(page)
})

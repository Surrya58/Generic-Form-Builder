import { expect, test } from '@playwright/test'

test.describe('routing', () => {
  test('home shows the forms list', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Forms' })).toBeVisible()
  })

  test('unknown routes show a not-found screen', async ({ page }) => {
    await page.goto('/no/such/route')
    await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible()
  })
})

test.describe('happy path', () => {
  test('build a form, save it, fill it out, and submit a response', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'New form' }).click()

    // Builder: set a title and add one required single-line text field.
    await page.getByRole('textbox', { name: 'Template title' }).fill('My Survey')
    await page.getByRole('button', { name: 'Single line text' }).click()
    await page.getByLabel('Label').fill('Your name')
    await page.getByRole('checkbox', { name: 'Required' }).check()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()

    // Back home: the saved form appears with its field count.
    await page.getByRole('link', { name: /Templates/ }).click()
    await expect(page.getByText('My Survey')).toBeVisible()
    await expect(page.getByText('1 field · 0 responses')).toBeVisible()

    // Start a response.
    await page.getByRole('button', { name: 'New response' }).click()
    await expect(page.getByRole('heading', { name: 'My Survey' })).toBeVisible()

    // The required field blocks an empty submit.
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByText(/please fix/i)).toBeVisible()

    // Fill it in and submit.
    await page.getByRole('textbox', { name: /Your name/ }).fill('Ada Lovelace')
    await page.getByRole('button', { name: 'Submit' }).click()

    // Lands on the instances list with one response and a PDF download.
    await expect(page.getByText('1 response')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible()
  })

  test('a saved template survives a full page refresh', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'New form' }).click()
    await page.getByRole('textbox', { name: 'Template title' }).fill('Persisted Form')
    await page.getByRole('button', { name: 'Single line text' }).click()
    await page.getByLabel('Label').fill('Field one')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()

    await page.reload()
    await expect(page.getByRole('textbox', { name: 'Template title' })).toHaveValue('Persisted Form')
  })
})

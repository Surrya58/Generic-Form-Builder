import { expect, test } from '@playwright/test'

test.describe('routing', () => {
  test('home shows the forms list', async ({ page }) => {
    await test.step('Open the home route', async () => {
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'Forms' })).toBeVisible()
    })
  })

  test('unknown routes show a not-found screen', async ({ page }) => {
    await test.step('Visit an unknown route', async () => {
      await page.goto('/no/such/route')
      await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible()
    })
  })
})

test.describe('happy path', () => {
  test('build a form, save it, fill it out, and submit a response', async ({ page }) => {
    await test.step('Open the app and start a new form', async () => {
      await page.goto('/')
      await page.getByRole('button', { name: 'New form' }).click()
    })

    await test.step('Configure a required single-line text field', async () => {
      await page.getByRole('textbox', { name: 'Template title' }).fill('My Survey')
      await page.getByRole('button', { name: 'Single line text' }).click()
      await page.getByLabel('Label').fill('Your name')
      await page.getByRole('checkbox', { name: 'Required' }).check()
    })

    await test.step('Save the template; Save then disables', async () => {
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
    })

    await test.step('Return to the list and confirm the saved form is shown', async () => {
      await page.getByRole('button', { name: /Templates/ }).click()
      await expect(page.getByText('My Survey')).toBeVisible()
      await expect(page.getByText('1 field · 0 responses')).toBeVisible()
    })

    await test.step('Start a response', async () => {
      await page.getByRole('button', { name: 'New response' }).click()
      await expect(page.getByRole('heading', { name: 'My Survey' })).toBeVisible()
    })

    await test.step('An empty required field blocks submit', async () => {
      await page.getByRole('button', { name: 'Submit' }).click()
      await expect(page.getByText(/please fix/i)).toBeVisible()
    })

    await test.step('Fill the field and submit', async () => {
      await page.getByRole('textbox', { name: /Your name/ }).fill('Ada Lovelace')
      await page.getByRole('button', { name: 'Submit' }).click()
    })

    await test.step('The response is recorded with a PDF download', async () => {
      await expect(page.getByText('1 response')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible()
    })
  })

  test('a saved template survives a full page refresh', async ({ page }) => {
    await test.step('Build and save a template', async () => {
      await page.goto('/')
      await page.getByRole('button', { name: 'New form' }).click()
      await page.getByRole('textbox', { name: 'Template title' }).fill('Persisted Form')
      await page.getByRole('button', { name: 'Single line text' }).click()
      await page.getByLabel('Label').fill('Field one')
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
    })

    await test.step('Reload and confirm it persisted', async () => {
      await page.reload()
      await expect(page.getByRole('textbox', { name: 'Template title' })).toHaveValue(
        'Persisted Form',
      )
    })
  })
})

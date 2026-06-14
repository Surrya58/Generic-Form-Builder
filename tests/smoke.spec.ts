import { expect, test } from '@playwright/test'

test.describe('routing smoke test', () => {
  test('/ renders the templates list placeholder', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Templates' })).toBeVisible()
  })

  test('/builder/:templateId renders the builder placeholder with the route param', async ({
    page,
  }) => {
    await page.goto('/builder/template-123')
    await expect(page.getByRole('heading', { name: 'Builder' })).toBeVisible()
    await expect(page.getByText('template-123')).toBeVisible()
  })

  test('/fill/:templateId/:instanceId renders the fill placeholder with both route params', async ({
    page,
  }) => {
    await page.goto('/fill/template-123/instance-456')
    await expect(page.getByRole('heading', { name: 'Fill' })).toBeVisible()
    await expect(page.getByText('template-123')).toBeVisible()
    await expect(page.getByText('instance-456')).toBeVisible()
  })

  test('/templates/:templateId/instances renders the instances list placeholder', async ({
    page,
  }) => {
    await page.goto('/templates/template-123/instances')
    await expect(page.getByRole('heading', { name: 'Instances' })).toBeVisible()
    await expect(page.getByText('template-123')).toBeVisible()
  })

  test('unknown routes render the not found placeholder', async ({ page }) => {
    await page.goto('/this/route/does/not/exist')
    await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible()
  })

  test('a full page refresh re-mounts the same screen', async ({ page }) => {
    await page.goto('/builder/template-123')
    await expect(page.getByRole('heading', { name: 'Builder' })).toBeVisible()

    await page.reload()

    await expect(page.getByRole('heading', { name: 'Builder' })).toBeVisible()
    await expect(page.getByText('template-123')).toBeVisible()
  })
})

import { test, expect } from '@playwright/test'

function uniqueEmail() {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`
}

async function loginNew(page: Parameters<Parameters<typeof test>[1]>[0]) {
  await page.goto('/register')
  await page.getByLabel('Name').fill('E2E Tester')
  await page.getByLabel('Email').fill(uniqueEmail())
  await page.getByLabel('Password').fill('password123!')
  await page.getByRole('button', { name: 'Register' }).click()
  await page.waitForURL('/dashboard')
}

test.describe('Projects', () => {
  test('new user sees empty state', async ({ page }) => {
    await loginNew(page)
    await expect(page.getByText('No projects yet')).toBeVisible()
  })

  test('create project → visible in dashboard', async ({ page }) => {
    await loginNew(page)

    await page.getByRole('link', { name: 'New Project' }).click()
    await page.waitForURL('/projects/new')

    const projectName = `E2E Project ${Date.now()}`
    await page.getByPlaceholder('My Marketing Campaign').fill(projectName)
    await page.getByRole('button', { name: 'Create Project' }).click()

    // redirects to project tasks page
    await page.waitForURL(/\/projects\/[0-9a-f-]+$/)

    // back to dashboard — project should appear
    await page.goto('/dashboard')
    await expect(page.getByText(projectName)).toBeVisible()
  })

  test('project page shows task creation form', async ({ page }) => {
    await loginNew(page)

    await page.getByRole('link', { name: 'New Project' }).click()
    await page.getByPlaceholder('My Marketing Campaign').fill('Task Form Test')
    await page.getByRole('button', { name: 'Create Project' }).click()
    await page.waitForURL(/\/projects\/[0-9a-f-]+$/)

    await expect(page.getByRole('heading', { name: 'New Task' })).toBeVisible()
    await expect(page.getByPlaceholder('Describe your task...')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Task' })).toBeVisible()
  })
})

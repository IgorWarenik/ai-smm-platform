import { test, expect } from '@playwright/test'

function uniqueEmail() {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`
}

async function loginNew(page: Parameters<Parameters<typeof test>[1]>[0]) {
  await page.goto('/register')
  await page.locator('input[type="text"]').fill('E2E Tester')
  await page.locator('input[type="email"]').fill(uniqueEmail())
  await page.locator('input[type="password"]').fill('password123!')
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click()
  await page.waitForURL('/dashboard')
}

test.describe('Projects', () => {
  test('new user sees empty state', async ({ page }) => {
    await loginNew(page)
    await expect(page.getByText('Нет проектов')).toBeVisible()
  })

  test('create project → visible in dashboard', async ({ page }) => {
    await loginNew(page)

    await page.getByRole('link', { name: 'Новый проект' }).first().click()
    await page.waitForURL('/projects/new')

    const projectName = `E2E Project ${Date.now()}`
    await page.getByPlaceholder('Название проекта').fill(projectName)
    await page.getByRole('button', { name: 'Создать проект' }).click()

    await page.waitForURL('/dashboard')

    await expect(page.getByText(projectName)).toBeVisible()
  })

  test('project page shows task creation form', async ({ page }) => {
    await loginNew(page)

    await page.getByRole('link', { name: 'Новый проект' }).first().click()
    await page.waitForURL('/projects/new')
    await page.getByPlaceholder('Название проекта').fill('Task Form Test')
    await page.getByRole('button', { name: 'Создать проект' }).click()

    await page.waitForURL('/dashboard')

    // Navigate to tasks page to verify task creation is available
    await page.getByRole('link', { name: 'Задачи' }).click()
    await expect(page.getByRole('button', { name: '+ Новая задача' })).toBeVisible()
  })
})

import { test, expect } from '@playwright/test'

function uniqueEmail() {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`
}

async function register(page: Parameters<Parameters<typeof test>[1]>[0], email: string) {
  await page.goto('/register')
  await page.locator('input[type="text"]').fill('E2E Tester')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill('password123!')
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click()
  await page.waitForURL('/dashboard')
}

test.describe('Authentication', () => {
  test('register → dashboard', async ({ page }) => {
    await register(page, uniqueEmail())
    await expect(page.getByText('Выберите проект')).toBeVisible()
  })

  test('logout → /login, then login → dashboard', async ({ page }) => {
    const email = uniqueEmail()
    await register(page, email)

    // TopBar: click user avatar to open menu, then click Выйти
    await page.locator('header button.rounded-full').click()
    await page.getByRole('button', { name: 'Выйти' }).click()
    await page.waitForURL('/login')

    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill('password123!')
    await page.getByRole('button', { name: 'Войти' }).click()
    await page.waitForURL('/dashboard')
    await expect(page.getByText('Выберите проект')).toBeVisible()
  })

  test('wrong password → error visible', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill('nobody@e2e.test')
    await page.locator('input[type="password"]').fill('wrongpassword')
    await page.getByRole('button', { name: 'Войти' }).click()
    await expect(page.getByText('Invalid credentials')).toBeVisible()
  })

  test('unauthenticated /dashboard → redirect to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})

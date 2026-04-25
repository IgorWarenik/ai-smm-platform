import { test, expect } from '@playwright/test'

function uniqueEmail() {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`
}

async function register(page: Parameters<Parameters<typeof test>[1]>[0], email: string) {
  await page.goto('/register')
  await page.locator('input[type="text"]').fill('E2E Tester')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill('password123!')
  await page.getByRole('button', { name: 'Register' }).click()
  await page.waitForURL('/dashboard')
}

test.describe('Authentication', () => {
  test('register → dashboard', async ({ page }) => {
    await register(page, uniqueEmail())
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
  })

  test('logout → /login, then login → dashboard', async ({ page }) => {
    const email = uniqueEmail()
    await register(page, email)

    await page.getByRole('button', { name: 'Logout' }).click()
    await page.waitForURL('/login')

    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill('password123!')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForURL('/dashboard')
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
  })

  test('wrong password → error visible', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill('nobody@e2e.test')
    await page.locator('input[type="password"]').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.locator('p.text-red-600')).toBeVisible()
  })

  test('unauthenticated /dashboard → redirect to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/login')
  })
})

import { test, expect } from '@playwright/test'

test.describe('Home Page', () => {
  test('should display the navbar', async ({ page }) => {
    await page.goto('/')
    
    // Check for navbar brand
    await expect(page.locator('nav')).toBeVisible()
    await expect(page.getByText('Better Auth')).toBeVisible()
    await expect(page.getByText('Paystack')).toBeVisible()
  })

  test('should have sign in buttons when not authenticated', async ({ page }) => {
    await page.goto('/')
    
    await expect(page.getByRole('button', { name: 'Guest Sign In' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign Up' })).toBeVisible()
  })
})

test.describe('Authentication Flow', () => {
  test('should sign in as guest and navigate to dashboard', async ({ page }) => {
    await page.goto('/')
    
    // Click guest sign in
    await page.getByRole('button', { name: 'Guest Sign In' }).click()
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/)
    
    // Should show dashboard content
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible()
  })

  test('should sign out and return to home', async ({ page }) => {
    // First sign in
    await page.goto('/')
    await page.getByRole('button', { name: 'Guest Sign In' }).click()
    await expect(page).toHaveURL(/.*dashboard/)
    
    // Then sign out
    await page.getByRole('button', { name: 'Sign Out' }).click()
    
    // Should return to home without session
    await expect(page.getByRole('button', { name: 'Guest Sign In' })).toBeVisible()
  })
})

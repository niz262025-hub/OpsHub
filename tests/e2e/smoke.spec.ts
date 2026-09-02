import { expect, test } from '@playwright/test';

const appUrl = process.env.BASE_URL || 'http://localhost:3000';

test.describe('OpsHub public smoke checks', () => {
  test('loads the home page', async ({ page }) => {
    const response = await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    expect(response).not.toBeNull();
    await expect(page).toHaveTitle(/OpsHub|Private trade, built on trust/i);
  });

  test('public marketplace page loads', async ({ page }) => {
    await page.goto(`${appUrl}/marketplace`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Product foundation/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/MARKETPLACE/i)).toBeVisible({ timeout: 15000 });
  });

  test('public product route handles missing product gracefully', async ({ page }) => {
    const response = await page.goto(`${appUrl}/products/does-not-exist`, { waitUntil: 'domcontentloaded' });
    await expect(response?.status()).toBeLessThan(500);
  });

  test('auth pages load', async ({ page }) => {
    await page.goto(`${appUrl}/auth/login`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Seller login/i)).toBeVisible({ timeout: 15000 });

    await page.goto(`${appUrl}/auth/register`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Request access/i })).toBeVisible({ timeout: 15000 });
  });

  test('public navigation links are available', async ({ page }) => {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: 'Become a seller' })).toBeVisible({ timeout: 15000 });
  });
});

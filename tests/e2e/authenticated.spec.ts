import { expect, test } from '@playwright/test';

const requiredKeys = [
  'BASE_URL',
  'PLAYWRIGHT_TEST_CUSTOMER_EMAIL',
  'PLAYWRIGHT_TEST_SELLER_EMAIL',
  'PLAYWRIGHT_TEST_ADMIN_EMAIL',
  'PLAYWRIGHT_TEST_PASSWORD',
] as const;

const missingKeys = requiredKeys.filter((key) => !process.env[key] || process.env[key]?.trim() === '');
const baseURL = process.env.BASE_URL?.trim();
const sellerEmail = process.env.PLAYWRIGHT_TEST_SELLER_EMAIL?.trim();
const customerEmail = process.env.PLAYWRIGHT_TEST_CUSTOMER_EMAIL?.trim();
const adminEmail = process.env.PLAYWRIGHT_TEST_ADMIN_EMAIL?.trim();
const password = process.env.PLAYWRIGHT_TEST_PASSWORD?.trim();

const hasAuthConfig = Boolean(baseURL && sellerEmail && customerEmail && adminEmail && password);

test.describe('OpsHub authenticated staging checks', () => {
  test.skip(!hasAuthConfig, () => {
    const details = missingKeys.length
      ? `Missing required staging config: ${missingKeys.join(', ')}`
      : 'Missing staging authentication config.';
    return details;
  });

  test('seller login flow reaches marketplace or pending status page', async ({ page }) => {
    await page.goto(`${baseURL}/auth/login`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/Email/i).fill(sellerEmail!);
    await page.getByLabel(/Password/i).fill(password!);
    await page.getByRole('button', { name: /Log in/i }).click();

    await expect(page).toHaveURL(/\/marketplace|\/verification\/pending|\/account\/suspended|\/verification\/rejected/, { timeout: 20000 });
  });

  test('customer login flow reaches the public app state without admin route access', async ({ page }) => {
    await page.goto(`${baseURL}/auth/login`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/Email/i).fill(customerEmail!);
    await page.getByLabel(/Password/i).fill(password!);
    await page.getByRole('button', { name: /Log in/i }).click();

    await expect(page).not.toHaveURL(/\/admin\//, { timeout: 20000 });
  });

  test('admin login flow reaches admin review page', async ({ page }) => {
    await page.goto(`${baseURL}/auth/login`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/Email/i).fill(adminEmail!);
    await page.getByLabel(/Password/i).fill(password!);
    await page.getByRole('button', { name: /Log in/i }).click();

    await expect(page).toHaveURL(/\/admin\/review/, { timeout: 20000 });
  });
});

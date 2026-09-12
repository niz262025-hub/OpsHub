import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const requiredKeys = [
  'BASE_URL',
  'PLAYWRIGHT_TEST_CUSTOMER_EMAIL',
  'PLAYWRIGHT_TEST_SELLER_EMAIL',
  'PLAYWRIGHT_TEST_ADMIN_EMAIL',
  'PLAYWRIGHT_TEST_PASSWORD',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const missingKeys = requiredKeys.filter((key) => !process.env[key] || process.env[key]?.trim() === '');
const baseURL = process.env.BASE_URL?.trim();
const sellerEmail = process.env.PLAYWRIGHT_TEST_SELLER_EMAIL?.trim();
const customerEmail = process.env.PLAYWRIGHT_TEST_CUSTOMER_EMAIL?.trim();
const adminEmail = process.env.PLAYWRIGHT_TEST_ADMIN_EMAIL?.trim();
const password = process.env.PLAYWRIGHT_TEST_PASSWORD?.trim();
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const hasAuthConfig = Boolean(baseURL && sellerEmail && customerEmail && adminEmail && password && supabaseUrl && supabaseServiceRoleKey);

const adminClient = hasAuthConfig
  ? createClient(supabaseUrl!, supabaseServiceRoleKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

async function getUserIdByEmail(email: string) {
  if (!adminClient) {
    throw new Error('Supabase admin client is unavailable.');
  }

  const { data, error } = await adminClient.auth.admin.listUsers();
  if (error || !data?.users) {
    throw new Error(`Unable to resolve user for ${email}: ${error?.message ?? 'unknown error'}`);
  }

  const matchedUser = data.users.find((user) => user.email === email);
  if (!matchedUser) {
    throw new Error(`Unable to find staged user for ${email}.`);
  }

  return matchedUser.id;
}

async function getSellerProductByName(sellerUserId: string, name: string) {
  if (!adminClient) {
    throw new Error('Supabase admin client is unavailable.');
  }

  const { data, error } = await adminClient
    .from('products')
    .select('*')
    .eq('seller_id', sellerUserId)
    .eq('name', name)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch seller product: ${error.message}`);
  }

  return data?.[0] ?? null;
}

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

  test('customer login flow reaches customer orders after valid session', async ({ page }) => {
    await page.goto(`${baseURL}/auth/customer/login`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/Email/i).fill(customerEmail!);
    await page.getByLabel(/Password/i).fill(password!);
    await page.getByRole('button', { name: /Log in/i }).click();

    await expect(page).toHaveURL(/\/customer\/orders/, { timeout: 20000 });
  });

  test('admin login flow reaches admin review page', async ({ page }) => {
    await page.goto(`${baseURL}/auth/login`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/Email/i).fill(adminEmail!);
    await page.getByLabel(/Password/i).fill(password!);
    await page.getByRole('button', { name: /Log in/i }).click();

    await expect(page).toHaveURL(/\/admin\/review/, { timeout: 20000 });
  });

  test('seller lifecycle persists in staging with public access, ownership isolation, and image persistence', async ({ page }) => {
    const uniqueProductName = `P0-2-${Date.now()}`;
    const productDescription = 'Created through the real staged seller lifecycle test.';
    const sellerUserId = await getUserIdByEmail(sellerEmail!);
    const customerUserId = await getUserIdByEmail(customerEmail!);

    await page.goto(`${baseURL}/auth/login`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/Email/i).fill(sellerEmail!);
    await page.getByLabel(/Password/i).fill(password!);
    await page.getByRole('button', { name: /Log in/i }).click();
    await expect(page).toHaveURL(/\/marketplace|\/verification\/pending|\/account\/suspended|\/verification\/rejected/, { timeout: 20000 });

    await page.goto(`${baseURL}/marketplace`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Product foundation/i })).toBeVisible({ timeout: 20000 });

    await page.getByLabel(/Product name/i).fill(uniqueProductName);
    await page.getByLabel(/Product description/i).fill(productDescription);
    await page.getByLabel(/Price/i).fill('49.99');
    await page.getByLabel(/Quantity/i).fill('3');

    await page.locator('input[type="file"]').setInputFiles({
      name: 'p0-2-upload.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAF', 'base64'),
    });

    await page.getByRole('button', { name: /Save product/i }).click();
    await expect(page.getByText(uniqueProductName)).toBeVisible({ timeout: 30000 });

    const product = await getSellerProductByName(sellerUserId, uniqueProductName);
    expect(product).not.toBeNull();
    expect(product.status).toBe('DRAFT');

    const { data: imageRows, error: imageError } = await adminClient!
      .from('product_images')
      .select('*')
      .eq('product_id', product.id)
      .eq('seller_id', sellerUserId);

    expect(imageError).toBeNull();
    expect(imageRows?.length ?? 0).toBeGreaterThan(0);

    await page.getByRole('link', { name: /Edit/i }).first().click();
    await page.getByLabel(/Status/i).selectOption('PUBLISHED');
    await page.getByRole('button', { name: /Save changes/i }).click();
    await expect(page).toHaveURL(/\/marketplace$/, { timeout: 20000 });

    const publishedProduct = await getSellerProductByName(sellerUserId, uniqueProductName);
    expect(publishedProduct).not.toBeNull();
    expect(publishedProduct.status).toBe('PUBLISHED');
    expect(Boolean(publishedProduct.is_public)).toBe(true);

    const publicPage = `${baseURL}/products/${publishedProduct.id}`;
    await page.goto(publicPage, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(uniqueProductName)).toBeVisible({ timeout: 20000 });

    await page.goto(`${baseURL}/marketplace`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Share/i }).first().click();
    await expect(page.getByText(/Generated product link/i)).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: /Unpublish/i }).first().click();
    await expect(page.getByText(/DRAFT/i)).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: /Archive/i }).first().click();

    const archivedProduct = await getSellerProductByName(sellerUserId, uniqueProductName);
    expect(archivedProduct).not.toBeNull();
    expect(archivedProduct.status).toBe('ARCHIVED');

    const sellerClient = createClient(supabaseUrl!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await sellerClient.auth.signInWithPassword({ email: sellerEmail!, password: password! });
    const { data: sellerRows } = await sellerClient.from('products').select('*').eq('seller_id', sellerUserId);
    expect((sellerRows ?? []).every((row) => row.seller_id === sellerUserId)).toBe(true);

    const customerClient = createClient(supabaseUrl!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await customerClient.auth.signInWithPassword({ email: customerEmail!, password: password! });
    const { data: customerRows } = await customerClient.from('products').select('*').eq('is_public', true).order('created_at', { ascending: false });
    expect((customerRows ?? []).some((row) => row.id === publishedProduct.id && row.is_public === true)).toBe(true);

    const { data: customerOwnRows } = await customerClient.from('products').select('*').eq('seller_id', sellerUserId);
    expect((customerOwnRows ?? []).some((row) => row.id === publishedProduct.id)).toBe(false);

    const { data: adminUsers } = await adminClient!.auth.admin.listUsers();
    expect(adminUsers?.users.some((user) => user.email === customerEmail)).toBe(true);
    expect(customerUserId).not.toBe(sellerUserId);
  });
});

#!/usr/bin/env node

const placeholderPatterns = [/replace-with-/i, /PASTE_[A-Z_]+_HERE/i, /example-project/i, /example\.com$/i];

const required = [
  'BASE_URL',
  'PLAYWRIGHT_TEST_CUSTOMER_EMAIL',
  'PLAYWRIGHT_TEST_SELLER_EMAIL',
  'PLAYWRIGHT_TEST_ADMIN_EMAIL',
  'PLAYWRIGHT_TEST_PASSWORD',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_PROJECT_ID',
];

const missing = [];
const invalid = [];

for (const key of required) {
  const value = process.env[key];

  if (!value || value.trim() === '') {
    missing.push(key);
    continue;
  }

  if (placeholderPatterns.some((pattern) => pattern.test(value))) {
    invalid.push(key);
  }
}

if (missing.length || invalid.length) {
  console.log('BLOCKED: required staging configuration is missing or still placeholder data.');
  if (missing.length) {
    console.log('Missing required values:');
    for (const key of missing) {
      console.log(`- ${key}`);
    }
  }
  if (invalid.length) {
    console.log('Placeholder values detected:');
    for (const key of invalid) {
      console.log(`- ${key}`);
    }
  }
  process.exit(1);
}

console.log('PASS: required staging configuration is present and not placeholder values. Secret values are not printed.');

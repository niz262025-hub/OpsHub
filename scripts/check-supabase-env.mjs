#!/usr/bin/env node

const placeholderPatterns = [/PASTE_[A-Z_]+_HERE/i, /replace-with-/i, /public-anon-key/i, /example-project/i];

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_PROJECT_ID',
];

const publicKeyCandidates = ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const hasPublicKey = publicKeyCandidates.some(
  (key) => process.env[key] && process.env[key].trim() !== '',
);

const missing = required.filter((key) => !process.env[key] || process.env[key].trim() === '');
const invalid = [];

for (const key of [...required, ...publicKeyCandidates]) {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    continue;
  }

  if (placeholderPatterns.some((pattern) => pattern.test(value))) {
    invalid.push(key);
  }
}

if (!hasPublicKey) {
  missing.push(...publicKeyCandidates);
}

const deduped = [...new Set([...missing, ...invalid])];

if (deduped.length > 0) {
  console.log('Supabase environment validation failed:');
  for (const key of deduped) {
    console.log(`- ${key}`);
  }
  process.exit(1);
}

console.log('Supabase environment variables are present and not placeholder values. Values are not printed.');

#!/usr/bin/env node

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_PROJECT_ID',
];

const missing = required.filter((key) => !process.env[key] || process.env[key].trim() === '');

if (missing.length > 0) {
  console.log('Missing required Supabase environment variables:');
  for (const key of missing) {
    console.log(`- ${key}`);
  }
  process.exit(1);
}

console.log('Supabase environment variables are present. Values are not printed.');

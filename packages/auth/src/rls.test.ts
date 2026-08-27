import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  new URL('../../../supabase/migrations/202608270001_phase1_auth.sql', import.meta.url),
  'utf8',
);

describe('phase 1 database and rls foundation', () => {
  it('creates profiles and seller_profiles with the required parent-child relationship', () => {
    expect(migrationSql).toContain('create table if not exists public.profiles');
    expect(migrationSql).toContain('create table if not exists public.seller_profiles');
    expect(migrationSql).toContain('id uuid primary key references auth.users(id) on delete cascade');
    expect(migrationSql).toContain('user_id uuid not null unique references public.profiles(id) on delete cascade');
  });

  it('forces seller-created records to pending and keeps them from changing through the seller policy', () => {
    expect(migrationSql).toContain("verification_status = 'PENDING'");
    expect(migrationSql).toContain("verification_status = old.verification_status");
    expect(migrationSql).toContain("verification_note = old.verification_note");
  });

  it('requires admin-only seller verification actions and blocks scalar privilege escalation', () => {
    expect(migrationSql).toContain("p.role = 'ADMIN'");
    expect(migrationSql).toContain('admins_manage_seller_verification');
    expect(migrationSql).toContain("auth.uid() = user_id and\n  verification_status = 'PENDING'");
    expect(migrationSql).toContain('role = \'SELLER\'');
  });

  it('enables row-level security on both critical tables', () => {
    expect(migrationSql).toContain('alter table public.profiles enable row level security;');
    expect(migrationSql).toContain('alter table public.seller_profiles enable row level security;');
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationSql = [
  readFileSync(new URL('../../../supabase/migrations/202608270001_phase1_auth.sql', import.meta.url), 'utf8'),
  readFileSync(new URL('../../../supabase/migrations/202608270002_phase1_auth_fix.sql', import.meta.url), 'utf8'),
  readFileSync(new URL('../../../supabase/migrations/202609010001_customer_commerce.sql', import.meta.url), 'utf8'),
].join('\n');

describe('phase 1 database and rls foundation', () => {
  it('creates profiles and seller_profiles with the required parent-child relationship', () => {
    expect(migrationSql).toContain('create table if not exists public.profiles');
    expect(migrationSql).toContain('create table if not exists public.seller_profiles');
    expect(migrationSql).toContain('id uuid primary key references auth.users(id) on delete cascade');
    expect(migrationSql).toContain('user_id uuid not null unique references public.profiles(id) on delete cascade');
  });

  it('forces seller-created records to pending and prevents direct seller verification mutations', () => {
    expect(migrationSql).toContain("verification_status = 'PENDING'");
    expect(migrationSql).toContain("if tg_op = 'INSERT' and new.verification_status <> 'PENDING'");
    expect(migrationSql).toContain("Only an active admin may change seller verification status");
    expect(migrationSql).toContain("verification_note is null");
    expect(migrationSql).toContain("new.verification_status <> 'PENDING'");
  });

  it('requires admin-only seller verification actions and blocks scalar privilege escalation', () => {
    expect(migrationSql).toContain("p.role = 'ADMIN'");
    expect(migrationSql).toContain('admins_manage_seller_verification');
    expect(migrationSql).toContain("auth.uid() = user_id and\n  verification_status = 'PENDING'");
    expect(migrationSql).toContain('role = \'SELLER\'');
    expect(migrationSql).toContain("raise exception 'Only an active admin may change profile role'");
    expect(migrationSql).toContain("raise exception 'Only an active admin may change account status'");
  });

  it('introduces a distinct customer identity and isolation boundary', () => {
    expect(migrationSql).toContain("ADD VALUE IF NOT EXISTS 'CUSTOMER'");
    expect(migrationSql).toContain('create table if not exists public.customer_profiles');
    expect(migrationSql).toContain('customer_profiles_select_own');
    expect(migrationSql).toContain('customer_profiles_select_admin');
    expect(migrationSql).toContain("role = 'CUSTOMER'");
    expect(migrationSql).toContain("auth.uid() = user_id");
  });

  it('uses a non-recursive admin check helper for profile and seller policy evaluation', () => {
    expect(migrationSql).toContain('create or replace function public.user_is_active_admin');
    expect(migrationSql).toContain('user_is_active_admin()');
    expect(migrationSql).toContain('for select using (user_is_active_admin())');
    expect(migrationSql).toContain('with check (\n  user_is_active_admin() and');
  });

  it('requires a controlled service-role bootstrap route for staging admins', () => {
    expect(migrationSql).toContain('create or replace function public.bootstrap_staging_admin');
    expect(migrationSql).toContain("coalesce(auth.jwt()->>'role', '') <> 'service_role'");
    expect(migrationSql).toContain('Only a service-role request may bootstrap staging admins');
  });

  it('rejects the forbidden seller privilege escalations in database policy and trigger logic', () => {
    expect(migrationSql).toContain("new.verification_status <> 'PENDING'");
    expect(migrationSql).toContain("raise exception 'Only an active admin may change seller verification status'");
    expect(migrationSql).toContain("raise exception 'Only an active admin may change profile role'");
    expect(migrationSql).toContain("raise exception 'Only an active admin may change account status'");
    expect(migrationSql).toContain("auth.uid() = user_id and\n  verification_status = 'PENDING'");
  });

  it('enables row-level security on both critical tables', () => {
    expect(migrationSql).toContain('alter table public.profiles enable row level security;');
    expect(migrationSql).toContain('alter table public.seller_profiles enable row level security;');
  });
});

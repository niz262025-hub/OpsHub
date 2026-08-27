import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  new URL('../../../supabase/migrations/202608270003_marketplace_foundation.sql', import.meta.url),
  'utf8',
);

describe('phase 2 marketplace foundation', () => {
  it('adds the locked product status and source enums', () => {
    expect(migrationSql).toContain("if not exists (select 1 from pg_type where typname = 'product_status')");
    expect(migrationSql).toContain("create type public.product_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED')");
    expect(migrationSql).toContain("if not exists (select 1 from pg_type where typname = 'product_source')");
    expect(migrationSql).toContain("create type public.product_source as enum ('OWNED', 'WHOLESALER', 'MANUFACTURER', 'DROP_SHIP')");
  });

  it('creates the product and product image tables with owner references', () => {
    expect(migrationSql).toContain('create table if not exists public.products');
    expect(migrationSql).toContain('seller_id uuid not null references public.profiles(id) on delete cascade');
    expect(migrationSql).toContain('create table if not exists public.product_images');
    expect(migrationSql).toContain('product_id uuid not null references public.products(id) on delete cascade');
  });

  it('enforces seller-only ownership and blocks owner reassignment', () => {
    expect(migrationSql).toContain("raise exception 'Seller can only manage their own products'");
    expect(migrationSql).toContain("raise exception 'Product ownership is immutable'");
    expect(migrationSql).toContain("auth.uid() = seller_id");
  });

  it('keeps public visibility restricted to publish-ready products and seller-owned data', () => {
    expect(migrationSql).toContain("(status = 'PUBLISHED' and is_public = true)");
    expect(migrationSql).toContain('seller_id = auth.uid()');
    expect(migrationSql).toContain('user_is_active_admin()');
  });

  it('includes the product sharing URL helper and marketplace item fields', () => {
    expect(migrationSql).toContain('generate_product_share_url');
    expect(migrationSql).toContain('name text not null');
    expect(migrationSql).toContain('price numeric(12,2) not null');
    expect(migrationSql).toContain('quantity integer not null');
    expect(migrationSql).toContain('image_url text');
  });

  it('adds the storage bucket and seller-owned image policies', () => {
    expect(migrationSql).toContain("insert into storage.buckets (id, name, public)");
    expect(migrationSql).toContain("marketplace-product-images");
    expect(migrationSql).toContain("create policy \"marketplace_product_images_insert_own\"");
    expect(migrationSql).toContain("split_part(name, '/', 1) = auth.uid()::text");
    expect(migrationSql).toContain("p.status = 'PUBLISHED'");
  });
});

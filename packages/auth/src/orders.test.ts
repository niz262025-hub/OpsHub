import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const baseMigrationSql = readFileSync(
  new URL('../../../supabase/migrations/202608280001_phase3_orders_payment.sql', import.meta.url),
  'utf8',
);
const inventoryFixSql = readFileSync(
  new URL('../../../supabase/migrations/202608280003_phase3_orders_payment_inventory_fix.sql', import.meta.url),
  'utf8',
);
const inventoryHardeningSql = readFileSync(
  new URL('../../../supabase/migrations/202608280008_phase3_orders_payment_rls_hardening_live_fix.sql', import.meta.url),
  'utf8',
);
const liveHardeningSql = readFileSync(
  new URL('../../../supabase/migrations/202608280010_phase3_orders_payment_live_fix.sql', import.meta.url),
  'utf8',
);
const migrationSql = `${baseMigrationSql}\n${inventoryFixSql}\n${inventoryHardeningSql}\n${liveHardeningSql}`;

describe('phase 3 money, orders, and payment foundation', () => {
  it('creates the required order and payment status enums', () => {
    expect(migrationSql).toContain("create type public.order_status as enum (");
    expect(migrationSql).toContain("'PENDING_PAYMENT'");
    expect(migrationSql).toContain("'PAID'");
    expect(migrationSql).toContain("'COMPLETED'");
    expect(migrationSql).toContain("create type public.payment_status as enum (");
    expect(migrationSql).toContain("'FAILED'");
    expect(migrationSql).toContain("'CANCELLED'");
  });

  it('defines the minimum order tables and money-safe totals', () => {
    expect(migrationSql).toContain('create table if not exists public.orders');
    expect(migrationSql).toContain('create table if not exists public.payments');
    expect(migrationSql).toContain('create table if not exists public.finance_records');
    expect(migrationSql).toContain('subtotal numeric(12,2)');
    expect(migrationSql).toContain('total numeric(12,2)');
    expect(migrationSql).toContain('calculate_order_total');
  });

  it('enforces ownership and inventory safety rules in the database layer', () => {
    expect(migrationSql).toContain('Order buyer is immutable');
    expect(migrationSql).toContain('Order seller is immutable');
    expect(migrationSql).toContain('Order totals are server-controlled');
    expect(migrationSql).toContain('Insufficient inventory for this product');
    expect(migrationSql).toContain('Order quantity must be greater than zero');
    expect(migrationSql).toContain("set_config('app.allow_product_inventory_adjustment', 'true', true)");
    expect(migrationSql).toContain('adjust_product_inventory_for_order');
    expect(migrationSql).toContain('seller_id = (select seller_id from public.products where id = product_id)');
    expect(migrationSql).toContain('unit_price = (select price from public.products where id = product_id)');
    expect(migrationSql).toContain('total = (select price from public.products where id = product_id) * quantity');
    expect(migrationSql).toContain('orders_update_own_or_admin');
  });

  it('keeps payment and finance mutations restricted to server/admin controlled paths', () => {
    expect(migrationSql).toContain('Client payment updates are not permitted');
    expect(migrationSql).toContain('Finance status may only be updated by the server or admin');
    expect(migrationSql).toContain('payments_update_admin_only');
    expect(migrationSql).toContain('finance_records_update_admin_only');
  });

  it('locks order updates and deletes to admin-only paths in the live staging hardening migration', () => {
    expect(migrationSql).toContain('orders_update_admin_only');
    expect(migrationSql).toContain('orders_delete_admin_only');
    expect(migrationSql).toContain('drop policy if exists "orders_update_own_or_admin" on public.orders;');
    expect(migrationSql).toContain('drop policy if exists "orders_delete_own_or_admin" on public.orders;');
    expect(migrationSql).toContain('Order buyer is immutable');
    expect(migrationSql).toContain('Order totals are server-controlled');
  });
});

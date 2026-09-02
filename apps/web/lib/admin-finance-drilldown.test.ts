import { describe, expect, it } from 'vitest';

import {
  assertAdminAuthorized,
  buildBusinessFinanceCsv,
  buildBusinessDrilldownData,
  filterFinanceRowsByDateRange,
  type FinanceDbRow,
} from './finance-data';

describe('admin finance drilldown', () => {
  const rows: FinanceDbRow[] = [
    {
      id: 'sale-1',
      seller_id: 'seller-a',
      order_id: 'order-1',
      amount: 50,
      direction: 'SALE',
      payment_status: 'PAID',
      created_at: '2026-01-01T00:00:00.000Z',
      orders: { order_status: 'COMPLETED' },
    },
    {
      id: 'sale-2',
      seller_id: 'seller-a',
      order_id: 'order-2',
      amount: 10,
      direction: 'SALE',
      payment_status: 'PAID',
      created_at: '2026-01-02T00:00:00.000Z',
      orders: { order_status: 'COMPLETED' },
    },
    {
      id: 'refund-1',
      seller_id: 'seller-a',
      order_id: 'order-3',
      amount: 7,
      direction: 'REFUND',
      payment_status: 'REFUNDED',
      created_at: '2026-01-03T00:00:00.000Z',
      orders: { order_status: 'CANCELLED' },
    },
    {
      id: 'payout-1',
      seller_id: 'seller-a',
      order_id: 'order-4',
      amount: 12,
      direction: 'PAYOUT',
      payment_status: 'PAID',
      created_at: '2026-01-04T00:00:00.000Z',
      orders: { order_status: 'COMPLETED' },
    },
    {
      id: 'sale-3',
      seller_id: 'seller-b',
      order_id: 'order-5',
      amount: 25,
      direction: 'SALE',
      payment_status: 'PAID',
      created_at: '2026-01-05T00:00:00.000Z',
      orders: { order_status: 'COMPLETED' },
    },
  ];

  it('builds an authorized business drilldown summary with correct totals', () => {
    const result = buildBusinessDrilldownData(rows, 'seller-a', {
      businessName: 'Alpha Business',
      sellerName: 'Alice Seller',
      page: 1,
      pageSize: 10,
    });

    expect(result.summary.totalSalesCents).toBe(6000);
    expect(result.summary.totalRefundsCents).toBe(700);
    expect(result.summary.totalPayoutsCents).toBe(1200);
    expect(result.summary.netRevenueCents).toBe(4100);
    expect(result.items).toHaveLength(4);
  });

  it('rejects non-admin access and tampered business identifiers', () => {
    expect(assertAdminAuthorized({ role: 'ADMIN', account_status: 'ACTIVE' })).toBe(true);
    expect(assertAdminAuthorized({ role: 'SELLER', account_status: 'ACTIVE' })).toBe(false);
    expect(assertAdminAuthorized({ role: 'ADMIN', account_status: 'SUSPENDED' })).toBe(false);

    const result = buildBusinessDrilldownData(rows, 'seller-b', {
      businessName: 'Beta',
      sellerName: 'Bob',
      page: 1,
      pageSize: 10,
      allowSellerId: 'seller-a',
    });

    expect(result.allowed).toBe(false);
    expect(result.summary.totalSalesCents).toBe(0);
  });

  it('filters records by date and preserves seller isolation', () => {
    const filtered = filterFinanceRowsByDateRange(rows, '2026-01-02T00:00:00.000Z', '2026-01-04T00:00:00.000Z');
    expect(filtered).toHaveLength(3);

    const drilldown = buildBusinessDrilldownData(rows, 'seller-a', {
      businessName: 'Alpha Business',
      sellerName: 'Alice Seller',
      from: '2026-01-02T00:00:00.000Z',
      to: '2026-01-04T00:00:00.000Z',
      page: 1,
      pageSize: 10,
    });

    expect(drilldown.summary.totalSalesCents).toBe(1000);
    expect(drilldown.summary.totalRefundsCents).toBe(700);
    expect(drilldown.summary.totalPayoutsCents).toBe(1200);
    expect(drilldown.summary.netRevenueCents).toBe(-900);
  });

  it('paginates transaction rows and handles empty state', () => {
    const result = buildBusinessDrilldownData(rows, 'seller-a', {
      businessName: 'Alpha Business',
      sellerName: 'Alice Seller',
      page: 2,
      pageSize: 2,
    });

    expect(result.items).toHaveLength(2);
    expect(result.totalCount).toBe(4);
    expect(result.totalPages).toBe(2);

    const empty = buildBusinessDrilldownData([], 'seller-a', {
      businessName: 'Alpha Business',
      sellerName: 'Alice Seller',
      page: 1,
      pageSize: 10,
    });

    expect(empty.totalCount).toBe(0);
    expect(empty.items).toHaveLength(0);
    expect(empty.summary.totalSalesCents).toBe(0);
  });

  it('does not double-count payouts or other reconciliation entries', () => {
    const result = buildBusinessDrilldownData(rows, 'seller-a', {
      businessName: 'Alpha Business',
      sellerName: 'Alice Seller',
      page: 1,
      pageSize: 10,
    });

    expect(result.summary.totalPayoutsCents).toBe(1200);
    expect(result.summary.totalAdjustmentsCents).toBe(0);
    expect(result.summary.netRevenueCents).toBe(4100);
  });

  it('exports authorized business csv with the same date filters and full dataset', () => {
    const csv = buildBusinessFinanceCsv(rows, 'seller-a', {
      businessName: 'Alpha Business',
      sellerName: 'Alice Seller',
      from: '2026-01-02T00:00:00.000Z',
      to: '2026-01-04T00:00:00.000Z',
    });

    expect(csv).toContain('date_time,business_name,seller_name');
    expect(csv).toContain('sale-2');
    expect(csv).toContain('refund-1');
    expect(csv).toContain('payout-1');
    expect(csv).not.toContain('sale-1');
    expect(csv).not.toContain('sale-3');
    expect(csv).toContain('Alpha Business');
    expect(csv).toContain('Alice Seller');
  });

  it('applies escaping for commas, quotes and newlines in csv output', () => {
    const escapingRows: FinanceDbRow[] = [
      {
        id: 'quote-1',
        seller_id: 'seller-a',
        order_id: 'order, "quoted"',
        amount: 15.5,
        direction: 'SALE',
        payment_status: 'PAID',
        created_at: '2026-01-06T00:00:00.000Z',
        orders: { order_status: 'Updated\nstatus' },
      },
    ];

    const csv = buildBusinessFinanceCsv(escapingRows, 'seller-a', {
      businessName: 'Alpha, "Business"',
      sellerName: 'Alice, "Seller"',
    });

    expect(csv).toContain('"Alpha, ""Business"""');
    expect(csv).toContain('"Alice, ""Seller"""');
    expect(csv).toContain('"order, ""quoted"""');
    expect(csv).toContain('"Updated\nstatus"');
  });

  it('does not export only the currently paginated page', () => {
    const csv = buildBusinessFinanceCsv(rows, 'seller-a', {
      businessName: 'Alpha Business',
      sellerName: 'Alice Seller',
    });

    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(5);
    expect(csv).toContain('sale-1');
    expect(csv).toContain('sale-2');
    expect(csv).toContain('refund-1');
    expect(csv).toContain('payout-1');
  });

  it('creates a valid empty export for businesses with no rows in range', () => {
    const csv = buildBusinessFinanceCsv([], 'seller-a', {
      businessName: 'Alpha Business',
      sellerName: 'Alice Seller',
      from: '2026-01-10T00:00:00.000Z',
      to: '2026-01-12T00:00:00.000Z',
    });

    expect(csv).toBe('date_time,business_name,seller_name,record_id,order_reference,direction,amount_cents,payment_status,order_status');
  });

  it('keeps data limited to the selected business and hides service-role material', () => {
    const csv = buildBusinessFinanceCsv(rows, 'seller-a', {
      businessName: 'Alpha Business',
      sellerName: 'Alice Seller',
    });

    expect(csv).not.toContain('SERVICE_ROLE');
    expect(csv).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(csv).not.toContain('seller-b');
    expect(csv).toContain('Alpha Business');
    expect(csv).toContain('Alice Seller');
  });
});

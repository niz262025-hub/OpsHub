import { describe, expect, it } from 'vitest';

import { buildAdminBusinessBreakdown, assertAdminAuthorized, type FinanceDbRow, type SellerBusinessProfile } from './finance-data';

describe('admin business breakdown', () => {
  const rows: FinanceDbRow[] = [
    {
      id: 'sale-a-1',
      seller_id: 'seller-a',
      order_id: 'order-a-1',
      amount: 50,
      direction: 'SALE',
      payment_status: 'PAID',
      created_at: '2026-01-01T00:00:00.000Z',
      orders: { order_status: 'COMPLETED' },
    },
    {
      id: 'sale-a-2',
      seller_id: 'seller-a',
      order_id: 'order-a-2',
      amount: 10,
      direction: 'SALE',
      payment_status: 'PAID',
      created_at: '2026-01-02T00:00:00.000Z',
      orders: { order_status: 'COMPLETED' },
    },
    {
      id: 'refund-a-1',
      seller_id: 'seller-a',
      order_id: 'order-a-3',
      amount: 7,
      direction: 'REFUND',
      payment_status: 'REFUNDED',
      created_at: '2026-01-03T00:00:00.000Z',
      orders: { order_status: 'CANCELLED' },
    },
    {
      id: 'payout-a-1',
      seller_id: 'seller-a',
      order_id: 'order-a-4',
      amount: 12,
      direction: 'PAYOUT',
      payment_status: 'PAID',
      created_at: '2026-01-04T00:00:00.000Z',
      orders: { order_status: 'COMPLETED' },
    },
    {
      id: 'sale-b-1',
      seller_id: 'seller-b',
      order_id: 'order-b-1',
      amount: 30,
      direction: 'SALE',
      payment_status: 'PAID',
      created_at: '2026-01-05T00:00:00.000Z',
      orders: { order_status: 'COMPLETED' },
    },
    {
      id: 'refund-b-1',
      seller_id: 'seller-b',
      order_id: 'order-b-2',
      amount: 5,
      direction: 'REFUND',
      payment_status: 'REFUNDED',
      created_at: '2026-01-06T00:00:00.000Z',
      orders: { order_status: 'CANCELLED' },
    },
  ];

  const profiles: SellerBusinessProfile[] = [
    { user_id: 'seller-a', business_name: 'Alpha Business', full_name: 'Alice Seller' },
    { user_id: 'seller-b', business_name: 'Beta Business', full_name: 'Bob Seller' },
  ];

  it('returns an authorized business breakdown with correct revenue, refunds, payouts and net revenue', () => {
    const result = buildAdminBusinessBreakdown(rows, profiles, { page: 1, pageSize: 20 });

    expect(result.totalCount).toBe(2);
    expect(result.items[0].businessName).toBe('Alpha Business');
    expect(result.items[0].totalSalesCents).toBe(6000);
    expect(result.items[0].totalRefundsCents).toBe(700);
    expect(result.items[0].totalPayoutsCents).toBe(1200);
    expect(result.items[0].netRevenueCents).toBe(4100);
    expect(result.items[1].businessName).toBe('Beta Business');
    expect(result.items[1].totalSalesCents).toBe(3000);
    expect(result.items[1].totalRefundsCents).toBe(500);
    expect(result.items[1].totalPayoutsCents).toBe(0);
    expect(result.items[1].netRevenueCents).toBe(2500);
  });

  it('supports search and pagination filtering', () => {
    const bySearch = buildAdminBusinessBreakdown(rows, profiles, { search: 'beta', page: 1, pageSize: 20 });
    expect(bySearch.totalCount).toBe(1);
    expect(bySearch.items[0].businessName).toBe('Beta Business');

    const paged = buildAdminBusinessBreakdown(rows, profiles, { page: 2, pageSize: 1 });
    expect(paged.totalPages).toBe(2);
    expect(paged.page).toBe(2);
    expect(paged.items).toHaveLength(1);
  });

  it('returns an empty result for no matching business rows', () => {
    const result = buildAdminBusinessBreakdown([], profiles, { search: 'no-match', page: 1, pageSize: 20 });
    expect(result.totalCount).toBe(0);
    expect(result.items).toHaveLength(0);
    expect(result.totalPages).toBe(1);
  });

  it('does not double count payouts in the business aggregates', () => {
    const result = buildAdminBusinessBreakdown(rows, profiles, { page: 1, pageSize: 20 });
    const alpha = result.items.find((item) => item.sellerId === 'seller-a');

    expect(alpha?.totalPayoutsCents).toBe(1200);
    expect(alpha?.netRevenueCents).toBe(4100);
    expect(alpha?.transactionCount).toBe(4);
  });

  it('only allows active admins through the authorization guard', () => {
    expect(assertAdminAuthorized({ role: 'ADMIN', account_status: 'ACTIVE' })).toBe(true);
    expect(assertAdminAuthorized({ role: 'SELLER', account_status: 'ACTIVE' })).toBe(false);
    expect(assertAdminAuthorized({ role: 'ADMIN', account_status: 'SUSPENDED' })).toBe(false);
  });
});

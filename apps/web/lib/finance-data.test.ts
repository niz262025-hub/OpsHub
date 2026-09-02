import { describe, expect, it } from 'vitest';

import {
  assertAdminAuthorized,
  buildAdminFinanceOverview,
  buildSellerFinanceSummary,
  filterFinanceRowsForSeller,
  mapFinanceRowsToEntries,
  type FinanceDbRow,
} from './finance-data';

const financeRows: FinanceDbRow[] = [
  {
    id: 'sale-1',
    seller_id: 'seller-1',
    order_id: 'order-1',
    amount: 50,
    direction: 'SALE',
    payment_status: 'PAID',
    created_at: '2026-01-01T00:00:00.000Z',
    orders: { order_status: 'COMPLETED' },
  },
  {
    id: 'sale-2',
    seller_id: 'seller-1',
    order_id: 'order-2',
    amount: 15,
    direction: 'SALE',
    payment_status: 'PAID',
    created_at: '2026-01-02T00:00:00.000Z',
    orders: { order_status: 'COMPLETED' },
  },
  {
    id: 'refund-1',
    seller_id: 'seller-1',
    order_id: 'order-3',
    amount: 7.5,
    direction: 'REFUND',
    payment_status: 'REFUNDED',
    created_at: '2026-01-03T00:00:00.000Z',
    orders: { order_status: 'CANCELLED' },
  },
  {
    id: 'payout-1',
    seller_id: 'seller-1',
    order_id: 'order-4',
    amount: 12,
    direction: 'PAYOUT',
    payment_status: 'PAID',
    created_at: '2026-01-04T00:00:00.000Z',
    orders: { order_status: 'COMPLETED' },
  },
  {
    id: 'biz-b-sale',
    seller_id: 'seller-2',
    order_id: 'order-5',
    amount: 25,
    direction: 'SALE',
    payment_status: 'PAID',
    created_at: '2026-01-05T00:00:00.000Z',
    orders: { order_status: 'COMPLETED' },
  },
];

describe('finance data access and aggregation', () => {
  it('receives real aggregated finance data and counts payouts once without double counting', () => {
    const summary = buildSellerFinanceSummary(financeRows, 'seller-1');

    expect(summary.totalSalesCents).toBe(6500);
    expect(summary.totalRefundsCents).toBe(750);
    expect(summary.totalPayoutsCents).toBe(1200);
    expect(summary.netRevenueCents).toBe(4550);
    expect(summary.transactionCount).toBe(4);
  });

  it('returns an empty summary for empty finance datasets', () => {
    expect(buildSellerFinanceSummary([], 'seller-1')).toMatchObject({
      totalSalesCents: 0,
      totalRefundsCents: 0,
      totalPayoutsCents: 0,
      netRevenueCents: 0,
      transactionCount: 0,
    });
  });

  it('keeps business A isolated from business B finance rows', () => {
    const ownRows = filterFinanceRowsForSeller(financeRows, 'seller-1');

    expect(ownRows).toHaveLength(4);
    expect(ownRows.every((row) => row.seller_id === 'seller-1')).toBe(true);
    expect(ownRows.some((row) => row.seller_id === 'seller-2')).toBe(false);
  });

  it('builds an admin overview that includes payouts and net revenue across authorized businesses', () => {
    const summary = buildAdminFinanceOverview(financeRows);

    expect(summary.totalRevenueCents).toBe(9000);
    expect(summary.totalRefundsCents).toBe(750);
    expect(summary.totalPayoutsCents).toBe(1200);
    expect(summary.netRevenueCents).toBe(7050);
    expect(summary.requiresReviewCount).toBe(0);
    expect(summary.ordersByStatus.COMPLETED).toBe(4);
  });

  it('authorizes only active admins for admin revenue access', () => {
    expect(assertAdminAuthorized({ role: 'ADMIN', account_status: 'ACTIVE' })).toBe(true);
    expect(assertAdminAuthorized({ role: 'SELLER', account_status: 'ACTIVE' })).toBe(false);
    expect(assertAdminAuthorized({ role: 'ADMIN', account_status: 'SUSPENDED' })).toBe(false);
  });

  it('maps raw finance rows into report entries without dropping valid payouts', () => {
    const entries = mapFinanceRowsToEntries(financeRows);

    expect(entries).toHaveLength(5);
    expect(entries.find((entry) => entry.id === 'payout-1')?.direction).toBe('PAYOUT');
    expect(entries.find((entry) => entry.id === 'payout-1')?.amountCents).toBe(1200);
  });
});

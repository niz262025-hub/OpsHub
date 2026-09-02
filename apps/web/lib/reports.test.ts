import { describe, expect, it } from 'vitest';

import {
  summarizeAdminOverview,
  summarizeFinanceReport,
  type FinanceReportEntry,
} from './reports';

describe('finance report aggregation', () => {
  const baseEntries: FinanceReportEntry[] = [
    {
      id: 'sale-1',
      businessId: 'biz-1',
      sellerId: 'seller-1',
      amountCents: 5000,
      direction: 'SALE',
      paymentStatus: 'PAID',
      orderStatus: 'COMPLETED',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'sale-2',
      businessId: 'biz-1',
      sellerId: 'seller-1',
      amountCents: 1500,
      direction: 'SALE',
      paymentStatus: 'PAID',
      orderStatus: 'COMPLETED',
      createdAt: '2026-01-02T00:00:00.000Z',
    },
    {
      id: 'refund-1',
      businessId: 'biz-1',
      sellerId: 'seller-1',
      amountCents: 750,
      direction: 'REFUND',
      paymentStatus: 'REFUNDED',
      orderStatus: 'CANCELLED',
      createdAt: '2026-01-03T00:00:00.000Z',
    },
    {
      id: 'failed-1',
      businessId: 'biz-2',
      sellerId: 'seller-2',
      amountCents: 2000,
      direction: 'ADJUSTMENT',
      paymentStatus: 'FAILED',
      orderStatus: 'CANCELLED',
      createdAt: '2026-01-04T00:00:00.000Z',
    },
  ];

  it('returns zero totals for empty datasets and partial states', () => {
    expect(summarizeFinanceReport([], { businessId: 'biz-1' })).toMatchObject({
      totalSalesCents: 0,
      totalRefundsCents: 0,
      totalAdjustmentsCents: 0,
      netRevenueCents: 0,
      transactionCount: 0,
    });

    expect(summarizeFinanceReport([{ ...baseEntries[0], paymentStatus: 'PENDING' }], { businessId: 'biz-1' })).toMatchObject({
      totalSalesCents: 0,
      netRevenueCents: 0,
      transactionCount: 1,
    });
  });

  it('aggregates sales and refunds and keeps tenant data isolated', () => {
    expect(summarizeFinanceReport(baseEntries, { businessId: 'biz-1' })).toMatchObject({
      totalSalesCents: 6500,
      totalRefundsCents: 750,
      totalAdjustmentsCents: 0,
      netRevenueCents: 5750,
      transactionCount: 3,
      requiresReviewCount: 0,
    });

    expect(summarizeFinanceReport(baseEntries, { sellerId: 'seller-2' })).toMatchObject({
      totalSalesCents: 0,
      totalRefundsCents: 0,
      totalAdjustmentsCents: 2000,
      netRevenueCents: 0,
      transactionCount: 1,
    });
  });

  it('separates payout totals from sales and keeps net revenue accurate', () => {
    const entries: FinanceReportEntry[] = [
      ...baseEntries,
      {
        id: 'payout-1',
        businessId: 'biz-1',
        sellerId: 'seller-1',
        amountCents: 1200,
        direction: 'PAYOUT',
        paymentStatus: 'PAID',
        orderStatus: 'COMPLETED',
        createdAt: '2026-01-05T00:00:00.000Z',
      },
      {
        id: 'payout-2',
        businessId: 'biz-2',
        sellerId: 'seller-2',
        amountCents: 400,
        direction: 'PAYOUT',
        paymentStatus: 'PAID',
        orderStatus: 'COMPLETED',
        createdAt: '2026-01-06T00:00:00.000Z',
      },
    ];

    const summary = summarizeFinanceReport(entries, { businessId: 'biz-1' });

    expect(summary.totalSalesCents).toBe(6500);
    expect(summary.totalRefundsCents).toBe(750);
    expect(summary.totalPayoutsCents).toBe(1200);
    expect(summary.netRevenueCents).toBe(4550);
    expect(summary.transactionCount).toBe(4);
  });

  it('builds an admin overview for status counts and revenue totals', () => {
    const summary = summarizeAdminOverview(baseEntries);

    expect(summary.totalRevenueCents).toBe(6500);
    expect(summary.totalRefundsCents).toBe(750);
    expect(summary.ordersByStatus).toMatchObject({
      COMPLETED: 2,
      CANCELLED: 2,
    });
    expect(summary.requiresReviewCount).toBe(1);
  });

  it('keeps payout and refund semantics isolated across businesses and zero-transaction sets', () => {
    const entries: FinanceReportEntry[] = [
      ...baseEntries,
      {
        id: 'payout-1',
        businessId: 'biz-1',
        sellerId: 'seller-1',
        amountCents: 1200,
        direction: 'PAYOUT',
        paymentStatus: 'PAID',
        orderStatus: 'COMPLETED',
        createdAt: '2026-01-05T00:00:00.000Z',
      },
      {
        id: 'payout-2',
        businessId: 'biz-2',
        sellerId: 'seller-2',
        amountCents: 400,
        direction: 'PAYOUT',
        paymentStatus: 'PAID',
        orderStatus: 'COMPLETED',
        createdAt: '2026-01-06T00:00:00.000Z',
      },
    ];

    expect(summarizeFinanceReport(entries, { businessId: 'biz-1' })).toMatchObject({
      totalSalesCents: 6500,
      totalRefundsCents: 750,
      totalPayoutsCents: 1200,
      netRevenueCents: 4550,
      transactionCount: 4,
    });

    expect(summarizeFinanceReport([], { businessId: 'biz-3' })).toMatchObject({
      totalSalesCents: 0,
      totalRefundsCents: 0,
      totalPayoutsCents: 0,
      netRevenueCents: 0,
      transactionCount: 0,
    });
  });
});

export type FinanceDirection = 'SALE' | 'REFUND' | 'PAYOUT' | 'ADJUSTMENT';
export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'COMPLETED'
  | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

export type FinanceReportEntry = {
  id: string;
  businessId: string;
  sellerId: string;
  amountCents: number;
  direction: FinanceDirection;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  createdAt: string;
};

export type FinanceSummary = {
  totalSalesCents: number;
  totalRefundsCents: number;
  totalAdjustmentsCents: number;
  totalPayoutsCents: number;
  netRevenueCents: number;
  transactionCount: number;
  requiresReviewCount: number;
};

export type AdminOverviewSummary = {
  totalRevenueCents: number;
  totalRefundsCents: number;
  totalAdjustmentsCents: number;
  totalPayoutsCents: number;
  netRevenueCents: number;
  requiresReviewCount: number;
  ordersByStatus: Record<string, number>;
};

export function summarizeFinanceReport(
  entries: FinanceReportEntry[],
  filters: { businessId?: string; sellerId?: string } = {},
): FinanceSummary {
  const filtered = entries.filter((entry) => {
    if (filters.businessId && entry.businessId !== filters.businessId) return false;
    if (filters.sellerId && entry.sellerId !== filters.sellerId) return false;
    return true;
  });

  const summary = filtered.reduce<FinanceSummary>(
    (acc, entry) => {
      const amount = Math.max(0, Number.isFinite(entry.amountCents) ? entry.amountCents : 0);

      if (entry.direction === 'SALE' && entry.paymentStatus === 'PAID') {
        acc.totalSalesCents += amount;
      }

      if (entry.direction === 'REFUND' || entry.paymentStatus === 'REFUNDED') {
        acc.totalRefundsCents += amount;
      }

      if (entry.direction === 'PAYOUT') {
        acc.totalPayoutsCents += amount;
      }

      if (entry.direction === 'ADJUSTMENT' || entry.paymentStatus === 'FAILED' || entry.paymentStatus === 'CANCELLED') {
        acc.totalAdjustmentsCents += amount;
      }

      if (entry.direction === 'SALE' && entry.paymentStatus === 'PAID') {
        acc.netRevenueCents += amount;
      } else if (entry.direction === 'REFUND' || entry.paymentStatus === 'REFUNDED') {
        acc.netRevenueCents -= amount;
      } else if (entry.direction === 'PAYOUT') {
        acc.netRevenueCents -= amount;
      }

      acc.transactionCount += 1;

      if (entry.paymentStatus === 'FAILED' || entry.paymentStatus === 'CANCELLED' || entry.direction === 'ADJUSTMENT') {
        acc.requiresReviewCount += 1;
      }

      return acc;
    },
    {
      totalSalesCents: 0,
      totalRefundsCents: 0,
      totalAdjustmentsCents: 0,
      totalPayoutsCents: 0,
      netRevenueCents: 0,
      transactionCount: 0,
      requiresReviewCount: 0,
    },
  );

  return summary;
}

export function summarizeAdminOverview(entries: FinanceReportEntry[]): AdminOverviewSummary {
  const summary = summarizeFinanceReport(entries);
  const ordersByStatus = entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.orderStatus] = (acc[entry.orderStatus] ?? 0) + 1;
    return acc;
  }, {});

  return {
    totalRevenueCents: summary.totalSalesCents,
    totalRefundsCents: summary.totalRefundsCents,
    totalAdjustmentsCents: summary.totalAdjustmentsCents,
    totalPayoutsCents: summary.totalPayoutsCents,
    netRevenueCents: summary.netRevenueCents,
    requiresReviewCount: summary.requiresReviewCount,
    ordersByStatus,
  };
}

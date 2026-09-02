import { summarizeAdminOverview, summarizeFinanceReport, type FinanceReportEntry } from './reports';

export type FinanceDbRow = {
  id: string;
  seller_id: string;
  order_id?: string | null;
  amount: number;
  direction: 'SALE' | 'REFUND' | 'PAYOUT' | 'ADJUSTMENT';
  payment_status: 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  created_at: string;
  orders?: {
    order_status?: string;
  }[] | { order_status?: string } | null;
};

export type FinanceAccessProfile = {
  role: string | null;
  account_status: string | null;
};

export type SellerBusinessProfile = {
  user_id: string;
  business_name?: string | null;
  full_name?: string | null;
};

export type BusinessFinanceBreakdownItem = {
  sellerId: string;
  businessId: string;
  businessName: string;
  sellerName: string;
  totalSalesCents: number;
  totalRefundsCents: number;
  totalPayoutsCents: number;
  totalAdjustmentsCents: number;
  netRevenueCents: number;
  requiresReviewCount: number;
  transactionCount: number;
};

export type BusinessDrilldownSummary = {
  sellerId: string;
  businessName: string;
  sellerName: string;
  totalSalesCents: number;
  totalRefundsCents: number;
  totalPayoutsCents: number;
  totalAdjustmentsCents: number;
  netRevenueCents: number;
  requiresReviewCount: number;
  transactionCount: number;
};

export type BusinessDrilldownResult = {
  allowed: boolean;
  businessName: string;
  sellerName: string;
  summary: BusinessDrilldownSummary;
  items: FinanceDbRow[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

export function mapFinanceRowsToEntries(rows: FinanceDbRow[]): FinanceReportEntry[] {
  return rows.map((row) => {
    const nestedOrder = Array.isArray(row.orders) ? row.orders[0] : row.orders;

    return {
      id: row.id,
      businessId: row.seller_id,
      sellerId: row.seller_id,
      amountCents: Math.round(Number(row.amount) * 100),
      direction: row.direction,
      paymentStatus: row.payment_status,
      orderStatus: (nestedOrder?.order_status as FinanceReportEntry['orderStatus']) ?? 'PENDING_PAYMENT',
      createdAt: row.created_at,
    };
  });
}

export function filterFinanceRowsForSeller(rows: FinanceDbRow[], sellerId: string): FinanceDbRow[] {
  return rows.filter((row) => row.seller_id === sellerId);
}

export function buildSellerFinanceSummary(rows: FinanceDbRow[], sellerId: string) {
  const filtered = filterFinanceRowsForSeller(rows, sellerId);
  return summarizeFinanceReport(mapFinanceRowsToEntries(filtered), { sellerId });
}

export function buildAdminFinanceOverview(rows: FinanceDbRow[]) {
  return summarizeAdminOverview(mapFinanceRowsToEntries(rows));
}

export function buildAdminBusinessBreakdown(
  rows: FinanceDbRow[],
  businessProfiles: SellerBusinessProfile[] = [],
  options: { search?: string; page?: number; pageSize?: number } = {},
) {
  const search = options.search?.trim().toLowerCase() ?? '';
  const pageSize = options.pageSize && options.pageSize > 0 ? options.pageSize : 20;
  const page = options.page && options.page > 0 ? options.page : 1;

  const profileMap = new Map<string, SellerBusinessProfile>();
  for (const profile of businessProfiles) {
    if (profile.user_id) {
      profileMap.set(profile.user_id, profile);
    }
  }

  const grouped = rows.reduce<Map<string, FinanceDbRow[]>>((acc, row) => {
    const current = acc.get(row.seller_id) ?? [];
    current.push(row);
    acc.set(row.seller_id, current);
    return acc;
  }, new Map());

  const items: BusinessFinanceBreakdownItem[] = Array.from(grouped.entries()).map(([sellerId, sellerRows]) => {
    const profile = profileMap.get(sellerId) ?? { user_id: sellerId, business_name: 'Unknown business', full_name: 'Unknown seller' };
    const summary = summarizeFinanceReport(mapFinanceRowsToEntries(sellerRows), { sellerId });

    return {
      sellerId,
      businessId: sellerId,
      businessName: profile.business_name?.trim() || 'Unknown business',
      sellerName: profile.full_name?.trim() || 'Unknown seller',
      totalSalesCents: summary.totalSalesCents,
      totalRefundsCents: summary.totalRefundsCents,
      totalPayoutsCents: summary.totalPayoutsCents,
      totalAdjustmentsCents: summary.totalAdjustmentsCents,
      netRevenueCents: summary.netRevenueCents,
      requiresReviewCount: summary.requiresReviewCount,
      transactionCount: summary.transactionCount,
    };
  });

  const filtered = search
    ? items.filter((item) => {
        const haystack = `${item.businessName} ${item.sellerName}`.toLowerCase();
        return haystack.includes(search);
      })
    : items;

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    items: paged,
    totalCount,
    page: safePage,
    totalPages,
    pageSize,
  };
}

export function assertAdminAuthorized(profile: FinanceAccessProfile): boolean {
  return profile.role === 'ADMIN' && profile.account_status === 'ACTIVE';
}

export function filterFinanceRowsByDateRange(rows: FinanceDbRow[], from?: string | null, to?: string | null): FinanceDbRow[] {
  return rows.filter((row) => {
    const createdAt = new Date(row.created_at).getTime();

    if (from && createdAt < new Date(from).getTime()) {
      return false;
    }

    if (to && createdAt > new Date(to).getTime()) {
      return false;
    }

    return true;
  });
}

export function escapeCsvValue(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function buildBusinessFinanceCsv(
  rows: FinanceDbRow[],
  sellerId: string,
  options: {
    businessName?: string;
    sellerName?: string;
    from?: string | null;
    to?: string | null;
  } = {},
): string {
  const filtered = filterFinanceRowsByDateRange(rows, options.from ?? null, options.to ?? null).filter((row) => row.seller_id === sellerId);

  const header = [
    'date_time',
    'business_name',
    'seller_name',
    'record_id',
    'order_reference',
    'direction',
    'amount_cents',
    'payment_status',
    'order_status',
  ];

  const lines = filtered.map((row) => {
    const orderStatus = Array.isArray(row.orders) ? row.orders[0]?.order_status ?? '' : row.orders?.order_status ?? '';
    const amountCents = Math.round(Number(row.amount) * 100);

    return [
      new Date(row.created_at).toISOString(),
      options.businessName ?? 'Unknown business',
      options.sellerName ?? 'Unknown seller',
      row.id,
      row.order_id ?? '',
      row.direction,
      String(amountCents),
      row.payment_status,
      orderStatus,
    ].map((cell) => escapeCsvValue(cell)).join(',');
  });

  return [header.map((cell) => escapeCsvValue(cell)).join(','), ...lines].join('\n');
}

export function buildBusinessDrilldownData(
  rows: FinanceDbRow[],
  sellerId: string,
  options: {
    businessName?: string;
    sellerName?: string;
    from?: string | null;
    to?: string | null;
    page?: number;
    pageSize?: number;
    allowSellerId?: string | null;
  } = {},
): BusinessDrilldownResult {
  const pageSize = options.pageSize && options.pageSize > 0 ? options.pageSize : 20;
  const page = options.page && options.page > 0 ? options.page : 1;
  const filtered = filterFinanceRowsByDateRange(rows, options.from ?? null, options.to ?? null).filter((row) => row.seller_id === sellerId);

  const allowed = options.allowSellerId ? options.allowSellerId === sellerId : true;
  const summary = summarizeFinanceReport(mapFinanceRowsToEntries(filtered), { sellerId });

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const items = allowed ? filtered.slice((safePage - 1) * pageSize, safePage * pageSize) : [];

  return {
    allowed,
    businessName: options.businessName ?? 'Unknown business',
    sellerName: options.sellerName ?? 'Unknown seller',
    summary: {
      sellerId,
      businessName: options.businessName ?? 'Unknown business',
      sellerName: options.sellerName ?? 'Unknown seller',
      totalSalesCents: allowed ? summary.totalSalesCents : 0,
      totalRefundsCents: allowed ? summary.totalRefundsCents : 0,
      totalPayoutsCents: allowed ? summary.totalPayoutsCents : 0,
      totalAdjustmentsCents: allowed ? summary.totalAdjustmentsCents : 0,
      netRevenueCents: allowed ? summary.netRevenueCents : 0,
      requiresReviewCount: allowed ? summary.requiresReviewCount : 0,
      transactionCount: allowed ? summary.transactionCount : 0,
    },
    items: allowed ? items : [],
    totalCount: allowed ? totalCount : 0,
    totalPages: allowed ? totalPages : 1,
    page: allowed ? safePage : 1,
    pageSize,
  };
}

export function toMoneyString(cents: number): string {
  return (cents / 100).toFixed(2);
}

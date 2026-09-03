export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'COMPLETED',
  'CANCELLED',
] as const;

export const PAYMENT_STATUSES = [
  'PENDING',
  'AUTHORIZED',
  'PAID',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
] as const;

export const FINANCE_DIRECTIONS = ['SALE', 'REFUND', 'PAYOUT', 'ADJUSTMENT'] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type FinanceDirection = (typeof FINANCE_DIRECTIONS)[number];

export type OrderTotals = {
  unitPriceCents: number;
  quantity: number;
  subtotalCents: number;
  totalCents: number;
};

export type SellerOrderAccessTarget = {
  id?: string | null;
  seller_id?: string | null;
} | null | undefined;

export function canSellerAccessOrder(order: SellerOrderAccessTarget, sellerId: string | null | undefined): boolean {
  return Boolean(order && order.id && order.seller_id && sellerId && order.seller_id === sellerId);
}

export function calculateOrderTotals(unitPriceCents: number, quantity: number): OrderTotals {
  if (!Number.isFinite(unitPriceCents) || unitPriceCents < 0) {
    throw new Error('Unit price must be a non-negative number of cents');
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Order quantity must be greater than zero');
  }

  const subtotalCents = unitPriceCents * quantity;
  return {
    unitPriceCents,
    quantity,
    subtotalCents,
    totalCents: subtotalCents,
  };
}

export function isValidOrderStatus(status: string | null | undefined): boolean {
  return Boolean(status) && ORDER_STATUSES.includes(status as OrderStatus);
}

export function isValidPaymentStatus(status: string | null | undefined): boolean {
  return Boolean(status) && PAYMENT_STATUSES.includes(status as PaymentStatus);
}

export function isOrderTransitionAllowed(currentStatus: OrderStatus, nextStatus: OrderStatus): boolean {
  const transitions: Record<OrderStatus, OrderStatus[]> = {
    PENDING_PAYMENT: ['PAID', 'CANCELLED'],
    PAID: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  };

  return transitions[currentStatus]?.includes(nextStatus) ?? false;
}

export function isPaymentTransitionAllowed(currentStatus: PaymentStatus, nextStatus: PaymentStatus): boolean {
  const transitions: Record<PaymentStatus, PaymentStatus[]> = {
    PENDING: ['AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED'],
    AUTHORIZED: ['PAID', 'FAILED', 'CANCELLED'],
    PAID: ['REFUNDED'],
    FAILED: [],
    CANCELLED: [],
    REFUNDED: [],
  };

  return transitions[currentStatus]?.includes(nextStatus) ?? false;
}

export function normalizeMoneyInput(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Money values must be finite and non-negative');
  }

  return Math.round(parsed * 100) / 100;
}

export function toCents(amount: number): number {
  return Math.round(normalizeMoneyInput(amount) * 100);
}

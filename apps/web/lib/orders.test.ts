import { describe, expect, it } from 'vitest';

import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  calculateOrderTotals,
  isOrderTransitionAllowed,
  isValidOrderStatus,
  isValidPaymentStatus,
} from './orders';

describe('order lifecycle state machine and inventory safety', () => {
  it('matches the actual order states supported by the schema and server logic', () => {
    expect(ORDER_STATUSES).toEqual([
      'PENDING_PAYMENT',
      'PAID',
      'PROCESSING',
      'SHIPPED',
      'COMPLETED',
      'CANCELLED',
    ]);
    expect(ORDER_STATUSES).not.toContain('PACKED');
    expect(ORDER_STATUSES).not.toContain('DELIVERED');
    expect(ORDER_STATUSES).not.toContain('CLOSED');
    expect(PAYMENT_STATUSES).toContain('PAID');
    expect(PAYMENT_STATUSES).toContain('FAILED');
    expect(PAYMENT_STATUSES).toContain('CANCELLED');
  });

  it('allows only the real supported transitions in the current model', () => {
    expect(isOrderTransitionAllowed('PENDING_PAYMENT', 'PAID')).toBe(true);
    expect(isOrderTransitionAllowed('PENDING_PAYMENT', 'CANCELLED')).toBe(true);
    expect(isOrderTransitionAllowed('PAID', 'PROCESSING')).toBe(true);
    expect(isOrderTransitionAllowed('PAID', 'CANCELLED')).toBe(true);
    expect(isOrderTransitionAllowed('PROCESSING', 'SHIPPED')).toBe(true);
    expect(isOrderTransitionAllowed('SHIPPED', 'COMPLETED')).toBe(true);
    expect(isOrderTransitionAllowed('SHIPPED', 'CANCELLED')).toBe(true);

    expect(isOrderTransitionAllowed('COMPLETED', 'PENDING_PAYMENT')).toBe(false);
    expect(isOrderTransitionAllowed('DELIVERED' as never, 'PENDING_PAYMENT' as never)).toBe(false);
    expect(isOrderTransitionAllowed('CANCELLED', 'PAID')).toBe(false);
    expect(isOrderTransitionAllowed('PAID', 'PAID')).toBe(false);
  });

  it('rejects unsupported order lifecycle states and keeps valid statuses intact', () => {
    expect(isValidOrderStatus('PENDING_PAYMENT')).toBe(true);
    expect(isValidOrderStatus('PAID')).toBe(true);
    expect(isValidOrderStatus('PROCESSING')).toBe(true);
    expect(isValidOrderStatus('SHIPPED')).toBe(true);
    expect(isValidOrderStatus('COMPLETED')).toBe(true);
    expect(isValidOrderStatus('CANCELLED')).toBe(true);

    expect(isValidOrderStatus('PACKED')).toBe(false);
    expect(isValidOrderStatus('DELIVERED')).toBe(false);
    expect(isValidOrderStatus('CLOSED')).toBe(false);
    expect(isValidOrderStatus(null)).toBe(false);
  });

  it('keeps order totals and quantity integrity enforced by the core helper', () => {
    expect(calculateOrderTotals(2500, 2)).toMatchObject({
      unitPriceCents: 2500,
      quantity: 2,
      subtotalCents: 5000,
      totalCents: 5000,
    });

    expect(() => calculateOrderTotals(-1, 2)).toThrow();
    expect(() => calculateOrderTotals(2500, 0)).toThrow();
    expect(isValidPaymentStatus('PAID')).toBe(true);
    expect(isValidPaymentStatus('FAILED')).toBe(true);
    expect(isValidPaymentStatus('REFUNDED')).toBe(true);
  });
});

import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  createProviderSignature,
  derivePaymentIdempotencyKey,
  isCallbackSignatureValid,
  isDuplicateCallback,
  isPaymentCallbackAllowed,
  isPaymentStatusAllowedTransition,
  reconcileFinanceTotals,
} from './payment';

describe('payment workflow logic', () => {
  it('accepts valid provider signatures and rejects invalid ones', () => {
    const payload = {
      provider: 'STRIPE',
      reference: 'pi_123',
      orderId: 'ord_456',
      paymentStatus: 'PAID' as const,
      amountCents: 1250,
      currency: 'USD',
    };

    const secret = 'super-secret';
    const validSignature = createProviderSignature(payload, secret);

    expect(isCallbackSignatureValid({ ...payload, signature: validSignature }, secret)).toBe(true);
    expect(isCallbackSignatureValid({ ...payload, signature: 'bad-signature' }, secret)).toBe(false);
    expect(isCallbackSignatureValid({ ...payload, signature: validSignature }, '')).toBe(false);
  });

  it('enforces allowed payment state transitions and blocks invalid ones', () => {
    expect(isPaymentStatusAllowedTransition('PENDING', 'PAID')).toBe(true);
    expect(isPaymentStatusAllowedTransition('PENDING', 'FAILED')).toBe(true);
    expect(isPaymentStatusAllowedTransition('AUTHORIZED', 'PAID')).toBe(true);
    expect(isPaymentStatusAllowedTransition('PAID', 'FAILED')).toBe(false);
    expect(isPaymentStatusAllowedTransition('FAILED', 'PAID')).toBe(false);
  });

  it('prevents duplicate callback processing and derives stable idempotency keys', () => {
    const eventIds = new Set(['evt_1', 'evt_2']);
    const keyA = derivePaymentIdempotencyKey('STRIPE', 'ord_456', 'pi_123');
    const keyB = derivePaymentIdempotencyKey('STRIPE', 'ord_456', 'pi_123');

    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe('');
    expect(isDuplicateCallback('evt_1', eventIds)).toBe(true);
    expect(isDuplicateCallback('evt_999', eventIds)).toBe(false);
  });

  it('reconciles money totals for successful, failed, and refunded payments', () => {
    expect(reconcileFinanceTotals({ orderTotalCents: 2000, paymentStatus: 'PAID', currency: 'USD' })).toMatchObject({
      netCents: 2000,
      direction: 'SALE',
      requiresReview: false,
    });

    expect(reconcileFinanceTotals({ orderTotalCents: 2000, paymentStatus: 'FAILED', currency: 'USD' })).toMatchObject({
      netCents: 0,
      direction: 'ADJUSTMENT',
      requiresReview: true,
    });

    expect(reconcileFinanceTotals({ orderTotalCents: 2000, paymentStatus: 'REFUNDED', refundedCents: 500, currency: 'USD' })).toMatchObject({
      netCents: -500,
      direction: 'REFUND',
      requiresReview: false,
    });
  });

  it('uses the expected provider-signature format for backends', () => {
    const payload = {
      provider: 'PAYPAL',
      reference: 'PAYID-123',
      orderId: 'ord_789',
      paymentStatus: 'AUTHORIZED' as const,
      amountCents: 9900,
      currency: 'USD',
    };

    const secret = 'pay-secret';
    const canonical = ['PAYPAL', 'PAYID-123', 'ord_789', '9900', 'USD', 'AUTHORIZED'].join(':');
    const expected = createHmac('sha256', secret).update(canonical).digest('hex');

    expect(createProviderSignature(payload, secret)).toBe(expected);
  });

  it('rejects duplicate or already-processed callbacks even when the signature is valid', () => {
    const payload = {
      provider: 'STRIPE',
      reference: 'pi_999',
      orderId: 'ord_999',
      paymentStatus: 'PAID' as const,
      amountCents: 4500,
      currency: 'USD',
    };

    const secret = 'callback-secret';
    const signature = createProviderSignature(payload, secret);

    expect(isPaymentCallbackAllowed({ ...payload, signature }, secret, 'PAID')).toBe(false);
    expect(isPaymentCallbackAllowed({ ...payload, signature }, secret, 'PENDING')).toBe(true);
  });

  it('keeps successful, failed, cancelled, refunded, and duplicate callback states reconciled without false revenue', () => {
    expect(reconcileFinanceTotals({ orderTotalCents: 2000, paymentStatus: 'PAID' })).toMatchObject({
      netCents: 2000,
      direction: 'SALE',
      requiresReview: false,
    });

    expect(reconcileFinanceTotals({ orderTotalCents: 2000, paymentStatus: 'FAILED' })).toMatchObject({
      netCents: 0,
      direction: 'ADJUSTMENT',
      requiresReview: true,
    });

    expect(reconcileFinanceTotals({ orderTotalCents: 2000, paymentStatus: 'CANCELLED' })).toMatchObject({
      netCents: 0,
      direction: 'ADJUSTMENT',
      requiresReview: true,
    });

    expect(reconcileFinanceTotals({ orderTotalCents: 2000, paymentStatus: 'REFUNDED', refundedCents: 500 })).toMatchObject({
      netCents: -500,
      direction: 'REFUND',
      requiresReview: false,
    });

    const seen = new Set(['pi_duplicate']);
    const payload = {
      provider: 'STRIPE',
      reference: 'pi_duplicate',
      orderId: 'ord_duplicate',
      paymentStatus: 'PAID' as const,
      amountCents: 3300,
      currency: 'USD',
    };
    const secret = 'duplicate-secret';
    const signature = createProviderSignature(payload, secret);

    expect(isDuplicateCallback('pi_duplicate', seen)).toBe(true);
    expect(isPaymentCallbackAllowed({ ...payload, signature }, secret, 'PENDING', seen)).toBe(false);
  });
});

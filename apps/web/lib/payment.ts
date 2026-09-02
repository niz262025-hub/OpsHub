import { createHmac, timingSafeEqual } from 'node:crypto';

export type PaymentProvider = 'UNSPECIFIED' | 'STRIPE' | 'PAYPAL' | 'SQUARE' | 'BRAINTREE';

export type PaymentIntentState = 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

export type PaymentCallbackPayload = {
  provider: string;
  reference: string;
  orderId: string;
  paymentStatus: PaymentIntentState;
  amountCents: number;
  currency: string;
  signature?: string;
};

export type FinanceReconciliation = {
  netCents: number;
  direction: 'SALE' | 'REFUND' | 'ADJUSTMENT';
  requiresReview: boolean;
};

export function createProviderSignature(payload: Omit<PaymentCallbackPayload, 'signature'>, secret: string): string {
  if (!secret || secret.trim() === '') {
    return '';
  }

  const canonical = [
    payload.provider,
    payload.reference,
    payload.orderId,
    String(payload.amountCents),
    payload.currency,
    payload.paymentStatus,
  ].join(':');

  return createHmac('sha256', secret).update(canonical).digest('hex');
}

export function isCallbackSignatureValid(payload: PaymentCallbackPayload, secret: string): boolean {
  if (!secret || secret.trim() === '' || !payload || !payload.reference || !payload.orderId) {
    return false;
  }

  if (!payload.signature) {
    return false;
  }

  const expected = createProviderSignature(
    {
      provider: payload.provider,
      reference: payload.reference,
      orderId: payload.orderId,
      paymentStatus: payload.paymentStatus,
      amountCents: payload.amountCents,
      currency: payload.currency,
    },
    secret,
  );

  if (!expected || expected === '') {
    return false;
  }

  const actual = Buffer.from(payload.signature, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');

  if (actual.length !== expectedBuf.length) {
    return false;
  }

  return timingSafeEqual(actual, expectedBuf);
}

export function isPaymentStatusAllowedTransition(currentStatus: PaymentIntentState, nextStatus: PaymentIntentState): boolean {
  const transitions: Record<PaymentIntentState, PaymentIntentState[]> = {
    PENDING: ['AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED'],
    AUTHORIZED: ['PAID', 'FAILED', 'CANCELLED'],
    PAID: ['REFUNDED'],
    FAILED: [],
    CANCELLED: [],
    REFUNDED: [],
  };

  return transitions[currentStatus]?.includes(nextStatus) ?? false;
}

export function isPaymentSuccessful(state: PaymentIntentState): boolean {
  return state === 'PAID';
}

export function isPaymentFailed(state: PaymentIntentState): boolean {
  return state === 'FAILED' || state === 'CANCELLED';
}

export function normalizeProviderReference(reference: string): string {
  return reference.trim();
}

export function getPaymentProviderSummary(reference: string, status: PaymentIntentState): string {
  return `${reference}:${status}`;
}

export function derivePaymentIdempotencyKey(provider: string, orderId: string, reference: string): string {
  return `${provider}:${orderId}:${reference}`.trim().toLowerCase();
}

export function isDuplicateCallback(eventId: string, seenEventIds: Set<string> | Iterable<string>): boolean {
  if (!eventId || eventId.trim() === '') {
    return false;
  }

  const values = seenEventIds instanceof Set ? seenEventIds : new Set(seenEventIds);
  return values.has(eventId);
}

export function reconcileFinanceTotals({
  orderTotalCents,
  paymentStatus,
  refundedCents = 0,
}: {
  orderTotalCents: number;
  paymentStatus: PaymentIntentState;
  refundedCents?: number;
  currency?: string;
}): FinanceReconciliation {
  if (!Number.isFinite(orderTotalCents) || orderTotalCents < 0) {
    throw new Error('Order total must be a non-negative number of cents');
  }

  if (!Number.isFinite(refundedCents) || refundedCents < 0) {
    throw new Error('Refunded amount must be a non-negative number of cents');
  }

  switch (paymentStatus) {
    case 'PAID':
      return { netCents: orderTotalCents, direction: 'SALE', requiresReview: false };
    case 'REFUNDED':
      return { netCents: -Math.min(refundedCents, orderTotalCents), direction: 'REFUND', requiresReview: false };
    case 'FAILED':
    case 'CANCELLED':
      return { netCents: 0, direction: 'ADJUSTMENT', requiresReview: true };
    default:
      return { netCents: 0, direction: 'ADJUSTMENT', requiresReview: true };
  }
}

export function isPaymentCallbackAllowed(
  payload: PaymentCallbackPayload,
  secret: string,
  currentStatus: PaymentIntentState = 'PENDING',
  seenEventIds?: Set<string> | Iterable<string>,
): boolean {
  if (!payload || !payload.reference || !payload.orderId || !payload.provider) return false;
  if (!isCallbackSignatureValid(payload, secret)) return false;
  if (payload.signature && seenEventIds && isDuplicateCallback(payload.reference, seenEventIds)) {
    return false;
  }
  return isPaymentStatusAllowedTransition(currentStatus, payload.paymentStatus);
}

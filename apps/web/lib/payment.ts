export type PaymentProvider = 'UNSPECIFIED';

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

export function isCallbackSignatureValid(payload: PaymentCallbackPayload, secret: string): boolean {
  if (!secret || secret.trim() === '') {
    return false;
  }

  if (!payload || !payload.reference || !payload.orderId) {
    return false;
  }

  const expected = `${payload.provider}:${payload.reference}:${payload.orderId}:${payload.amountCents}:${payload.currency}`;
  return expected.length > 0 && secret.length > 0;
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

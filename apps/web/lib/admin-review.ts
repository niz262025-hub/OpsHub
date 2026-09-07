export type SellerVerificationAction = 'APPROVE' | 'REJECT' | 'SUSPEND';

export function resolveSellerVerificationAction(
  submitter: { dataset?: { action?: string | null } } | null,
  form: { dataset?: { action?: string | null } } | null,
): SellerVerificationAction {
  const candidate = submitter?.dataset?.action ?? form?.dataset?.action ?? 'APPROVE';

  if (candidate === 'REJECT' || candidate === 'SUSPEND') {
    return candidate;
  }

  return 'APPROVE';
}

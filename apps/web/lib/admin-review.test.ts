import { describe, expect, it } from 'vitest';

import { resolveSellerVerificationAction } from './admin-review';

describe('resolveSellerVerificationAction', () => {
  it('reads the clicked submit button action before falling back to the form dataset', () => {
    expect(resolveSellerVerificationAction({ dataset: { action: 'APPROVE' } }, null)).toBe('APPROVE');
    expect(resolveSellerVerificationAction(null, { dataset: { action: 'REJECT' } })).toBe('REJECT');
    expect(resolveSellerVerificationAction({ dataset: { action: 'SUSPEND' } }, { dataset: { action: 'APPROVE' } })).toBe('SUSPEND');
  });
});

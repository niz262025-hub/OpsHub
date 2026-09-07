import { describe, expect, it } from 'vitest';

import { normalizeProfileRoleResult } from './auth';

describe('normalizeProfileRoleResult', () => {
  it('preserves an authenticated CUSTOMER role when the seller profile lookup is empty or denied', () => {
    const result = normalizeProfileRoleResult({
      profileData: { role: 'CUSTOMER', account_status: 'ACTIVE' },
      sellerError: new Error('permission denied for table seller_profiles'),
      sellerData: null,
    });

    expect(result.role).toBe('CUSTOMER');
    expect(result.accountStatus).toBe('ACTIVE');
    expect(result.error).toBeNull();
    expect(result.verificationStatus).toBeNull();
  });

  it('keeps the seller verification status when the seller profile exists', () => {
    const result = normalizeProfileRoleResult({
      profileData: { role: 'SELLER', account_status: 'ACTIVE' },
      sellerData: { verification_status: 'VERIFIED' },
      sellerError: null,
    });

    expect(result.role).toBe('SELLER');
    expect(result.verificationStatus).toBe('VERIFIED');
  });
});

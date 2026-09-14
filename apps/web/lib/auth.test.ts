import { describe, expect, it } from 'vitest';

import { getAuthRedirectPathForRole, getSellerProfileStatusField, normalizeProfileRoleResult } from './auth';

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

  it('uses only the canonical seller verification field and resolves an active SELLER correctly', () => {
    expect(getSellerProfileStatusField()).toBe('verification_status');

    const result = normalizeProfileRoleResult({
      profileData: { role: 'SELLER', account_status: 'ACTIVE' },
      sellerData: { verification_status: 'VERIFIED' },
      sellerError: null,
    });

    expect(result.role).toBe('SELLER');
    expect(result.accountStatus).toBe('ACTIVE');
    expect(result.verificationStatus).toBe('VERIFIED');
    expect(result.error).toBeNull();
    expect(getAuthRedirectPathForRole({ role: 'SELLER', accountStatus: 'ACTIVE', verificationStatus: 'VERIFIED' })).toBe('/marketplace');
  });

  it('uses the canonical customer redirect path for customer roles', () => {
    expect(getAuthRedirectPathForRole({ role: 'CUSTOMER' })).toBe('/customer/orders');
    expect(getAuthRedirectPathForRole({ role: 'SELLER', verificationStatus: 'VERIFIED' })).toBe('/marketplace');
    expect(getAuthRedirectPathForRole({ role: 'ADMIN', accountStatus: 'ACTIVE' })).toBe('/admin/review');
  });
});

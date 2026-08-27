import { describe, expect, it } from 'vitest';
import {
  canAccessProtectedPage,
  canAccessSellerRecord,
  canUpdateVerificationStatus,
  getSellerAccessResult,
  isAdminRole,
  normalizeSellerInput,
  sanitizeRoleAssignment,
} from './index';

describe('seller access rules', () => {
  it('returns pending when seller is not verified', () => {
    expect(getSellerAccessResult('PENDING', 'ACTIVE')).toEqual({
      canAccessHub: false,
      reason: 'verification_pending',
    });
  });

  it('allows verified active seller', () => {
    expect(getSellerAccessResult('VERIFIED', 'ACTIVE')).toEqual({ canAccessHub: true });
  });

  it('blocks rejected and suspended sellers', () => {
    expect(getSellerAccessResult('REJECTED', 'ACTIVE')).toEqual({
      canAccessHub: false,
      reason: 'verification_rejected',
    });
    expect(getSellerAccessResult('SUSPENDED', 'ACTIVE')).toEqual({
      canAccessHub: false,
      reason: 'verification_suspended',
    });
  });

  it('prefers account suspension', () => {
    expect(getSellerAccessResult('VERIFIED', 'SUSPENDED')).toEqual({
      canAccessHub: false,
      reason: 'account_suspended',
    });
  });
});

describe('admin and registration helpers', () => {
  it('exposes admin role detection', () => {
    expect(isAdminRole('ADMIN')).toBe(true);
    expect(isAdminRole('SELLER')).toBe(false);
  });

  it('normalizes seller registration input', () => {
    expect(
      normalizeSellerInput({
        fullName: '  Ada Stone  ',
        email: ' ada@example.com ',
        phone: ' 123 ',
        businessName: ' Stone Labs ',
        businessRegistrationNumber: '  REG-42 ',
        businessAddress: ' 1 Market St ',
      }),
    ).toEqual({
      full_name: 'Ada Stone',
      email: 'ada@example.com',
      phone: '123',
      business_name: 'Stone Labs',
      business_registration_number: 'REG-42',
      business_address: '1 Market St',
    });
  });
});

describe('phase 1 access controls', () => {
  it('denies a seller from another profile', () => {
    expect(
      canAccessSellerRecord({
        actorId: 'user-1',
        targetId: 'user-2',
        actorRole: 'SELLER',
        actorAccountStatus: 'ACTIVE',
      }),
    ).toBe(false);
  });

  it('prevents seller self-promotion to admin', () => {
    expect(sanitizeRoleAssignment('SELLER', 'ADMIN')).toBe('SELLER');
  });

  it('prevents sellers from changing verification status', () => {
    expect(canUpdateVerificationStatus('SELLER', 'VERIFIED')).toBe(false);
  });

  it('requires authentication before the protected page is open', () => {
    expect(canAccessProtectedPage({ authenticated: false, role: 'SELLER' })).toBe(false);
  });

  it('allows admins to approve, reject, and suspend sellers', () => {
    expect(canUpdateVerificationStatus('ADMIN', 'APPROVE')).toBe(true);
    expect(canUpdateVerificationStatus('ADMIN', 'REJECT')).toBe(true);
    expect(canUpdateVerificationStatus('ADMIN', 'SUSPEND')).toBe(true);
  });
});

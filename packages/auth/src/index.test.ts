import { describe, expect, it } from 'vitest';
import {
  canAccessAdminRoute,
  canAccessProtectedPage,
  canAccessSellerRecord,
  canAdminManageSellerStatus,
  canAdminMutateSellerStatus,
  canSignOut,
  canUpdateVerificationStatus,
  evaluateAdminAccess,
  getSellerAccessResult,
  getUserLandingRoute,
  isAdminRole,
  isStaleAdminSession,
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

  it('grants active admin access only to admin routes and admin actions', () => {
    expect(canAccessAdminRoute('ADMIN', 'ACTIVE')).toBe(true);
    expect(canAccessAdminRoute('ADMIN', 'SUSPENDED')).toBe(false);
    expect(canAccessAdminRoute('SELLER', 'ACTIVE')).toBe(false);
    expect(canAdminManageSellerStatus('ADMIN', 'ACTIVE')).toBe(true);
    expect(canAdminManageSellerStatus('SELLER', 'ACTIVE')).toBe(false);
  });

  it('blocks stale or invalid admin sessions', () => {
    expect(canSignOut({ authenticated: true, role: 'ADMIN', accountStatus: 'ACTIVE' })).toBe(true);
    expect(canSignOut({ authenticated: false, role: 'ADMIN', accountStatus: 'ACTIVE' })).toBe(false);
    expect(isStaleAdminSession({ authenticated: true, role: 'ADMIN', accountStatus: 'ACTIVE' })).toBe(false);
    expect(isStaleAdminSession({ authenticated: true, role: 'ADMIN', accountStatus: 'SUSPENDED' })).toBe(true);
    expect(isStaleAdminSession({ authenticated: true, role: 'SELLER', accountStatus: 'ACTIVE' })).toBe(true);
    expect(isStaleAdminSession(null)).toBe(true);
  });

  it('rejects inactive admin and non-admin for protected admin routes', () => {
    expect(evaluateAdminAccess({ authenticated: true, role: 'ADMIN', accountStatus: 'ACTIVE' })).toEqual({ canAccess: true });
    expect(evaluateAdminAccess({ authenticated: true, role: 'ADMIN', accountStatus: 'SUSPENDED' })).toEqual({
      canAccess: false,
      reason: 'inactive_admin',
    });
    expect(evaluateAdminAccess({ authenticated: true, role: 'SELLER', accountStatus: 'ACTIVE' })).toEqual({
      canAccess: false,
      reason: 'non_admin',
    });
    expect(evaluateAdminAccess(null)).toEqual({ canAccess: false, reason: 'missing_session' });
  });

  it('requires active admin status for any seller-verification mutation', () => {
    expect(canAdminMutateSellerStatus('ADMIN', 'ACTIVE', 'APPROVE')).toBe(true);
    expect(canAdminMutateSellerStatus('ADMIN', 'ACTIVE', 'REJECT')).toBe(true);
    expect(canAdminMutateSellerStatus('ADMIN', 'ACTIVE', 'SUSPEND')).toBe(true);
    expect(canAdminMutateSellerStatus('ADMIN', 'SUSPENDED', 'APPROVE')).toBe(false);
    expect(canAdminMutateSellerStatus('SELLER', 'ACTIVE', 'APPROVE')).toBe(false);
    expect(canAdminMutateSellerStatus('ADMIN', 'ACTIVE', 'DELETE')).toBe(false);
  });

  it('routes seller sessions to the correct post-login state', () => {
    expect(getUserLandingRoute('ADMIN', 'ACTIVE', 'PENDING')).toBe('/admin/review');
    expect(getUserLandingRoute('SELLER', 'ACTIVE', 'PENDING')).toBe('/verification/pending');
    expect(getUserLandingRoute('SELLER', 'ACTIVE', 'VERIFIED')).toBe('/marketplace');
    expect(getUserLandingRoute('SELLER', 'ACTIVE', 'REJECTED')).toBe('/verification/rejected');
    expect(getUserLandingRoute('SELLER', 'SUSPENDED', 'VERIFIED')).toBe('/account/suspended');
    expect(getUserLandingRoute(null, null, null)).toBe('/auth/login');
  });
});

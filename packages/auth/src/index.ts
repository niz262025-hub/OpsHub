export type UserRole = 'ADMIN' | 'SELLER' | 'CUSTOMER';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED';
export type SellerVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
export type VerificationAction = 'APPROVE' | 'REJECT' | 'SUSPEND';

export type ProfileRole = UserRole;

export interface ProfileRecord {
  id: string;
  email: string;
  full_name: string;
  role: ProfileRole;
  account_status: AccountStatus;
  created_at: string;
  updated_at: string;
}

export interface SellerProfileRecord {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  business_name: string;
  business_registration_number: string | null;
  business_address: string;
  verification_status: SellerVerificationStatus;
  verification_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface SellerAccessResult {
  canAccessHub: boolean;
  reason?: string;
}

export interface AuthSessionState {
  authenticated: boolean;
  role?: UserRole | null;
}

export interface SellerRecordAccessInput {
  actorId: string;
  targetId: string;
  actorRole: UserRole | null;
  actorAccountStatus: AccountStatus | null;
}

export interface AuthSessionLike {
  authenticated?: boolean;
  role?: UserRole | null;
  accountStatus?: AccountStatus | null;
}

export interface AdminAccessCheckResult {
  canAccess: boolean;
  reason?: 'missing_session' | 'non_admin' | 'inactive_admin' | 'stale_session';
}

export function getSellerAccessResult(
  verificationStatus: SellerVerificationStatus | null,
  accountStatus: AccountStatus | null,
): SellerAccessResult {
  if (accountStatus === 'SUSPENDED') {
    return { canAccessHub: false, reason: 'account_suspended' };
  }

  switch (verificationStatus) {
    case 'VERIFIED':
      return { canAccessHub: true };
    case 'PENDING':
      return { canAccessHub: false, reason: 'verification_pending' };
    case 'REJECTED':
      return { canAccessHub: false, reason: 'verification_rejected' };
    case 'SUSPENDED':
      return { canAccessHub: false, reason: 'verification_suspended' };
    default:
      return { canAccessHub: false, reason: 'verification_pending' };
  }
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === 'ADMIN';
}

export function normalizeSellerInput(input: {
  fullName: string;
  email: string;
  phone: string;
  businessName: string;
  businessRegistrationNumber?: string | null;
  businessAddress: string;
}) {
  return {
    full_name: input.fullName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    business_name: input.businessName.trim(),
    business_registration_number: input.businessRegistrationNumber?.trim() || null,
    business_address: input.businessAddress.trim(),
  };
}

export function canAccessSellerRecord(input: SellerRecordAccessInput): boolean {
  if (!input.actorId || !input.targetId) return false;
  if (input.actorAccountStatus === 'SUSPENDED') return false;
  if (input.actorRole !== 'SELLER') return false;
  return input.actorId === input.targetId;
}

export function sanitizeRoleAssignment(currentRole: UserRole, requestedRole: UserRole | null | undefined): UserRole {
  if (currentRole === 'SELLER' && requestedRole === 'ADMIN') {
    return 'SELLER';
  }

  return currentRole;
}

export function forceSellerPendingStatus(): SellerVerificationStatus {
  return 'PENDING';
}

export function canUpdateVerificationStatus(actorRole: UserRole | null, action: VerificationAction | string): boolean {
  if (actorRole !== 'ADMIN') return false;

  return action === 'APPROVE' || action === 'REJECT' || action === 'SUSPEND';
}

export function canSellerUpdateOwnProfile(current: Partial<SellerProfileRecord>, next: Partial<SellerProfileRecord>): boolean {
  if (next.verification_status && next.verification_status !== current.verification_status) {
    return false;
  }

  if (next.verification_note && next.verification_note !== current.verification_note) {
    return false;
  }

  return true;
}

export function canAdminReviewSeller(actorRole: UserRole | null, accountStatus: AccountStatus | null): boolean {
  return actorRole === 'ADMIN' && accountStatus === 'ACTIVE';
}

export function canAccessAdminRoute(actorRole: UserRole | null, accountStatus: AccountStatus | null): boolean {
  return canAdminReviewSeller(actorRole, accountStatus);
}

export function canAdminManageSellerStatus(actorRole: UserRole | null, accountStatus: AccountStatus | null): boolean {
  return canAccessAdminRoute(actorRole, accountStatus);
}

export function canSignOut(session?: AuthSessionLike | null): boolean {
  return Boolean(session?.authenticated);
}

export function isStaleAdminSession(session?: AuthSessionLike | null): boolean {
  if (!session?.authenticated) {
    return true;
  }

  if (session.role !== 'ADMIN') {
    return true;
  }

  if (session.accountStatus !== 'ACTIVE') {
    return true;
  }

  return false;
}

export function evaluateAdminAccess(session?: AuthSessionLike | null): AdminAccessCheckResult {
  if (!session || !session.authenticated) {
    return { canAccess: false, reason: 'missing_session' };
  }

  if (session.role !== 'ADMIN') {
    return { canAccess: false, reason: 'non_admin' };
  }

  if (session.accountStatus !== 'ACTIVE') {
    return { canAccess: false, reason: 'inactive_admin' };
  }

  return { canAccess: true };
}

export function canAdminMutateSellerStatus(
  actorRole: UserRole | null,
  accountStatus: AccountStatus | null,
  action: VerificationAction | string,
): boolean {
  if (!canAdminReviewSeller(actorRole, accountStatus)) {
    return false;
  }

  return action === 'APPROVE' || action === 'REJECT' || action === 'SUSPEND';
}

export function getAuthSessionState(session?: AuthSessionLike | null): AuthSessionState {
  const authenticated = Boolean(session?.authenticated);
  return {
    authenticated,
    role: authenticated ? (session?.role ?? null) : null,
  };
}

export function getUserLandingRoute(
  role: UserRole | null | undefined,
  accountStatus: AccountStatus | null | undefined,
  verificationStatus: SellerVerificationStatus | string | null | undefined,
): string {
  if (role === 'ADMIN' && accountStatus === 'ACTIVE') {
    return '/admin/review';
  }

  if (role === 'CUSTOMER') {
    return '/customer/orders';
  }

  if (role === 'SELLER') {
    if (accountStatus === 'SUSPENDED') {
      return '/account/suspended';
    }

    if (verificationStatus === 'VERIFIED') {
      return '/marketplace';
    }

    if (verificationStatus === 'REJECTED') {
      return '/verification/rejected';
    }

    if (verificationStatus === 'SUSPENDED') {
      return '/account/suspended';
    }

    return '/verification/pending';
  }

  return '/auth/login';
}

export function getLogoutState(): AuthSessionState {
  return { authenticated: false, role: null };
}

export function canAccessProtectedPage(session: AuthSessionState | AuthSessionLike | null | undefined): boolean {
  const state = getAuthSessionState(session ?? null);
  return Boolean(state.authenticated && state.role);
}

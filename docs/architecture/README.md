# OpsHub Architecture — Phase 1

## Authentication and seller verification

The Phase 1 foundation protects access to the seller marketplace and community by enforcing verified seller access before the Hub becomes available.

### Principles

- Supabase Auth owns identity and session persistence.
- `auth.users` is the source of truth for logins.
- `public.profiles` stores role and account status metadata.
- `public.seller_profiles` stores seller onboarding and verification state.
- Admin verification actions remain controlled and server-side.
- Client code never chooses or assigns the admin role.

### Access rules

- SELLER + ACTIVE + VERIFIED => allowed into the Hub.
- SELLER + PENDING => can log in and view status only.
- SELLER + REJECTED or SUSPENDED => denied from the Hub.
- ADMIN + ACTIVE => can review and verify seller applications.

### Security constraints

- RLS protects all profile and seller-profile writes.
- Sellers may only read or update their own records.
- Sellers cannot change another seller's profile or verification status.
- Service-role credentials are not placed in browser build output.

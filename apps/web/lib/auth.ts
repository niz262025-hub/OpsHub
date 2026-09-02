import { getSupabaseBrowserClient } from './supabase';

export async function signInWithEmail(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpSeller(payload: {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  businessName: string;
  businessRegistrationNumber?: string | null;
  businessAddress: string;
}) {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        full_name: payload.fullName,
        seller_registration: true,
        phone: payload.phone,
        business_name: payload.businessName,
        business_registration_number: payload.businessRegistrationNumber ?? null,
        business_address: payload.businessAddress,
      },
    },
  });

  if (error) return { data, error };

  return { data, error: null };
}

export async function signUpCustomer(payload: {
  fullName: string;
  email: string;
  password: string;
  phone?: string | null;
  preferredName?: string | null;
}) {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        full_name: payload.fullName,
        customer_registration: true,
        phone: payload.phone ?? null,
        preferred_name: payload.preferredName ?? null,
      },
    },
  });

  if (error) return { data, error };

  return { data, error: null };
}

export async function signOut() {
  const supabase = getSupabaseBrowserClient();
  return supabase.auth.signOut();
}

export async function getSession() {
  const supabase = getSupabaseBrowserClient();
  return supabase.auth.getSession();
}

export async function getCurrentUser() {
  const supabase = getSupabaseBrowserClient();
  return supabase.auth.getUser();
}

export async function getCurrentUserProfileRole() {
  const supabase = getSupabaseBrowserClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return {
      role: null,
      accountStatus: null,
      verificationStatus: null,
      error: userError ?? new Error('No authenticated user found'),
    };
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('role, account_status')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError) {
    return { role: null, accountStatus: null, verificationStatus: null, error: profileError };
  }

  const { data: sellerData, error: sellerError } = await supabase
    .from('seller_profiles')
    .select('verification_status')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (sellerError) {
    return { role: null, accountStatus: null, verificationStatus: null, error: sellerError };
  }

  return {
    role: profileData?.role ?? null,
    accountStatus: profileData?.account_status ?? null,
    verificationStatus: sellerData?.verification_status ?? null,
    error: null,
  };
}

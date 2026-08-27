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

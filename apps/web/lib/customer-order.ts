export type SellerProfileBankDetails = {
  bank_name?: string | null;
  account_holder_name?: string | null;
  account_number?: string | null;
  payment_instructions?: string | null;
  qr_image_url?: string | null;
};

export async function getSellerBankDetailsForOrder(
  supabaseClient: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: SellerProfileBankDetails | null; error: { message: string } | null }>;
        };
      };
    };
  },
  sellerId: string,
) {
  return supabaseClient.from('seller_profiles').select('bank_name, account_holder_name, account_number, payment_instructions, qr_image_url').eq('user_id', sellerId).maybeSingle();
}

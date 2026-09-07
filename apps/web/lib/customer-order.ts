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
  try {
    const result = await supabaseClient.from('seller_profiles').select('bank_name, account_holder_name, account_number, payment_instructions, qr_image_url').eq('user_id', sellerId).maybeSingle();
    if (result.error && /column .*bank_name.* does not exist|does not exist/i.test(result.error.message)) {
      return { data: null, error: null };
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load seller bank details.';
    if (/column .*bank_name.* does not exist|does not exist/i.test(message)) {
      return { data: null, error: null };
    }
    return { data: null, error: { message } };
  }
}

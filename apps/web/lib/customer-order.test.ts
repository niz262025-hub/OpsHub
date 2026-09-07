import { describe, expect, it, vi } from 'vitest';

import { getSellerBankDetailsForOrder } from './customer-order';

describe('getSellerBankDetailsForOrder', () => {
  it('looks up the seller profile by user_id and returns the bank details', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        bank_name: 'Test Bank',
        account_holder_name: 'Jane Seller',
        account_number: '123456',
        payment_instructions: 'Send by bank transfer',
        qr_image_url: 'https://example.com/qr.png',
      },
      error: null,
    }));

    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    const result = await getSellerBankDetailsForOrder({ from }, 'seller-123');

    expect(from).toHaveBeenCalledWith('seller_profiles');
    expect(result.data?.bank_name).toBe('Test Bank');
    expect(result.data?.account_number).toBe('123456');
    expect(result.error).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import {
  canSubmitManualTransferProof,
  canVerifyManualTransfer,
  getManualPaymentSummary,
  validateSellerPaymentSettings,
  validateTransferProof,
} from './manual-payment';

describe('manual bank transfer workflow', () => {
  it('accepts valid bank details and QR configuration', () => {
    expect(
      validateSellerPaymentSettings({
        bankName: 'Maybank',
        accountHolderName: 'Seller Name',
        accountNumber: '1234567890',
        paymentInstructions: 'Transfer to the account above before 5pm.',
      }).valid,
    ).toBe(true);

    expect(
      validateSellerPaymentSettings({
        qrImageUrl: 'https://example.com/duitnow.png',
        paymentInstructions: 'Scan the QR code and include the reference number.',
      }).valid,
    ).toBe(true);
  });

  it('rejects invalid manual payment settings', () => {
    expect(
      validateSellerPaymentSettings({
        bankName: '',
        accountHolderName: '',
        accountNumber: '',
        paymentInstructions: '',
      }).valid,
    ).toBe(false);
  });

  it('accepts valid payment proof submissions and blocks invalid ones', () => {
    expect(
      validateTransferProof({
        proofUrl: 'https://example.com/proof.jpg',
        transferReference: 'T123456',
        transferDate: '2026-09-03T09:00:00.000Z',
      }).valid,
    ).toBe(true);

    expect(
      validateTransferProof({
        proofUrl: '',
        transferReference: '',
        transferDate: '',
      }).valid,
    ).toBe(false);
  });

  it('allows sellers and admins to verify manual transfer, but not buyers or cancelled orders', () => {
    expect(
      canVerifyManualTransfer({
        actorId: 'seller-1',
        sellerId: 'seller-1',
        buyerId: 'buyer-1',
        orderStatus: 'PENDING_PAYMENT',
        paymentStatus: 'PENDING',
        isAdmin: false,
      }),
    ).toBe(true);

    expect(
      canVerifyManualTransfer({
        actorId: 'buyer-1',
        sellerId: 'seller-1',
        buyerId: 'buyer-1',
        orderStatus: 'PENDING_PAYMENT',
        paymentStatus: 'PENDING',
        isAdmin: false,
      }),
    ).toBe(false);

    expect(
      canVerifyManualTransfer({
        actorId: 'admin-1',
        sellerId: 'seller-1',
        buyerId: 'buyer-1',
        orderStatus: 'CANCELLED',
        paymentStatus: 'CANCELLED',
        isAdmin: true,
      }),
    ).toBe(false);
  });

  it('treats duplicate verification as idempotent', () => {
    expect(
      canVerifyManualTransfer({
        actorId: 'seller-1',
        sellerId: 'seller-1',
        buyerId: 'buyer-1',
        orderStatus: 'PROCESSING',
        paymentStatus: 'PAID',
        isAdmin: false,
      }),
    ).toBe(true);
  });

  it('allows customers to submit proof only before payment is confirmed', () => {
    expect(
      canSubmitManualTransferProof({
        actorId: 'buyer-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        orderStatus: 'PENDING_PAYMENT',
        paymentStatus: 'PENDING',
      }),
    ).toBe(true);

    expect(
      canSubmitManualTransferProof({
        actorId: 'buyer-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        orderStatus: 'PAID',
        paymentStatus: 'PAID',
      }),
    ).toBe(false);
  });

  it('builds a clear summary for manual payment instruction and verification state', () => {
    expect(
      getManualPaymentSummary({
        orderStatus: 'PENDING_PAYMENT',
        paymentStatus: 'PENDING',
        hasBankDetails: true,
        hasQrCode: true,
      }),
    ).toContain('Manual bank transfer');

    expect(
      getManualPaymentSummary({
        orderStatus: 'PAID',
        paymentStatus: 'PAID',
        hasBankDetails: true,
        hasQrCode: false,
      }),
    ).toContain('Paid');
  });
});

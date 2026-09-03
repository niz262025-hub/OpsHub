export type SellerPaymentSettings = {
  bankName?: string | null;
  accountHolderName?: string | null;
  accountNumber?: string | null;
  accountType?: string | null;
  paymentInstructions?: string | null;
  qrImageUrl?: string | null;
};

export type ManualTransferProof = {
  proofUrl?: string | null;
  transferReference?: string | null;
  transferDate?: string | null;
};

export type ManualTransferVerification = {
  actorId?: string | null;
  sellerId?: string | null;
  buyerId?: string | null;
  orderStatus?: string | null;
  paymentStatus?: string | null;
  isAdmin?: boolean;
};

export type ManualTransferSubmission = {
  actorId?: string | null;
  buyerId?: string | null;
  sellerId?: string | null;
  orderStatus?: string | null;
  paymentStatus?: string | null;
};

export type ManualPaymentSummaryInput = {
  orderStatus?: string | null;
  paymentStatus?: string | null;
  hasBankDetails?: boolean;
  hasQrCode?: boolean;
};

export function validateSellerPaymentSettings(settings: SellerPaymentSettings): { valid: boolean; reason?: string } {
  const normalized = settings ?? {};
  const bankName = (normalized.bankName ?? '').trim();
  const accountHolderName = (normalized.accountHolderName ?? '').trim();
  const accountNumber = (normalized.accountNumber ?? '').trim();
  const paymentInstructions = (normalized.paymentInstructions ?? '').trim();
  const qrImageUrl = (normalized.qrImageUrl ?? '').trim();

  const hasBankDetails = Boolean(bankName && accountHolderName && accountNumber);
  const hasQr = Boolean(qrImageUrl);
  const hasInstructions = Boolean(paymentInstructions);

  if (!hasInstructions) {
    return { valid: false, reason: 'Payment instructions are required' };
  }

  if (hasBankDetails) {
    return { valid: true };
  }

  if (hasQr) {
    return { valid: true };
  }

  return { valid: false, reason: 'Provide either bank details or a QR image plus instructions' };
}

export function validateTransferProof(proof: ManualTransferProof): { valid: boolean; reason?: string } {
  const normalized = proof ?? {};
  const proofUrl = (normalized.proofUrl ?? '').trim();
  const transferReference = (normalized.transferReference ?? '').trim();
  const transferDate = (normalized.transferDate ?? '').trim();

  if (!proofUrl) {
    return { valid: false, reason: 'Payment proof image is required' };
  }

  if (!transferReference) {
    return { valid: false, reason: 'Transfer reference is required' };
  }

  if (!transferDate) {
    return { valid: false, reason: 'Transfer date is required' };
  }

  return { valid: true };
}

export function canSubmitManualTransferProof(input: ManualTransferSubmission): boolean {
  const actorId = (input.actorId ?? '').trim();
  const buyerId = (input.buyerId ?? '').trim();
  const sellerId = (input.sellerId ?? '').trim();
  const orderStatus = (input.orderStatus ?? '').trim();
  const paymentStatus = (input.paymentStatus ?? '').trim();

  if (!actorId || !buyerId || !sellerId) {
    return false;
  }

  if (actorId !== buyerId) {
    return false;
  }

  if (orderStatus === 'CANCELLED' || paymentStatus === 'CANCELLED') {
    return false;
  }

  if (orderStatus === 'PAID' || paymentStatus === 'PAID') {
    return false;
  }

  return true;
}

export function canVerifyManualTransfer(input: ManualTransferVerification): boolean {
  const actorId = (input.actorId ?? '').trim();
  const sellerId = (input.sellerId ?? '').trim();
  const buyerId = (input.buyerId ?? '').trim();
  const orderStatus = (input.orderStatus ?? '').trim();
  const paymentStatus = (input.paymentStatus ?? '').trim();

  if (!actorId || !sellerId || !buyerId) {
    return false;
  }

  if (orderStatus === 'CANCELLED' || paymentStatus === 'CANCELLED') {
    return false;
  }

  if (actorId === buyerId) {
    return false;
  }

  const isSellerVerification = actorId === sellerId;
  const isAdminVerification = Boolean(input.isAdmin);

  return Boolean(isSellerVerification || isAdminVerification);
}

export function getManualPaymentSummary(input: ManualPaymentSummaryInput): string {
  const orderStatus = (input.orderStatus ?? '').trim();
  const paymentStatus = (input.paymentStatus ?? '').trim();
  const hasBankDetails = Boolean(input.hasBankDetails);
  const hasQrCode = Boolean(input.hasQrCode);

  if (orderStatus === 'PAID' || paymentStatus === 'PAID') {
    return 'Paid — manual bank transfer was verified and the order is now paid.';
  }

  if (orderStatus === 'CANCELLED' || paymentStatus === 'CANCELLED') {
    return 'Payment cancelled — no manual transfer is required.';
  }

  const methodSummary = hasBankDetails && hasQrCode
    ? 'bank details and QR code'
    : hasBankDetails
      ? 'bank details'
      : hasQrCode
        ? 'QR code'
        : 'manual bank transfer';

  return `Manual bank transfer required: pay by ${methodSummary}. Once the seller verifies the transfer, the order will be marked Paid.`;
}

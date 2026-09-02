export type CustomerCheckoutInput = {
  productId: string;
  sellerId: string;
  quantity: number;
  productStatus: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  isPublic: boolean;
  availableQuantity: number;
};

export type CustomerCheckoutValidation = {
  valid: boolean;
  reason?: string;
};

export function validateCustomerCheckoutInput(input: CustomerCheckoutInput): CustomerCheckoutValidation {
  if (!input.productId || input.productId.trim() === '') {
    return { valid: false, reason: 'Product not found' };
  }

  if (!input.sellerId || input.sellerId.trim() === '') {
    return { valid: false, reason: 'Product is not available for purchase' };
  }

  if (input.quantity <= 0) {
    return { valid: false, reason: 'Quantity must be greater than zero' };
  }

  if (input.productStatus !== 'PUBLISHED' || input.isPublic !== true) {
    return { valid: false, reason: 'Product is not available for purchase' };
  }

  if (input.availableQuantity < input.quantity) {
    return { valid: false, reason: 'Insufficient inventory for this product' };
  }

  return { valid: true };
}

export function formatOrderReference(value: string): string {
  const safe = (value ?? '').toString().trim();
  const token = safe.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'ORDER';
  return `OH-${token.toUpperCase()}`;
}

export function getCustomerOrderStatusSummary(status: string): string {
  const supported = ['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED'];
  return supported.includes(status) ? status : 'PENDING_PAYMENT';
}

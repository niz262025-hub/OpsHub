import { describe, expect, it } from 'vitest';

import {
  validateCustomerCheckoutInput,
  formatOrderReference,
  getCustomerOrderStatusSummary,
  type CustomerCheckoutInput,
} from './customer-commerce';

describe('customer commerce validation', () => {
  it('requires valid public published product purchases with positive quantity', () => {
    const valid: CustomerCheckoutInput = {
      productId: 'prod-123',
      sellerId: 'seller-123',
      quantity: 2,
      productStatus: 'PUBLISHED',
      isPublic: true,
      availableQuantity: 5,
    };

    expect(validateCustomerCheckoutInput(valid)).toMatchObject({ valid: true });

    expect(validateCustomerCheckoutInput({ ...valid, quantity: 0 })).toMatchObject({ valid: false, reason: 'Quantity must be greater than zero' });
    expect(validateCustomerCheckoutInput({ ...valid, productStatus: 'DRAFT' })).toMatchObject({ valid: false, reason: 'Product is not available for purchase' });
    expect(validateCustomerCheckoutInput({ ...valid, isPublic: false })).toMatchObject({ valid: false, reason: 'Product is not available for purchase' });
    expect(validateCustomerCheckoutInput({ ...valid, availableQuantity: 1 })).toMatchObject({ valid: false, reason: 'Insufficient inventory for this product' });
  });

  it('formats order references and summaries with the supported order lifecycle', () => {
    expect(formatOrderReference('prod-123')).toMatch(/^OH-/i);
    expect(getCustomerOrderStatusSummary('PENDING_PAYMENT')).toContain('PENDING_PAYMENT');
    expect(getCustomerOrderStatusSummary('PAID')).toContain('PAID');
    expect(getCustomerOrderStatusSummary('PROCESSING')).toContain('PROCESSING');
    expect(getCustomerOrderStatusSummary('SHIPPED')).toContain('SHIPPED');
    expect(getCustomerOrderStatusSummary('COMPLETED')).toContain('COMPLETED');
    expect(getCustomerOrderStatusSummary('CANCELLED')).toContain('CANCELLED');
  });
});

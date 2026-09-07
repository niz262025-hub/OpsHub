import { describe, expect, it } from 'vitest';

import { isPublicProductAvailableForPurchase } from './marketplace-data';

describe('isPublicProductAvailableForPurchase', () => {
  it('allows only published public products with stock to be purchased', () => {
    expect(isPublicProductAvailableForPurchase({ status: 'PUBLISHED', is_public: true, quantity: 2 })).toBe(true);
    expect(isPublicProductAvailableForPurchase({ status: 'PUBLISHED', is_public: true, quantity: 0 })).toBe(false);
    expect(isPublicProductAvailableForPurchase({ status: 'DRAFT', is_public: true, quantity: 2 })).toBe(false);
    expect(isPublicProductAvailableForPurchase({ status: 'PUBLISHED', is_public: false, quantity: 2 })).toBe(false);
  });
});

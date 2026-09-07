import { describe, expect, it } from 'vitest';

import { isPublicProductAvailableForPurchase, jsonifyMarketplaceProductRow, toPublicMarketplaceProduct } from './marketplace-data';

describe('isPublicProductAvailableForPurchase', () => {
  it('allows only published public products with stock to be purchased', () => {
    expect(isPublicProductAvailableForPurchase({ status: 'PUBLISHED', is_public: true, quantity: 2 })).toBe(true);
    expect(isPublicProductAvailableForPurchase({ status: 'PUBLISHED', is_public: true, quantity: 0 })).toBe(false);
    expect(isPublicProductAvailableForPurchase({ status: 'DRAFT', is_public: true, quantity: 2 })).toBe(false);
    expect(isPublicProductAvailableForPurchase({ status: 'PUBLISHED', is_public: false, quantity: 2 })).toBe(false);
  });
});

describe('marketplace product row mapping', () => {
  it('keeps only live products that are published, public, and in stock', () => {
    const row = {
      id: 'a1',
      name: 'Live Product',
      description: 'Live storefront item',
      price: 19.99,
      quantity: 3,
      status: 'PUBLISHED',
      source: 'OWNED',
      is_public: true,
      seller_id: 'seller-1',
      image_url: 'https://example.com/img.png',
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    } as const;

    expect(jsonifyMarketplaceProductRow(row)).toMatchObject({
      id: 'a1',
      sellerId: 'seller-1',
      name: 'Live Product',
      status: 'PUBLISHED',
      isPublic: true,
      quantity: 3,
    });

    expect(toPublicMarketplaceProduct(row)).toBeTruthy();
    expect(isPublicProductAvailableForPurchase({
      status: 'PUBLISHED',
      isPublic: true,
      quantity: 3,
    })).toBe(true);
  });
});

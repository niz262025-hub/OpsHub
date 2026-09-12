import { describe, expect, it } from 'vitest';

import { buildSellerProductPayload, buildSellerProductUpdatePayload, validateSellerProductOwnership } from './products';

describe('seller product lifecycle helpers', () => {
  it('maps create payloads to the public.products schema and marks published products public', () => {
    expect(buildSellerProductPayload({
      name: 'Live product',
      description: 'A published product',
      price: 19.99,
      quantity: 4,
      source: 'OWNED',
      status: 'PUBLISHED',
      imageUrl: 'https://example.com/image.png',
    }, 'seller-1')).toMatchObject({
      seller_id: 'seller-1',
      name: 'Live product',
      description: 'A published product',
      price: 19.99,
      quantity: 4,
      source: 'OWNED',
      status: 'PUBLISHED',
      is_public: true,
      image_url: 'https://example.com/image.png',
    });

    expect(buildSellerProductPayload({
      name: 'Draft item',
      description: 'Draft content',
      price: 5,
      quantity: 0,
      source: 'WHOLESALER',
      status: 'DRAFT',
    }, 'seller-1')).toMatchObject({
      status: 'DRAFT',
      is_public: false,
      quantity: 0,
    });
  });

  it('preserves update semantics without changing ownership or public visibility rules', () => {
    expect(buildSellerProductUpdatePayload({
      name: ' Updated ',
      description: 'A new description',
      price: '25',
      quantity: 10,
      source: 'DROP_SHIP',
      status: 'ARCHIVED',
      imageUrl: 'https://example.com/updated.png',
    })).toMatchObject({
      name: 'Updated',
      description: 'A new description',
      price: 25,
      quantity: 10,
      source: 'DROP_SHIP',
      status: 'ARCHIVED',
      is_public: false,
      image_url: 'https://example.com/updated.png',
    });
  });

  it('enforces seller-owned product access', () => {
    expect(validateSellerProductOwnership('seller-1', 'seller-1')).toBe(true);
    expect(validateSellerProductOwnership('seller-1', 'seller-2')).toBe(false);
    expect(validateSellerProductOwnership(null, 'seller-1')).toBe(false);
  });
});

export type MarketplaceProductAvailabilityInput = {
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  is_public: boolean;
  quantity: number;
};

export function isPublicProductAvailableForPurchase(product: MarketplaceProductAvailabilityInput): boolean {
  return product.status === 'PUBLISHED' && product.is_public === true && Number(product.quantity ?? 0) > 0;
}

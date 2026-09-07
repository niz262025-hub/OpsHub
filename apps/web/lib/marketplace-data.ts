export type MarketplaceProductAvailabilityInput = {
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  is_public?: boolean;
  isPublic?: boolean;
  quantity: number;
};

export type MarketplaceProductRow = {
  id: string;
  seller_id?: string | null;
  name: string;
  description?: string | null;
  price?: number | string | null;
  quantity?: number | string | null;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | null;
  source?: 'OWNED' | 'WHOLESALER' | 'MANUFACTURER' | 'DROP_SHIP' | null;
  is_public?: boolean | null;
  image_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PublicMarketplaceProduct = {
  id: string;
  sellerId: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  source: 'OWNED' | 'WHOLESALER' | 'MANUFACTURER' | 'DROP_SHIP';
  isPublic: boolean;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
};

export function isPublicProductAvailableForPurchase(product: MarketplaceProductAvailabilityInput): boolean {
  const isPublic = typeof product.is_public === 'boolean' ? product.is_public : Boolean(product.isPublic);
  return product.status === 'PUBLISHED' && isPublic === true && Number(product.quantity ?? 0) > 0;
}

export function jsonifyMarketplaceProductRow(product: MarketplaceProductRow): PublicMarketplaceProduct {
  return {
    id: product.id,
    sellerId: product.seller_id ?? 'unknown-seller',
    name: product.name ?? 'Untitled product',
    description: product.description ?? 'Marketplace product ready for review.',
    price: Number(product.price ?? 0),
    quantity: Number(product.quantity ?? 0),
    status: product.status ?? 'DRAFT',
    source: product.source ?? 'OWNED',
    isPublic: Boolean(product.is_public),
    imageUrl: product.image_url ?? 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80',
    createdAt: product.created_at ?? new Date().toISOString(),
    updatedAt: product.updated_at ?? new Date().toISOString(),
  };
}

export function toPublicMarketplaceProduct(product: MarketplaceProductRow): PublicMarketplaceProduct | null {
  const mapped = jsonifyMarketplaceProductRow(product);
  return isPublicProductAvailableForPurchase({
    status: mapped.status,
    is_public: mapped.isPublic,
    quantity: mapped.quantity,
  }) ? mapped : null;
}

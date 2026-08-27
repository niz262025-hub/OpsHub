export const PRODUCT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export const PRODUCT_SOURCES = ['OWNED', 'WHOLESALER', 'MANUFACTURER', 'DROP_SHIP'] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export type ProductSource = (typeof PRODUCT_SOURCES)[number];

export type Product = {
  id: string;
  sellerId: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  status: ProductStatus;
  source: ProductSource;
  isPublic: boolean;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
};

export const sampleProducts: Product[] = [
  {
    id: 'prod-1',
    sellerId: 'seller-100',
    name: 'Urban Pine Candle',
    description: 'Small-batch soy candle with cedar and pine notes for home rituals and gifting.',
    price: 29.99,
    quantity: 12,
    status: 'PUBLISHED',
    source: 'OWNED',
    isPublic: true,
    imageUrl: 'https://images.unsplash.com/photo-1602872029706-8d52f4e9bca1?auto=format&fit=crop&w=900&q=80',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-12T12:00:00.000Z',
  },
  {
    id: 'prod-2',
    sellerId: 'seller-200',
    name: 'Field Notes Journal',
    description: 'Premium stitched notebook with recycled paper and durable linen cover.',
    price: 18.5,
    quantity: 42,
    status: 'DRAFT',
    source: 'WHOLESALER',
    isPublic: false,
    imageUrl: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=900&q=80',
    createdAt: '2026-08-05T14:30:00.000Z',
    updatedAt: '2026-08-10T09:20:00.000Z',
  },
];

export function generateProductShareUrl(productId: string) {
  return `/products/${productId}`;
}

export function getMarketingShareLinks(productId: string) {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com'}${generateProductShareUrl(productId)}`;

  return {
    instagram: `https://www.instagram.com/`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    tiktok: `https://www.tiktok.com/upload?url=${encodeURIComponent(url)}`,
    threads: `https://www.threads.net/`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out this product from OpsHub')}&url=${encodeURIComponent(url)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`Check this out: ${url}`)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}`,
  };
}

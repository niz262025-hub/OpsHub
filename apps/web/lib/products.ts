export type SellerProductSource = 'OWNED' | 'WHOLESALER' | 'MANUFACTURER' | 'DROP_SHIP';
export type SellerProductStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type SellerProductInput = {
  name: string;
  description: string;
  price: number | string;
  quantity: number | string;
  source: SellerProductSource;
  status: SellerProductStatus;
  imageUrl?: string | null;
};

export function buildSellerProductPayload(input: SellerProductInput, sellerId: string) {
  const name = input.name.trim();
  const description = input.description.trim();
  const normalizedPrice = Number(input.price ?? 0);
  const normalizedQuantity = Number(input.quantity ?? 0);
  const normalizedStatus = input.status ?? 'DRAFT';
  const normalizedSource = input.source ?? 'OWNED';
  const imageUrl = typeof input.imageUrl === 'string' ? input.imageUrl.trim() : '';

  return {
    seller_id: sellerId,
    name,
    description,
    price: Number.isFinite(normalizedPrice) ? normalizedPrice : 0,
    quantity: Number.isFinite(normalizedQuantity) ? Math.max(0, Math.floor(normalizedQuantity)) : 0,
    source: normalizedSource,
    status: normalizedStatus,
    is_public: normalizedStatus === 'PUBLISHED',
    image_url: imageUrl || null,
  };
}

export function buildSellerProductUpdatePayload(input: SellerProductInput) {
  const name = input.name.trim();
  const description = input.description.trim();
  const normalizedPrice = Number(input.price ?? 0);
  const normalizedQuantity = Number(input.quantity ?? 0);
  const normalizedStatus = input.status ?? 'DRAFT';
  const normalizedSource = input.source ?? 'OWNED';
  const imageUrl = typeof input.imageUrl === 'string' ? input.imageUrl.trim() : '';

  return {
    name,
    description,
    price: Number.isFinite(normalizedPrice) ? normalizedPrice : 0,
    quantity: Number.isFinite(normalizedQuantity) ? Math.max(0, Math.floor(normalizedQuantity)) : 0,
    source: normalizedSource,
    status: normalizedStatus,
    is_public: normalizedStatus === 'PUBLISHED',
    image_url: imageUrl || null,
  };
}

export function validateSellerProductOwnership(productSellerId: string | null | undefined, currentSellerId: string | null | undefined) {
  return Boolean(currentSellerId) && productSellerId === currentSellerId;
}

export async function uploadSellerProductImage({
  supabase,
  sellerId,
  productId,
  file,
}: {
  supabase: { storage: { from: (bucket: string) => { upload: (path: string, file: File, options?: { upsert?: boolean; contentType?: string }) => Promise<{ data: { path?: string } | null; error: { message: string } | null }>; getPublicUrl: (path: string) => { data: { publicUrl?: string | null } } } } };
  sellerId: string;
  productId: string;
  file: File;
}) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${sellerId}/${productId}/${Date.now()}-${safeName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage.from('marketplace-product-images').upload(storagePath, file, {
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  });

  if (uploadError || !uploadData?.path) {
    throw new Error(uploadError?.message ?? 'Image upload failed');
  }

  const { data: urlData } = supabase.storage.from('marketplace-product-images').getPublicUrl(storagePath);

  return {
    storagePath,
    publicUrl: urlData?.publicUrl ?? null,
  };
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { isPublicProductAvailableForPurchase, jsonifyMarketplaceProductRow } from '@/lib/marketplace-data';
import { generateProductShareUrl, getMarketingShareLinks } from '@/lib/marketplace';

export default async function MarketplaceProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();

  if (error || !data) {
    notFound();
  }

  const product = jsonifyMarketplaceProductRow(data);

  if (!isPublicProductAvailableForPurchase({
    status: product.status,
    is_public: product.isPublic,
    quantity: product.quantity,
  })) {
    notFound();
  }

  const shareLinks = getMarketingShareLinks(product.id);

  return (
    <main className="marketplace-shell narrow">
      <section className="panel product-detail">
        <div className="product-detail-image-wrap">
          <img src={product.imageUrl} alt={product.name} className="product-detail-image" />
        </div>
        <div>
          <p className="eyebrow">PRODUCT DETAIL</p>
          <h1>{product.name}</h1>
          <p className="price-row">${product.price.toFixed(2)}</p>
          <p className="status-row">{product.status} · {product.source} · {product.quantity} units</p>
          <p className="description">{product.description}</p>
          <div className="product-detail-actions">
            <Link href={`/products/${product.id}`}>Open purchase page</Link>
            <Link href={generateProductShareUrl(product.id)}>Share / Post Product</Link>
          </div>
          <div className="share-links">
            {Object.entries(shareLinks).map(([platform, link]) => (
              <a key={platform} href={link} target="_blank" rel="noreferrer">{platform}</a>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

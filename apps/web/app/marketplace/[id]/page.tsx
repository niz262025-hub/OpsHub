import Link from 'next/link';
import { notFound } from 'next/navigation';
import { generateProductShareUrl, getMarketingShareLinks, sampleProducts } from '@/lib/marketplace';

export default async function MarketplaceProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = sampleProducts.find((entry) => entry.id === id);

  if (!product) {
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
            <Link href={`/marketplace/${product.id}/edit`}>Edit product</Link>
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

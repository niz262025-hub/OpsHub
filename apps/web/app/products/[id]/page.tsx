import { notFound } from 'next/navigation';
import { sampleProducts } from '@/lib/marketplace';

export default async function PublicProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = sampleProducts.find((entry) => entry.id === id && entry.status === 'PUBLISHED' && entry.isPublic);

  if (!product) {
    notFound();
  }

  return (
    <main className="marketplace-shell narrow">
      <article className="panel product-detail public-product">
        <div className="product-detail-image-wrap">
          <img src={product.imageUrl} alt={product.name} className="product-detail-image" />
        </div>
        <div>
          <p className="eyebrow">OPSHUB</p>
          <h1>{product.name}</h1>
          <p className="price-row">${product.price.toFixed(2)}</p>
          <p className="status-row">{product.quantity} available · {product.source}</p>
          <p className="description">{product.description}</p>
          <div className="product-detail-actions">
            <a href="/auth/register">Become a seller</a>
            <a href="/auth/login">Seller login</a>
          </div>
        </div>
      </article>
    </main>
  );
}

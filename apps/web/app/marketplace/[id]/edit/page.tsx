import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PRODUCT_SOURCES, PRODUCT_STATUSES, sampleProducts } from '@/lib/marketplace';

export default async function EditMarketplaceProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = sampleProducts.find((entry) => entry.id === id);

  if (!product) {
    notFound();
  }

  return (
    <main className="marketplace-shell narrow">
      <section className="panel">
        <p className="eyebrow">EDIT PRODUCT</p>
        <h1>{product.name}</h1>
        <form className="product-form">
          <label>
            Product name
            <input defaultValue={product.name} />
          </label>
          <label>
            Description
            <textarea defaultValue={product.description} rows={5} />
          </label>
          <div className="two-col">
            <label>
              Price
              <input type="number" defaultValue={product.price} />
            </label>
            <label>
              Quantity
              <input type="number" defaultValue={product.quantity} />
            </label>
          </div>
          <div className="two-col">
            <label>
              Source
              <select defaultValue={product.source}>
                {PRODUCT_SOURCES.map((source) => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select defaultValue={product.status}>
                {PRODUCT_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Image URL
            <input defaultValue={product.imageUrl} />
          </label>
          <div className="product-detail-actions">
            <button type="submit">Save changes</button>
            <Link href={`/marketplace/${product.id}`}>Back to detail</Link>
          </div>
        </form>
      </section>
    </main>
  );
}

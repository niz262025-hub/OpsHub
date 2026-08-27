'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { PRODUCT_SOURCES, PRODUCT_STATUSES, generateProductShareUrl, getMarketingShareLinks, sampleProducts, type Product } from '@/lib/marketplace';

const EMPTY_FORM = {
  name: '',
  description: '',
  price: '0',
  quantity: '1',
  source: 'OWNED' as Product['source'],
  status: 'DRAFT' as Product['status'],
  imageUrl: '',
};

export default function MarketplacePage() {
  const [products, setProducts] = useState<Product[]>(sampleProducts);
  const [form, setForm] = useState(EMPTY_FORM);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const publishedCount = useMemo(() => products.filter((product) => product.status === 'PUBLISHED').length, [products]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextProduct: Product = {
      id: `prod-${Date.now()}`,
      sellerId: 'seller-100',
      name: form.name || 'New product',
      description: form.description || 'Marketplace product ready for review.',
      price: Number(form.price) || 0,
      quantity: Number(form.quantity) || 0,
      status: form.status,
      source: form.source,
      isPublic: form.status === 'PUBLISHED',
      imageUrl: form.imageUrl || 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setProducts((current) => [nextProduct, ...current]);
    setForm(EMPTY_FORM);
  }

  function togglePublish(productId: string) {
    setProducts((current) =>
      current.map((product) => {
        if (product.id !== productId) return product;

        const nextStatus = product.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
        return {
          ...product,
          status: nextStatus,
          isPublic: nextStatus === 'PUBLISHED',
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  }

  function shareProduct(product: Product) {
    const shareUrl = generateProductShareUrl(product.id);
    setGeneratedUrl(shareUrl);
  }

  return (
    <main className="marketplace-shell">
      <header className="marketplace-header">
        <div>
          <p className="eyebrow">MARKETPLACE</p>
          <h1>Product foundation</h1>
        </div>
        <div className="status-pill">{publishedCount} published</div>
      </header>

      <section className="marketplace-grid">
        <div className="panel">
          <h2>Add product</h2>
          <form className="product-form" onSubmit={handleSubmit}>
            <label>
              Product name
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Product name" required />
            </label>
            <label>
              Product description
              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Describe the product" rows={4} required />
            </label>
            <div className="two-col">
              <label>
                Price
                <input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
              </label>
              <label>
                Quantity
                <input type="number" min="0" step="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required />
              </label>
            </div>
            <div className="two-col">
              <label>
                Source
                <select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value as Product['source'] })}>
                  {PRODUCT_SOURCES.map((source) => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Product['status'] })}>
                  {PRODUCT_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Image URL
              <input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="https://..." />
            </label>
            <button type="submit">Save product</button>
          </form>
        </div>

        <div className="panel">
          <h2>Product list</h2>
          <div className="product-list">
            {products.map((product) => {
              const shareLinks = getMarketingShareLinks(product.id);
              return (
                <article key={product.id} className="product-card">
                  <img src={product.imageUrl} alt={product.name} />
                  <div className="product-card-body">
                    <div className="product-card-heading">
                      <strong>{product.name}</strong>
                      <span>{product.status}</span>
                    </div>
                    <p>{product.description}</p>
                    <div className="product-meta">
                      <span>${product.price.toFixed(2)}</span>
                      <span>{product.quantity} available</span>
                      <span>{product.source}</span>
                    </div>
                    <div className="product-actions">
                      <Link href={`/marketplace/${product.id}`}>Detail</Link>
                      <Link href={`/marketplace/${product.id}/edit`}>Edit</Link>
                      <button type="button" onClick={() => togglePublish(product.id)}>{product.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}</button>
                      <button type="button" onClick={() => shareProduct(product)}>Share</button>
                    </div>
                    <div className="share-links">
                      {Object.entries(shareLinks).slice(0, 4).map(([platform, link]) => (
                        <a key={platform} href={link} target="_blank" rel="noreferrer">{platform}</a>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {generatedUrl ? (
        <section className="share-banner panel">
          <h3>Generated product link</h3>
          <p>{generatedUrl}</p>
          <div className="share-links">
            {Object.entries(getMarketingShareLinks(generatedUrl.split('/').pop() ?? 'prod-unknown')).map(([platform, link]) => (
              <a key={platform} href={link} target="_blank" rel="noreferrer">{platform}</a>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

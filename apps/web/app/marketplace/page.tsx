'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { PRODUCT_SOURCES, PRODUCT_STATUSES, generateProductShareUrl, getMarketingShareLinks, type Product } from '@/lib/marketplace';
import { buildSellerProductPayload, type SellerProductStatus } from '@/lib/products';
import { getCurrentUserProfileRole } from '@/lib/auth';
import { getSupabaseBrowserClient } from '@/lib/supabase';

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
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sellerVerified, setSellerVerified] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    let active = true;

    async function loadSellerProducts() {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id ?? null;

      if (!active) return;

      setSessionUserId(userId);

      if (!userId) {
        setProducts([]);
        setSellerVerified(false);
        setLoading(false);
        return;
      }

      const profile = await getCurrentUserProfileRole();
      const isVerifiedSeller = profile.role === 'SELLER' && profile.accountStatus === 'ACTIVE' && profile.verificationStatus === 'VERIFIED';

      if (!active) return;

      setSellerVerified(isVerifiedSeller);

      if (!isVerifiedSeller) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false });

      if (!active) return;

      if (fetchError) {
        setError(fetchError.message);
        setProducts([]);
        setLoading(false);
        return;
      }

      const mappedProducts: Product[] = (data ?? []).map((product) => ({
        id: product.id,
        sellerId: product.seller_id,
        name: product.name,
        description: product.description,
        price: Number(product.price ?? 0),
        quantity: Number(product.quantity ?? 0),
        status: product.status,
        source: product.source,
        isPublic: Boolean(product.is_public),
        imageUrl: product.image_url ?? 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80',
        createdAt: product.created_at,
        updatedAt: product.updated_at,
      }));

      setProducts(mappedProducts);
      setError(null);
      setLoading(false);
    }

    void loadSellerProducts();

    return () => {
      active = false;
    };
  }, [supabase]);

  const publishedCount = useMemo(() => products.filter((product) => product.status === 'PUBLISHED').length, [products]);

  async function handleUpload(productId: string, sellerId: string, file: File | null) {
    if (!file) return null;

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${sellerId}/${productId}/${Date.now()}-${safeName}`;
    const { error: uploadError, data: uploadData } = await supabase.storage.from('marketplace-product-images').upload(storagePath, file, {
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    });

    if (uploadError || !uploadData?.path) {
      throw new Error(uploadError?.message ?? 'Image upload failed');
    }

    const { data: publicUrlData } = supabase.storage.from('marketplace-product-images').getPublicUrl(storagePath);
    const publicUrl = publicUrlData?.publicUrl ?? null;

    if (!publicUrl) {
      throw new Error('Image URL was not generated');
    }

    const { error: imageInsertError } = await supabase.from('product_images').insert([
      {
        product_id: productId,
        seller_id: sellerId,
        storage_path: storagePath,
        image_url: publicUrl,
        is_primary: true,
      },
    ]);

    if (imageInsertError) {
      throw new Error(imageInsertError.message);
    }

    const { error: productUpdateError } = await supabase
      .from('products')
      .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .eq('seller_id', sellerId);

    if (productUpdateError) {
      throw new Error(productUpdateError.message);
    }

    return publicUrl;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sessionUserId) {
      setError('You must be signed in as a verified seller to create products.');
      return;
    }

    if (!sellerVerified) {
      setError('Only verified sellers can create marketplace products.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = buildSellerProductPayload(
        {
          name: form.name,
          description: form.description,
          price: form.price,
          quantity: form.quantity,
          source: form.source,
          status: form.status,
          imageUrl: form.imageUrl,
        },
        sessionUserId,
      );

      const { data: product, error: insertError } = await supabase
        .from('products')
        .insert([payload])
        .select('*')
        .single();

      if (insertError || !product) {
        throw new Error(insertError?.message ?? 'Product creation failed.');
      }

      let finalImageUrl = form.imageUrl || null;

      if (imageFile) {
        const uploadedUrl = await handleUpload(product.id, sessionUserId, imageFile);
        if (uploadedUrl) {
          finalImageUrl = uploadedUrl;
        }
      }

      if (finalImageUrl && finalImageUrl !== product.image_url) {
        await supabase.from('products').update({ image_url: finalImageUrl }).eq('id', product.id).eq('seller_id', sessionUserId);
      }

      setForm(EMPTY_FORM);
      setImageFile(null);
      setGeneratedUrl(generateProductShareUrl(product.id));
      const { data: refreshedRows } = await supabase.from('products').select('*').eq('seller_id', sessionUserId).order('created_at', { ascending: false });
      setProducts((refreshedRows ?? []).map((row) => ({
        id: row.id,
        sellerId: row.seller_id,
        name: row.name,
        description: row.description,
        price: Number(row.price ?? 0),
        quantity: Number(row.quantity ?? 0),
        status: row.status,
        source: row.source,
        isPublic: Boolean(row.is_public),
        imageUrl: row.image_url ?? 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Product creation failed.');
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(productId: string, nextStatus: SellerProductStatus) {
    if (!sessionUserId) return;

    const targetStatus = nextStatus === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
    const { error } = await supabase
      .from('products')
      .update({ status: targetStatus, is_public: targetStatus === 'PUBLISHED', updated_at: new Date().toISOString() })
      .eq('id', productId)
      .eq('seller_id', sessionUserId);

    if (error) {
      setError(error.message);
      return;
    }

    const { data: refreshedRows } = await supabase.from('products').select('*').eq('seller_id', sessionUserId).order('created_at', { ascending: false });
    setProducts((refreshedRows ?? []).map((row) => ({
      id: row.id,
      sellerId: row.seller_id,
      name: row.name,
      description: row.description,
      price: Number(row.price ?? 0),
      quantity: Number(row.quantity ?? 0),
      status: row.status,
      source: row.source,
      isPublic: Boolean(row.is_public),
      imageUrl: row.image_url ?? 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })));
  }

  async function archiveProduct(productId: string) {
    if (!sessionUserId) return;

    const { error } = await supabase
      .from('products')
      .update({ status: 'ARCHIVED', is_public: false, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .eq('seller_id', sessionUserId);

    if (error) {
      setError(error.message);
      return;
    }

    const { data: refreshedRows } = await supabase.from('products').select('*').eq('seller_id', sessionUserId).order('created_at', { ascending: false });
    setProducts((refreshedRows ?? []).map((row) => ({
      id: row.id,
      sellerId: row.seller_id,
      name: row.name,
      description: row.description,
      price: Number(row.price ?? 0),
      quantity: Number(row.quantity ?? 0),
      status: row.status,
      source: row.source,
      isPublic: Boolean(row.is_public),
      imageUrl: row.image_url ?? 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })));
  }

  function shareProduct(product: Product) {
    setGeneratedUrl(generateProductShareUrl(product.id));
  }

  if (!sellerVerified && !loading) {
    return (
      <main className="marketplace-shell narrow">
        <section className="panel">
          <p className="eyebrow">SELLER TOOLS</p>
          <h1>Verified seller access required</h1>
          <p className="muted">Your profile must be an active verified seller before managing products.</p>
          <Link href="/auth/login">Return to seller login</Link>
        </section>
      </main>
    );
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
          {loading ? <p className="muted">Loading seller products…</p> : null}
          {error ? <p className="error-message">{error}</p> : null}
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
              Product image
              <input type="file" accept="image/*" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} />
            </label>
            <label>
              Image URL (optional fallback)
              <input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="https://..." />
            </label>
            <button type="submit" disabled={saving}>{saving ? 'Saving product...' : 'Save product'}</button>
          </form>
        </div>

        <div className="panel">
          <h2>Product list</h2>
          <div className="product-list">
            {products.length === 0 ? <p className="muted">No products yet. Add your first product to publish it.</p> : null}
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
                      <Link href={`/products/${product.id}`}>Detail</Link>
                      <Link href={`/marketplace/${product.id}/edit`}>Edit</Link>
                      {product.status === 'PUBLISHED' ? (
                        <button type="button" onClick={() => togglePublish(product.id, 'DRAFT')}>Unpublish</button>
                      ) : (
                        <button type="button" onClick={() => togglePublish(product.id, 'PUBLISHED')}>Publish</button>
                      )}
                      <button type="button" onClick={() => archiveProduct(product.id)}>Archive</button>
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

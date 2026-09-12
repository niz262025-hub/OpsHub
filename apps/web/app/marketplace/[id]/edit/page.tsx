'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { PRODUCT_SOURCES, PRODUCT_STATUSES, generateProductShareUrl } from '@/lib/marketplace';
import { buildSellerProductUpdatePayload, type SellerProductStatus } from '@/lib/products';
import { getCurrentUserProfileRole } from '@/lib/auth';
import { getSupabaseBrowserClient } from '@/lib/supabase';

export default function EditMarketplaceProductPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [verifiedSeller, setVerifiedSeller] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '0',
    quantity: '1',
    source: 'OWNED' as 'OWNED' | 'WHOLESALER' | 'MANUFACTURER' | 'DROP_SHIP',
    status: 'DRAFT' as SellerProductStatus,
    imageUrl: '',
  });

  useEffect(() => {
    let active = true;

    async function loadProduct() {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id ?? null;

      if (!active) return;
      setSessionUserId(userId);

      if (!userId) {
        setLoading(false);
        setError('You must sign in to edit this product.');
        return;
      }

      const profile = await getCurrentUserProfileRole();
      const isVerifiedSeller = profile.role === 'SELLER' && profile.accountStatus === 'ACTIVE' && profile.verificationStatus === 'VERIFIED';

      if (!active) return;
      setVerifiedSeller(isVerifiedSeller);

      if (!isVerifiedSeller) {
        setLoading(false);
        setError('Only verified sellers may edit marketplace products.');
        return;
      }

      const { data, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', params.id)
        .eq('seller_id', userId)
        .maybeSingle();

      if (!active) return;

      if (productError || !data) {
        setError('This product could not be found or you do not have ownership rights.');
        setLoading(false);
        return;
      }

      setForm({
        name: data.name,
        description: data.description ?? '',
        price: String(data.price ?? 0),
        quantity: String(data.quantity ?? 0),
        source: data.source,
        status: data.status,
        imageUrl: data.image_url ?? '',
      });
      setLoading(false);
    }

    void loadProduct();

    return () => {
      active = false;
    };
  }, [params.id, supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sessionUserId || !verifiedSeller) {
      setError('Verified seller access is required to save changes.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = buildSellerProductUpdatePayload({
        name: form.name,
        description: form.description,
        price: form.price,
        quantity: form.quantity,
        source: form.source,
        status: form.status,
        imageUrl: form.imageUrl,
      });

      const { error: updateError } = await supabase
        .from('products')
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id)
        .eq('seller_id', sessionUserId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      router.push('/marketplace');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to update this product.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="marketplace-shell narrow"><section className="panel"><p className="muted">Loading product…</p></section></main>;
  }

  if (error) {
    return (
      <main className="marketplace-shell narrow">
        <section className="panel">
          <p className="eyebrow">EDIT PRODUCT</p>
          <h1>Unable to edit product</h1>
          <p className="error-message">{error}</p>
          <Link href="/marketplace">Back to marketplace</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="marketplace-shell narrow">
      <section className="panel">
        <p className="eyebrow">EDIT PRODUCT</p>
        <h1>{form.name || 'Product settings'}</h1>
        <form className="product-form" onSubmit={handleSubmit}>
          <label>
            Product name
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Product name" required />
          </label>
          <label>
            Description
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={5} />
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
              <select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value as typeof form.source })}>
                {PRODUCT_SOURCES.map((source) => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as SellerProductStatus })}>
                {PRODUCT_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Image URL
            <input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} />
          </label>
          <div className="product-detail-actions">
            <button type="submit" disabled={saving}>{saving ? 'Saving changes...' : 'Save changes'}</button>
            <Link href={generateProductShareUrl(params.id)}>Preview public product</Link>
            <Link href="/marketplace">Back to marketplace</Link>
          </div>
        </form>
      </section>
    </main>
  );
}

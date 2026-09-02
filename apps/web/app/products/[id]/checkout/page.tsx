'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCurrentUserProfileRole, getSession } from '@/lib/auth';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { validateCustomerCheckoutInput } from '@/lib/customer-commerce';

type ProductCheckoutRow = {
  id: string;
  name: string;
  description: string | null;
  seller_id: string;
  price: number;
  quantity: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  is_public: boolean;
  image_url: string | null;
};

export default function ProductCheckoutPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<ProductCheckoutRow | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    let active = true;

    async function loadProduct() {
      const { data: sessionData } = await getSession();
      if (!active) return;

      const userId = sessionData.session?.user?.id;
      if (!userId) {
        router.replace('/auth/customer/login');
        return;
      }

      const profile = await getCurrentUserProfileRole();
      if (!active) return;

      if (profile.role !== 'CUSTOMER') {
        router.replace('/auth/customer/login');
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('id', params.id)
        .maybeSingle();

      if (!active) return;

      if (fetchError || !data) {
        setError(fetchError?.message ?? 'Product not found.');
        setLoading(false);
        return;
      }

      const productRow = data as ProductCheckoutRow;
      const validation = validateCustomerCheckoutInput({
        productId: productRow.id,
        sellerId: productRow.seller_id,
        quantity: 1,
        productStatus: productRow.status,
        isPublic: productRow.is_public,
        availableQuantity: productRow.quantity,
      });

      if (!validation.valid) {
        setError(validation.reason ?? 'Product is not available for purchase.');
        setLoading(false);
        return;
      }

      setProduct(productRow);
      setLoading(false);
    }

    void loadProduct();

    return () => {
      active = false;
    };
  }, [params.id, router, supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) return;

    const validation = validateCustomerCheckoutInput({
      productId: product.id,
      sellerId: product.seller_id,
      quantity,
      productStatus: product.status,
      isPublic: product.is_public,
      availableQuantity: product.quantity,
    });

    if (!validation.valid) {
      setError(validation.reason ?? 'Unable to place this order.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const { data: sessionData } = await getSession();
      const buyerId = sessionData.session?.user?.id;
      if (!buyerId) {
        router.replace('/auth/customer/login');
        return;
      }

      const { data, error: orderError } = await supabase.rpc('create_order_for_product', {
        p_buyer_id: buyerId,
        p_product_id: product.id,
        p_quantity: quantity,
      });

      if (orderError) {
        setError(orderError.message);
        setSubmitting(false);
        return;
      }

      const orderId = (data as { id?: string } | null)?.id ?? null;
      if (!orderId) {
        setError('The order was created but no order ID was returned.');
        setSubmitting(false);
        return;
      }

      router.push(`/customer/orders/${orderId}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to complete your purchase.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="marketplace-shell narrow"><article className="panel"><p className="muted">Preparing checkout…</p></article></main>;
  }

  if (!product) {
    return <main className="marketplace-shell narrow"><article className="panel"><p className="error-message">{error ?? 'Product not found.'}</p><Link href="/">Back home</Link></article></main>;
  }

  return (
    <main className="marketplace-shell narrow">
      <article className="panel product-detail public-product">
        <div className="product-detail-image-wrap">
          <img src={product.image_url ?? 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80'} alt={product.name} className="product-detail-image" />
        </div>
        <div>
          <p className="eyebrow">CHECKOUT</p>
          <h1>{product.name}</h1>
          <p className="price-row">${Number(product.price).toFixed(2)}</p>
          <p className="status-row">{product.quantity} available</p>
          <p className="description">{product.description ?? 'No description provided.'}</p>

          <form onSubmit={handleSubmit} className="auth-form" style={{ marginTop: '1rem' }}>
            <label>
              Quantity
              <input type="number" min={1} max={product.quantity} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} required />
            </label>
            {error ? <p className="error-message">{error}</p> : null}
            <button type="submit" disabled={submitting}>{submitting ? 'Placing order...' : 'Place order'}</button>
          </form>
        </div>
      </article>
    </main>
  );
}

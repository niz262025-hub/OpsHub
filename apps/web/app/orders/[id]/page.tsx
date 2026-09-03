'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCurrentUserProfileRole, getSession } from '@/lib/auth';
import { canSellerAccessOrder } from '@/lib/orders';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type SellerOrderDetailRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  total: number;
  currency: string;
  order_status: string;
  payment_status: string;
  created_at: string;
  products?: { name?: string | null; id?: string | null } | null;
  profiles?: { full_name?: string | null } | null;
};

export default function SellerOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<SellerOrderDetailRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    let active = true;

    async function loadOrder() {
      const { data: sessionData } = await getSession();
      if (!active) return;

      const userId = sessionData.session?.user?.id;
      if (!userId) {
        router.replace('/auth/login');
        return;
      }

      const profile = await getCurrentUserProfileRole();
      if (!active) return;

      if (profile.role !== 'SELLER') {
        router.replace('/auth/login');
        return;
      }

      if (!params.id || params.id.trim() === '') {
        setOrder(null);
        setError('Order not found.');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('id, buyer_id, seller_id, product_id, quantity, unit_price, subtotal, total, currency, order_status, payment_status, created_at, products(name, id), profiles!orders_buyer_id_fkey(full_name)')
        .eq('id', params.id)
        .maybeSingle();

      if (!active) return;

      if (fetchError) {
        setError(fetchError.message);
        setOrder(null);
        setLoading(false);
        return;
      }

      if (!data) {
        setOrder(null);
        setError('Order not found.');
        setLoading(false);
        return;
      }

      if (!canSellerAccessOrder({ id: data.id, seller_id: data.seller_id }, userId)) {
        setOrder(null);
        setError('Order not found.');
        setLoading(false);
        return;
      }

      setOrder(data as SellerOrderDetailRow);
      setLoading(false);
    }

    void loadOrder();

    return () => {
      active = false;
    };
  }, [params.id, router, supabase]);

  if (loading) {
    return <main className="marketplace-shell narrow"><article className="panel"><p className="muted">Loading order…</p></article></main>;
  }

  if (error || !order) {
    return <main className="marketplace-shell narrow"><article className="panel"><p className="error-message">{error ?? 'Order not found.'}</p><Link href="/orders">Back to orders</Link></article></main>;
  }

  return (
    <main className="marketplace-shell narrow">
      <article className="panel">
        <p className="eyebrow">ORDER</p>
        <h1>{order.id}</h1>
        <p><strong>Customer:</strong> {order.profiles?.full_name ?? 'Customer'}</p>
        <p><strong>Product:</strong> {order.products?.name ?? 'Product'}</p>
        <p><strong>Quantity:</strong> {order.quantity}</p>
        <p><strong>Unit price:</strong> ${Number(order.unit_price).toFixed(2)}</p>
        <p><strong>Subtotal:</strong> ${Number(order.subtotal).toFixed(2)}</p>
        <p><strong>Total:</strong> ${Number(order.total).toFixed(2)}</p>
        <p><strong>Currency:</strong> {order.currency}</p>
        <p><strong>Status:</strong> {order.order_status}</p>
        <p><strong>Payment:</strong> {order.payment_status}</p>
        <p><strong>Created:</strong> {new Date(order.created_at).toLocaleString()}</p>
        <p style={{ marginTop: '1rem' }}><Link href="/orders">Back to orders</Link></p>
      </article>
    </main>
  );
}

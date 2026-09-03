'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ORDER_STATUSES, PAYMENT_STATUSES, calculateOrderTotals, isOrderTransitionAllowed } from '@/lib/orders';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type SellerOrderRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string;
  quantity: number;
  total: number;
  order_status: string;
  payment_status: string;
  created_at: string;
  products?: { name?: string | null; image_url?: string | null } | null;
  profiles?: { full_name?: string | null } | null;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<SellerOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    async function loadSellerOrders() {
      setLoading(true);
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (!userId) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('id, buyer_id, seller_id, product_id, quantity, total, order_status, payment_status, created_at, products(name, image_url), profiles!orders_buyer_id_fkey(full_name)')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        setOrders([]);
        setLoading(false);
        return;
      }

      setOrders((data ?? []) as SellerOrderRow[]);
      setLoading(false);
    }

    void loadSellerOrders();
  }, [supabase]);

  const totals = useMemo(
    () => orders.map((order) => ({ ...order, ...calculateOrderTotals(Math.round((Number(order.total) / order.quantity) * 100), order.quantity) })),
    [orders],
  );

  return (
    <main className="marketplace-shell narrow">
      <header className="marketplace-header">
        <div>
          <p className="eyebrow">ORDERS</p>
          <h1>Seller order view</h1>
        </div>
      </header>

      {error ? <p className="error-message">{error}</p> : null}

      <section className="panel">
        {loading ? (
          <p className="muted">Loading orders…</p>
        ) : orders.length === 0 ? (
          <p className="muted">No orders for your products yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Order</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Buyer</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Product</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Qty</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Total</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Order</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Payment</th>
              </tr>
            </thead>
            <tbody>
              {totals.map((order) => (
                <tr key={order.id}>
                  <td style={{ padding: '0.75rem 0.5rem' }}><Link href={`/orders/${order.id}`}>{order.id}</Link></td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{order.profiles?.full_name ?? 'Customer'}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{order.products?.name ?? 'Product'}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{order.quantity}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>${Number(order.total).toFixed(2)}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{order.order_status}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{order.payment_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel" style={{ marginTop: '1.5rem' }}>
        <h2>Lifecycle rules</h2>
        <ul style={{ margin: '1rem 0 0', paddingLeft: '1.25rem', display: 'grid', gap: '0.5rem' }}>
          {ORDER_STATUSES.map((status) => (
            <li key={status}>{status}</li>
          ))}
        </ul>
        <p style={{ marginTop: '1rem' }}>
          PENDING_PAYMENT → PAID → PROCESSING → SHIPPED → COMPLETED
        </p>
        <div style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem' }}>
          <strong>Payment states:</strong>
          {PAYMENT_STATUSES.map((status) => (
            <span key={status}>{status}</span>
          ))}
        </div>
        <p style={{ marginTop: '1rem' }}>
          Transition helper: {String(isOrderTransitionAllowed('PENDING_PAYMENT', 'PAID'))}
        </p>
      </section>
    </main>
  );
}

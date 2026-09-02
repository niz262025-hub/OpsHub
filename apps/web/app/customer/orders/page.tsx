'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUserProfileRole, getSession } from '@/lib/auth';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type CustomerOrderRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string;
  quantity: number;
  total: number;
  currency: string;
  order_status: string;
  payment_status: string;
  created_at: string;
  products?: { name?: string | null; id?: string | null } | null;
};

export default function CustomerOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<CustomerOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    let active = true;

    async function loadCustomerOrders() {
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
        .from('orders')
        .select('id, buyer_id, seller_id, product_id, quantity, total, currency, order_status, payment_status, created_at, products(name, id)')
        .eq('buyer_id', userId)
        .order('created_at', { ascending: false });

      if (!active) return;

      if (fetchError) {
        setError(fetchError.message);
        setOrders([]);
        setLoading(false);
        return;
      }

      setOrders((data ?? []) as CustomerOrderRow[]);
      setLoading(false);
    }

    void loadCustomerOrders();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  return (
    <main className="marketplace-shell narrow">
      <header className="marketplace-header">
        <div>
          <p className="eyebrow">CUSTOMER</p>
          <h1>Your orders</h1>
        </div>
      </header>

      {error ? <p className="error-message">{error}</p> : null}

      <section className="panel">
        {loading ? (
          <p className="muted">Loading your orders…</p>
        ) : orders.length === 0 ? (
          <p className="muted">You have not placed any orders yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Order</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Product</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Qty</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Total</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Payment</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td style={{ padding: '0.75rem 0.5rem' }}><Link href={`/customer/orders/${order.id}`}>{order.id}</Link></td>
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
    </main>
  );
}

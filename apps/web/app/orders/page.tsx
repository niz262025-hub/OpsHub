'use client';

import { useMemo, useState } from 'react';
import { ORDER_STATUSES, PAYMENT_STATUSES, calculateOrderTotals, isOrderTransitionAllowed } from '@/lib/orders';

const sampleOrders = [
  {
    id: 'ord-100',
    buyer: 'Alpha Buyer',
    seller: 'Pine & Co',
    product: 'Urban Pine Candle',
    quantity: 2,
    unitPriceCents: 2999,
    status: 'PENDING_PAYMENT',
    paymentStatus: 'PENDING',
  },
  {
    id: 'ord-101',
    buyer: 'Beta Buyer',
    seller: 'Pine & Co',
    product: 'Field Notes Journal',
    quantity: 1,
    unitPriceCents: 1850,
    status: 'PAID',
    paymentStatus: 'PAID',
  },
];

export default function OrdersPage() {
  const [orders] = useState(sampleOrders);
  const totals = useMemo(
    () => orders.map((order) => ({ ...order, ...calculateOrderTotals(order.unitPriceCents, order.quantity) })),
    [orders],
  );

  return (
    <main className="marketplace-shell narrow">
      <header className="marketplace-header">
        <div>
          <p className="eyebrow">ORDERS</p>
          <h1>Order foundation</h1>
        </div>
      </header>

      <section className="panel">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Order</th>
              <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Buyer</th>
              <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Seller</th>
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
                <td style={{ padding: '0.75rem 0.5rem' }}>{order.id}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>{order.buyer}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>{order.seller}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>{order.product}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>{order.quantity}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>${(order.totalCents / 100).toFixed(2)}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>{order.status}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>{order.paymentStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
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

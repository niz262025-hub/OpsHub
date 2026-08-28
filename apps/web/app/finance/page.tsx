'use client';

import { FINANCE_DIRECTIONS, PAYMENT_STATUSES } from '@/lib/orders';

const sampleFinance = [
  { id: 'txn-1', seller: 'Pine & Co', amountCents: 5998, direction: 'SALE', paymentStatus: 'PAID', reference: 'pay_123' },
  { id: 'txn-2', seller: 'Pine & Co', amountCents: 2999, direction: 'REFUND', paymentStatus: 'REFUNDED', reference: 'pay_456' },
];

export default function FinancePage() {
  const totals = sampleFinance.map((entry) => ({ ...entry, total: (entry.amountCents / 100).toFixed(2) }));

  return (
    <main className="marketplace-shell narrow">
      <header className="marketplace-header">
        <div>
          <p className="eyebrow">FINANCE</p>
          <h1>Finance foundation</h1>
        </div>
      </header>

      <section className="panel">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Txn</th>
              <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Seller</th>
              <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Direction</th>
              <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Amount</th>
              <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Payment</th>
              <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Reference</th>
            </tr>
          </thead>
          <tbody>
            {totals.map((entry) => (
              <tr key={entry.id}>
                <td style={{ padding: '0.75rem 0.5rem' }}>{entry.id}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>{entry.seller}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>{entry.direction}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>${entry.total}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>{entry.paymentStatus}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>{entry.reference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel" style={{ marginTop: '1.5rem' }}>
        <h2>Allowed directions</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          {FINANCE_DIRECTIONS.map((direction) => (
            <span key={direction} className="status-pill">{direction}</span>
          ))}
        </div>
        <div style={{ marginTop: '1rem' }}>
          <strong>Payment states:</strong>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {PAYMENT_STATUSES.map((status) => (
              <span key={status} className="status-pill">{status}</span>
            ))}
          </div>
        </div>
        <p style={{ marginTop: '1rem' }}>
          Money values are represented in cents for safe, integer-based arithmetic.
        </p>
      </section>
    </main>
  );
}

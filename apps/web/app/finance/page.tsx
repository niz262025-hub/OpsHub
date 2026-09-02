'use client';

import { useEffect, useMemo, useState } from 'react';

import { buildSellerFinanceSummary, type FinanceDbRow, toMoneyString } from '@/lib/finance-data';
import { getSupabaseBrowserClient } from '@/lib/supabase';

export default function FinancePage() {
  const [rows, setRows] = useState<FinanceDbRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    async function loadFinance() {
      setLoading(true);
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const activeUserId = sessionData.session?.user?.id ?? null;
      setSellerId(activeUserId);

      if (!activeUserId) {
        setRows([]);
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('finance_records')
        .select('id, seller_id, order_id, amount, direction, payment_status, created_at, orders(order_status)')
        .eq('seller_id', activeUserId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        setRows([]);
        setLoading(false);
        return;
      }

      const normalizedRows = (data ?? []).map((row) => ({
        ...row,
        orders: Array.isArray(row.orders) ? row.orders[0] ?? null : row.orders ?? null,
      })) as FinanceDbRow[];

      setRows(normalizedRows);
      setLoading(false);
    }

    void loadFinance();
  }, [supabase]);

  const summary = useMemo(() => {
    if (!sellerId) {
      return {
        totalSalesCents: 0,
        totalRefundsCents: 0,
        totalPayoutsCents: 0,
        netRevenueCents: 0,
        transactionCount: 0,
        totalAdjustmentsCents: 0,
      };
    }

    return buildSellerFinanceSummary(rows, sellerId);
  }, [rows, sellerId]);

  return (
    <main className="marketplace-shell narrow">
      <header className="marketplace-header">
        <div>
          <p className="eyebrow">FINANCE</p>
          <h1>Business finance</h1>
        </div>
      </header>

      <section className="panel" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div>
            <p className="muted">Revenue</p>
            <h2>${toMoneyString(summary.totalSalesCents)}</h2>
          </div>
          <div>
            <p className="muted">Refunds</p>
            <h2>-${toMoneyString(summary.totalRefundsCents)}</h2>
          </div>
          <div>
            <p className="muted">Payouts</p>
            <h2>-${toMoneyString(summary.totalPayoutsCents)}</h2>
          </div>
          <div>
            <p className="muted">Net revenue</p>
            <h2>${toMoneyString(summary.netRevenueCents)}</h2>
          </div>
        </div>
      </section>

      {error ? <p className="error-message">{error}</p> : null}

      <section className="panel">
        {loading ? (
          <p className="muted">Loading finance data…</p>
        ) : rows.length === 0 ? (
          <p className="muted">No finance records for this business yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Txn</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Direction</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Amount</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Payment</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Order status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => {
                const nestedOrder = Array.isArray(entry.orders) ? entry.orders[0] : entry.orders;

                return (
                  <tr key={entry.id}>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{entry.id}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{entry.direction}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>${toMoneyString(Math.round(Number(entry.amount) * 100))}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{entry.payment_status}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{nestedOrder?.order_status ?? 'PENDING_PAYMENT'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

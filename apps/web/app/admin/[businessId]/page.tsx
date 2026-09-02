'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import {
  buildBusinessDrilldownData,
  type FinanceDbRow,
  toMoneyString,
} from '@/lib/finance-data';
import { getSupabaseBrowserClient } from '@/lib/supabase';

export default function AdminBusinessDrilldownPage({ params }: { params: Promise<{ businessId: string }> }) {
  const [resolvedParams, setResolvedParams] = useState<{ businessId: string } | null>(null);
  const [rows, setRows] = useState<FinanceDbRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ businessName: string; sellerName: string } | null>(null);
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    void params.then((resolved) => setResolvedParams(resolved));
  }, [params]);

  useEffect(() => {
    async function loadDrilldown() {
      if (!resolvedParams) return;

      setLoading(true);
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        setError('Admin session required.');
        setLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role, account_status')
        .eq('id', userId)
        .maybeSingle();

      if (profileError || profileData?.role !== 'ADMIN' || profileData?.account_status !== 'ACTIVE') {
        setError('Admin authorization required.');
        setLoading(false);
        return;
      }

      const businessId = resolvedParams.businessId;
      const { data: sellerProfile, error: sellerError } = await supabase
        .from('seller_profiles')
        .select('user_id, business_name, full_name')
        .eq('user_id', businessId)
        .maybeSingle();

      if (sellerError || !sellerProfile) {
        setError('Selected business not found.');
        setLoading(false);
        return;
      }

      const from = searchParams.get('from');
      const to = searchParams.get('to');
      const page = Number(searchParams.get('page') ?? '1');
      const pageSize = Number(searchParams.get('pageSize') ?? '20');

      const { data, error: financeError } = await supabase
        .from('finance_records')
        .select('id, seller_id, order_id, amount, direction, payment_status, created_at, orders(order_status)')
        .eq('seller_id', businessId)
        .order('created_at', { ascending: false });

      if (financeError) {
        setError(financeError.message);
        setLoading(false);
        return;
      }

      const normalizedRows = (data ?? []).map((row) => ({
        ...row,
        order_id: row.order_id ?? null,
        orders: Array.isArray(row.orders) ? row.orders[0] ?? null : row.orders ?? null,
      })) as FinanceDbRow[];

      const filteredByDate = normalizedRows.filter((row) => {
        const createdAt = new Date(row.created_at).getTime();
        if (from && createdAt < new Date(from).getTime()) return false;
        if (to && createdAt > new Date(to).getTime()) return false;
        return true;
      });

      const drilldown = buildBusinessDrilldownData(normalizedRows, businessId, {
        businessName: sellerProfile.business_name ?? 'Unknown business',
        sellerName: sellerProfile.full_name ?? 'Unknown seller',
        from: from ?? null,
        to: to ?? null,
        page: Number.isFinite(page) && page > 0 ? page : 1,
        pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20,
      });

      setRows(filteredByDate);
      setProfile({
        businessName: sellerProfile.business_name ?? 'Unknown business',
        sellerName: sellerProfile.full_name ?? 'Unknown seller',
      });
      setLoading(false);

      if (!drilldown.allowed) {
        setError('Business access denied.');
      }
    }

    void loadDrilldown();
  }, [resolvedParams, searchParams, supabase]);

  if (!resolvedParams || loading) {
    return <main className="marketplace-shell narrow"><p className="muted">Loading business drilldown…</p></main>;
  }

  if (error) {
    return <main className="marketplace-shell narrow"><p className="error-message">{error}</p></main>;
  }

  const summary = buildBusinessDrilldownData(rows, resolvedParams.businessId, {
    businessName: profile?.businessName ?? 'Unknown business',
    sellerName: profile?.sellerName ?? 'Unknown seller',
    from: searchParams.get('from') ?? null,
    to: searchParams.get('to') ?? null,
    page: Number(searchParams.get('page') ?? '1'),
    pageSize: Number(searchParams.get('pageSize') ?? '20'),
  });

  return (
    <main className="marketplace-shell narrow">
      <header className="marketplace-header">
        <div>
          <p className="eyebrow">ADMIN / BUSINESS DRILLDOWN</p>
          <h1>{profile?.businessName ?? 'Business finance'}</h1>
        </div>
        <a
          href={`/admin/${resolvedParams.businessId}/export${searchParams.toString() ? `?${searchParams.toString()}` : ''}`}
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '0.5rem',
            background: '#111827',
            color: '#ffffff',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Export CSV
        </a>
      </header>

      <section className="panel" style={{ marginBottom: '1rem' }}>
        <p><strong>Seller:</strong> {profile?.sellerName}</p>
        <p><strong>From:</strong> {searchParams.get('from') ?? 'All time'}</p>
        <p><strong>To:</strong> {searchParams.get('to') ?? 'Latest'}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div><p className="muted">Revenue</p><h2>${toMoneyString(summary.summary.totalSalesCents)}</h2></div>
          <div><p className="muted">Refunds</p><h2>-${toMoneyString(summary.summary.totalRefundsCents)}</h2></div>
          <div><p className="muted">Payouts</p><h2>-${toMoneyString(summary.summary.totalPayoutsCents)}</h2></div>
          <div><p className="muted">Net revenue</p><h2>${toMoneyString(summary.summary.netRevenueCents)}</h2></div>
        </div>
      </section>

      <section className="panel">
        <h2>Transactions</h2>
        {summary.items.length === 0 ? (
          <p className="muted">No transactions for the selected business and date range.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Order</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Direction</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Amount</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {summary.items.map((entry) => (
                <tr key={entry.id}>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{new Date(entry.created_at).toISOString()}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{entry.order_id ?? entry.id}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{entry.direction}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>${toMoneyString(Math.round(Number(entry.amount) * 100))}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{entry.payment_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

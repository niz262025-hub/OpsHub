import { redirect } from 'next/navigation';

import {
  assertAdminAuthorized,
  buildAdminBusinessBreakdown,
  buildAdminFinanceOverview,
  toMoneyString,
  type FinanceDbRow,
  type SellerBusinessProfile,
} from '@/lib/finance-data';
import { createSupabaseServerClient } from '@/lib/supabase-server';

type AdminFinancePageParams = {
  q?: string;
  page?: string;
  pageSize?: string;
  from?: string;
  to?: string;
};

export default async function AdminIndexPage({
  searchParams,
}: {
  searchParams?: Promise<AdminFinancePageParams> | AdminFinancePageParams;
}) {
  const params = await Promise.resolve(searchParams ?? {});
  const search = (params.q ?? '').trim();
  const page = Number(params.page ?? '1');
  const pageSize = Number(params.pageSize ?? '10');
  const from = params.from && !Number.isNaN(Date.parse(params.from)) ? new Date(params.from).toISOString() : null;
  const to = params.to && !Number.isNaN(Date.parse(params.to)) ? new Date(params.to).toISOString() : null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/admin/login');
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role, account_status')
    .eq('id', user.id)
    .maybeSingle();

  if (!assertAdminAuthorized({ role: profileData?.role ?? null, account_status: profileData?.account_status ?? null })) {
    redirect('/admin/login');
  }

  let financeQuery = supabase
    .from('finance_records')
    .select('id, seller_id, amount, direction, payment_status, created_at, orders(order_status)');

  if (from) {
    financeQuery = financeQuery.gte('created_at', from);
  }

  if (to) {
    financeQuery = financeQuery.lte('created_at', to);
  }

  const { data: financeRows } = await financeQuery.order('created_at', { ascending: false });

  const normalizedFinanceRows = (financeRows ?? []).map((row) => ({
    ...row,
    order_id: null,
    orders: Array.isArray(row.orders) ? row.orders[0] ?? null : row.orders ?? null,
  })) as FinanceDbRow[];

  let profileQuery = supabase.from('seller_profiles').select('user_id, business_name, full_name');
  if (search) {
    profileQuery = profileQuery.or(`business_name.ilike.%${search}%,full_name.ilike.%${search}%`);
  }

  const { data: profileRows } = await profileQuery.order('business_name', { ascending: true });

  const summary = buildAdminFinanceOverview(normalizedFinanceRows);
  const breakdown = buildAdminBusinessBreakdown(
    normalizedFinanceRows,
    (profileRows ?? []) as SellerBusinessProfile[],
    {
      search,
      page: Number.isFinite(page) && page > 0 ? page : 1,
      pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 10,
    },
  );

  const query = new URLSearchParams();
  if (search) query.set('q', search);
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  if (pageSize > 0) query.set('pageSize', String(pageSize));

  return (
    <main className="marketplace-shell narrow">
      <header className="marketplace-header">
        <div>
          <p className="eyebrow">ADMIN</p>
          <h1>Revenue overview</h1>
        </div>
      </header>

      <section className="panel" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div>
            <p className="muted">Platform revenue</p>
            <h2>${toMoneyString(summary.totalRevenueCents)}</h2>
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

      <section className="panel">
        <form method="GET" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <input name="q" defaultValue={search} placeholder="Search business or seller" />
          <input name="from" type="date" defaultValue={from ? from.slice(0, 10) : ''} />
          <input name="to" type="date" defaultValue={to ? to.slice(0, 10) : ''} />
          <button type="submit">Apply filters</button>
        </form>

        <h2>Business breakdown</h2>
        {breakdown.items.length === 0 ? (
          <p className="muted">No businesses match the current filter.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Business</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Seller</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Revenue</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Refunds</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Payouts</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Net</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Adjustments</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.items.map((item) => (
                <tr key={item.sellerId}>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{item.businessName}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{item.sellerName}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>${toMoneyString(item.totalSalesCents)}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>${toMoneyString(item.totalRefundsCents)}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>${toMoneyString(item.totalPayoutsCents)}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>${toMoneyString(item.netRevenueCents)}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>${toMoneyString(item.totalAdjustmentsCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {breakdown.totalPages > 1 ? (
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {Array.from({ length: breakdown.totalPages }, (_, index) => index + 1).map((pageNumber) => {
              const nextQuery = new URLSearchParams(query.toString());
              nextQuery.set('page', String(pageNumber));
              const isCurrent = pageNumber === breakdown.page;

              return (
                <a
                  key={pageNumber}
                  href={`?${nextQuery.toString()}`}
                  style={{
                    padding: '0.45rem 0.75rem',
                    border: '1px solid #d0d7de',
                    background: isCurrent ? '#111827' : '#ffffff',
                    color: isCurrent ? '#ffffff' : '#111827',
                    borderRadius: '0.375rem',
                    textDecoration: 'none',
                  }}
                >
                  {pageNumber}
                </a>
              );
            })}
          </div>
        ) : null}
      </section>
    </main>
  );
}

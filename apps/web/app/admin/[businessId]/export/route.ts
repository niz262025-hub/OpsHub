import { NextRequest, NextResponse } from 'next/server';

import {
  assertAdminAuthorized,
  buildBusinessFinanceCsv,
  type FinanceDbRow,
} from '@/lib/finance-data';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> | { businessId: string } },
) {
  const { businessId } = await Promise.resolve(context.params);
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!businessId) {
    return NextResponse.json({ error: 'Business identifier is required.' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role, account_status')
    .eq('id', user.id)
    .maybeSingle();

  if (!assertAdminAuthorized({ role: profileData?.role ?? null, account_status: profileData?.account_status ?? null })) {
    return NextResponse.json({ error: 'Admin authorization required.' }, { status: 403 });
  }

  const { data: sellerProfile, error: sellerError } = await supabase
    .from('seller_profiles')
    .select('user_id, business_name, full_name')
    .eq('user_id', businessId)
    .maybeSingle();

  if (sellerError || !sellerProfile) {
    return NextResponse.json({ error: 'Selected business not found.' }, { status: 404 });
  }

  let financeQuery = supabase
    .from('finance_records')
    .select('id, seller_id, order_id, amount, direction, payment_status, created_at, orders(order_status)')
    .eq('seller_id', businessId);

  if (from && !Number.isNaN(Date.parse(from))) {
    financeQuery = financeQuery.gte('created_at', new Date(from).toISOString());
  }

  if (to && !Number.isNaN(Date.parse(to))) {
    financeQuery = financeQuery.lte('created_at', new Date(to).toISOString());
  }

  const { data: financeRows, error: financeError } = await financeQuery.order('created_at', { ascending: false });

  if (financeError) {
    return NextResponse.json({ error: financeError.message }, { status: 500 });
  }

  const normalizedRows = (financeRows ?? []).map((row) => ({
    ...row,
    order_id: row.order_id ?? null,
    orders: Array.isArray(row.orders) ? row.orders[0] ?? null : row.orders ?? null,
  })) as FinanceDbRow[];

  const csv = buildBusinessFinanceCsv(normalizedRows, businessId, {
    businessName: sellerProfile.business_name ?? 'Unknown business',
    sellerName: sellerProfile.full_name ?? 'Unknown seller',
    from,
    to,
  });

  const businessSafeName = (sellerProfile.business_name ?? businessId ?? 'business')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'business';

  const fromStamp = from && !Number.isNaN(Date.parse(from)) ? new Date(from).toISOString().slice(0, 10) : 'all';
  const toStamp = to && !Number.isNaN(Date.parse(to)) ? new Date(to).toISOString().slice(0, 10) : 'latest';
  const filename = `${businessSafeName}_${fromStamp}_to_${toStamp}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

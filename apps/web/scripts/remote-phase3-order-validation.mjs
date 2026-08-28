import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';

function loadLocalEnv() {
  const candidates = ['.env.local', '.env'];
  for (const candidate of candidates) {
    const filePath = new URL(`../../${candidate}`, import.meta.url);
    if (!existsSync(filePath)) continue;

    const content = readFileSync(filePath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
        process.env[key] = value;
      }
    }
  }
}

function getRequiredEnv(key) {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
}

const log = (name, ok, detail = '') => {
  const status = ok ? 'PASS' : 'FAIL';
  console.log(`${status} ${name}${detail ? ` :: ${detail}` : ''}`);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const uniqueEmail = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

async function waitForRow(adminClient, table, column, value, attempts = 25) {
  for (let i = 0; i < attempts; i += 1) {
    const { data, error } = await adminClient.from(table).select('*').eq(column, value).maybeSingle();
    if (!error && data) return data;
    await sleep(400);
  }
  throw new Error(`missing row ${table}.${column}=${value}`);
}

function createSignedInClient(url, key) {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function main() {
  loadLocalEnv();

  const url = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anon = getRequiredEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  const serviceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  const adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'opshub-phase3-live-validation' } },
  });

  const providerEnvLabels = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'SQUARE_ACCESS_TOKEN', 'BRAINTREE_MERCHANT_ID'];
  const providerConfigured = providerEnvLabels.some((key) => !!process.env[key] && process.env[key].trim() !== '');
  if (!providerConfigured) {
    console.log('PAYMENT PROVIDER LIVE VALIDATION BLOCKED');
  }

  try {
    const adminEmailA = uniqueEmail('admin-order-a');
    const adminPassA = 'TempPass123!';
    const adminUserA = await adminClient.auth.admin.createUser({
      email: adminEmailA,
      password: adminPassA,
      email_confirm: true,
      user_metadata: { full_name: 'Admin Order A' },
    });
    if (adminUserA.error) throw new Error(`admin A createUser failed: ${adminUserA.error.message}`);

    await waitForRow(adminClient, 'profiles', 'id', adminUserA.data.user.id, 25);
    const adminRoleUpdate = await adminClient.from('profiles').update({ role: 'ADMIN', account_status: 'ACTIVE' }).eq('id', adminUserA.data.user.id).select();
    if (adminRoleUpdate.error) throw new Error(`admin A role update failed: ${adminRoleUpdate.error.message}`);

    const adminClientA = createSignedInClient(url, anon);
    const adminSignInA = await adminClientA.auth.signInWithPassword({ email: adminEmailA, password: adminPassA });
    if (adminSignInA.error) throw new Error(`admin A sign-in failed: ${adminSignInA.error.message}`);
    await adminClientA.auth.setSession({
      access_token: adminSignInA.data.session.access_token,
      refresh_token: adminSignInA.data.session.refresh_token,
    });

    const sellerEmailA = uniqueEmail('seller-order-a');
    const sellerPassA = 'TempPass123!';
    const sellerUserA = await adminClient.auth.admin.createUser({
      email: sellerEmailA,
      password: sellerPassA,
      email_confirm: true,
      user_metadata: {
        full_name: 'Seller Order A',
        seller_registration: 'true',
        phone: '1112223333',
        business_name: 'Seller A Order Business',
        business_address: '1 Order Street',
      },
    });
    if (sellerUserA.error) throw new Error(`seller A createUser failed: ${sellerUserA.error.message}`);

    await waitForRow(adminClient, 'profiles', 'id', sellerUserA.data.user.id, 25);
    const verifySellerA = await adminClientA.from('seller_profiles').update({
      verification_status: 'VERIFIED',
      verification_note: 'remote phase3 validation',
    }).eq('user_id', sellerUserA.data.user.id).select();
    if (verifySellerA.error) throw new Error(`seller A verification failed: ${verifySellerA.error.message}`);
    log('seller A verified', verifySellerA.data?.length > 0, `status=${verifySellerA.data?.[0]?.verification_status ?? 'n/a'}`);

    const sellerClientA = createSignedInClient(url, anon);
    const sellerSignInA = await sellerClientA.auth.signInWithPassword({ email: sellerEmailA, password: sellerPassA });
    if (sellerSignInA.error) throw new Error(`seller A sign-in failed: ${sellerSignInA.error.message}`);
    await sellerClientA.auth.setSession({
      access_token: sellerSignInA.data.session.access_token,
      refresh_token: sellerSignInA.data.session.refresh_token,
    });

    const publicProduct = await sellerClientA.from('products').insert({
      seller_id: sellerUserA.data.user.id,
      name: 'Phase 3 Valid Product',
      description: 'Live validation product',
      price: 19.99,
      quantity: 5,
      status: 'PUBLISHED',
      source: 'OWNED',
      is_public: true,
    }).select().single();
    if (publicProduct.error) throw new Error(`seller product insert failed: ${publicProduct.error.message}`);

    const productId = publicProduct.data.id;
    log('seller can create published product', !!productId, `product=${productId}`);

    const buyerEmailA = uniqueEmail('buyer-order-a');
    const buyerPassA = 'TempPass123!';
    const buyerUserA = await adminClient.auth.admin.createUser({
      email: buyerEmailA,
      password: buyerPassA,
      email_confirm: true,
      user_metadata: { full_name: 'Buyer Order A' },
    });
    if (buyerUserA.error) throw new Error(`buyer A createUser failed: ${buyerUserA.error.message}`);

    await waitForRow(adminClient, 'profiles', 'id', buyerUserA.data.user.id, 25);

    const buyerClientA = createSignedInClient(url, anon);
    const buyerSignInA = await buyerClientA.auth.signInWithPassword({ email: buyerEmailA, password: buyerPassA });
    if (buyerSignInA.error) throw new Error(`buyer A sign-in failed: ${buyerSignInA.error.message}`);
    await buyerClientA.auth.setSession({
      access_token: buyerSignInA.data.session.access_token,
      refresh_token: buyerSignInA.data.session.refresh_token,
    });

    const forgedInsert = await buyerClientA.from('orders').insert({
      buyer_id: buyerUserA.data.user.id,
      seller_id: sellerUserA.data.user.id,
      product_id: productId,
      quantity: 1,
      unit_price: 9999.99,
      subtotal: 19999.98,
      total: 19999.98,
      currency: 'USD',
      order_status: 'PENDING_PAYMENT',
      payment_status: 'PENDING',
    }).select();
    log('forged order total rejected', !!forgedInsert.error, forgedInsert.error ? forgedInsert.error.message : 'unexpected success');

    const validOrderResponse = await buyerClientA.rpc('create_order_for_product', {
      p_buyer_id: buyerUserA.data.user.id,
      p_product_id: productId,
      p_quantity: 2,
    });
    log('valid order creation via server-controlled RPC', !validOrderResponse.error && !!validOrderResponse.data, validOrderResponse.error ? validOrderResponse.error.message : `order_id=${validOrderResponse.data?.id ?? 'n/a'}`);

    const createdOrder = validOrderResponse.data;
    if (!createdOrder) {
      throw new Error('No valid order created; cannot continue remote validation');
    }

    const orderCheck = await adminClient.from('orders').select('*').eq('id', createdOrder.id).maybeSingle();
    log('order status correct', !orderCheck.error && orderCheck.data?.order_status === 'PENDING_PAYMENT', orderCheck.error ? orderCheck.error.message : `status=${orderCheck.data?.order_status}`);
    log('payment status default pending', !orderCheck.error && orderCheck.data?.payment_status === 'PENDING', orderCheck.error ? orderCheck.error.message : `status=${orderCheck.data?.payment_status}`);
    log('total matches subtotal', !orderCheck.error && Number(orderCheck.data?.subtotal) === Number(orderCheck.data?.total), orderCheck.error ? orderCheck.error.message : `subtotal=${orderCheck.data?.subtotal} total=${orderCheck.data?.total}`);

    const productAfterOrder = await adminClient.from('products').select('*').eq('id', productId).maybeSingle();
    log('inventory decremented correctly', !productAfterOrder.error && productAfterOrder.data?.quantity === 3, productAfterOrder.error ? productAfterOrder.error.message : `remaining=${productAfterOrder.data?.quantity}`);

    const invalidQty = await buyerClientA.rpc('create_order_for_product', {
      p_buyer_id: buyerUserA.data.user.id,
      p_product_id: productId,
      p_quantity: 999,
    });
    log('oversized quantity rejected', !!invalidQty.error, invalidQty.error ? invalidQty.error.message : 'unexpected success');

    const zeroQty = await buyerClientA.rpc('create_order_for_product', {
      p_buyer_id: buyerUserA.data.user.id,
      p_product_id: productId,
      p_quantity: 0,
    });
    log('zero quantity rejected', !!zeroQty.error, zeroQty.error ? zeroQty.error.message : 'unexpected success');

    const hiddenProduct = await sellerClientA.from('products').update({ status: 'DRAFT', is_public: false }).eq('id', productId).select();
    if (hiddenProduct.error) throw new Error(`product visibility update failed: ${hiddenProduct.error.message}`);
    const unavailable = await buyerClientA.rpc('create_order_for_product', {
      p_buyer_id: buyerUserA.data.user.id,
      p_product_id: productId,
      p_quantity: 1,
    });
    log('unpublished product rejected', !!unavailable.error, unavailable.error ? unavailable.error.message : 'unexpected success');

    const customerBEmail = uniqueEmail('buyer-order-b');
    const customerBPass = 'TempPass123!';
    const customerB = await adminClient.auth.admin.createUser({
      email: customerBEmail,
      password: customerBPass,
      email_confirm: true,
      user_metadata: { full_name: 'Buyer Order B' },
    });
    if (customerB.error) throw new Error(`buyer B createUser failed: ${customerB.error.message}`);
    await waitForRow(adminClient, 'profiles', 'id', customerB.data.user.id, 25);

    const buyerClientB = createSignedInClient(url, anon);
    const buyerSignInB = await buyerClientB.auth.signInWithPassword({ email: customerBEmail, password: customerBPass });
    if (buyerSignInB.error) throw new Error(`buyer B sign-in failed: ${buyerSignInB.error.message}`);
    await buyerClientB.auth.setSession({
      access_token: buyerSignInB.data.session.access_token,
      refresh_token: buyerSignInB.data.session.refresh_token,
    });

    const buyerAOrders = await buyerClientA.from('orders').select('*');
    const buyerBOrders = await buyerClientB.from('orders').select('*');
    log('customer A sees own order', !buyerAOrders.error && buyerAOrders.data?.some((row) => row.id === createdOrder.id), buyerAOrders.error ? buyerAOrders.error.message : 'ok');
    log('customer B does not see customer A order', !buyerBOrders.error && !buyerBOrders.data?.some((row) => row.id === createdOrder.id), buyerBOrders.error ? buyerBOrders.error.message : 'ok');

    const tamperTotal = await buyerClientA.from('orders').update({ total: 999999 }).eq('id', createdOrder.id).select();
    log('customer cannot tamper total', !!tamperTotal.error, tamperTotal.error ? tamperTotal.error.message : 'unexpected success');

    const tamperPrice = await buyerClientA.from('orders').update({ unit_price: 1 }).eq('id', createdOrder.id).select();
    log('customer cannot tamper unit price', !!tamperPrice.error, tamperPrice.error ? tamperPrice.error.message : 'unexpected success');

    const sellerBEmail = uniqueEmail('seller-order-b');
    const sellerBPass = 'TempPass123!';
    const sellerUserB = await adminClient.auth.admin.createUser({
      email: sellerBEmail,
      password: sellerBPass,
      email_confirm: true,
      user_metadata: {
        full_name: 'Seller Order B',
        seller_registration: 'true',
        phone: '2223334444',
        business_name: 'Seller B Order Business',
        business_address: '2 Order Street',
      },
    });
    if (sellerUserB.error) throw new Error(`seller B createUser failed: ${sellerUserB.error.message}`);
    await waitForRow(adminClient, 'profiles', 'id', sellerUserB.data.user.id, 25);
    await adminClient.from('profiles').update({ role: 'SELLER', account_status: 'ACTIVE' }).eq('id', sellerUserB.data.user.id).select();
    await adminClient.from('seller_profiles').update({ verification_status: 'VERIFIED', verification_note: 'remote phase3 validation' }).eq('user_id', sellerUserB.data.user.id).select();

    const sellerClientB = createSignedInClient(url, anon);
    const sellerSignInB = await sellerClientB.auth.signInWithPassword({ email: sellerBEmail, password: sellerBPass });
    if (sellerSignInB.error) throw new Error(`seller B sign-in failed: ${sellerSignInB.error.message}`);
    await sellerClientB.auth.setSession({
      access_token: sellerSignInB.data.session.access_token,
      refresh_token: sellerSignInB.data.session.refresh_token,
    });

    const sellerAOrders = await sellerClientA.from('orders').select('*').eq('id', createdOrder.id);
    log('seller A can view own order', !sellerAOrders.error && sellerAOrders.data?.length === 1, sellerAOrders.error ? sellerAOrders.error.message : 'ok');

    const sellerBOtherOrder = await sellerClientB.from('orders').select('*').eq('id', createdOrder.id);
    log('seller B cannot view seller A order', !sellerBOtherOrder.error && sellerBOtherOrder.data?.length === 0, sellerBOtherOrder.error ? sellerBOtherOrder.error.message : 'unexpected data returned');

    const sellerBMutation = await sellerClientB.from('orders').update({ order_status: 'PAID', payment_status: 'PAID' }).eq('id', createdOrder.id).select();
    log('seller B cannot mutate seller A order', !!sellerBMutation.error, sellerBMutation.error ? sellerBMutation.error.message : 'unexpected success');

    const adminEmail = uniqueEmail('admin-phase3');
    const adminPass = 'TempPass123!';
    const adminUser = await adminClient.auth.admin.createUser({
      email: adminEmail,
      password: adminPass,
      email_confirm: true,
      user_metadata: { full_name: 'Admin Phase 3' },
    });
    if (adminUser.error) throw new Error(`admin createUser failed: ${adminUser.error.message}`);
    await waitForRow(adminClient, 'profiles', 'id', adminUser.data.user.id, 25);
    const adminUpdate = await adminClient.from('profiles').update({ role: 'ADMIN', account_status: 'ACTIVE' }).eq('id', adminUser.data.user.id).select();
    if (adminUpdate.error) throw new Error(`admin profile update failed: ${adminUpdate.error.message}`);

    const adminClientAuth = createSignedInClient(url, anon);
    const adminSignIn = await adminClientAuth.auth.signInWithPassword({ email: adminEmail, password: adminPass });
    if (adminSignIn.error) throw new Error(`admin sign-in failed: ${adminSignIn.error.message}`);
    await adminClientAuth.auth.setSession({
      access_token: adminSignIn.data.session.access_token,
      refresh_token: adminSignIn.data.session.refresh_token,
    });

    const adminAllowed = await adminClientAuth.from('orders').select('*').eq('id', createdOrder.id).maybeSingle();
    log('admin may inspect order', !adminAllowed.error && !!adminAllowed.data, adminAllowed.error ? adminAllowed.error.message : 'ok');

    const noServiceRole = await buyerClientA.from('orders').insert({
      buyer_id: buyerUserA.data.user.id,
      seller_id: sellerUserA.data.user.id,
      product_id: productId,
      quantity: 1,
      unit_price: 19.99,
      subtotal: 19.99,
      total: 19.99,
      currency: 'USD',
      order_status: 'PAID',
      payment_status: 'PAID',
    }).select();
    log('client cannot directly insert paid order', !!noServiceRole.error, noServiceRole.error ? noServiceRole.error.message : 'unexpected success');

    const paymentStatusCheck = await adminClient.from('payments').select('*').limit(1);
    log('payment table reachable for audit', !paymentStatusCheck.error && Array.isArray(paymentStatusCheck.data), paymentStatusCheck.error ? paymentStatusCheck.error.message : `rows=${paymentStatusCheck.data.length}`);

    console.log('PHASE3_LIVE_VALIDATION_COMPLETE');
  } catch (error) {
    console.log(`BLOCKER ${error?.message || String(error)}`);
    process.exit(1);
  }
}

main();

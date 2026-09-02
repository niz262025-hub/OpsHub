import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';


function loadLocalEnv() {
  const candidates = ['.env.local', '.env'];
  for (const candidate of candidates) {
    const filePath = new URL(`../${candidate}`, import.meta.url);
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
    global: { headers: { 'x-application-name': 'opshub-live-validation' } },
  });

  const cleanup = [];

  try {
    const sellerEmailA = uniqueEmail('seller-a');
    const sellerPassA = 'TempPass123!';
    const sellerUserA = await adminClient.auth.admin.createUser({
      email: sellerEmailA,
      password: sellerPassA,
      email_confirm: true,
      user_metadata: {
        full_name: 'Seller A Remote',
        seller_registration: 'true',
        phone: '1112223333',
        business_name: 'Seller A Business',
        business_address: '1 Seller Street',
      },
    });
    if (sellerUserA.error) throw new Error(`seller A createUser failed: ${sellerUserA.error.message}`);
    cleanup.push(sellerUserA.data.user.id);

    const profileA = await waitForRow(adminClient, 'profiles', 'id', sellerUserA.data.user.id, 25);
    const sellerA = await waitForRow(adminClient, 'seller_profiles', 'user_id', sellerUserA.data.user.id, 25);
    log('auth trigger seller A profile created', !!profileA, profileA ? 'profile exists' : 'missing');
    log('auth trigger seller A seller_profile created', !!sellerA, sellerA ? sellerA.verification_status : 'missing');
    log('auth trigger seller A starts PENDING', sellerA?.verification_status === 'PENDING', sellerA ? sellerA.verification_status : 'missing');

    const sellerClientA = createSignedInClient(url, anon);
    const signInA = await sellerClientA.auth.signInWithPassword({ email: sellerEmailA, password: sellerPassA });
    if (signInA.error) throw new Error(`seller A sign-in failed: ${signInA.error.message}`);
    await sellerClientA.auth.setSession({
      access_token: signInA.data.session.access_token,
      refresh_token: signInA.data.session.refresh_token,
    });

    const ownProfileA = await sellerClientA.from('profiles').select('*').eq('id', sellerUserA.data.user.id).maybeSingle();
    log('seller A can read own profile', !ownProfileA.error && !!ownProfileA.data, ownProfileA.error ? ownProfileA.error.message : 'ok');

    const sellerEmailB = uniqueEmail('seller-b');
    const sellerPassB = 'TempPass123!';
    const sellerUserB = await adminClient.auth.admin.createUser({
      email: sellerEmailB,
      password: sellerPassB,
      email_confirm: true,
      user_metadata: {
        full_name: 'Seller B Remote',
        seller_registration: 'true',
        phone: '2223334444',
        business_name: 'Seller B Business',
        business_address: '2 Seller Street',
      },
    });
    if (sellerUserB.error) throw new Error(`seller B createUser failed: ${sellerUserB.error.message}`);
    cleanup.push(sellerUserB.data.user.id);
    await waitForRow(adminClient, 'profiles', 'id', sellerUserB.data.user.id, 25);
    await waitForRow(adminClient, 'seller_profiles', 'user_id', sellerUserB.data.user.id, 25);

    const sellerBProfile = await sellerClientA.from('profiles').select('*').eq('id', sellerUserB.data.user.id).maybeSingle();
    const otherProfileBlocked = !sellerBProfile.error && !sellerBProfile.data;
    log('seller A cannot read seller B profile', otherProfileBlocked, sellerBProfile.error ? sellerBProfile.error.message : sellerBProfile.data ? 'unexpected data returned' : 'no data returned');

    const beforeRoleState = await adminClient.from('profiles').select('role').eq('id', sellerUserA.data.user.id).maybeSingle();
    const beforeStatusState = await adminClient.from('profiles').select('account_status').eq('id', sellerUserA.data.user.id).maybeSingle();
    const beforeVerificationState = await adminClient.from('seller_profiles').select('verification_status').eq('user_id', sellerUserA.data.user.id).maybeSingle();

    const ownRoleUpdate = await sellerClientA.from('profiles').update({ role: 'ADMIN' }).eq('id', sellerUserA.data.user.id).select();
    const afterRoleState = await adminClient.from('profiles').select('role').eq('id', sellerUserA.data.user.id).maybeSingle();
    const roleProtected = !!ownRoleUpdate.error || (Array.isArray(ownRoleUpdate.data) ? ownRoleUpdate.data.length === 0 : !ownRoleUpdate.data) && afterRoleState.data?.role === beforeRoleState.data?.role;
    log('seller A cannot change role', roleProtected, `before=${beforeRoleState.data?.role ?? 'missing'} after=${afterRoleState.data?.role ?? 'missing'} error=${ownRoleUpdate.error?.message ?? 'none'} rows=${Array.isArray(ownRoleUpdate.data) ? ownRoleUpdate.data.length : 0}`);

    const ownStatusUpdate = await sellerClientA.from('profiles').update({ account_status: 'SUSPENDED' }).eq('id', sellerUserA.data.user.id).select();
    const afterStatusState = await adminClient.from('profiles').select('account_status').eq('id', sellerUserA.data.user.id).maybeSingle();
    const statusProtected = !!ownStatusUpdate.error || (Array.isArray(ownStatusUpdate.data) ? ownStatusUpdate.data.length === 0 : !ownStatusUpdate.data) && afterStatusState.data?.account_status === beforeStatusState.data?.account_status;
    log('seller A cannot change account_status', statusProtected, `before=${beforeStatusState.data?.account_status ?? 'missing'} after=${afterStatusState.data?.account_status ?? 'missing'} error=${ownStatusUpdate.error?.message ?? 'none'} rows=${Array.isArray(ownStatusUpdate.data) ? ownStatusUpdate.data.length : 0}`);

    const ownVerificationUpdate = await sellerClientA.from('seller_profiles').update({ verification_status: 'VERIFIED' }).eq('user_id', sellerUserA.data.user.id).select();
    const afterVerificationState = await adminClient.from('seller_profiles').select('verification_status').eq('user_id', sellerUserA.data.user.id).maybeSingle();
    const verificationProtected = !!ownVerificationUpdate.error || (Array.isArray(ownVerificationUpdate.data) ? ownVerificationUpdate.data.length === 0 : !ownVerificationUpdate.data) && afterVerificationState.data?.verification_status === beforeVerificationState.data?.verification_status;
    log('seller A cannot change verification_status', verificationProtected, `before=${beforeVerificationState.data?.verification_status ?? 'missing'} after=${afterVerificationState.data?.verification_status ?? 'missing'} error=${ownVerificationUpdate.error?.message ?? 'none'} rows=${Array.isArray(ownVerificationUpdate.data) ? ownVerificationUpdate.data.length : 0}`);

    const adminEmail = uniqueEmail('admin-a');
    const adminPass = 'TempPass123!';
    const adminUser = await adminClient.auth.admin.createUser({
      email: adminEmail,
      password: adminPass,
      email_confirm: true,
      user_metadata: { full_name: 'Admin A Remote' },
    });
    if (adminUser.error) throw new Error(`admin createUser failed: ${adminUser.error.message}`);
    cleanup.push(adminUser.data.user.id);
    const adminId = adminUser.data.user.id;
    await waitForRow(adminClient, 'profiles', 'id', adminId, 25);
    const updatedAdmin = await adminClient.from('profiles').update({ role: 'ADMIN', account_status: 'ACTIVE' }).eq('id', adminId).select();
    if (updatedAdmin.error) throw new Error(`admin profile update failed: ${updatedAdmin.error.message}`);

    const adminClientAuth = createSignedInClient(url, anon);
    const adminSignIn = await adminClientAuth.auth.signInWithPassword({ email: adminEmail, password: adminPass });
    if (adminSignIn.error) throw new Error(`admin sign-in failed: ${adminSignIn.error.message}`);
    await adminClientAuth.auth.setSession({
      access_token: adminSignIn.data.session.access_token,
      refresh_token: adminSignIn.data.session.refresh_token,
    });

    const pendingView = await adminClientAuth.from('seller_profiles').select('*').eq('user_id', sellerUserA.data.user.id).maybeSingle();
    log('admin can view pending seller', !pendingView.error && !!pendingView.data, pendingView.error ? pendingView.error.message : 'ok');

    const approve = await adminClientAuth.from('seller_profiles').update({ verification_status: 'VERIFIED', verification_note: 'approved by live admin validation' }).eq('user_id', sellerUserA.data.user.id).select();
    log('admin approves seller', !approve.error && !!approve.data, approve.error ? approve.error.message : 'ok');

    const reject = await adminClientAuth.from('seller_profiles').update({ verification_status: 'REJECTED', verification_note: 'rejected by live admin validation' }).eq('user_id', sellerUserB.data.user.id).select();
    log('admin rejects seller', !reject.error && !!reject.data, reject.error ? reject.error.message : 'ok');

    const suspend = await adminClientAuth.from('seller_profiles').update({ verification_status: 'SUSPENDED', verification_note: 'suspended by live admin validation' }).eq('user_id', sellerUserA.data.user.id).select();
    log('admin suspends seller', !suspend.error && !!suspend.data, suspend.error ? suspend.error.message : 'ok');

    const selfApprovalAfterAdmin = await sellerClientA.from('seller_profiles').update({ verification_status: 'VERIFIED', verification_note: 'self-approval attempt' }).eq('user_id', sellerUserA.data.user.id).select();
    log('seller A cannot self-approve after admin action', !!selfApprovalAfterAdmin.error, selfApprovalAfterAdmin.error ? selfApprovalAfterAdmin.error.message : 'unexpected success');

    const statusRow = await adminClient.from('seller_profiles').select('user_id, verification_status').in('user_id', [sellerUserA.data.user.id, sellerUserB.data.user.id, adminId]);
    log('remote admin state update', !statusRow.error && Array.isArray(statusRow.data), statusRow.error ? statusRow.error.message : `records=${statusRow.data.length}`);

    const cleanupResult = [];
    for (const userId of cleanup) {
      try {
        const deleted = await adminClient.auth.admin.deleteUser(userId);
        cleanupResult.push({ userId, ok: !deleted.error });
      } catch {
        cleanupResult.push({ userId, ok: false });
      }
    }
    log('test cleanup', cleanupResult.every((entry) => entry.ok), `processed=${cleanupResult.length}`);

    console.log('REMOTE_VALIDATION_COMPLETE');
  } catch (error) {
    console.log(`BLOCKER ${error?.message || String(error)}`);
    process.exit(1);
  }
}

main();

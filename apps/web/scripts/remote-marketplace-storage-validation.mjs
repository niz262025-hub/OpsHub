import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

function loadLocalEnv() {
  const candidates = ['.env.local', '.env'];
  for (const candidate of candidates) {
    const filePath = new URL(`../../../${candidate}`, import.meta.url);
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

async function waitForRow(adminClient, table, column, value, attempts = 30) {
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

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB4L' +
    'mJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJ0UkGAAAAA' +
    'EAgM3Db5AAAAAElFTkSuQmCC',
  'base64',
);

async function fetchStatus(url) {
  const response = await fetch(url, { redirect: 'follow' });
  return response;
}

async function main() {
  loadLocalEnv();
  const url = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anon = getRequiredEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  const serviceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  const adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'opshub-marketplace-storage-validation' } },
  });

  const cleanup = [];

  try {
    const adminEmail = uniqueEmail('phase2-admin');
    const adminPass = 'TempPass123!';
    const adminUser = await adminClient.auth.admin.createUser({
      email: adminEmail,
      password: adminPass,
      email_confirm: true,
      user_metadata: { full_name: 'Marketplace Admin' },
    });
    if (adminUser.error) throw new Error(`admin createUser failed: ${adminUser.error.message}`);
    cleanup.push(adminUser.data.user.id);
    await waitForRow(adminClient, 'profiles', 'id', adminUser.data.user.id, 25);
    const adminRoleUpdate = await adminClient.from('profiles').update({ role: 'ADMIN', account_status: 'ACTIVE' }).eq('id', adminUser.data.user.id).select();
    if (adminRoleUpdate.error) throw new Error(`admin role update failed: ${adminRoleUpdate.error.message}`);

    const adminClientAuth = createSignedInClient(url, anon);
    const adminSignIn = await adminClientAuth.auth.signInWithPassword({ email: adminEmail, password: adminPass });
    if (adminSignIn.error) throw new Error(`admin sign-in failed: ${adminSignIn.error.message}`);
    await adminClientAuth.auth.setSession({
      access_token: adminSignIn.data.session.access_token,
      refresh_token: adminSignIn.data.session.refresh_token,
    });

    const sellerEmail = uniqueEmail('phase2-seller');
    const sellerPass = 'TempPass123!';
    const sellerUser = await adminClient.auth.admin.createUser({
      email: sellerEmail,
      password: sellerPass,
      email_confirm: true,
      user_metadata: {
        full_name: 'Marketplace Seller',
        seller_registration: 'true',
        phone: '5551112222',
        business_name: 'Phase 2 Seller Co',
        business_address: '42 Market Way',
      },
    });
    if (sellerUser.error) throw new Error(`seller createUser failed: ${sellerUser.error.message}`);
    cleanup.push(sellerUser.data.user.id);
    await waitForRow(adminClient, 'profiles', 'id', sellerUser.data.user.id, 30);
    await waitForRow(adminClient, 'seller_profiles', 'user_id', sellerUser.data.user.id, 30);

    const sellerApproval = await adminClientAuth.from('seller_profiles').update({
      verification_status: 'VERIFIED',
      verification_note: 'marketplace storage validation',
    }).eq('user_id', sellerUser.data.user.id).select();
    if (sellerApproval.error) throw new Error(`seller approval failed: ${sellerApproval.error.message}`);

    const sellerClient = createSignedInClient(url, anon);
    const sellerSignIn = await sellerClient.auth.signInWithPassword({ email: sellerEmail, password: sellerPass });
    if (sellerSignIn.error) throw new Error(`seller sign-in failed: ${sellerSignIn.error.message}`);
    await sellerClient.auth.setSession({
      access_token: sellerSignIn.data.session.access_token,
      refresh_token: sellerSignIn.data.session.refresh_token,
    });

    const productId = randomUUID();
    const productInsert = await sellerClient.from('products').insert({
      id: productId,
      seller_id: sellerUser.data.user.id,
      name: 'Phase 2 storage test product',
      description: 'Storage validation product',
      price: 49.99,
      quantity: 7,
      status: 'DRAFT',
      source: 'OWNED',
      is_public: false,
      image_url: '',
    }).select().single();
    if (productInsert.error) throw new Error(`product insert failed: ${productInsert.error.message}`);

    const objectPath = `${sellerUser.data.user.id}/products/${randomUUID()}.png`;
    const upload = await sellerClient.storage.from('marketplace-product-images').upload(objectPath, tinyPng, {
      contentType: 'image/png',
      upsert: false,
      cacheControl: '3600',
    });
    if (upload.error) throw new Error(`image upload failed: ${upload.error.message}`);
    const objectSigned = await sellerClient.storage.from('marketplace-product-images').createSignedUrl(objectPath, 3600);
    const objectExists = !objectSigned.error && !!objectSigned.data?.signedUrl;
    log('Storage upload', !!upload.data, upload.error ? upload.error.message : `path=${objectPath}`);
    log('Storage object exists remotely', objectExists, objectSigned.error ? objectSigned.error.message : `url_ok=${!!objectSigned.data?.signedUrl}`);

    const imageInsert = await sellerClient.from('product_images').insert({
      product_id: productId,
      seller_id: sellerUser.data.user.id,
      storage_path: objectPath,
      image_url: objectPath,
      is_primary: true,
    }).select().single();
    if (imageInsert.error) throw new Error(`product_images insert failed: ${imageInsert.error.message}`);
    log('Product stores durable image path', !!imageInsert.data, `storage_path=${imageInsert.data?.storage_path ?? 'missing'}`);

    const signedUrlData = await sellerClient.storage.from('marketplace-product-images').createSignedUrl(objectPath, 3600);
    if (signedUrlData.error) throw new Error(`signed image URL failed: ${signedUrlData.error.message}`);
    const signedResponse = await fetchStatus(signedUrlData.data.signedUrl);
    log('Image loads immediately after upload', signedResponse.ok, `status=${signedResponse.status}`);

    const refreshedClient = createSignedInClient(url, anon);
    const refreshedSeller = await refreshedClient.auth.signInWithPassword({ email: sellerEmail, password: sellerPass });
    if (refreshedSeller.error) throw new Error(`refreshed seller sign-in failed: ${refreshedSeller.error.message}`);
    await refreshedClient.auth.setSession({
      access_token: refreshedSeller.data.session.access_token,
      refresh_token: refreshedSeller.data.session.refresh_token,
    });
    const refreshSigned = await refreshedClient.storage.from('marketplace-product-images').createSignedUrl(objectPath, 3600);
    if (refreshSigned.error) throw new Error(`post-refresh signed URL failed: ${refreshSigned.error.message}`);
    const refreshResponse = await fetchStatus(refreshSigned.data.signedUrl);
    log('Image persists after refresh', refreshResponse.ok, `status=${refreshResponse.status}`);

    await sellerClient.auth.signOut();
    const sellerSignInAgain = await sellerClient.auth.signInWithPassword({ email: sellerEmail, password: sellerPass });
    if (sellerSignInAgain.error) throw new Error(`seller re-sign-in failed: ${sellerSignInAgain.error.message}`);
    await sellerClient.auth.setSession({
      access_token: sellerSignInAgain.data.session.access_token,
      refresh_token: sellerSignInAgain.data.session.refresh_token,
    });
    const reloginSigned = await sellerClient.storage.from('marketplace-product-images').createSignedUrl(objectPath, 3600);
    if (reloginSigned.error) throw new Error(`post-login signed URL failed: ${reloginSigned.error.message}`);
    const reloginResponse = await fetchStatus(reloginSigned.data.signedUrl);
    log('Image still loads after sign out/in', reloginResponse.ok, `status=${reloginResponse.status}`);

    const updateImage = await sellerClient.from('product_images').update({ is_primary: false }).eq('id', imageInsert.data.id).select();
    if (updateImage.error) throw new Error(`seller image update failed: ${updateImage.error.message}`);
    log('Seller can update own image', !!updateImage.data, `updated=${updateImage.data?.length ?? 0}`);

    const otherSellerEmail = uniqueEmail('phase2-seller-b');
    const otherSellerPass = 'TempPass123!';
    const otherSellerUser = await adminClient.auth.admin.createUser({
      email: otherSellerEmail,
      password: otherSellerPass,
      email_confirm: true,
      user_metadata: {
        full_name: 'Other Seller',
        seller_registration: 'true',
        phone: '4447778888',
        business_name: 'Other Seller Co',
        business_address: '99 Other Street',
      },
    });
    if (otherSellerUser.error) throw new Error(`other seller createUser failed: ${otherSellerUser.error.message}`);
    cleanup.push(otherSellerUser.data.user.id);
    await waitForRow(adminClient, 'seller_profiles', 'user_id', otherSellerUser.data.user.id, 25);
    const otherSellerApproval = await adminClientAuth.from('seller_profiles').update({
      verification_status: 'VERIFIED',
      verification_note: 'cross-seller validation',
    }).eq('user_id', otherSellerUser.data.user.id).select();
    if (otherSellerApproval.error) throw new Error(`other seller approval failed: ${otherSellerApproval.error.message}`);

    const otherSellerClient = createSignedInClient(url, anon);
    const otherSellerSignIn = await otherSellerClient.auth.signInWithPassword({ email: otherSellerEmail, password: otherSellerPass });
    if (otherSellerSignIn.error) throw new Error(`other seller sign-in failed: ${otherSellerSignIn.error.message}`);
    await otherSellerClient.auth.setSession({
      access_token: otherSellerSignIn.data.session.access_token,
      refresh_token: otherSellerSignIn.data.session.refresh_token,
    });

    const protectedPath = `${sellerUser.data.user.id}/protected/${randomUUID()}.png`;
    const protectedUpload = await sellerClient.storage.from('marketplace-product-images').upload(protectedPath, tinyPng, {
      contentType: 'image/png',
      upsert: false,
    });
    if (protectedUpload.error) throw new Error(`protected image upload failed: ${protectedUpload.error.message}`);
    const protectedImageRow = await sellerClient.from('product_images').insert({
      product_id: productId,
      seller_id: sellerUser.data.user.id,
      storage_path: protectedPath,
      image_url: protectedPath,
      is_primary: false,
    }).select().single();
    if (protectedImageRow.error) throw new Error(`protected image row insert failed: ${protectedImageRow.error.message}`);

    const otherRead = await otherSellerClient.from('product_images').select('*').eq('storage_path', protectedPath).maybeSingle();
    const otherReadBlocked = !!otherRead.error || !otherRead.data;
    log('Cross-seller cannot access image row', otherReadBlocked, otherRead.error ? otherRead.error.message : 'no data returned');

    const otherUpdate = await otherSellerClient.from('product_images').update({ is_primary: true }).eq('storage_path', protectedPath).select();
    const otherUpdateBlocked = !otherUpdate.error && Array.isArray(otherUpdate.data) && otherUpdate.data.length === 0;
    log('Cross-seller cannot update image row', otherUpdateBlocked, otherUpdate.error ? otherUpdate.error.message : `updated_rows=${otherUpdate.data?.length ?? 0}`);

    const otherDelete = await otherSellerClient.storage.from('marketplace-product-images').remove([protectedPath]);
    const otherDeleteBlocked = !otherDelete.error && Array.isArray(otherDelete.data) && otherDelete.data.length === 0;
    log('Cross-seller cannot delete storage object', otherDeleteBlocked, otherDelete.error ? otherDelete.error.message : `removed_rows=${otherDelete.data?.length ?? 0}`);

    const deleteImage = await sellerClient.from('product_images').delete().eq('id', protectedImageRow.data.id).select();
    if (deleteImage.error) throw new Error(`seller image delete failed: ${deleteImage.error.message}`);
    const storageRemove = await sellerClient.storage.from('marketplace-product-images').remove([protectedPath]);
    if (storageRemove.error) throw new Error(`storage image delete failed: ${storageRemove.error.message}`);
    log('Seller can delete own image', !!storageRemove.data, `removed=${storageRemove.data?.length ?? 0}`);

    const publicProductId = randomUUID();
    const publishedProduct = await sellerClient.from('products').insert({
      id: publicProductId,
      seller_id: sellerUser.data.user.id,
      name: 'Published Product for Public Testing',
      description: 'Public marketplace product',
      price: 29.5,
      quantity: 9,
      status: 'PUBLISHED',
      source: 'OWNED',
      is_public: true,
      image_url: objectPath,
    }).select().single();
    if (publishedProduct.error) throw new Error(`published product insert failed: ${publishedProduct.error.message}`);

    const publicImagePath = `${sellerUser.data.user.id}/public/${randomUUID()}.png`;
    const publicImageUpload = await sellerClient.storage.from('marketplace-product-images').upload(publicImagePath, tinyPng, {
      contentType: 'image/png',
      upsert: false,
    });
    if (publicImageUpload.error) throw new Error(`public image upload failed: ${publicImageUpload.error.message}`);
    const publicImageRow = await sellerClient.from('product_images').insert({
      product_id: publicProductId,
      seller_id: sellerUser.data.user.id,
      storage_path: publicImagePath,
      image_url: publicImagePath,
      is_primary: true,
    }).select().single();
    if (publicImageRow.error) throw new Error(`public image row insert failed: ${publicImageRow.error.message}`);

    const anonClient = createSignedInClient(url, anon);
    const publicRead = await anonClient.from('products').select('*').eq('id', publicProductId).maybeSingle();
    log('Published product is public', !publicRead.error && !!publicRead.data, publicRead.error ? publicRead.error.message : 'ok');
    const anonImageUrl = await anonClient.storage.from('marketplace-product-images').createSignedUrl(publicImagePath, 3600);
    if (anonImageUrl.error) throw new Error(`public image signed URL failed: ${anonImageUrl.error.message}`);
    const publicImageResponse = await fetchStatus(anonImageUrl.data.signedUrl);
    log('Published image loads publicly', publicImageResponse.ok, `status=${publicImageResponse.status}`);

    const hiddenProductId = randomUUID();
    const hiddenInsert = await sellerClient.from('products').insert({
      id: hiddenProductId,
      seller_id: sellerUser.data.user.id,
      name: 'Private Product',
      description: 'Hidden from public',
      price: 9.99,
      quantity: 2,
      status: 'DRAFT',
      source: 'OWNED',
      is_public: false,
      image_url: '',
    }).select().single();
    if (hiddenInsert.error) throw new Error(`hidden product insert failed: ${hiddenInsert.error.message}`);
    const hiddenImagePath = `${sellerUser.data.user.id}/hidden/${randomUUID()}.png`;
    const hiddenUpload = await sellerClient.storage.from('marketplace-product-images').upload(hiddenImagePath, tinyPng, {
      contentType: 'image/png',
      upsert: false,
    });
    if (hiddenUpload.error) throw new Error(`hidden image upload failed: ${hiddenUpload.error.message}`);
    const hiddenImageRow = await sellerClient.from('product_images').insert({
      product_id: hiddenProductId,
      seller_id: sellerUser.data.user.id,
      storage_path: hiddenImagePath,
      image_url: hiddenImagePath,
      is_primary: true,
    }).select().single();
    if (hiddenImageRow.error) throw new Error(`hidden image row failed: ${hiddenImageRow.error.message}`);

    const hiddenPublicRead = await anonClient.from('products').select('*').eq('id', hiddenProductId).maybeSingle();
    const hiddenPublicBlocked = !!hiddenPublicRead.error || !hiddenPublicRead.data;
    log('Unpublished product is not public', hiddenPublicBlocked, hiddenPublicRead.error ? hiddenPublicRead.error.message : 'unexpected data returned');
    const hiddenSigned = await anonClient.storage.from('marketplace-product-images').createSignedUrl(hiddenImagePath, 3600);
    log('Unpublished image is not public', !!hiddenSigned.error, hiddenSigned.error ? hiddenSigned.error.message : 'unexpected success');

    const privateProfiles = await anonClient.from('profiles').select('*').limit(5);
    const privateProfilesBlocked = !privateProfiles.error && Array.isArray(privateProfiles.data) && privateProfiles.data.length === 0;
    log('No private seller/admin data exposed publicly', privateProfilesBlocked, privateProfiles.error ? privateProfiles.error.message : `rows=${privateProfiles.data?.length ?? 0}`);

    const shareUrl = '/products/' + publicProductId;
    const shareLinks = {
      instagram: 'https://www.instagram.com/',
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://example.com${shareUrl}`)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`Check this out: https://example.com${shareUrl}`)}`,
    };
    const shareOk = shareUrl.startsWith('/products/') && !!shareLinks.facebook && !!shareLinks.whatsapp;
    log('Generate Product Link → Share / Post Product flow', shareOk, `shareUrl=${shareUrl}`);

    console.log('REMOTE_MARKETPLACE_STORAGE_VALIDATION_COMPLETE');
  } catch (error) {
    console.log(`BLOCKER ${error?.message || String(error)}`);
    process.exit(1);
  } finally {
    for (const userId of cleanup) {
      try {
        await adminClient.auth.admin.deleteUser(userId);
      } catch {
        // ignore cleanup failure
      }
    }
  }
}

main();

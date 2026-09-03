'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCurrentUserProfileRole, getSession } from '@/lib/auth';
import { getManualPaymentSummary, validateTransferProof } from '@/lib/manual-payment';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type OrderDetailRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  total: number;
  currency: string;
  order_status: string;
  payment_status: string;
  created_at: string;
  products?: { name?: string | null; id?: string | null } | null;
  seller_profiles?: {
    bank_name?: string | null;
    account_holder_name?: string | null;
    account_number?: string | null;
    payment_instructions?: string | null;
    qr_image_url?: string | null;
  } | null;
};

export default function CustomerOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetailRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState('');
  const [transferReference, setTransferReference] = useState('');
  const [transferDate, setTransferDate] = useState('');
  const [submittingProof, setSubmittingProof] = useState(false);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    let active = true;

    async function loadOrder() {
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
        .select('id, buyer_id, seller_id, product_id, quantity, unit_price, subtotal, total, currency, order_status, payment_status, created_at, products(name, id), seller_profiles!orders_seller_id_fkey(bank_name, account_holder_name, account_number, payment_instructions, qr_image_url)')
        .eq('id', params.id)
        .eq('buyer_id', userId)
        .maybeSingle();

      if (!active) return;

      if (fetchError) {
        setError(fetchError.message);
        setOrder(null);
        setLoading(false);
        return;
      }

      if (!data) {
        setOrder(null);
        setError('Order not found.');
        setLoading(false);
        return;
      }

      setOrder(data as OrderDetailRow);
      setLoading(false);
    }

    void loadOrder();

    return () => {
      active = false;
    };
  }, [params.id, router, supabase]);

  if (loading) {
    return <main className="marketplace-shell narrow"><article className="panel"><p className="muted">Loading order…</p></article></main>;
  }

  if (error || !order) {
    return <main className="marketplace-shell narrow"><article className="panel"><p className="error-message">{error ?? 'Order not found.'}</p><Link href="/customer/orders">Back to orders</Link></article></main>;
  }

  async function handleSubmitProof(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateTransferProof({
      proofUrl,
      transferReference,
      transferDate,
    });

    if (!validation.valid) {
      setError(validation.reason ?? 'Unable to submit payment proof.');
      return;
    }

    try {
      setSubmittingProof(true);
      setError(null);

      const { error: updateError } = await supabase.from('orders').update({
        payment_proof_url: proofUrl,
        payment_reference: transferReference,
        payment_transfer_date: new Date(transferDate).toISOString(),
      }).eq('id', order.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setProofUrl('');
      setTransferReference('');
      setTransferDate('');
      window.location.reload();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit proof.');
    } finally {
      setSubmittingProof(false);
    }
  }

  const sellerBankDetails = order.seller_profiles;
  const manualSummary = getManualPaymentSummary({
    orderStatus: order.order_status,
    paymentStatus: order.payment_status,
    hasBankDetails: Boolean(sellerBankDetails?.bank_name || sellerBankDetails?.account_number || sellerBankDetails?.account_holder_name),
    hasQrCode: Boolean(sellerBankDetails?.qr_image_url),
  });

  return (
    <main className="marketplace-shell narrow">
      <article className="panel">
        <p className="eyebrow">ORDER</p>
        <h1>{order.id}</h1>
        <p><strong>Product:</strong> {order.products?.name ?? 'Product'}</p>
        <p><strong>Quantity:</strong> {order.quantity}</p>
        <p><strong>Unit price:</strong> ${Number(order.unit_price).toFixed(2)}</p>
        <p><strong>Subtotal:</strong> ${Number(order.subtotal).toFixed(2)}</p>
        <p><strong>Total:</strong> ${Number(order.total).toFixed(2)}</p>
        <p><strong>Status:</strong> {order.order_status}</p>
        <p><strong>Payment:</strong> {order.payment_status}</p>
        <p><strong>Created:</strong> {new Date(order.created_at).toLocaleString()}</p>

        <div style={{ marginTop: '1.5rem' }}>
          <h2>Manual payment instructions</h2>
          <p>{manualSummary}</p>
          {sellerBankDetails ? (
            <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
              {sellerBankDetails.bank_name ? <p><strong>Bank:</strong> {sellerBankDetails.bank_name}</p> : null}
              {sellerBankDetails.account_holder_name ? <p><strong>Account holder:</strong> {sellerBankDetails.account_holder_name}</p> : null}
              {sellerBankDetails.account_number ? <p><strong>Account number:</strong> {sellerBankDetails.account_number}</p> : null}
              {sellerBankDetails.payment_instructions ? <p><strong>Instructions:</strong> {sellerBankDetails.payment_instructions}</p> : null}
              {sellerBankDetails.qr_image_url ? <img src={sellerBankDetails.qr_image_url} alt="Seller payment QR code" style={{ maxWidth: '240px', borderRadius: '12px', border: '1px solid #ddd' }} /> : null}
            </div>
          ) : (
            <p>No bank transfer details have been published for this seller yet.</p>
          )}
        </div>

        {order.order_status !== 'PAID' && order.payment_status !== 'PAID' ? (
          <form onSubmit={handleSubmitProof} className="auth-form" style={{ marginTop: '1.5rem' }}>
            <h2>Submit transfer proof</h2>
            <label>
              Proof image URL
              <input type="url" value={proofUrl} onChange={(event) => setProofUrl(event.target.value)} required />
            </label>
            <label>
              Transfer reference
              <input value={transferReference} onChange={(event) => setTransferReference(event.target.value)} required />
            </label>
            <label>
              Transfer date
              <input type="datetime-local" value={transferDate} onChange={(event) => setTransferDate(event.target.value)} required />
            </label>
            <button type="submit" disabled={submittingProof}>{submittingProof ? 'Submitting…' : 'Submit proof'}</button>
          </form>
        ) : null}

        <p style={{ marginTop: '1rem' }}><Link href="/customer/orders">Back to orders</Link></p>
      </article>
    </main>
  );
}

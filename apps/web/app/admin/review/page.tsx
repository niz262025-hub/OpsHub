'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type SellerReviewRow = {
  id: string;
  user_id: string;
  full_name: string;
  business_name: string;
  email: string;
  verification_status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  verification_note: string | null;
};

export default function AdminReviewPage() {
  const [sellers, setSellers] = useState<SellerReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [loggingOut, setLoggingOut] = useState(false);

  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    async function ensureAdminAccess() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/admin/login');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role, account_status')
        .eq('id', sessionData.session.user.id)
        .maybeSingle();

      if (profileError || profileData?.role !== 'ADMIN' || profileData?.account_status !== 'ACTIVE') {
        router.push('/admin/login');
        return;
      }

      return true;
    }

    void ensureAdminAccess();
  }, [router, supabase]);

  useEffect(() => {
    async function loadSellers() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('seller_profiles')
        .select('*')
        .in('verification_status', ['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'])
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      setSellers((data ?? []) as SellerReviewRow[]);
      setLoading(false);
    }

    void loadSellers();
  }, [supabase]);

  async function updateVerification(userId: string, status: SellerReviewRow['verification_status'], note: string) {
    const { error: updateError } = await supabase
      .from('seller_profiles')
      .update({
        verification_status: status,
        verification_note: note || null,
      })
      .eq('user_id', userId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSellers((current) =>
      current.map((seller) =>
        seller.user_id === userId
          ? { ...seller, verification_status: status, verification_note: note || null }
          : seller,
      ),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>, userId: string) {
    event.preventDefault();
    const action = event.currentTarget.dataset.action as 'APPROVE' | 'REJECT' | 'SUSPEND';
    const note = noteDrafts[userId] ?? '';

    if (action === 'APPROVE') {
      await updateVerification(userId, 'VERIFIED', note);
    }

    if (action === 'REJECT') {
      await updateVerification(userId, 'REJECTED', note);
    }

    if (action === 'SUSPEND') {
      await updateVerification(userId, 'SUSPENDED', note);
    }
  }

  async function handleSignOut() {
    setLoggingOut(true);
    const { error: signOutError } = await signOut();
    if (signOutError) {
      setError(signOutError.message);
      setLoggingOut(false);
      return;
    }

    router.push('/admin/login');
    router.refresh();
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">ADMIN / SELLER REVIEW</p>
          <h1>Seller applications</h1>
        </div>
        <button type="button" className="secondary-button" onClick={handleSignOut} disabled={loggingOut}>
          {loggingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </header>

      {error ? <p className="error-message">{error}</p> : null}

      <section className="admin-list">
        {loading ? (
          <p className="muted">Loading applications…</p>
        ) : sellers.length === 0 ? (
          <p className="muted">No sellers pending review.</p>
        ) : (
          sellers.map((seller) => (
            <article key={seller.id} className="review-card">
              <div>
                <h2>{seller.full_name}</h2>
                <p>{seller.business_name}</p>
                <p>{seller.email}</p>
              </div>
              <div className="status-badge">{seller.verification_status}</div>
              <form className="review-forms" onSubmit={(event) => handleSubmit(event, seller.user_id)}>
                <textarea
                  value={noteDrafts[seller.user_id] ?? seller.verification_note ?? ''}
                  onChange={(event) => setNoteDrafts((current) => ({ ...current, [seller.user_id]: event.target.value }))}
                  rows={3}
                  placeholder="Add verification note"
                />
                <div className="review-actions">
                  <button type="submit" data-action="APPROVE">Approve</button>
                  <button type="submit" data-action="REJECT" className="secondary-button">Reject</button>
                  <button type="submit" data-action="SUSPEND" className="secondary-button">Suspend</button>
                </div>
              </form>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getCurrentUserProfileRole, getSession } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let active = true;

    async function redirectSignedInUser() {
      try {
        const { data: sessionData, error: sessionError } = await getSession();

        if (!active) {
          return;
        }

        if (sessionError || !sessionData.session) {
          setCheckingAuth(false);
          return;
        }

        const profile = await getCurrentUserProfileRole();
        if (!active) {
          return;
        }

        if (profile.error || !profile.role) {
          setCheckingAuth(false);
          return;
        }

        if (profile.role === 'ADMIN' && profile.accountStatus === 'ACTIVE') {
          router.replace('/admin/review');
          return;
        }

        if (profile.role === 'CUSTOMER') {
          router.replace('/customer/orders');
          return;
        }

        if (profile.role === 'SELLER') {
          if (profile.accountStatus === 'SUSPENDED') {
            router.replace('/account/suspended');
            return;
          }

          if (profile.verificationStatus === 'VERIFIED') {
            router.replace('/marketplace');
            return;
          }

          if (profile.verificationStatus === 'REJECTED') {
            router.replace('/verification/rejected');
            return;
          }

          router.replace('/verification/pending');
          return;
        }

        setCheckingAuth(false);
      } catch {
        if (active) {
          setCheckingAuth(false);
        }
      }
    }

    void redirectSignedInUser();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="shell">
      <p className="eyebrow">OPSHUB / PHASE 0</p>
      <h1>Private trade, built on trust.</h1>
      <p className="intro">
        The OpsHub foundation is ready for the verified seller and reseller marketplace.
      </p>

      {checkingAuth ? (
        <div className="status" role="status">
          <span className="status-dot" aria-hidden="true" />
          Checking your session…
        </div>
      ) : (
        <div className="auth-actions" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
          <Link href="/auth/login" className="primary-link" style={{ display: 'inline-block', padding: '0.75rem 1.1rem', borderRadius: '0.75rem', background: '#111827', color: '#fff', textDecoration: 'none' }}>
            Log in
          </Link>
          <Link href="/auth/register" className="secondary-link" style={{ display: 'inline-block', padding: '0.75rem 1.1rem', borderRadius: '0.75rem', border: '1px solid #d1d5db', color: '#111827', textDecoration: 'none' }}>
            Become a seller
          </Link>
        </div>
      )}

      <div className="status" role="status" style={{ marginTop: '1.5rem' }}>
        <span className="status-dot" aria-hidden="true" />
        Foundation online
      </div>
    </main>
  );
}

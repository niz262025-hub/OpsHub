'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { getCurrentUserProfileRole, signInWithEmail, signOut } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await signInWithEmail(email, password);

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const profile = await getCurrentUserProfileRole();

    if (profile.error || !profile.role) {
      await signOut();
      setError('Your account could not be verified. Please sign in again.');
      setLoading(false);
      return;
    }

    if (profile.role === 'ADMIN') {
      if (profile.accountStatus === 'ACTIVE') {
        router.push('/admin/review');
      } else {
        await signOut();
        setError('Active admin access is required.');
        setLoading(false);
        return;
      }
    } else if (profile.role === 'CUSTOMER') {
      router.push('/customer/orders');
    } else if (profile.accountStatus === 'SUSPENDED') {
      router.push('/account/suspended');
    } else if (profile.verificationStatus === 'VERIFIED') {
      router.push('/marketplace');
    } else if (profile.verificationStatus === 'REJECTED') {
      router.push('/verification/rejected');
    } else {
      router.push('/verification/pending');
    }

    router.refresh();
    setLoading(false);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">OPSHUB AUTH</p>
        <h1>Seller login</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="your@email.com" required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" required />
          </label>
          {error ? <p className="error-message">{error}</p> : null}
          <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Log in'}</button>
        </form>
        <p className="muted">
          Need an account? <Link href="/auth/register">Register as a seller</Link>
        </p>
        <p className="muted small">
          Admin access is managed separately and never assigned from the public app.
        </p>
      </section>
    </main>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { getCurrentUserProfileRole, signInWithEmail, signOut } from '@/lib/auth';

export default function CustomerLoginPage() {
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

    if (profile.role !== 'CUSTOMER') {
      await signOut();
      setError('This sign-in is for customers only.');
      setLoading(false);
      return;
    }

    router.push('/customer/orders');
    router.refresh();
    setLoading(false);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">CUSTOMER AUTH</p>
        <h1>Customer login</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" required />
          </label>
          {error ? <p className="error-message">{error}</p> : null}
          <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Log in'}</button>
        </form>
        <p className="muted">
          Need an account? <Link href="/auth/customer/register">Register as a customer</Link>
        </p>
      </section>
    </main>
  );
}

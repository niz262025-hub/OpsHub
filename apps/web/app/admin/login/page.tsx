'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { signInWithEmail } from '@/lib/auth';

export default function AdminLoginPage() {
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

    router.push('/admin/review');
    router.refresh();
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">ADMIN ACCESS</p>
        <h1>OpsHub admin</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Admin email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@your-domain.com" required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter admin password" required />
          </label>
          {error ? <p className="error-message">{error}</p> : null}
          <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in as admin'}</button>
        </form>
        <p className="muted">
          Public role assignment is not available. Admin access is restricted to controlled accounts.
        </p>
        <Link href="/auth/login" className="secondary-link">Seller login</Link>
      </section>
    </main>
  );
}

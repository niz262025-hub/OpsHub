'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { signUpCustomer } from '@/lib/auth';

export default function CustomerRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    preferredName: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signUpError } = await signUpCustomer({
      fullName: form.fullName,
      email: form.email,
      password: form.password,
      phone: form.phone || null,
      preferredName: form.preferredName || null,
    });

    if (signUpError) {
      setError(signUpError.message);
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
        <p className="eyebrow">CUSTOMER REGISTRATION</p>
        <h1>Create your buyer account</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Full name
            <input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Jane Customer" required />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" required />
          </label>
          <label>
            Password
            <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Create password" required />
          </label>
          <label>
            Phone (optional)
            <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+1 555 010 0000" />
          </label>
          <label>
            Preferred name (optional)
            <input value={form.preferredName} onChange={(event) => setForm({ ...form, preferredName: event.target.value })} placeholder="Jane" />
          </label>
          {error ? <p className="error-message">{error}</p> : null}
          <button type="submit" disabled={loading}>{loading ? 'Creating account...' : 'Create account'}</button>
        </form>
        <p className="muted">
          Already have an account? <Link href="/auth/customer/login">Log in</Link>
        </p>
      </section>
    </main>
  );
}

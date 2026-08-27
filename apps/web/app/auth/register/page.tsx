'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { signUpSeller } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    businessName: '',
    businessRegistrationNumber: '',
    businessAddress: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null); 

    const { error: signUpError } = await signUpSeller({
      fullName: form.fullName,
      email: form.email,
      password: form.password,
      phone: form.phone,
      businessName: form.businessName,
      businessRegistrationNumber: form.businessRegistrationNumber || null,
      businessAddress: form.businessAddress,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    router.push('/verification/pending');
    router.refresh();
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">SELLER REGISTRATION</p>
        <h1>Request access</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="two-col">
            <label>
              Full name
              <input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Jane Seller" required />
            </label>
            <label>
              Email
              <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@business.com" required />
            </label>
          </div>
          <div className="two-col">
            <label>
              Password
              <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Create password" required />
            </label>
            <label>
              Phone
              <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+1 555 010 0000" required />
            </label>
          </div>
          <label>
            Business name
            <input value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} placeholder="Your business name" required />
          </label>
          <label>
            Business registration number
            <input value={form.businessRegistrationNumber} onChange={(event) => setForm({ ...form, businessRegistrationNumber: event.target.value })} placeholder="Optional registration number" />
          </label>
          <label>
            Business address
            <textarea value={form.businessAddress} onChange={(event) => setForm({ ...form, businessAddress: event.target.value })} rows={4} placeholder="Street, city, state, country" required />
          </label>
          {error ? <p className="error-message">{error}</p> : null}
          <button type="submit" disabled={loading}>{loading ? 'Submitting...' : 'Submit for verification'}</button>
        </form>
        <p className="muted">
          Already registered? <Link href="/auth/login">Log in</Link>
        </p>
      </section>
    </main>
  );
}

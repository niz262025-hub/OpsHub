import Link from 'next/link';

export default function AuthIndexPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">OPSHUB AUTH</p>
        <h1>Choose your sign-in</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
          <Link href="/auth/customer/login" className="primary-link">Customer login</Link>
          <Link href="/auth/login" className="secondary-link">Seller login</Link>
        </div>
      </section>
    </main>
  );
}

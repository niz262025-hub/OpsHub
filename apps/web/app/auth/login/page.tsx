import Link from 'next/link';

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">OPSHUB AUTH</p>
        <h1>Seller login</h1>
        <form className="auth-form">
          <label>
            Email
            <input type="email" defaultValue="seller@opshub.local" />
          </label>
          <label>
            Password
            <input type="password" defaultValue="password" />
          </label>
          <button type="submit">Log in</button>
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

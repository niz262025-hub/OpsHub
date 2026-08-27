import Link from 'next/link';

export default function AdminLoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">ADMIN ACCESS</p>
        <h1>OpsHub admin</h1>
        <form className="auth-form">
          <label>
            Admin email
            <input type="email" defaultValue="admin@opshub.local" />
          </label>
          <label>
            Password
            <input type="password" defaultValue="admin-password" />
          </label>
          <button type="submit">Sign in as admin</button>
        </form>
        <p className="muted">
          Public role assignment is not available. Admin access is restricted to controlled accounts.
        </p>
        <Link href="/auth/login" className="secondary-link">Seller login</Link>
      </section>
    </main>
  );
}

import Link from 'next/link';

export default function AccountSuspendedPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card narrow">
        <p className="eyebrow">ACCOUNT STATUS</p>
        <h1>Account suspended</h1>
        <p className="intro">
          This account is currently suspended. Contact OpsHub support for resolution.
        </p>
        <Link href="/auth/login" className="secondary-link">Back to login</Link>
      </section>
    </main>
  );
}

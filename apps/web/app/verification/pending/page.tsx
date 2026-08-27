import Link from 'next/link';

export default function VerificationPendingPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card narrow">
        <p className="eyebrow">VERIFICATION</p>
        <h1>Pending review</h1>
        <p className="intro">
          Your seller application is under review. You can sign in to view your status, but the Hub remains restricted until your account is approved.
        </p>
        <Link href="/auth/login" className="secondary-link">Back to login</Link>
      </section>
    </main>
  );
}

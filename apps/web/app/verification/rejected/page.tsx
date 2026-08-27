import Link from 'next/link';

export default function VerificationRejectedPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card narrow">
        <p className="eyebrow">VERIFICATION</p>
        <h1>Application rejected</h1>
        <p className="intro">
          Your seller application was not approved. Please contact the OpsHub admin team for further review.
        </p>
        <Link href="/auth/login" className="secondary-link">Back to login</Link>
      </section>
    </main>
  );
}

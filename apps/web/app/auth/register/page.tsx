import Link from 'next/link';

export default function RegisterPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">SELLER REGISTRATION</p>
        <h1>Request access</h1>
        <form className="auth-form">
          <div className="two-col">
            <label>
              Full name
              <input defaultValue="Ada Stone" />
            </label>
            <label>
              Email
              <input type="email" defaultValue="ada@stone.example" />
            </label>
          </div>
          <div className="two-col">
            <label>
              Phone
              <input defaultValue="+1 555 010 2048" />
            </label>
            <label>
              Business name
              <input defaultValue="Stone Labs" />
            </label>
          </div>
          <label>
            Business registration number
            <input defaultValue="REG-42" />
          </label>
          <label>
            Business address
            <textarea defaultValue="1 Market Street, New York, NY" rows={4} />
          </label>
          <button type="submit">Submit for verification</button>
        </form>
        <p className="muted">
          Already registered? <Link href="/auth/login">Log in</Link>
        </p>
      </section>
    </main>
  );
}

import type { Metadata } from 'next';
import './globals.css';
import { resolveSupabasePublicKey, resolveSupabaseUrl } from '../lib/supabase-env';

// App routes depend on runtime identity/configuration, never build-time credentials.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'OpsHub',
  description: 'The independent marketplace for verified sellers, resellers and their customers.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let configured = true;
  try {
    resolveSupabaseUrl();
    resolveSupabasePublicKey();
  } catch {
    configured = false;
  }
  return (
    <html lang="en">
      <body>{configured ? children : (
        <main style={{ maxWidth: 600, margin: '4rem auto', padding: 24 }}>
          <h1>OpsHub is temporarily unavailable</h1>
          <p>The service is being configured. Please try again later.</p>
        </main>
      )}</body>
    </html>
  );
}

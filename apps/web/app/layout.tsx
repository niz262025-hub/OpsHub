import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OpsHub',
  description: 'A foundation for the OpsHub marketplace and community.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

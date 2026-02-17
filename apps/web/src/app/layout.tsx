import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

export const dynamic = 'force-dynamic';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Mirror Markets - Polymarket Copy Trading',
  description: 'Follow top Polymarket traders and automatically copy their trades.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-[--bg-page] text-[--text-primary] antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

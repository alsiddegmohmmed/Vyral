import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './site.css';
import './motion.css';

// next/font preloads these files and sizes a matching fallback, so the swap to the brand fonts doesn't flash or shift.
const syne = localFont({
  src: '../public/fonts/syne.woff2',
  weight: '400 800',
  variable: '--font-syne',
  display: 'swap',
});

const schibsted = localFont({
  src: '../public/fonts/schibsted-grotesk.woff2',
  weight: '400 900',
  variable: '--font-schibsted',
  display: 'swap',
});

const dmMono = localFont({
  src: '../public/fonts/dm-mono.woff2',
  weight: '500',
  variable: '--font-dm-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Vyral Labs — Branding & Digital Growth in Kigali',
  description: 'Brand identity, campaigns and digital growth for ambitious businesses in Kigali. Take the free five-question growth check.',
};

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en" className={`${syne.variable} ${schibsted.variable} ${dmMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

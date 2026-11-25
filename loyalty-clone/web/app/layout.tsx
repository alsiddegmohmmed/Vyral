import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

// Garuka kit: one variable family (optical size + width axes) and a mono for labels.
const sans = Bricolage_Grotesque({ subsets: ['latin', 'latin-ext'], axes: ['opsz', 'wdth'], variable: '--nf-sans', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--nf-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Garuka', template: '%s · Garuka' },
  description: 'Garuka: stamp cards that bring customers back. Apple Wallet, Google Wallet or any phone’s browser.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#fbf9ff' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

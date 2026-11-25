import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--nf-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--nf-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Garuka', template: '%s · Garuka' },
  description: 'Garuka: stamp cards that bring customers back. Apple Wallet, Google Wallet or any phone’s browser.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

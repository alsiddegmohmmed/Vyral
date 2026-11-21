import type { Metadata } from 'next';
import './site.css';
import './motion.css';

export const metadata: Metadata = {
  title: 'Vyral Labs — Branding & Digital Growth in Kigali',
  description: 'Brand identity, campaigns and digital growth for ambitious businesses in Kigali. Take the free five-question growth check.',
};

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}

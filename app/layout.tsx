import type { Metadata, Viewport } from 'next';
import './site.css';
import './motion.css';

export const metadata: Metadata = {
  title: 'Vyral Labs — Branding & Digital Growth in Kigali',
  description: 'Vyral Labs is a Kigali branding and digital growth agency for brand launches, social content, advertising, search, websites and customer journeys.',
};

export const viewport: Viewport = {
  themeColor: '#15101a',
};

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}

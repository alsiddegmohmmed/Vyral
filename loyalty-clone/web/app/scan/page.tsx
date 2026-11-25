import type { Metadata, Viewport } from 'next';
import { ScannerApp } from './scanner-app';

export const metadata: Metadata = { title: 'Scanner', robots: { index: false }, manifest: '/scan.webmanifest' };
export const viewport: Viewport = { themeColor: '#0f1216' };

/** WhatsApp support link from SUPPORT_WHATSAPP (a number in international format, or a full https link). */
function supportUrl(): string | null {
  const v = process.env.SUPPORT_WHATSAPP?.trim();
  if (!v) return null;
  if (/^https:\/\//.test(v)) return v;
  const digits = v.replace(/\D/g, '');
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

export default function ScanPage() { return <ScannerApp supportUrl={supportUrl()} />; }

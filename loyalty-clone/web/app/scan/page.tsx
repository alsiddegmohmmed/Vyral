import type { Metadata, Viewport } from 'next';
import { ScannerApp } from './scanner-app';

export const metadata: Metadata = { title: 'Scanner', robots: { index: false }, manifest: '/scan.webmanifest' };
export const viewport: Viewport = { themeColor: '#0f1216' };

export default function ScanPage() { return <ScannerApp />; }

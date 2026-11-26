import Link from 'next/link';
import { X } from 'lucide-react';
import { GarukaLockup } from '@/components/brand/garuka-mark';
import { requireOwner } from '@/lib/session';

// Focused full-screen frame for the new-card wizard: no sidebar, one task.
// Layout mirrors the structure studied in reference-stampmate.md; colours, type
// and mark are Garuka's (Night ground with a Jacaranda glow).
export default async function WizardLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    <div className="min-h-dvh bg-[var(--tk-color-night)] bg-[radial-gradient(60%_50%_at_75%_0%,rgba(106,59,224,.45),transparent_70%),radial-gradient(40%_40%_at_10%_100%,rgba(255,178,63,.10),transparent_70%)] text-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-[var(--tk-color-night)]">Skip to content</a>
      <header className="mx-auto flex h-20 max-w-[1296px] items-center justify-between px-4 sm:px-8">
        <Link href="/cards" aria-label="Garuka, your cards" className="text-[26px]"><GarukaLockup ring="#ffffff" word="#ffffff" /></Link>
        <Link href="/cards" className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-white/10 px-4 text-sm font-semibold hover:bg-white/20">
          <X aria-hidden className="size-4" />Close<span className="sr-only"> and go back to all cards</span>
        </Link>
      </header>
      <main id="main" className="mx-auto max-w-[1296px] px-3 pb-12 sm:px-8 sm:pb-16">{children}</main>
    </div>
  );
}

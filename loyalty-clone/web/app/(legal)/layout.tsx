import Link from 'next/link';
import { GarukaLockup } from '@/components/brand/garuka-mark';
import { LEGAL } from '@/lib/legal';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-[760px] items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Garuka home" className="text-[24px] text-accent"><GarukaLockup word="var(--tk-color-text)" /></Link>
          <nav aria-label="Legal" className="flex gap-4 text-sm"><Link href="/privacy" className="hover:underline">Privacy</Link><Link href="/terms" className="hover:underline">Terms</Link></nav>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[760px] px-4 py-10 sm:px-6 sm:py-14">
        {!LEGAL.reviewed && (
          <p role="note" className="mb-8 rounded-md border border-warning/30 bg-warning-bg p-4 text-sm text-text">
            <strong>Draft for legal review.</strong> This page is not yet in force. Names in [brackets] are placeholders.
          </p>
        )}
        <article className="flex flex-col gap-4 text-base leading-7 [&_h1]:text-3xl [&_h2]:mt-6 [&_h2]:text-xl [&_h3]:mt-2 [&_h3]:text-base [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_a]:font-semibold [&_a]:text-accent [&_a]:underline">
          {children}
        </article>
      </main>
    </div>
  );
}

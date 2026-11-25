import Link from 'next/link';
import { Banner } from '@/components/ui/feedback';
import { buttonClass } from '@/components/ui/button';
import { DataError, verifyEmail } from '@/lib/data/api';

export const metadata = { title: 'Confirm your email', robots: { index: false } };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  let ok = false, msg = 'This link is incomplete.';
  if (token) { try { await verifyEmail(token); ok = true; } catch (e) { msg = e instanceof DataError ? e.message : 'Something went wrong.'; } }
  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4">
      <div className="flex w-full max-w-[420px] flex-col gap-4 rounded-xl border border-border bg-surface-raised p-6 shadow-card">
        <Banner tone={ok ? 'success' : 'danger'} title={ok ? 'Email confirmed' : msg} />
        <Link href="/cards" className={buttonClass('primary')}>Go to your cards</Link>
      </div>
    </main>
  );
}

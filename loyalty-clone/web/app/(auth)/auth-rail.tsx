'use client';
import { usePathname } from 'next/navigation';
import { QrCode, ScanLine, Wallet } from 'lucide-react';
import { SETUP_STEPS, StepRail } from '@/components/loyalty/setup-steps';

const benefits = [
  { icon: QrCode, title: 'Customers join in seconds', body: 'They scan your QR code and get the card. No app to install.' },
  { icon: Wallet, title: 'Lives in their phone wallet', body: 'Apple Wallet, Google Wallet, or a web card that works anywhere.' },
  { icon: ScanLine, title: 'Stamp from any phone', body: 'Pair the phone at your counter and give a stamp in one scan.' },
];

/** Left rail on wide screens: the setup steps while signing up, a short pitch everywhere else. */
export function AuthRail() {
  const path = usePathname();
  if (path.startsWith('/signup')) {
    return (
      <div>
        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Setup checklist</p>
        <div className="mt-3"><StepRail current={0} /></div>
        <p className="mt-6 px-3 text-xs text-text-muted">The rest happens in your dashboard. You can stop and come back at any step.</p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-5 px-3">
      {benefits.map(({ icon: Icon, title, body }) => (
        <li key={title} className="flex gap-3">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-sm bg-nav-active text-text"><Icon className="size-[18px]" /></span>
          <span>
            <span className="block text-sm font-semibold">{title}</span>
            <span className="mt-0.5 block text-sm text-text-muted">{body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Phone-width stand-in for the rail: a thin progress bar with the step name. */
export function AuthProgress() {
  const path = usePathname();
  if (!path.startsWith('/signup')) return null;
  const total = SETUP_STEPS.length;
  return (
    <div className="mb-6 lg:hidden">
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span className="font-semibold uppercase tracking-wider">Setup checklist</span>
        <span className="tabular">1 of {total}</span>
      </div>
      <div aria-hidden className="mt-2 flex gap-1">
        {SETUP_STEPS.map((s, i) => <span key={s.key} className={i === 0 ? 'h-1 flex-1 rounded-pill bg-accent' : 'h-1 flex-1 rounded-pill bg-border'} />)}
      </div>
    </div>
  );
}

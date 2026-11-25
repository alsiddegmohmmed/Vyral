import { Gift, Smartphone } from 'lucide-react';
import { StampStrip } from './stamp-strip';
import type { CardDesign } from './pass-preview';

export function WebCard({ d, firstName, rewards, manualCode, message }: {
  d: CardDesign; firstName: string; rewards: number; manualCode: string; message?: string;
}) {
  const toGo = d.total - d.filled;
  return (
    <article aria-label={`${d.business} stamp card`} className="mx-auto w-full max-w-[380px] overflow-hidden rounded-xl border border-border bg-bg shadow-pop">
      <header className="px-5 pb-5 pt-6" style={{ background: d.background, color: d.foreground }}>
        <p className="text-sm font-semibold" style={{ color: d.label }}>{d.business}</p>
        <h3 className="mt-1 text-2xl">Hi {firstName}</h3>
        <StampStrip total={d.total} filled={d.filled} icon={d.icon} stamp={d.stamp} empty={`${d.foreground}55`} background={d.background} className="mt-4 w-full" />
        <p className="mt-3 text-sm">
          {rewards > 0 ? 'Your reward is ready. Show this card at the counter.' : `${toGo} more ${toGo === 1 ? 'stamp' : 'stamps'} to ${d.reward.toLowerCase()}.`}
        </p>
      </header>
      {rewards > 0 && (
        <div className="flex items-center gap-2 bg-success-bg px-5 py-3 text-sm font-semibold text-success">
          <Gift aria-hidden className="size-4" /> {rewards} × {d.reward}
        </div>
      )}
      <div className="flex flex-col items-center gap-2 px-5 py-6">
        <div aria-label="Your card code for staff to scan" role="img" className="size-44 rounded-md bg-white bg-[repeating-conic-gradient(#111_0_25%,#fff_0_50%)] bg-[length:14px_14px] p-3 [background-clip:content-box] ring-1 ring-border" />
        <p className="text-xs text-text-muted">Can’t scan? Staff can type <span className="font-mono font-semibold text-text">{manualCode}</span></p>
      </div>
      {message && (
        <div className="border-t border-border px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Latest from {d.business}</p>
          <p className="mt-1 text-sm">{message}</p>
        </div>
      )}
      <div className="flex flex-col gap-2 border-t border-border bg-surface px-5 py-4">
        <p className="flex items-center gap-1.5 text-xs text-text-muted"><Smartphone aria-hidden className="size-3.5" /> Keep it on your phone</p>
        <div className="grid grid-cols-2 gap-2">
          <span className="grid h-11 place-items-center rounded-md bg-black text-xs font-semibold text-white">Apple Wallet badge</span>
          <span className="grid h-11 place-items-center rounded-md bg-black text-xs font-semibold text-white">Google Wallet badge</span>
        </div>
        <p className="text-[11px] text-text-subtle">Placeholders: the official Apple and Google badges go here, unmodified.</p>
      </div>
    </article>
  );
}

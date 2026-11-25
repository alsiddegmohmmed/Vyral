'use client';
import { useState } from 'react';
import { CheckCircle2, Flashlight, Keyboard, X, XCircle, Gift } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Stepper } from '@/components/ui/controls';
import { StampStrip } from './stamp-strip';
import { cn } from '@/lib/cn';

/** S28: camera view (static stand-in on the design page: no camera access). */
export function ScannerFrame() {
  return (
    <div data-scanner className="relative flex aspect-[9/16] w-full max-w-[300px] flex-col overflow-hidden rounded-xl bg-scanner-bg text-scanner-text">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#3a4350,transparent_70%)]" />
      <div className="relative flex justify-between p-3">
        <IconButton aria-label="Close scanner" size="lg" variant="ghost" className="text-scanner-text hover:bg-scanner-surface" icon={<X aria-hidden className="size-6" />} />
        <IconButton aria-label="Turn on torch" size="lg" variant="ghost" className="text-scanner-text hover:bg-scanner-surface" icon={<Flashlight aria-hidden className="size-6" />} />
      </div>
      <div className="relative mx-auto mt-10 size-48">
        {['left-0 top-0 border-l-4 border-t-4 rounded-tl-lg', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-lg', 'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-lg', 'right-0 bottom-0 border-r-4 border-b-4 rounded-br-lg'].map((c) => (
          <span key={c} aria-hidden className={cn('absolute size-10 border-scanner-text', c)} />
        ))}
      </div>
      <p className="relative mt-6 text-center text-sm text-scanner-muted" role="status">Point the camera at the customer’s card</p>
      <div className="relative mt-auto p-4">
        <Button size="lg" variant="ghost" block className="bg-scanner-surface text-scanner-text hover:bg-scanner-surface/80">
          <Keyboard aria-hidden className="size-5" /> Type the code instead
        </Button>
      </div>
    </div>
  );
}

/** S29: what staff see after a scan. */
export function TransactionPanel() {
  const total = 10, current = 8;
  const [add, setAdd] = useState(1);
  const [redeem, setRedeem] = useState(false);
  const after = current + add;
  const earns = after >= total;
  return (
    <div className="flex w-full max-w-[340px] flex-col gap-4 rounded-xl bg-scanner-bg p-5 text-scanner-text">
      <div>
        <p className="text-sm text-scanner-muted">Coffee card</p>
        <p className="text-2xl font-bold">Aline</p>
        <p className="text-xs text-scanner-muted tabular">Lifetime 23 stamps · Last visit 3 days ago</p>
      </div>
      <StampStrip total={total} filled={current} stamp="#f4f5f7" empty="#5b6470" background="#1c2128" className="w-full rounded-lg" />
      <div className="flex flex-col items-center gap-2 rounded-lg bg-scanner-surface p-4">
        <p className="text-sm text-scanner-muted">Stamps to add</p>
        <Stepper label="Stamps to add" value={add} onChange={setAdd} min={0} max={5} size="scanner" />
      </div>
      <button
        type="button"
        aria-pressed={redeem}
        onClick={() => setRedeem(!redeem)}
        className={cn('flex min-h-16 items-center gap-3 rounded-lg border-2 px-4 text-left', redeem ? 'border-scanner-success bg-scanner-surface' : 'border-scanner-surface')}
      >
        <Gift aria-hidden className="size-6 shrink-0" />
        <span className="flex-1"><span className="block font-semibold">Give 1 free coffee</span><span className="text-xs text-scanner-muted">1 reward ready</span></span>
        <span className={cn('size-6 rounded-pill border-2', redeem ? 'border-scanner-success bg-scanner-success' : 'border-scanner-muted')} aria-hidden />
      </button>
      <Button size="scanner" block disabled={add === 0 && !redeem} className="bg-scanner-text text-scanner-bg hover:bg-white">
        {add > 0 ? `Add ${add} ${add === 1 ? 'stamp' : 'stamps'}` : 'Give reward'}
        {redeem && add > 0 ? ' + reward' : ''}
      </Button>
      <p className="text-center text-xs text-scanner-muted" aria-live="polite">
        {earns ? `This completes the card: 1 free coffee earned, ${after % total} left over.` : `${total - after} more after this.`}
      </p>
    </div>
  );
}

/** S30: result screen. */
export function ScanResult({ ok }: { ok: boolean }) {
  return (
    <div role="alert" className="flex aspect-[9/12] w-full max-w-[260px] flex-col items-center justify-center gap-3 rounded-xl bg-scanner-surface p-6 text-center text-scanner-text">
      {ok ? <CheckCircle2 aria-hidden className="size-16 text-scanner-success" /> : <XCircle aria-hidden className="size-16 text-scanner-danger" />}
      <p className="text-xl font-bold">{ok ? '2 stamps added' : 'This card was replaced'}</p>
      <p className="text-sm text-scanner-muted">{ok ? 'Aline has 9 of 10. One more for a free coffee.' : 'Ask the customer to open their latest card and scan again.'}</p>
      <p className="mt-2 text-xs text-scanner-muted">Back to the camera in 3 s</p>
    </div>
  );
}

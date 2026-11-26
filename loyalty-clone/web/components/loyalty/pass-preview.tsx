'use client';
import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { SegmentedControl } from '@/components/ui/controls';
import { Button } from '@/components/ui/button';
import { StampStrip } from './stamp-strip';
import { useStampLoop } from './use-stamp-loop';

export type CardDesign = {
  business: string; programName: string; reward: string; total: number; filled: number; icon: string;
  background: string; foreground: string; label: string; stamp: string; logoText: string; logoUrl?: string; stampUrl?: string;
};

const QRStub = () => (
  <div aria-hidden className="relative mx-auto grid size-28 place-items-center rounded-md bg-white">
    <div className="size-24 bg-[repeating-conic-gradient(#111_0_25%,#fff_0_50%)] bg-[length:12px_12px] opacity-80 blur-[1.5px]" />
    <span className="absolute rounded-sm bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">Preview</span>
  </div>
);

/** While the preview fills itself, the stamp grid keeps one steady name instead of a new count every second. */
const strip = (d: CardDesign, anim: boolean) => ({
  total: d.total, filled: d.filled, icon: d.icon, image: d.stampUrl, stamp: d.stamp, empty: `${d.foreground}55`, background: d.background,
  landing: anim, label: anim ? `Preview: the card filling up to ${d.total} stamps` : undefined,
});
const full = (d: CardDesign) => d.filled >= d.total;

/** `fit`: size to the content instead of the pass ratio (inside the phone mockup, so the QR never clips). */
function AppleFront({ d, anim = false, fit = false }: { d: CardDesign; anim?: boolean; fit?: boolean }) {
  return (
    <div className={fit ? 'flex w-full flex-col overflow-hidden rounded-xl shadow-pass' : 'flex aspect-[1/1.4] w-full flex-col overflow-hidden rounded-xl shadow-pass'} style={{ background: d.background, color: d.foreground }}>
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="flex min-w-0 items-center gap-2 font-bold">{d.logoUrl && <img src={d.logoUrl} alt="" className="h-8 max-w-[110px] object-contain" />}{d.logoText}</span>
        <span className="text-right">
          <span className="block text-[10px] font-semibold uppercase tracking-wide" style={{ color: d.label }}>Stamps</span>
          <span className="tabular text-lg font-semibold">{d.filled}/{d.total}</span>
        </span>
      </div>
      <div className="mt-3 px-4" style={{ background: 'rgba(0,0,0,.12)' }}>
        <StampStrip {...strip(d, anim)} className="w-full py-3" />
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pt-3 text-sm">
        <div><p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: d.label }}>Reward</p><p className="font-medium">{d.reward}</p></div>
        <div className="text-right"><p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: d.label }}>To go</p><p className="tabular font-medium">{full(d) ? 'Ready' : d.total - d.filled}</p></div>
      </div>
      <div className={fit ? 'pb-5 pt-4' : 'mt-auto pb-5'}><QRStub /></div>
    </div>
  );
}

function AppleBack({ d }: { d: CardDesign }) {
  const rows: [string, string][] = [
    ['Latest news', 'Double stamps every Friday this month.'],
    ['How to earn', 'One stamp for every drink you buy.'],
    ['Your reward', `${d.reward} after ${d.total} stamps.`],
    ['Find us', 'KG 7 Ave, Kigali'],
    ['Terms', 'One stamp per visit. Rewards can’t be exchanged for cash.'],
  ];
  return (
    <div className="aspect-[1/1.4] w-full overflow-auto rounded-xl bg-[#f2f2f7] p-4 text-[#1c1c1e] shadow-pass">
      <p className="mb-3 text-center text-sm font-semibold">{d.business}</p>
      <dl className="divide-y divide-black/10 rounded-lg bg-white">
        {rows.map(([k, v]) => (
          <div key={k} className="px-3 py-2.5">
            <dt className="text-xs text-black/60">{k}</dt>
            <dd className="text-sm">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function GoogleCard({ d, anim = false }: { d: CardDesign; anim?: boolean }) {
  return (
    <div className="flex aspect-[1/1.4] w-full flex-col overflow-hidden rounded-2xl shadow-pass" style={{ background: d.background, color: d.foreground }}>
      <div className="flex items-center gap-2 px-4 pt-4">
        <span className="grid size-8 place-items-center rounded-pill bg-white/90 text-xs font-bold text-black">{d.logoText.slice(0, 1)}</span>
        <span className="text-sm font-medium">{d.business}</span>
      </div>
      <p className="px-4 pt-3 text-xl font-semibold">{d.programName}</p>
      <div className="px-4 pt-2">
        <p className="text-xs opacity-80">Stamps</p>
        <p className="tabular text-2xl font-semibold">{d.filled}/{d.total}{full(d) && <span className="ml-2 text-sm font-medium">· {d.reward} ready</span>}</p>
      </div>
      <StampStrip {...strip(d, anim)} className="mx-4 mt-3" />
      <div className="mt-auto pb-5"><QRStub /></div>
    </div>
  );
}

/** Pause / play for the self-filling preview (moving content must be pausable, WCAG 2.2.2). */
function PlayToggle({ playing, onChange, className }: { playing: boolean; onChange: (p: boolean) => void; className?: string }) {
  return (
    <Button variant="secondary" size="sm" className={className} onClick={() => onChange(!playing)}>
      {playing ? <Pause aria-hidden className="size-3.5" /> : <Play aria-hidden className="size-3.5" />}
      {playing ? 'Pause filling' : 'Play filling'}
    </Button>
  );
}

/**
 * Designer preview. With `play`, the card fills one stamp at a time, rests on the
 * reward, and starts again; `design.filled` is what shows when paused.
 */
export function PassPreview({ design, play, onTap }: {
  design: CardDesign; play?: { playing: boolean; onChange: (p: boolean) => void };
  /** tap the card to add a stamp (new-card wizard) */
  onTap?: () => void;
}) {
  const [view, setView] = useState<'front' | 'back' | 'google'>('front');
  const loop = useStampLoop(design.total, !!play?.playing);
  const d = loop.running ? { ...design, filled: loop.filled } : design;
  return (
    <div className="flex w-full max-w-[300px] flex-col items-center gap-4">
      <SegmentedControl
        label="Preview"
        value={view}
        onChange={setView}
        options={[{ value: 'front', label: 'Apple' }, { value: 'back', label: 'Back' }, { value: 'google', label: 'Google' }]}
      />
      {view === 'back' && <AppleBack d={d} />}
      {view !== 'back' && (
        // with onTap the card itself is a pointer shortcut; the "Add a stamp" button below is the accessible control
        <div onClick={onTap} className={onTap ? 'w-full cursor-pointer transition-transform duration-[var(--tk-motion-fast)] active:scale-[.98]' : 'w-full'}>
          {view === 'front' ? <AppleFront d={d} anim={loop.running} /> : <GoogleCard d={d} anim={loop.running} />}
        </div>
      )}
      {onTap && view !== 'back' && <Button variant="secondary" size="sm" onClick={onTap}>Add a stamp</Button>}
      {play && !loop.reduced && view !== 'back' && <PlayToggle playing={play.playing} onChange={play.onChange} />}
      <p className="text-center text-xs text-text-muted">Close to what customers see. Apple and Google draw the final card.</p>
    </div>
  );
}

/** A self-filling card on its own (landing page), with its own pause control. */
export function LivePassCard({ design, className }: { design: CardDesign; className?: string }) {
  const [playing, setPlaying] = useState(true);
  const loop = useStampLoop(design.total, playing);
  const d = loop.running ? { ...design, filled: loop.filled } : design;
  return (
    <div className={className}>
      <AppleFront d={d} anim={loop.running} />
      {!loop.reduced && <PlayToggle playing={playing} onChange={setPlaying} className="mt-3 w-full bg-surface-raised" />}
    </div>
  );
}

/**
 * The card inside a phone, for the new-card wizard's stage. Our own device drawing
 * (Night frame, status bar, wallet-style screen). Fills itself, a tap on the card
 * adds a stamp, and the two pill buttons underneath are the accessible controls.
 */
export function PhoneMockup({ design, playing, onPlayingChange, onTap, views = false }: {
  design: CardDesign; playing: boolean; onPlayingChange: (p: boolean) => void; onTap: () => void;
  /** designer: switch the phone between the Apple front, the Apple back and Google Wallet */
  views?: boolean;
}) {
  const [view, setView] = useState<'front' | 'back' | 'google'>('front');
  const loop = useStampLoop(design.total, playing);
  const d = loop.running ? { ...design, filled: loop.filled } : design;
  return (
    <div className="flex flex-col items-center gap-4">
      {views && (
        <fieldset className="flex gap-1 rounded-pill bg-white/15 p-1 backdrop-blur">
          <legend className="sr-only">Preview</legend>
          {([['front', 'Apple'], ['back', 'Back'], ['google', 'Google']] as const).map(([v, l]) => (
            <label key={v} className="cursor-pointer">
              <input type="radio" name="phone-view" value={v} checked={view === v} onChange={() => setView(v)} className="peer sr-only" />
              <span className="flex h-8 items-center rounded-pill px-3.5 text-sm font-medium text-white peer-checked:bg-white peer-checked:font-semibold peer-checked:text-[var(--tk-color-night)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white">{l}</span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="relative w-[270px] rounded-[46px] bg-[var(--tk-color-night)] p-[9px] shadow-[0_40px_80px_-30px_rgba(23,18,43,.75)] ring-1 ring-white/15">
        <div className="flex h-[547px] flex-col overflow-hidden rounded-[38px] bg-[#f3f1f8]">
          <div aria-hidden className="relative flex items-center justify-between px-6 pb-2 pt-3 text-[11px] font-semibold tabular text-[var(--tk-color-night)]">
            <span>9:41</span>
            <span className="absolute left-1/2 top-2 h-[22px] w-[84px] -translate-x-1/2 rounded-pill bg-[var(--tk-color-night)]" />
            <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-[2px] border border-current" /><span className="h-2 w-4 rounded-[3px] bg-current" /></span>
          </div>
          <div aria-hidden className="flex items-center justify-between px-4 pb-2 pt-1 text-[var(--tk-color-night)]">
            <span className="grid size-6 place-items-center rounded-pill bg-black/10 text-[10px]">✕</span>
            <span className="h-6 w-12 rounded-pill bg-black/10" />
          </div>
          {/* the card is a pointer shortcut; the "Add a stamp" pill below is the accessible control */}
          <div onClick={view === 'back' ? undefined : onTap} className={view === 'back' ? 'min-h-0 flex-1 px-2.5 pb-2.5' : 'cursor-pointer px-2.5 transition-transform duration-[var(--tk-motion-fast)] active:scale-[.98]'}>
            {view === 'front' ? <AppleFront d={d} anim={loop.running} fit /> : view === 'google' ? <GoogleCard d={d} anim={loop.running} /> : <AppleBack d={d} />}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        {!loop.reduced && view !== 'back' && (
          <button type="button" onClick={() => onPlayingChange(!playing)}
            className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-white/15 px-3.5 text-sm font-medium text-white backdrop-blur hover:bg-white/25">
            {playing ? <Pause aria-hidden className="size-3.5" /> : <Play aria-hidden className="size-3.5" />}{playing ? 'Pause filling' : 'Play filling'}
          </button>
        )}
        {view !== 'back' && <button type="button" onClick={onTap} className="inline-flex h-9 items-center rounded-pill bg-white px-3.5 text-sm font-semibold text-[var(--tk-color-night)] hover:bg-white/90">Add a stamp</button>}
      </div>
    </div>
  );
}

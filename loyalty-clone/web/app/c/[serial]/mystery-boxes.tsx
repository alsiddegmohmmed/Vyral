'use client';
import { useState, useTransition } from 'react';
import { Gift, Sparkles } from 'lucide-react';
import { DOT } from '@/components/brand/garuka-mark';
import { Button } from '@/components/ui/button';
import { openPrizeAction } from './actions';

type Box = { id: string; name: string; tier: 'common' | 'rare' | 'legendary'; opened: boolean };
const TIER = { common: 'Common', rare: 'Rare', legendary: 'Legendary' } as const;

/** Mystery boxes waiting on the card: open each one to see the prize, then show the card at the counter. */
export function MysteryBoxes({ serial, boxes }: { serial: string; boxes: Box[] }) {
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [revealing, setRevealing] = useState<string | null>(null);
  // the little game: three taps to open, each one shakes the box harder
  const TAPS = 3;
  const [taps, setTaps] = useState<Record<string, number>>({});
  const [shake, setShake] = useState<Record<string, number>>({});
  const tap = (id: string) => {
    if (pending || revealing) return;
    const n = (taps[id] ?? 0) + 1;
    setTaps((t) => ({ ...t, [id]: n }));
    setShake((k) => ({ ...k, [id]: (k[id] ?? 0) + 1 }));
    try { navigator.vibrate?.(n < TAPS ? 15 * n : [30, 40, 60]); } catch { /* no vibration */ }
    if (n >= TAPS) open(id);
  };
  const open = (id: string) => start(async () => {
    if (!(await openPrizeAction(serial, id))) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) { setOpened((o) => ({ ...o, [id]: true })); return; }
    setRevealing(id);
    setTimeout(() => { setRevealing(null); setOpened((o) => ({ ...o, [id]: true })); }, 1400);
  });
  const [pending, start] = useTransition();
  return (
    <section aria-labelledby="boxes" className="flex flex-col gap-3 border-b border-border bg-accent-subtle px-5 py-4">
      <h2 id="boxes" className="flex items-center gap-2 text-sm font-semibold"><Gift aria-hidden className="size-4 text-accent" />
        {boxes.length === 1 ? 'You have a mystery box' : `You have ${boxes.length} mystery boxes`}</h2>
      <ul className="flex flex-col gap-2">
        {boxes.map((b) => {
          const shown = b.opened || opened[b.id];
          return (
            <li key={b.id} className="rounded-md bg-surface-raised p-4 shadow-card">
              {revealing === b.id ? (
                <div role="status" className="flex items-center gap-4">
                  {/* the Garuka ring closes around the Sunrise dot, then one pulse */}
                  <svg viewBox="0 0 256 256" aria-hidden className="size-20 shrink-0">
                    <circle cx="128" cy="128" r="80" fill="none" stroke="var(--tk-color-petal)" strokeWidth="44" />
                    <circle className="box-close" cx="128" cy="128" r="80" fill="none" stroke="var(--tk-color-jacaranda)" strokeWidth="44" transform="rotate(-55 128 128) scale(1 -1) translate(0 -256)" />
                    <circle cx={DOT.cx} cy={DOT.cy} r={DOT.r} fill="var(--tk-color-sunrise)" />
                    <circle className="box-pulse" cx="128" cy="128" r="112" fill="none" stroke="var(--tk-color-sunrise)" strokeWidth="6" />
                  </svg>
                  <span className="font-semibold">Opening your box…</span>
                </div>
              ) : shown ? (
                <p role="status" className="flex items-start gap-3">
                  <Sparkles aria-hidden className="mt-0.5 size-5 shrink-0 text-accent motion-safe:animate-[pop-in_400ms_var(--tk-motion-land)]" />
                  <span><span className="block text-lg font-bold">{b.name}</span>
                    <span className="text-sm text-text-muted">{TIER[b.tier]} prize. Show this card at the counter to collect it.</span></span>
                </p>
              ) : (
                <div className="flex items-center gap-4">
                  {/* the box: tap it (or press the button) three times */}
                  <button type="button" onClick={() => tap(b.id)} disabled={pending}
                    aria-label={`Open your mystery box: tap ${TAPS - (taps[b.id] ?? 0)} more ${TAPS - (taps[b.id] ?? 0) === 1 ? 'time' : 'times'}`}
                    className="grid size-20 shrink-0 cursor-pointer place-items-center rounded-lg bg-accent text-on-accent shadow-pop transition-transform active:scale-95">
                    <Gift key={shake[b.id] ?? 0} aria-hidden className={(shake[b.id] ?? 0) > 0 ? 'box-shake size-10 motion-reduce:animate-none' : 'size-10'}
                      style={{ ['--k' as string]: 6 + (taps[b.id] ?? 0) * 6 }} />
                  </button>
                  <div className="min-w-0">
                    <p className="font-semibold">{['Tap the box to open it', 'Again!', 'One more…'][Math.min(taps[b.id] ?? 0, TAPS - 1)]}</p>
                    <p className="mt-1.5 flex gap-1.5" aria-hidden>
                      {Array.from({ length: TAPS }, (_, i) => <span key={i} className={i < (taps[b.id] ?? 0) ? 'size-2.5 rounded-pill bg-[var(--tk-color-sunrise)]' : 'size-2.5 rounded-pill bg-border'} />)}
                    </p>
                    <p role="status" className="sr-only">{(taps[b.id] ?? 0) > 0 && (taps[b.id] ?? 0) < TAPS ? `${TAPS - (taps[b.id] ?? 0)} to go` : ''}</p>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

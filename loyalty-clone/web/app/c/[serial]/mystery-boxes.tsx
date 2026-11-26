'use client';
import { useState, useTransition } from 'react';
import { Gift, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { openPrizeAction } from './actions';

type Box = { id: string; name: string; tier: 'common' | 'rare' | 'legendary'; opened: boolean };
const TIER = { common: 'Common', rare: 'Rare', legendary: 'Legendary' } as const;

/** Mystery boxes waiting on the card: open each one to see the prize, then show the card at the counter. */
export function MysteryBoxes({ serial, boxes }: { serial: string; boxes: Box[] }) {
  const [opened, setOpened] = useState<Record<string, boolean>>({});
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
              {shown ? (
                <p role="status" className="flex items-start gap-3">
                  <Sparkles aria-hidden className="mt-0.5 size-5 shrink-0 text-accent motion-safe:animate-[pop-in_400ms_var(--tk-motion-land)]" />
                  <span><span className="block text-lg font-bold">{b.name}</span>
                    <span className="text-sm text-text-muted">{TIER[b.tier]} prize. Show this card at the counter to collect it.</span></span>
                </p>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-text-muted">What’s inside is already decided.</span>
                  <Button size="sm" loading={pending} onClick={() => start(async () => { if (await openPrizeAction(serial, b.id)) setOpened((o) => ({ ...o, [b.id]: true })); })}>
                    Open your mystery box
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

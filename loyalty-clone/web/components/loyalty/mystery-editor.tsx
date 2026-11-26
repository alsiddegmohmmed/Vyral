'use client';
import { useState } from 'react';
import { Dices, Plus, Trash2 } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { TextInput } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import type { Prize, PrizeTier } from '@/lib/data/types';

// Mystery box editor (wizard and designer). Chances are relative weights 1–100;
// the server draws with the same weights when a card fills (draw_prize, migration 0008).

export const TIERS: { value: PrizeTier; label: string; swatch: string }[] = [
  { value: 'common', label: 'Common', swatch: 'var(--tk-color-accent)' },
  { value: 'rare', label: 'Rare', swatch: 'var(--tk-color-info)' },
  { value: 'legendary', label: 'Legendary', swatch: 'var(--tk-color-sunrise)' },
];
const tierLabel = (t: PrizeTier) => TIERS.find((x) => x.value === t)?.label ?? t;

/** Starting rows: the current reward as the common prize, two to fill in. */
export const starterPrizes = (reward: string): Prize[] => [
  { name: reward || '', weight: 70, tier: 'common' },
  { name: '', weight: 25, tier: 'rare' },
  { name: '', weight: 5, tier: 'legendary' },
];

export const prizesValid = (p: Prize[]) => p.length >= 2 && p.length <= 6 && p.every((x) => x.name.trim() && Number.isInteger(x.weight) && x.weight >= 1 && x.weight <= 100);

/** "about 1 in 4" for a share between 0 and 1. */
const oneIn = (share: number) => (share >= 0.95 ? 'almost every box' : share >= 0.5 ? `about ${Math.round(share * 10)} in 10` : `about 1 in ${Math.max(2, Math.round(1 / share))}`);

/** The same weighted draw as the server, for the "Try a box" button. */
export function drawLocal(prizes: Prize[]): Prize | null {
  const tot = prizes.reduce((n, p) => n + p.weight, 0);
  if (!tot) return null;
  let pick = Math.floor(Math.random() * tot);
  for (const p of prizes) { if (pick < p.weight) return p; pick -= p.weight; }
  return prizes[prizes.length - 1];
}

export function MysteryEditor({ prizes, onChange, idPrefix = 'prize' }: { prizes: Prize[]; onChange: (p: Prize[]) => void; idPrefix?: string }) {
  const [tried, setTried] = useState<Prize | null>(null);
  const tot = prizes.reduce((n, p) => n + (p.weight || 0), 0);
  const set = (i: number, patch: Partial<Prize>) => { setTried(null); onChange(prizes.map((p, j) => (j === i ? { ...p, ...patch } : p))); };
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3">
        {prizes.map((p, i) => {
          const share = tot ? p.weight / tot : 0;
          return (
            <li key={i} className="rounded-md border border-border bg-surface-raised p-3">
              <div className="flex items-end gap-2">
                <label className="min-w-0 flex-1 text-sm font-semibold" htmlFor={`${idPrefix}-name-${i}`}>
                  Prize {i + 1}
                  <TextInput id={`${idPrefix}-name-${i}`} className="mt-1" value={p.name} maxLength={60} placeholder={i === 0 ? 'e.g. Free coffee' : i === 1 ? 'e.g. Free pastry' : 'e.g. Free lunch'}
                    onChange={(e) => set(i, { name: e.target.value })} />
                </label>
                <IconButton aria-label={`Remove prize ${i + 1}`} icon={<Trash2 aria-hidden className="size-4" />} disabled={prizes.length <= 2}
                  onClick={() => { setTried(null); onChange(prizes.filter((_, j) => j !== i)); }} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm" htmlFor={`${idPrefix}-weight-${i}`}>
                  Chance
                  <TextInput id={`${idPrefix}-weight-${i}`} inputMode="numeric" className="w-20 text-center tabular" value={p.weight || ''}
                    onChange={(e) => set(i, { weight: Math.min(100, Number(e.target.value.replace(/\D/g, '')) || 0) })} />
                </label>
                <span className="text-sm tabular text-text-muted">{Math.round(share * 100)}%, {share ? oneIn(share) : 'never'}</span>
                <label className="ml-auto flex items-center gap-2 text-sm" htmlFor={`${idPrefix}-tier-${i}`}>
                  <span className="sr-only">Prize {i + 1} tier</span>
                  <span aria-hidden className="size-2.5 rounded-pill" style={{ background: TIERS.find((t) => t.value === p.tier)?.swatch }} />
                  <select id={`${idPrefix}-tier-${i}`} value={p.tier} onChange={(e) => set(i, { tier: e.target.value as PrizeTier })}
                    className="h-10 rounded-md border border-border-input bg-bg px-2 text-sm">
                    {TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </label>
              </div>
            </li>
          );
        })}
      </ol>
      {tot > 0 && (
        <div aria-hidden className="flex h-2.5 overflow-hidden rounded-pill bg-surface">
          {prizes.map((p, i) => <span key={i} style={{ width: `${(p.weight / tot) * 100}%`, background: TIERS.find((t) => t.value === p.tier)?.swatch }} />)}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" disabled={prizes.length >= 6} onClick={() => onChange([...prizes, { name: '', weight: 10, tier: 'rare' }])}>
          <Plus aria-hidden className="size-4" /> Add a prize
        </Button>
        <Button variant="secondary" size="sm" disabled={!prizesValid(prizes)} onClick={() => setTried(drawLocal(prizes))}>
          <Dices aria-hidden className="size-4" /> Try a box
        </Button>
        <p role="status" className={cn('text-sm', tried ? 'font-semibold' : 'text-text-muted')}>
          {tried ? `This box gave: ${tried.name} (${tierLabel(tried.tier)})` : prizesValid(prizes) ? '' : 'Name at least 2 prizes.'}
        </p>
      </div>
      <p className="text-xs text-text-muted">The prize is drawn when the card fills. Staff see which one to give, and the customer opens it on their card. Chances are relative: 70, 25 and 5 make 70%, 25% and 5%.</p>
    </div>
  );
}

export { tierLabel };

'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { Banner } from '@/components/ui/feedback';
import type { Campaign } from '@/lib/data/types';
import { saveDesignAction } from '../../actions';

export function DailyChart({ data }: { data: { date: string; stamps: number; enrolled: number }[] }) {
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.stamps));
  const w = 100 / data.length;
  return (
    <div className="mt-3 flex flex-col gap-3">
      <button type="button" className="self-end text-sm text-text-muted underline" aria-pressed={table} onClick={() => setTable(!table)}>{table ? 'Show chart' : 'Show as table'}</button>
      {table ? (
        <div className="max-h-80 overflow-auto rounded-md border border-border">
          <table className="w-full text-sm"><caption className="sr-only">Stamps and new customers per day</caption>
            <thead className="sticky top-0 bg-surface text-left"><tr><th scope="col" className="px-3 py-2">Day</th><th scope="col" className="px-3 py-2">Stamps</th><th scope="col" className="px-3 py-2">New customers</th></tr></thead>
            <tbody>{data.map((d) => <tr key={d.date} className="border-t border-border"><td className="px-3 py-1.5">{d.date}</td><td className="px-3 py-1.5 tabular">{d.stamps}</td><td className="px-3 py-1.5 tabular">{d.enrolled}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-48 w-full" role="img"
          aria-label={`Stamps per day, ${data[0]?.date} to ${data.at(-1)?.date}. Highest: ${max}. Use “Show as table” for exact numbers.`}>
          {data.map((d, i) => (
            <rect key={d.date} x={i * w + w * 0.15} width={w * 0.7} y={40 - (d.stamps / max) * 38} height={(d.stamps / max) * 38} rx={0.4} className="fill-accent">
              <title>{`${d.date}: ${d.stamps} stamps`}</title>
            </rect>
          ))}
          <line x1="0" x2="100" y1="40" y2="40" className="stroke-border" strokeWidth="0.3" />
        </svg>
      )}
    </div>
  );
}

export function RoiForm({ id, currency, stampValue, rewardCost, reward }: { id: string; currency: string; stampValue?: number; rewardCost?: number; reward: Campaign['reward'] }) {
  const router = useRouter();
  const [v, setV] = useState(stampValue ? String(stampValue / 100) : '');
  const [cost, setCost] = useState(rewardCost ? String(rewardCost / 100) : '');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const num = (s: string) => (s.trim() === '' ? undefined : Math.round(Number(s.replace(/[^\d.]/g, '')) * 100));
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); start(async () => {
      const r = await saveDesignAction(id, { stampValueCents: num(v), reward: { ...reward, costCents: num(cost) } });
      setMsg(r.error ?? null); if (!r.error) router.refresh();
    }); }}>
      <Field label={`A visit is worth (${currency})`} hint="What a customer spends on a typical visit."><TextInput inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} /></Field>
      <Field label={`A reward costs you (${currency})`} hint="What it costs you to give one reward."><TextInput inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
      {msg && <Banner tone="danger" title={msg} />}
      <Button type="submit" variant="secondary" loading={pending}>Update estimate</Button>
    </form>
  );
}

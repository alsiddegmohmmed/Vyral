'use client';
import { useState } from 'react';
import { Cake, HeartHandshake, Info, Stamp, Gift, CheckCircle2, Smartphone, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/controls';
import { Field, Select, Textarea, TextInput } from '@/components/ui/field';
import { Badge } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export function BudgetNote() {
  return (
    <p className="flex items-start gap-2 rounded-md bg-info-bg p-3 text-sm text-info">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>Each card gets at most 3 notifications a day. Anyone already at today’s limit is skipped, and the report shows how many.</span>
    </p>
  );
}

export function AutomationCard({ kind }: { kind: 'birthday' | 'winback' }) {
  const [on, setOn] = useState(kind === 'birthday');
  const [body, setBody] = useState(kind === 'birthday' ? 'Happy birthday {name}! Your next drink is on us this week.' : 'We miss you, {name}. Come by this week for a double stamp.');
  const Icon = kind === 'birthday' ? Cake : HeartHandshake;
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface"><Icon aria-hidden className="size-5" /></span>
        <div className="flex-1">
          <h3 className="text-lg">{kind === 'birthday' ? 'Birthday message' : 'We miss you'}</h3>
          <p className="text-sm text-text-muted">{kind === 'birthday' ? 'Sent on the customer’s birthday.' : 'Sent when a customer hasn’t visited for a while.'}</p>
        </div>
      </div>
      <Switch label={on ? 'On' : 'Off'} checked={on} onCheckedChange={setOn} />
      {on && (
        <>
          <Field label="Message" hint="{name} becomes the customer’s first name. Under 90 characters shows in full on the lock screen.">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} max={90} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {kind === 'winback' && (
              <Field label="After (days)"><TextInput inputMode="numeric" defaultValue="30" /></Field>
            )}
            <Field label="Send at" hint="Africa/Kigali">
              <Select defaultValue="10">{[8, 9, 10, 11, 12, 14, 16, 18].map((h) => <option key={h} value={h}>{`${h}:00`}</option>)}</Select>
            </Field>
          </div>
          <p className="text-sm tabular text-text-muted">About <strong className="text-text">{kind === 'birthday' ? 6 : 14} customers</strong> in the next 7 days.</p>
        </>
      )}
    </section>
  );
}

export function PlanCard({ name, price, limits, current, recommended }: {
  name: string; price: string; limits: string[]; current?: boolean; recommended?: boolean;
}) {
  return (
    <section className={cn('flex flex-col gap-4 rounded-lg border bg-surface-raised p-5', recommended ? 'border-accent shadow-pop' : 'border-border shadow-card')}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg">{name}</h3>
        {current ? <Badge>Current plan</Badge> : recommended ? <Badge tone="info">Most chosen</Badge> : null}
      </div>
      <p className="text-2xl tabular">{price}<span className="text-sm font-normal text-text-muted"> / month</span></p>
      <ul className="flex flex-col gap-2 text-sm">
        {limits.map((l) => <li key={l} className="flex gap-2"><CheckCircle2 aria-hidden className="size-4 shrink-0 text-success" />{l}</li>)}
      </ul>
      <Button variant={current ? 'secondary' : 'primary'} disabled={current} block>{current ? 'Your plan' : `Choose ${name}`}</Button>
      <p className="text-xs text-text-muted">Pay by card, MTN MoMo or Airtel Money</p>
    </section>
  );
}

const ev = [
  { icon: Stamp, text: 'Front counter added 2 stamps', at: '2 min ago' },
  { icon: Gift, text: 'Earned a free coffee', at: '2 min ago' },
  { icon: Smartphone, text: 'Added the card to Apple Wallet', at: 'Mon 09:14' },
  { icon: CheckCircle2, text: 'Joined from the counter QR', at: 'Mon 09:12' },
];
export function Timeline() {
  return (
    <ol className="flex flex-col">
      {ev.map((e, i) => (
        <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
          {i < ev.length - 1 && <span aria-hidden className="absolute left-4 top-8 h-[calc(100%-24px)] w-px bg-border" />}
          <span className="grid size-8 shrink-0 place-items-center rounded-pill bg-surface"><e.icon aria-hidden className="size-4" /></span>
          <div><p className="text-sm">{e.text}</p><p className="text-xs text-text-muted">{e.at}</p></div>
        </li>
      ))}
    </ol>
  );
}

export const customers = [
  { name: 'Aline Uwase', stamps: 9, total: 10, wallet: 'Apple Wallet', last: 'Today' },
  { name: 'Eric Mugisha', stamps: 3, total: 10, wallet: 'Google Wallet', last: '4 days ago' },
  { name: 'Grace Iradukunda', stamps: 0, total: 10, wallet: 'Web card', last: '32 days ago' },
];
export { Trash2 };

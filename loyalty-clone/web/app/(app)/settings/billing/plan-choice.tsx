'use client';
import { useState, useTransition } from 'react';
import { Banner } from '@/components/ui/feedback';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/feedback';
import { cn } from '@/lib/cn';
import { checkoutAction } from '../actions';

type P = { id: 'starter' | 'growth' | 'pro'; name: string; audience: string; price: number; limits: string[] };

export function PlanChoice({ plans, current, currency, recommended }: { plans: P[]; current?: P['id']; currency: string; recommended: P['id'] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  return (
    <>
    {msg && <div className="mb-4"><Banner tone={msg.tone} title={msg.text} /></div>}
    <ul className="grid gap-4 md:grid-cols-3">
      {plans.map((p) => (
        <li key={p.id} className={cn('flex flex-col gap-4 rounded-lg border bg-surface-raised p-5', p.id === recommended ? 'border-accent shadow-pop' : 'border-border shadow-card')}>
          <div className="flex items-center justify-between"><h2 className="text-lg">{p.name}</h2>{p.id === current ? <Badge tone="success">Current plan</Badge> : p.id === recommended ? <Badge tone="info">Most chosen</Badge> : null}</div>
          <p className="-mt-3 text-sm text-text-muted">{p.audience}</p>
          <p className="text-2xl tabular">{currency} {p.price.toLocaleString()}<span className="text-sm font-normal text-text-muted"> / month</span></p>
          <ul className="flex flex-col gap-2 text-sm">{p.limits.map((l) => <li key={l} className="flex gap-2"><CheckCircle2 aria-hidden className="size-4 shrink-0 text-success" />{l}</li>)}</ul>
          <Button className="mt-auto" variant={p.id === current ? 'secondary' : 'primary'} disabled={p.id === current} loading={pending} onClick={() => start(async () => { const r = await checkoutAction(p.id); if (r.url) { window.location.href = r.url; return; } setMsg(r.error ? { tone: 'danger', text: r.error } : { tone: 'success', text: r.ok ?? 'Done' }); })}>
            {p.id === current ? 'Your plan' : `Choose ${p.name}`}
          </Button>
          <p className="text-xs text-text-muted">{currency === 'RWF' ? 'Pay with MTN MoMo, Airtel Money or card' : 'Pay by card'}</p>
        </li>
      ))}
    </ul>
    </>
  );
}

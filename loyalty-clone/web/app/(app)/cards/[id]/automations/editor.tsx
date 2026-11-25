'use client';
import { useState, useTransition } from 'react';
import { Cake, HeartHandshake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/controls';
import { Field, Select, Textarea, TextInput } from '@/components/ui/field';
import { Banner } from '@/components/ui/feedback';
import type { Automation } from '@/lib/data/types';
import { saveAutomationAction } from '../../actions';

export function AutomationEditor({ campaignId, kind, initial, forecast, timezone, blocked }: {
  campaignId: string; kind: 'birthday' | 'winback'; initial: Automation; forecast: number; timezone: string; blocked?: string;
}) {
  const [a, setA] = useState(initial);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [pending, start] = useTransition();
  const Icon = kind === 'birthday' ? Cake : HeartHandshake;
  const save = (next = a) => start(async () => {
    const r = await saveAutomationAction(campaignId, kind, { enabled: next.enabled, body: next.body, daysInactive: next.daysInactive, sendHour: next.sendHour });
    setMsg(r.error ? { tone: 'danger', text: r.error } : { tone: 'success', text: next.enabled ? 'Saved. It’s on.' : 'Saved. It’s off.' });
    if (r.error && next.enabled !== initial.enabled) setA({ ...next, enabled: initial.enabled });
  });
  return (
    <section aria-labelledby={`${kind}-title`} className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface"><Icon aria-hidden className="size-5" /></span>
        <div className="flex-1">
          <h2 id={`${kind}-title`} className="text-lg">{kind === 'birthday' ? 'Birthday message' : 'We miss you'}</h2>
          <p className="text-sm text-text-muted">{kind === 'birthday' ? 'Sent on the customer’s birthday.' : 'Sent when someone hasn’t visited for a while.'}</p>
        </div>
      </div>
      {blocked && <Banner tone="warning" title={blocked} />}
      <Switch label={a.enabled ? 'On' : 'Off'} checked={a.enabled} disabled={!!blocked && !a.enabled} onCheckedChange={(v) => { const n = { ...a, enabled: v }; setA(n); save(n); }} />
      <Field label="Message" hint="{name} becomes the customer’s first name. Under 90 characters shows in full on the lock screen.">
        <Textarea value={a.body} max={300} onChange={(e) => setA({ ...a, body: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {kind === 'winback' && (
          <Field label="After how many days" hint="7 to 365"><TextInput inputMode="numeric" value={a.daysInactive ?? ''} onChange={(e) => setA({ ...a, daysInactive: Number(e.target.value.replace(/\D/g, '')) || undefined })} /></Field>
        )}
        <Field label="Send at" hint={timezone}>
          <Select value={a.sendHour} onChange={(e) => setA({ ...a, sendHour: Number(e.target.value) })}>
            {Array.from({ length: 15 }, (_, i) => i + 7).map((h) => <option key={h} value={h}>{`${h}:00`}</option>)}
          </Select>
        </Field>
      </div>
      <p className="text-sm tabular text-text-muted">About <strong className="text-text">{forecast} {forecast === 1 ? 'customer' : 'customers'}</strong> in the next 7 days.</p>
      {msg && <Banner tone={msg.tone} title={msg.text} />}
      <Button variant="secondary" className="self-start" loading={pending} onClick={() => save()}>Save message</Button>
    </section>
  );
}

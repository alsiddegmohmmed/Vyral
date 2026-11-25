'use client';
import { useState, useTransition } from 'react';
import { Pause, Play, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/overlays';
import { pushUpdateAction, setStatusAction } from '../actions';

export function OverviewActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok?: string; error?: string }>) => start(async () => { const r = await fn(); setMsg(r.error ? { tone: 'danger', text: r.error } : { tone: 'success', text: r.ok ?? 'Done' }); });
  return (
    <section aria-labelledby="manage" className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-5 shadow-card">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" loading={pending} onClick={() => run(() => pushUpdateAction(id))}><RefreshCw aria-hidden className="size-4" /> Update all cards</Button>
        {status === 'live' ? (
          <ConfirmDialog trigger={<Button variant="secondary"><Pause aria-hidden className="size-4" /> Pause</Button>} title="Pause this card?" action="Pause card" onConfirm={() => run(() => setStatusAction(id, 'paused'))}>
            New customers won’t be able to join and the scanner won’t add stamps until you resume. Rewards already earned can still be given from the dashboard.
          </ConfirmDialog>
        ) : (
          <Button variant="secondary" loading={pending} onClick={() => run(() => setStatusAction(id, 'live'))}><Play aria-hidden className="size-4" /> Resume</Button>
        )}
      </div>
      <p className="text-xs text-text-muted">“Update all cards” sends your latest design and text to customers’ phones. Once every 10 minutes.</p>
      {msg && <Banner tone={msg.tone} title={msg.text} />}
    </section>
  );
}

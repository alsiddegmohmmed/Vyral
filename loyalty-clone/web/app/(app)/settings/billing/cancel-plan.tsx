'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/overlays';
import { cancelPlanAction } from '../actions';

/** Renewal line plus one-click cancel (with a confirm) and undo. No phone call, no form. */
export function CancelPlan({ planName, renewsOn, cancelling, canUndo }: { planName: string; renewsOn: string; cancelling: boolean; canUndo: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const run = (cancel: boolean) => start(async () => { const r = await cancelPlanAction(cancel); setMsg(r.error ? { tone: 'danger', text: r.error } : { tone: 'success', text: r.ok ?? 'Done' }); });
  return (
    <section aria-labelledby="renewal" className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-5 shadow-card">
      <h2 id="renewal" className="text-base font-semibold">Renewal</h2>
      <p className="text-sm text-text-muted">
        {cancelling
          ? <>{planName} ends on <strong className="text-text">{renewsOn}</strong>. You won’t be charged again. Customers keep their cards after that; editing pauses.</>
          : <>{planName} renews on <strong className="text-text">{renewsOn}</strong>. We email you a week before.</>}
      </p>
      <div className="flex flex-wrap gap-2">
        {cancelling ? (
          canUndo && <Button variant="secondary" size="sm" loading={pending} onClick={() => run(false)}>Keep my plan</Button>
        ) : (
          <ConfirmDialog trigger={<Button variant="secondary" size="sm">Cancel plan</Button>} title="Cancel your plan?" action="Cancel plan"
            onConfirm={() => run(true)}>
            Everything keeps working until {renewsOn}, and you won’t be charged again. You can change your mind before then.
          </ConfirmDialog>
        )}
      </div>
      {msg && <Banner tone={msg.tone} title={msg.text} />}
    </section>
  );
}

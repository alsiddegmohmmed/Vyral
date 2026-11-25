'use client';
import { useActionState, useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';
import { Banner } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/overlays';
import { sendBroadcastAction, type ActionState } from '../../actions';

export function Composer({ id, wallet, webCards, business }: { id: string; wallet: number; webCards: number; business: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(sendBroadcastAction.bind(null, id), {});
  const [body, setBody] = useState('');
  let formRef: HTMLFormElement | null = null;
  // keep the text when sending fails (B-009); clear it only after a successful send
  useEffect(() => { if (state.ok) setBody(''); }, [state]);
  return (
    <form ref={(f) => { formRef = f; }} action={action} className="flex flex-col gap-4">
      {state.ok && <Banner tone="success" title="Sent">{state.ok}</Banner>}
      {state.error && <Banner tone="danger" title={state.error} />}
      <Field label="Message" hint="Under 90 characters shows in full on the lock screen. Appears as news from your business.">
        <Textarea name="body" value={body} max={300} onChange={(e) => setBody(e.target.value)} placeholder="Double stamps this Friday!" />
      </Field>
      <p className="text-sm text-text-muted"><strong className="text-text">{wallet}</strong> wallet passes will be notified. Also shown on <strong className="text-text">{webCards}</strong> web cards.</p>
      <ConfirmDialog tone="primary" trigger={<Button disabled={!body.trim() || body.length > 300} loading={pending}><Send aria-hidden className="size-4" /> Send</Button>}
        title="Send this message?" action="Send now" onConfirm={() => formRef?.requestSubmit()}>
        <p className="rounded-md bg-surface p-3 text-text">“{body}”</p>
        <p className="mt-2">From {business}, to {wallet} wallet passes. It can’t be unsent.</p>
      </ConfirmDialog>
    </form>
  );
}

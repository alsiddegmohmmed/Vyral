'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { Plus } from 'lucide-react';
import { Button, buttonClass } from '@/components/ui/button';
import { Dialog } from '@/components/ui/overlays';
import { Field, TextInput } from '@/components/ui/field';
import { Banner } from '@/components/ui/feedback';
import { createCardAction, type ActionState } from './actions';

export function NewCardButton({ atLimit, tile = false }: { atLimit: boolean; tile?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createCardAction, {});
  if (atLimit) {
    return <Link href="/settings/billing" className={buttonClass('secondary')}>Upgrade for more cards</Link>;
  }
  // The tile variant is the dashed "add" slot at the end of the cards grid.
  const trigger = tile ? (
    <button type="button" className="flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-bg p-6 text-text-muted transition-colors duration-[var(--tk-motion-fast)] hover:border-border-input hover:bg-surface hover:text-text">
      <span aria-hidden className="grid size-11 place-items-center rounded-pill bg-surface"><Plus className="size-5" /></span>
      <span className="text-sm font-semibold text-text">New card</span>
      <span aria-hidden className="max-w-[200px] text-center text-xs">Start another design, e.g. a pastry or lunch card</span>
    </button>
  ) : <Button><Plus aria-hidden className="size-4" /> New card</Button>;
  return (
    <Dialog trigger={trigger} title="New card" description="You can change everything before it goes live.">
      <form action={action} className="flex flex-col gap-4">
        {state.error && <Banner tone="danger" title={state.error} />}
        <Field label="Card name" hint="Only you see this, e.g. “Coffee card”."><TextInput name="name" required autoFocus maxLength={60} /></Field>
        <Button type="submit" loading={pending} block>Create and design</Button>
      </form>
    </Dialog>
  );
}

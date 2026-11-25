'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { Plus } from 'lucide-react';
import { Button, buttonClass } from '@/components/ui/button';
import { Dialog } from '@/components/ui/overlays';
import { Field, TextInput } from '@/components/ui/field';
import { Banner } from '@/components/ui/feedback';
import { createCardAction, type ActionState } from './actions';

export function NewCardButton({ atLimit }: { atLimit: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createCardAction, {});
  if (atLimit) {
    return <Link href="/settings/billing" className={buttonClass('secondary')}>Upgrade for more cards</Link>;
  }
  return (
    <Dialog trigger={<Button><Plus aria-hidden className="size-4" /> New card</Button>} title="New card" description="You can change everything before it goes live.">
      <form action={action} className="flex flex-col gap-4">
        {state.error && <Banner tone="danger" title={state.error} />}
        <Field label="Card name" hint="Only you see this, e.g. “Coffee card”."><TextInput name="name" required autoFocus maxLength={60} /></Field>
        <Button type="submit" loading={pending} block>Create and design</Button>
      </form>
    </Dialog>
  );
}

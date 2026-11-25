'use client';
import { useActionState, useState } from 'react';
import { Copy, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/overlays';
import { Field, TextInput } from '@/components/ui/field';
import { Banner } from '@/components/ui/feedback';
import { addCustomerAction, type ActionState } from '../../actions';

export function AddCustomer({ campaignId }: { campaignId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addCustomerAction.bind(null, campaignId), {});
  const [copied, setCopied] = useState(false);
  const link = state.ok ? `${location.origin}/c/${state.ok}` : '';
  return (
    <Dialog trigger={<Button size="sm" variant="secondary"><UserPlus aria-hidden className="size-4" /> Add customer</Button>} title="Add a customer" description="For customers who can’t scan the QR. You’ll get a link to send them.">
      {state.ok ? (
        <div className="flex flex-col gap-3">
          <Banner tone="success" title="Card created">Send this link by WhatsApp or SMS. It opens their card.</Banner>
          <p className="break-all rounded-md bg-surface p-3 font-mono text-xs">{link}</p>
          <Button onClick={async () => { await navigator.clipboard?.writeText(link); setCopied(true); }}><Copy aria-hidden className="size-4" /> {copied ? 'Copied' : 'Copy link'}</Button>
        </div>
      ) : (
        <form action={action} className="flex flex-col gap-4">
          {state.error && <Banner tone="danger" title={state.error} />}
          <Field label="Name" required><TextInput name="name" autoComplete="off" required /></Field>
          <Field label="Phone" hint="With country code, e.g. +250788123456."><TextInput name="phone" type="tel" inputMode="tel" /></Field>
          <Field label="Email"><TextInput name="email" type="email" inputMode="email" /></Field>
          <Button type="submit" loading={pending} block>Create card</Button>
        </form>
      )}
    </Dialog>
  );
}

'use client';
import { useRef, useState, useTransition } from 'react';
import { Copy, Gift, Stamp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Stepper } from '@/components/ui/controls';
import { Field, TextInput, Textarea } from '@/components/ui/field';
import { Banner } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/overlays';
import { deleteCardAction, giveStampsAction, updateCustomerAction } from '../../../actions';

export function CardActions({ campaignId, cardId, firstName, current, rewards, customer, rewardName, serial }: {
  campaignId: string; cardId: string; firstName: string; current: number; rewards: number;
  customer: { name: string; email: string; phone: string }; rewardName: string; serial: string;
}) {
  const [stamps, setStamps] = useState(1);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [details, setDetails] = useState(customer);
  const [farewell, setFarewell] = useState('');
  const key = useRef(crypto.randomUUID());
  const run = (fn: () => Promise<{ ok?: string; error?: string }>) => start(async () => {
    const r = await fn();
    setMsg(r.error ? { tone: 'danger', text: r.error } : { tone: 'success', text: r.ok ?? 'Done' });
    key.current = crypto.randomUUID();
  });
  return (
    <aside className="flex flex-col gap-4">
      {msg && <Banner tone={msg.tone} title={msg.text} />}
      <section aria-labelledby="give" className="flex flex-col gap-3 rounded-lg border border-border p-5">
        <h2 id="give" className="text-lg">Stamps and rewards</h2>
        <p className="text-sm text-text-muted">For a forgotten stamp or a fix. It’s logged with your name.</p>
        <Stepper label="Stamps" value={stamps} onChange={setStamps} min={-current} max={100} />
        <div className="flex flex-wrap gap-2">
          <Button loading={pending} disabled={stamps === 0} onClick={() => run(() => giveStampsAction(cardId, stamps, 0, key.current))}>
            <Stamp aria-hidden className="size-4" /> {stamps >= 0 ? `Add ${stamps}` : `Remove ${-stamps}`}
          </Button>
          <Button variant="secondary" loading={pending} disabled={rewards === 0} onClick={() => run(() => giveStampsAction(cardId, 0, 1, key.current))}>
            <Gift aria-hidden className="size-4" /> Give {rewardName.toLowerCase()}
          </Button>
        </div>
      </section>
      <section aria-labelledby="edit" className="flex flex-col gap-3 rounded-lg border border-border p-5">
        <h2 id="edit" className="text-lg">Details</h2>
        <Field label="Name"><TextInput value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} /></Field>
        <Field label="Phone"><TextInput type="tel" value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} /></Field>
        <Field label="Email"><TextInput type="email" value={details.email} onChange={(e) => setDetails({ ...details, email: e.target.value })} /></Field>
        <Button variant="secondary" loading={pending} onClick={() => run(() => updateCustomerAction(cardId, details))}>Save details</Button>
        <Button variant="ghost" onClick={async () => { await navigator.clipboard?.writeText(`${location.origin}/c/${serial}`); setMsg({ tone: 'success', text: 'Card link copied. Send it by WhatsApp or SMS.' }); }}>
          <Copy aria-hidden className="size-4" /> Copy card link
        </Button>
      </section>
      <ConfirmDialog trigger={<Button variant="ghost" className="self-start text-danger"><Trash2 aria-hidden className="size-4" /> Delete {firstName}’s card</Button>}
        title={`Delete ${firstName}’s card?`} action="Delete card" onConfirm={() => run(() => deleteCardAction(campaignId, cardId, farewell))}>
        <p>The card stops working right away and this can’t be undone.</p>
        <div className="mt-3"><Field label="Goodbye note on the card (optional)"><Textarea value={farewell} max={300} onChange={(e) => setFarewell(e.target.value)} /></Field></div>
      </ConfirmDialog>
    </aside>
  );
}

'use client';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { ExternalLink, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog } from '@/components/ui/overlays';
import { Field, Select, TextInput } from '@/components/ui/field';
import { Banner } from '@/components/ui/feedback';
import { pairingCodeAction, revokeDeviceAction, type SettingsState } from '../actions';

export function PairPhone({ locations, disabled }: { locations: { id: string; name: string }[]; disabled: boolean }) {
  return (
    <Dialog trigger={<Button disabled={disabled}><Plus aria-hidden className="size-4" /> Pair a phone</Button>} title="Pair a phone" description="Open the scanner link on the counter phone, then type the code you get here.">
      <PairForm locations={locations} />
    </Dialog>
  );
}

/** The scanner's full address on this site, as a link to open or send to the counter phone. */
function ScannerLink() {
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/scan`;
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-surface p-3 text-left">
      <p className="text-sm text-text-muted">On the counter phone, open:</p>
      <a href="/scan" target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 break-all font-semibold text-accent hover:underline">
        {origin ? url.replace(/^https?:\/\//, '') : '/scan'}<ExternalLink aria-hidden className="size-4 shrink-0" /><span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>
  );
}

function PairForm({ locations }: { locations: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(pairingCodeAction, {});
  return (
    <>
      <ScannerLink />
      <div className="mt-4">
      {state.code ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-text-muted">Then type this code on the phone:</p>
          <p className="rounded-lg bg-surface px-6 py-4 font-mono text-display tracking-[.3em]" aria-live="polite">{state.code}</p>
          <p className="text-xs text-text-muted">Works once, for 10 minutes (until {new Date(state.expiresAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).</p>
        </div>
      ) : (
        <form action={action} className="flex flex-col gap-4">
          {state.error && <Banner tone="danger" title={state.error} />}
          <Field label="Name for this phone" hint="Shown in the stamp history, e.g. “Front counter”."><TextInput name="label" maxLength={40} required /></Field>
          {locations.length > 0 && (
            <Field label="Location"><Select name="locationId" defaultValue=""><option value="">Any location</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
          )}
          <Button type="submit" loading={pending} block>Get pairing code</Button>
        </form>
      )}
      </div>
    </>
  );
}

export function RevokeButton({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog trigger={<Button variant="secondary" size="sm" loading={pending}>Remove</Button>} title={`Remove “${label}”?`} action="Remove phone" onConfirm={() => start(() => revokeDeviceAction(id))}>
      This phone stops working as a scanner right away. Its past stamps stay in the history.
    </ConfirmDialog>
  );
}

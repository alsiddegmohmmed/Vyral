'use client';
import { useActionState, useState, useTransition } from 'react';
import { LocateFixed, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Checkbox, Field, TextInput } from '@/components/ui/field';
import { Banner } from '@/components/ui/feedback';
import { ConfirmDialog, Dialog } from '@/components/ui/overlays';
import type { Location } from '@/lib/data/types';
import { deleteLocationAction, upsertLocationAction, type SettingsState } from '../settings/actions';

export function LocationDialog({ location: l, disabled }: { location?: Location; disabled: boolean }) {
  const trigger = l ? <IconButton aria-label={`Edit ${l.name}`} size="sm" icon={<Pencil aria-hidden className="size-4" />} />
    : <Button disabled={disabled}><Plus aria-hidden className="size-4" /> Add location</Button>;
  return <Dialog trigger={trigger} title={l ? `Edit ${l.name}` : 'Add a location'} wide><LocationForm location={l} /></Dialog>;
}

function LocationForm({ location: l }: { location?: Location }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(upsertLocationAction, {});
  const [pos, setPos] = useState({ lat: l ? String(l.lat) : '', lon: l ? String(l.lon) : '' });
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const here = () => navigator.geolocation?.getCurrentPosition(
    (p) => setPos({ lat: p.coords.latitude.toFixed(6), lon: p.coords.longitude.toFixed(6) }),
    () => setGeoErr('Couldn’t get your location. Type the coordinates instead.'), { enableHighAccuracy: true, timeout: 8000 });
  return (
    <>
      {state.ok ? <Banner tone="success" title="Saved">Use “Update all cards” on a card to send the change to phones.</Banner> : (
        <form action={action} className="flex flex-col gap-4">
          {state.error && <Banner tone="danger" title={state.error} />}
          {l && <input type="hidden" name="id" value={l.id} />}
          <Field label="Name" required><TextInput name="name" defaultValue={l?.name} maxLength={80} required /></Field>
          <Field label="Address"><TextInput name="address" defaultValue={l?.address} /></Field>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude"><TextInput name="lat" inputMode="decimal" value={pos.lat} onChange={(e) => setPos({ ...pos, lat: e.target.value })} required /></Field>
              <Field label="Longitude"><TextInput name="lon" inputMode="decimal" value={pos.lon} onChange={(e) => setPos({ ...pos, lon: e.target.value })} required /></Field>
            </div>
            <Button size="sm" variant="secondary" className="self-start" onClick={here}><LocateFixed aria-hidden className="size-4" /> Use where I am now</Button>
            {geoErr && <p className="text-xs text-danger">{geoErr}</p>}
            <p className="text-xs text-text-muted">Address search comes with the backend step (Google Places).</p>
          </div>
          <Field label="Address on the card" hint="How it’s written on the back of the card."><TextInput name="addressOnCard" defaultValue={l?.addressOnCard} /></Field>
          <Checkbox name="showOnCard" defaultChecked={l?.showOnCard ?? true} label="Show this address on the card" />
          <Field label="Nearby text" hint="Shown when a phone suggests the card here, e.g. “Your coffee is around the corner”. Max 120."><TextInput name="relevantText" defaultValue={l?.relevantText} maxLength={120} /></Field>
          <Button type="submit" loading={pending} block>Save location</Button>
        </form>
      )}
    </>
  );
}

export function DeleteLocation({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog trigger={<IconButton aria-label={`Delete ${name}`} size="sm" loading={pending} icon={<Trash2 aria-hidden className="size-4" />} />}
      title={`Delete ${name}?`} action="Delete location" onConfirm={() => start(() => deleteLocationAction(id))}>
      It’s removed from every card that shows it. Past stamps keep the location name.
    </ConfirmDialog>
  );
}

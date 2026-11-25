'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Select, TextInput } from '@/components/ui/field';
import { Banner } from '@/components/ui/feedback';
import type { Org } from '@/lib/data/types';
import { updateOrgAction, type SettingsState } from './actions';

const ZONES = ['Africa/Kigali', 'Africa/Nairobi', 'Africa/Kampala', 'Africa/Dar_es_Salaam', 'Africa/Lagos', 'Africa/Johannesburg', 'Europe/London', 'America/New_York', 'UTC'];

export function OrgForm({ org }: { org: Org }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateOrgAction, {});
  const zones = ZONES.includes(org.timezone) ? ZONES : [org.timezone, ...ZONES];
  return (
    <form action={action} className="flex max-w-[560px] flex-col gap-4">
      {state.ok && <Banner tone="success" title="Saved" />}
      {state.error && <Banner tone="danger" title={state.error} />}
      <Field label="Business name" required><TextInput name="name" defaultValue={org.name} maxLength={80} /></Field>
      <Field label="Time zone" hint="Birthday and “We miss you” messages send at this local time."><Select name="timezone" defaultValue={org.timezone}>{zones.map((z) => <option key={z}>{z}</option>)}</Select></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email"><TextInput name="email" type="email" defaultValue={org.email} /></Field>
        <Field label="Phone"><TextInput name="phone" type="tel" defaultValue={org.phone} /></Field>
      </div>
      <Field label="Website"><TextInput name="website" type="url" defaultValue={org.website} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Street"><TextInput name="addressLine1" defaultValue={org.addressLine1} /></Field>
        <Field label="City"><TextInput name="city" defaultValue={org.city} /></Field>
      </div>
      <Button type="submit" loading={pending} className="self-start">Save</Button>
    </form>
  );
}

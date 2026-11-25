'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GripVertical, Plus, Rocket, Save, Trash2 } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Checkbox, Field, Select, Textarea, TextInput } from '@/components/ui/field';
import { SegmentedControl, Stepper, Switch } from '@/components/ui/controls';
import { Banner, Badge } from '@/components/ui/feedback';
import { ConfirmDialog, Tabs } from '@/components/ui/overlays';
import { ColorField } from '@/components/ui/color-field';
import { PassPreview } from '@/components/loyalty/pass-preview';
import { stampIcons } from '@/components/loyalty/stamp-strip';
import type { Campaign, CardLink, FieldType, FormField, Location } from '@/lib/data/types';
import { activateAction, saveCardLocationsAction, saveDesignAction, saveFieldsAction } from '../../actions';

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Short text' }, { value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' },
  { value: 'birthday', label: 'Birthday' }, { value: 'number', label: 'Number' }, { value: 'date', label: 'Date' }, { value: 'url', label: 'Website' },
];

export function Designer({ campaign, locations }: { campaign: Campaign; locations: Location[] }) {
  const router = useRouter();
  const live = campaign.status !== 'draft';
  const [c, setC] = useState(campaign);
  const [fields, setFields] = useState<FormField[]>(campaign.fields);
  const [locIds, setLocIds] = useState<string[]>(campaign.locationIds);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [previewStamps, setPreviewStamps] = useState(Math.ceil(campaign.totalStamps * 0.6));

  const set = <K extends keyof Campaign>(k: K, v: Campaign[K]) => setC((x) => ({ ...x, [k]: v }));
  const setDesign = (k: keyof Campaign['design'], v: string) => setC((x) => ({ ...x, design: { ...x.design, [k]: v } }));
  const dirty = useMemo(() => JSON.stringify([c, fields, locIds]) !== JSON.stringify([campaign, campaign.fields, campaign.locationIds]), [c, fields, locIds, campaign]);

  const save = () => start(async () => {
    setMsg(null);
    const patch = {
      name: c.name, programName: c.programName, description: c.description, howToEarn: c.howToEarn, terms: c.terms, hideTerms: c.hideTerms,
      stampMessage: c.stampMessage, rewardMessage: c.rewardMessage, reward: c.reward, design: c.design, links: c.links,
      consentEnabled: c.consentEnabled, consentText: c.consentText, defaultCountry: c.defaultCountry,
      stampCooldownMinutes: c.stampCooldownMinutes, maxStampsPerTransaction: c.maxStampsPerTransaction, maxStampsPerDay: c.maxStampsPerDay,
      stampValueCents: c.stampValueCents,
      ...(live ? {} : { totalStamps: c.totalStamps, expiryMode: c.expiryMode, expiryDate: c.expiryDate, expiryDays: c.expiryDays }),
    };
    for (const r of [await saveDesignAction(c.id, patch), await saveFieldsAction(c.id, fields), await saveCardLocationsAction(c.id, locIds)]) {
      if (r.error) { setMsg({ tone: 'danger', text: r.error }); return; }
    }
    setMsg({ tone: 'success', text: live ? 'Saved. Use “Update all cards” on the overview to push changes to customers’ phones.' : 'Saved.' });
    router.refresh();
  });

  const design = {
    business: c.programName, programName: c.programName, reward: c.reward.name || 'Your reward', total: c.totalStamps,
    filled: Math.min(previewStamps, c.totalStamps), icon: c.design.icon, background: c.design.background,
    foreground: c.design.foreground, label: c.design.label, stamp: c.design.stamp, logoText: c.design.logoText,
  };

  const designTab = (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Card name" hint="Only you see this."><TextInput value={c.name} maxLength={60} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Name on the card" hint="Your business or programme name."><TextInput value={c.programName} maxLength={40} onChange={(e) => set('programName', e.target.value)} /></Field>
        <Field label="Logo text" hint="Shown at the top of Apple passes. Logo images come with the backend step."><TextInput value={c.design.logoText} maxLength={24} onChange={(e) => setDesign('logoText', e.target.value)} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField label="Card background" value={c.design.background} onChange={(v) => setDesign('background', v)} against={c.design.foreground} againstLabel="text colour" />
        <ColorField label="Text" value={c.design.foreground} onChange={(v) => setDesign('foreground', v)} against={c.design.background} againstLabel="background" />
        <ColorField label="Labels" value={c.design.label} onChange={(v) => setDesign('label', v)} against={c.design.background} againstLabel="background" />
        <ColorField label="Stamps" value={c.design.stamp} onChange={(v) => setDesign('stamp', v)} against={c.design.background} againstLabel="background" />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Stamp icon</legend>
        <div role="radiogroup" aria-label="Stamp icon" className="flex flex-wrap gap-2">
          {Object.entries(stampIcons).map(([key, Icon]) => (
            <button key={key} type="button" role="radio" aria-checked={c.design.icon === key} aria-label={key} onClick={() => setDesign('icon', key)}
              className={`grid size-11 place-items-center rounded-md border bg-bg ${c.design.icon === key ? 'border-accent ring-2 ring-accent' : 'border-border'}`}>
              <Icon aria-hidden className="size-5" />
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end gap-8">
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-2 text-sm font-semibold">Stamps for a reward {live && <Badge>Locked</Badge>}</span>
          {live ? <p className="tabular text-xl font-bold">{c.totalStamps}</p> : <Stepper label="Stamps for a reward" value={c.totalStamps} onChange={(v) => set('totalStamps', v)} min={1} max={30} />}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Preview with</span>
          <Stepper label="Preview stamps" value={design.filled} onChange={setPreviewStamps} min={0} max={c.totalStamps} />
        </div>
      </div>
    </div>
  );

  const detailsTab = (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Reward" required hint="What customers get, e.g. “Free coffee”."><TextInput value={c.reward.name} maxLength={60} onChange={(e) => set('reward', { ...c.reward, name: e.target.value })} /></Field>
        <Field label="Reward details" hint="Optional, e.g. “Any hot drink, any size”."><TextInput value={c.reward.details} maxLength={120} onChange={(e) => set('reward', { ...c.reward, details: e.target.value })} /></Field>
      </div>
      <Field label="About this card"><Textarea value={c.description} max={500} onChange={(e) => set('description', e.target.value)} /></Field>
      <Field label="How to earn stamps"><Textarea value={c.howToEarn} max={300} onChange={(e) => set('howToEarn', e.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Stamp text on the card" hint="{n} becomes the number of stamps. Shown quietly, no notification.">
          <TextInput value={c.stampMessage} maxLength={120} onChange={(e) => set('stampMessage', e.target.value)} />
        </Field>
        <Field label="Reward notification" hint="Appears on the lock screen when a reward is earned.">
          <TextInput value={c.rewardMessage} maxLength={120} onChange={(e) => set('rewardMessage', e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold">Cards expire {live && <Badge>Locked</Badge>}</span>
        <SegmentedControl label="Cards expire" value={c.expiryMode} onChange={(v) => !live && set('expiryMode', v)}
          options={[{ value: 'never', label: 'Never' }, { value: 'fixed_date', label: 'On a date' }, { value: 'days_after_join', label: 'After N days' }]} />
        {c.expiryMode === 'fixed_date' && <Field label="Expiry date" locked={live}><TextInput type="date" value={c.expiryDate?.slice(0, 10) ?? ''} onChange={(e) => set('expiryDate', e.target.value ? new Date(e.target.value).toISOString() : undefined)} /></Field>}
        {c.expiryMode === 'days_after_join' && <Field label="Days after joining" locked={live}><TextInput inputMode="numeric" value={c.expiryDays ?? ''} onChange={(e) => set('expiryDays', Number(e.target.value.replace(/\D/g, '')) || undefined)} /></Field>}
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">Links on the back of the card</legend>
        {c.links.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <Field label="Label"><TextInput value={l.label} onChange={(e) => set('links', c.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} /></Field>
            <Field label="Link or number"><TextInput value={l.value} onChange={(e) => set('links', c.links.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} /></Field>
            <IconButton aria-label={`Remove ${l.label || 'link'}`} variant="secondary" icon={<Trash2 aria-hidden className="size-4" />} onClick={() => set('links', c.links.filter((_, j) => j !== i))} />
          </div>
        ))}
        <Button variant="secondary" size="sm" className="self-start" onClick={() => set('links', [...c.links, { kind: 'url', label: '', value: '' } as CardLink])}><Plus aria-hidden className="size-4" /> Add a link</Button>
      </fieldset>
    </div>
  );

  const locationsTab = locations.length === 0 ? (
    <Banner tone="info" title="No locations yet">Add your shops under Locations, then choose them here. Phones can suggest the card when customers are nearby.</Banner>
  ) : (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm text-text-muted">Up to 10. Phones may suggest the card on the lock screen nearby; iPhone and Android decide when.</legend>
      {locations.map((l) => (
        <Checkbox key={l.id} label={<><span className="font-semibold">{l.name}</span> · <span className="text-text-muted">{l.addressOnCard || l.address}</span></>}
          checked={locIds.includes(l.id)} disabled={!locIds.includes(l.id) && locIds.length >= 10}
          onChange={(e) => setLocIds(e.target.checked ? [...locIds, l.id] : locIds.filter((x) => x !== l.id))} />
      ))}
    </fieldset>
  );

  const termsTab = (
    <div className="flex flex-col gap-4">
      <Field label="Terms" hint="Shown on the back of the card and on the join page."><Textarea value={c.terms} max={4000} onChange={(e) => set('terms', e.target.value)} /></Field>
      <Switch label="Hide terms on the join page" checked={c.hideTerms} onCheckedChange={(v) => set('hideTerms', v)} />
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold">Scanner limits (stop misuse)</legend>
        <Field label="Max stamps per scan"><TextInput inputMode="numeric" value={c.maxStampsPerTransaction} onChange={(e) => set('maxStampsPerTransaction', Math.min(30, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)))} /></Field>
        <Field label="Wait between stamps (min)" hint="0 = off"><TextInput inputMode="numeric" value={c.stampCooldownMinutes} onChange={(e) => set('stampCooldownMinutes', Math.min(1440, Number(e.target.value.replace(/\D/g, '')) || 0))} /></Field>
        <Field label="Max stamps per day" hint="0 = off"><TextInput inputMode="numeric" value={c.maxStampsPerDay} onChange={(e) => set('maxStampsPerDay', Math.min(100, Number(e.target.value.replace(/\D/g, '')) || 0))} /></Field>
      </fieldset>
    </div>
  );

  const hasContact = fields.some((f) => (f.type === 'email' || f.type === 'phone') && f.required);
  const formTab = (
    <div className="flex flex-col gap-4">
      {!hasContact && <Banner tone="warning" title="Keep email or phone required">Customers need one of them to get their card back if they lose it.</Banner>}
      <ul className="flex flex-col gap-2">
        {fields.map((f, i) => (
          <li key={f.key} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border border-border bg-bg p-3 sm:grid-cols-[auto_1fr_160px_auto_auto]">
            <GripVertical aria-hidden className="size-4 text-text-subtle" />
            <TextInput aria-label={`Label for field ${i + 1}`} value={f.label} onChange={(e) => setFields(fields.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <span className="hidden text-sm text-text-muted sm:block">{FIELD_TYPES.find((t) => t.value === f.type)?.label ?? (f.type === 'name' ? 'Name' : f.type)}</span>
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" className="size-4 accent-[var(--tk-color-accent)]" checked={f.required} onChange={(e) => setFields(fields.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))} /> Required</label>
            <IconButton aria-label={`Remove ${f.label}`} size="sm" icon={<Trash2 aria-hidden className="size-4" />} disabled={f.type === 'name'} onClick={() => setFields(fields.filter((_, j) => j !== i))} />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Add a field">
          <Select defaultValue="" onChange={(e) => {
            const type = e.target.value as FieldType; if (!type) return;
            const taken = ['email', 'phone', 'birthday'].includes(type) && fields.some((f) => f.type === type);
            if (!taken) setFields([...fields, { key: type === 'text' || type === 'number' || type === 'date' || type === 'url' ? `${type}_${fields.length}` : type, label: FIELD_TYPES.find((t) => t.value === type)!.label, type, required: false }]);
            e.target.value = '';
          }}>
            <option value="">Choose a type…</option>
            {FIELD_TYPES.map((t) => <option key={t.value} value={t.value} disabled={['email', 'phone', 'birthday'].includes(t.value) && fields.some((f) => f.type === t.value)}>{t.label}</option>)}
          </Select>
        </Field>
      </div>
      <Switch label="Ask for marketing consent" checked={c.consentEnabled} onCheckedChange={(v) => set('consentEnabled', v)} />
      {c.consentEnabled && <Field label="Consent text" hint="The box starts unticked."><Textarea value={c.consentText} max={300} onChange={(e) => set('consentText', e.target.value)} /></Field>}
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-5">
        {live && <Banner tone="info" title="This card is live">The number of stamps and expiry are locked. Colours and text can still change.</Banner>}
        <Tabs tabs={[
          { value: 'design', label: 'Design', content: designTab },
          { value: 'details', label: 'Details', hasError: !c.reward.name.trim(), content: detailsTab },
          { value: 'form', label: 'Signup form', hasError: !hasContact, content: formTab },
          { value: 'locations', label: 'Locations', content: locationsTab },
          { value: 'terms', label: 'Terms & limits', content: termsTab },
        ]} />
        {msg && <Banner tone={msg.tone} title={msg.text} />}
        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-4">
          <Button onClick={save} loading={pending} disabled={!dirty}><Save aria-hidden className="size-4" /> {dirty ? 'Save changes' : 'Saved'}</Button>
          {!live && (
            <ConfirmDialog
              trigger={<Button variant="secondary" disabled={dirty || !c.reward.name.trim() || !hasContact}><Rocket aria-hidden className="size-4" /> Go live</Button>}
              title={`Make “${c.name}” live?`} action="Go live" tone="primary"
              onConfirm={() => start(async () => { const r = await activateAction(c.id); if (r?.error) setMsg({ tone: 'danger', text: r.error }); })}
            >
              You’ll get a link and QR code for customers. After this, the number of stamps ({c.totalStamps}) and the expiry rule can’t change.
            </ConfirmDialog>
          )}
          {dirty && !live && <span className="text-xs text-text-muted">Save before going live.</span>}
        </div>
      </div>
      <div className="flex justify-center lg:sticky lg:top-6 lg:self-start"><PassPreview design={design} /></div>
    </div>
  );
}

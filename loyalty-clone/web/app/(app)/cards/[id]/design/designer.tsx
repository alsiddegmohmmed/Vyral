'use client';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GripVertical, Plus, Rocket, Save, Trash2 } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Checkbox, Field, Select, Textarea, TextInput } from '@/components/ui/field';
import { SegmentedControl, Stepper, Switch } from '@/components/ui/controls';
import { Banner, Badge } from '@/components/ui/feedback';
import { ConfirmDialog, Tabs } from '@/components/ui/overlays';
import { ColorField } from '@/components/ui/color-field';
import { ImageUpload } from '@/components/ui/image-upload';
import { ImagePlus, Loader2 } from 'lucide-react';
import { PhoneMockup } from '@/components/loyalty/pass-preview';
import { MysteryEditor, prizesValid, starterPrizes } from '@/components/loyalty/mystery-editor';
import { stampIcons } from '@/components/loyalty/stamp-strip';
import { GarukaMark } from '@/components/brand/garuka-mark';
import { THEMES } from '@/lib/card-presets';
import { cn } from '@/lib/cn';
import { analyseLogo, type LogoResult } from '@/lib/logo-canvas';
import { REWARD_FITS } from '@/lib/wallet/reward-first';
import type { Campaign, CardLink, FieldType, FormField, Location } from '@/lib/data/types';
import { activateAction, saveCardLocationsAction, saveDesignAction, saveFieldsAction } from '../../actions';

// dashboard language, shared with the new-card wizard: bordered raised panels, accent ring + tint when chosen
const panel = 'rounded-lg border border-border bg-surface-raised p-5 shadow-card';
const chipCls = 'grid size-11 place-items-center rounded-md border border-border bg-surface-raised text-text transition-colors duration-[var(--tk-motion-fast)] hover:border-border-input peer-checked:border-accent peer-checked:bg-accent-subtle peer-checked:text-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:opacity-50';

/** Store an image (a data: URL from the logo analysis, or an existing image URL) on the card; returns its URL. */
async function attachImage(campaignId: string, kind: 'logo' | 'stamp', src: string): Promise<string> {
  const blob = await (await fetch(src)).blob();
  const fd = new FormData(); fd.set('file', new File([blob], `${kind}.png`, { type: blob.type || 'image/png' })); fd.set('kind', kind); fd.set('campaignId', campaignId);
  const r = await fetch('/api/images', { method: 'POST', body: fd }).catch(() => null);
  if (!r) throw new Error('No connection. Try again.');
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error ?? 'That didn’t upload. Try again.');
  return body.url as string;
}

// Unsaved edits live in sessionStorage while the owner moves between the card's
// sections (Overview, Customers, ...), so leaving the designer never silently
// throws them away. Only what the owner changed is kept: on return it is laid
// over the latest saved card, so a draft can't undo a newer save from elsewhere.
type Draft = { base: Campaign; c: Campaign; baseFields: FormField[]; fields: FormField[]; baseLocIds: string[]; locIds: string[] };
const draftKey = (id: string) => `garuka:designer-draft:${id}`;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function readDraft(id: string): Draft | null {
  try { const raw = sessionStorage.getItem(draftKey(id)); return raw ? (JSON.parse(raw) as Draft) : null; } catch { return null; }
}
function writeDraft(id: string, d: Draft | null) {
  try { if (d) sessionStorage.setItem(draftKey(id), JSON.stringify(d)); else sessionStorage.removeItem(draftKey(id)); } catch { /* storage blocked: nothing to keep */ }
}
/** The draft's own edits, laid over the latest saved card. */
function applyDraft(latest: Campaign, d: Draft): Campaign {
  const out = { ...latest } as Record<string, unknown>;
  const base = d.base as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(d.c)) {
    if (same(v, base[k])) continue;
    if (k === 'design' || k === 'reward') {
      const sub = { ...(out[k] as Record<string, unknown>) };
      for (const [kk, vv] of Object.entries(v as Record<string, unknown>)) if (!same(vv, (base[k] as Record<string, unknown>)?.[kk])) sub[kk] = vv;
      out[k] = sub;
    } else out[k] = v;
  }
  return out as unknown as Campaign;
}

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
  const [restored, setRestored] = useState(false);
  const [playing, setPlaying] = useState(true); // self-filling preview; touching the stepper pauses it
  const loaded = useRef(campaign);

  const set = <K extends keyof Campaign>(k: K, v: Campaign[K]) => setC((x) => ({ ...x, [k]: v }));
  const setDesign = (k: keyof Campaign['design'], v: string | undefined) => setC((x) => ({ ...x, design: { ...x.design, [k]: v } }));
  // compare only what the owner edits: server-managed fields (updatedAt, lastPushedAt...) change on every save
  const editable = (x: Campaign) => { const { updatedAt: _u, lastPushedAt: _l, createdAt: _c, activatedAt: _a, status: _s, ...rest } = x; return rest; };
  const dirty = useMemo(() => JSON.stringify([editable(c), fields, [...locIds].sort()]) !== JSON.stringify([editable(campaign), campaign.fields, [...campaign.locationIds].sort()]), [c, fields, locIds, campaign]);

  // Bring back unsaved edits left behind when the owner opened another section.
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const d = readDraft(campaign.id);
    if (!d) return;
    const next = applyDraft(campaign, d);
    const nextFields = same(d.fields, d.baseFields) ? campaign.fields : d.fields;
    const nextLocs = same([...d.locIds].sort(), [...d.baseLocIds].sort()) ? campaign.locationIds : d.locIds;
    if (same(editable(next), editable(campaign)) && same(nextFields, campaign.fields) && same(nextLocs, campaign.locationIds)) { writeDraft(campaign.id, null); return; }
    loaded.current = campaign;
    setC(next); setFields(nextFields); setLocIds(nextLocs); setRestored(true);
  }, [campaign]);

  // Keep the draft in step with the editor; drop it once everything is saved.
  useEffect(() => {
    if (!hydrated.current) return;
    if (!dirty) { writeDraft(campaign.id, null); return; }
    writeDraft(campaign.id, { base: loaded.current, c, baseFields: loaded.current.fields, fields, baseLocIds: loaded.current.locationIds, locIds });
  }, [c, fields, locIds, dirty, campaign.id]);

  // A save refreshes `campaign`; later drafts are measured from the new saved state.
  useEffect(() => { if (!dirty) loaded.current = campaign; }, [campaign, dirty]);

  // Closing or reloading the browser tab with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const discard = () => {
    writeDraft(campaign.id, null);
    setC(campaign); setFields(campaign.fields); setLocIds(campaign.locationIds); setRestored(false); setMsg(null);
  };

  const save = () => start(async () => {
    setMsg(null);
    const full = {
      name: c.name, programName: c.programName, description: c.description, howToEarn: c.howToEarn, terms: c.terms, hideTerms: c.hideTerms,
      stampMessage: c.stampMessage, rewardMessage: c.rewardMessage, reward: c.reward, design: c.design, links: c.links,
      prizes: c.prizes, ...(live ? {} : { rewardMode: c.rewardMode }),
      consentEnabled: c.consentEnabled, consentText: c.consentText, defaultCountry: c.defaultCountry,
      stampCooldownMinutes: c.stampCooldownMinutes, maxStampsPerTransaction: c.maxStampsPerTransaction, maxStampsPerDay: c.maxStampsPerDay,
      stampValueCents: c.stampValueCents,
      ...(live ? {} : { totalStamps: c.totalStamps, expiryMode: c.expiryMode, expiryDate: c.expiryDate, expiryDays: c.expiryDays }),
    };
    // only the fields THIS tab changed since it loaded, merged onto the latest saved card on
    // the server, so a stale tab can't silently undo another tab's newer edits (F03-E2)
    const base = campaign as unknown as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(full)) {
      if (k === 'design' || k === 'reward') {
        const sub = Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([kk, vv]) => JSON.stringify(vv) !== JSON.stringify((base[k] as Record<string, unknown>)?.[kk])));
        if (Object.keys(sub).length) patch[k] = sub;
      } else if (JSON.stringify(v) !== JSON.stringify(base[k])) patch[k] = v;
    }
    const steps = [() => saveDesignAction(c.id, patch)];
    if (JSON.stringify(fields) !== JSON.stringify(campaign.fields)) steps.push(() => saveFieldsAction(c.id, fields));
    if (JSON.stringify([...locIds].sort()) !== JSON.stringify([...campaign.locationIds].sort())) steps.push(() => saveCardLocationsAction(c.id, locIds));
    for (const step of steps) {
      const r = await step();
      if (r.error) { setMsg({ tone: 'danger', text: r.error }); return; }
    }
    writeDraft(campaign.id, null); setRestored(false);
    setMsg({ tone: 'success', text: live ? 'Saved. Use “Update all cards” on the overview to push changes to customers’ phones.' : 'Saved.' });
    router.refresh();
  });

  const design = {
    business: c.programName, programName: c.programName, reward: c.reward.name || 'Your reward', total: c.totalStamps,
    filled: Math.min(previewStamps, c.totalStamps), icon: c.design.icon, background: c.design.background,
    foreground: c.design.foreground, label: c.design.label, stamp: c.design.stamp, logoText: c.design.logoText, logoUrl: c.design.logoUrl, stampUrl: c.design.stampUrl,
  };

  // ---- logo → design (the same browser-side analysis as the new-card wizard, lib/logo-canvas) ----
  const [logo, setLogo] = useState<LogoResult | null>(null);
  const [reading, setReading] = useState(false);
  const [logoMsg, setLogoMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const lastStamp = useRef<string | undefined>(campaign.design.stampUrl); // to bring a custom stamp back after picking a preset
  const [stampBusy, setStampBusy] = useState(false);

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    setReading(true); setLogoMsg(null);
    try {
      const r = await analyseLogo(file);
      const wordmark = r.wordmark ? await attachImage(c.id, 'logo', r.wordmark) : undefined;
      const symbol = r.symbol ? await attachImage(c.id, 'stamp', r.symbol) : undefined;
      if (symbol) lastStamp.current = symbol;
      setLogo(r);
      setC((x) => ({ ...x, design: {
        ...x.design, ...r.theme,
        ...(wordmark ? { logoUrl: wordmark, logoText: '' } : {}),
        ...(symbol ? { stampUrl: symbol } : {}),
      } }));
      const found = ({ 'icon-text': 'We found a symbol and a wordmark.', 'icon-top': 'We found a symbol above a wordmark.', icon: 'We found a symbol.', text: 'We found a wordmark.' } as const)[r.layout];
      setLogoMsg({ tone: 'ok', text: `${found} The card now uses them and your logo’s colours. Save to keep the colours.` });
      router.refresh();
    } catch (e) { setLogoMsg({ tone: 'error', text: (e as Error).message }); }
    setReading(false);
  };

  const pickTheme = (t: { background: string; foreground: string; label: string; stamp: string }) =>
    setC((x) => ({ ...x, design: { ...x.design, background: t.background, foreground: t.foreground, label: t.label, stamp: t.stamp } }));
  const themeOn = (t: { background: string; foreground: string; label: string; stamp: string }) =>
    [t.background, t.foreground, t.label, t.stamp].join().toLowerCase() === [c.design.background, c.design.foreground, c.design.label, c.design.stamp].join().toLowerCase();
  const themes = [...(logo ? [{ id: 'logo', name: 'From your logo', ...logo.theme }] : []), ...THEMES];

  // stamp images are stored on the card straight away (like the uploads below), so switching is immediate
  const pickIcon = (key: string) => {
    setDesign('icon', key);
    if (!c.design.stampUrl) return;
    setStampBusy(true);
    void fetch('/api/images', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'stamp', campaignId: c.id }) })
      .finally(() => { setStampBusy(false); router.refresh(); });
    setDesign('stampUrl', undefined);
  };
  const pickCustomStamp = async () => {
    const url = lastStamp.current;
    if (!url || c.design.stampUrl) return;
    setStampBusy(true);
    try { const next = await attachImage(c.id, 'stamp', url); setDesign('stampUrl', next); lastStamp.current = next; router.refresh(); }
    catch (e) { setLogoMsg({ tone: 'error', text: (e as Error).message }); }
    setStampBusy(false);
  };
  const customStamp = c.design.stampUrl ?? lastStamp.current;

  const designTab = (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="designer-logo-title" className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="designer-logo-title" className="text-base font-bold tracking-[-0.01em]">Design it from your logo</h2>
            <p className="text-sm text-text-muted">Upload your logo and we set the colours, the header and the stamp from it.</p>
          </div>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-pill border border-border bg-surface-raised px-4 text-sm font-semibold hover:bg-surface has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
            {reading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ImagePlus aria-hidden className="size-4" />}
            {logo ? 'Use another logo' : 'Upload your logo'}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" aria-label={logo ? 'Use another logo' : 'Upload your logo'} disabled={reading}
              onChange={(e) => { void onLogo(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
        <p role="status" className={cn('text-sm empty:hidden', logoMsg?.tone === 'error' ? 'mt-3 font-medium text-danger' : 'mt-3')}>{logoMsg?.text}</p>
        {logo && (
          <div className="mt-3 flex w-fit items-center gap-3 rounded-md p-3" style={{ background: logo.theme.background }}>
            {logo.symbol && <img src={logo.symbol} alt="Logo symbol" className="size-10 object-contain" />}
            {logo.wordmark && <img src={logo.wordmark} alt="Logo wordmark" className="h-8 max-w-[160px] object-contain" />}
          </div>
        )}
      </section>

      <section aria-labelledby="designer-names-title" className={panel}>
        <h2 id="designer-names-title" className="mb-4 text-base font-bold tracking-[-0.01em]">Names</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Card name" hint="Only you see this."><TextInput value={c.name} maxLength={60} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Name on the card" hint="Your business or programme name."><TextInput value={c.programName} maxLength={40} onChange={(e) => set('programName', e.target.value)} /></Field>
          <Field label="Logo text" hint="Shown next to the logo on Apple passes. Leave empty when the logo has your name in it."><TextInput value={c.design.logoText} maxLength={24} onChange={(e) => setDesign('logoText', e.target.value)} /></Field>
        </div>
      </section>

      <section aria-labelledby="designer-colours-title" className={panel}>
        <h2 id="designer-colours-title" className="text-base font-bold tracking-[-0.01em]">Colours</h2>
        <fieldset className="mt-3">
          <legend className="sr-only">Colour presets</legend>
          <div className="flex flex-wrap gap-2">
            {themes.map((t) => (
              <label key={t.id} className="cursor-pointer">
                <input type="radio" name="designer-theme" value={t.id} checked={themeOn(t)} onChange={() => pickTheme(t)} className="peer sr-only" />
                <span className="sr-only">{t.name}</span>
                <span aria-hidden title={t.name} className="grid size-9 place-items-center rounded-pill ring-offset-2 ring-offset-[var(--tk-color-surface-raised)] peer-checked:ring-2 peer-checked:ring-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-focus" style={{ background: t.background }}>
                  <span className="size-3 rounded-pill" style={{ background: t.stamp }} />
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <ColorField label="Card background" value={c.design.background} onChange={(v) => setDesign('background', v)} against={c.design.foreground} againstLabel="text colour" />
          <ColorField label="Text" value={c.design.foreground} onChange={(v) => setDesign('foreground', v)} against={c.design.background} againstLabel="background" />
          <ColorField label="Labels" value={c.design.label} onChange={(v) => setDesign('label', v)} against={c.design.background} againstLabel="background" />
          <ColorField label="Stamps" value={c.design.stamp} onChange={(v) => setDesign('stamp', v)} against={c.design.background} againstLabel="background" />
        </div>
      </section>

      <section aria-labelledby="designer-stamp-title" className={panel}>
        <h2 id="designer-stamp-title" className="text-base font-bold tracking-[-0.01em]">Stamp</h2>
        <fieldset className="mt-3" disabled={stampBusy} aria-busy={stampBusy || undefined}>
          <legend className="sr-only">Stamp</legend>
          <div className="flex flex-wrap gap-2">
            {customStamp && (
              <label className="cursor-pointer">
                <input type="radio" name="designer-icon" value="custom" checked={!!c.design.stampUrl} onChange={() => void pickCustomStamp()} className="peer sr-only" />
                <span className="sr-only">Your logo</span>
                <span aria-hidden className={chipCls}><img src={customStamp} alt="" className="size-6 object-contain" /></span>
              </label>
            )}
            {Object.entries(stampIcons).map(([key, Icon]) => (
              <label key={key} className="cursor-pointer">
                <input type="radio" name="designer-icon" value={key} checked={!c.design.stampUrl && c.design.icon === key} onChange={() => pickIcon(key)} className="peer sr-only" />
                <span className="sr-only">{key}</span>
                <span aria-hidden className={chipCls}><Icon className="size-5" /></span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-5 flex flex-wrap items-end gap-8">
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-2 text-sm font-semibold">Stamps for a reward {live && <Badge>Locked</Badge>}</span>
          {live ? <p className="tabular text-xl font-bold">{c.totalStamps}</p> : <Stepper label="Stamps for a reward" value={c.totalStamps} onChange={(v) => set('totalStamps', v)} min={1} max={30} />}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Preview with</span>
          <Stepper label="Preview stamps" value={design.filled} onChange={(v) => { setPlaying(false); setPreviewStamps(v); }} min={0} max={c.totalStamps} />
        </div>
        </div>
      </section>

      <section aria-labelledby="designer-images-title" className={panel}>
        <h2 id="designer-images-title" className="text-base font-bold tracking-[-0.01em]">Images</h2>
        <p className="mb-4 text-sm text-text-muted">Upload them one by one if you’d rather not start from the logo.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <ImageUpload label="Logo" kind="logo" campaignId={c.id} url={c.design.logoUrl} hint="Wide PNG with a transparent background, at least 160×50 (best 480×150)."
            onChange={(u) => { setDesign('logoUrl', u as string); router.refresh(); }} />
          <ImageUpload label="Icon" kind="icon" campaignId={c.id} url={c.design.iconUrl} hint="Square, at least 87×87. Shown in notifications."
            onChange={(u) => { setDesign('iconUrl', u as string); router.refresh(); }} />
          <ImageUpload label="Custom stamp" kind="stamp" campaignId={c.id} url={c.design.stampUrl} hint="Square, at least 100×100. Replaces the icon on filled stamps."
            onChange={(u) => { setDesign('stampUrl', u as string); if (u) lastStamp.current = u as string; router.refresh(); }} />
        </div>
      </section>
    </div>
  );

  // switching to a mystery box keeps the old reward as the common prize; switching back takes the first prize
  const setMode = (mode: 'single' | 'mystery') => setC((x) => mode === x.rewardMode ? x : mode === 'mystery'
    ? { ...x, rewardMode: 'mystery', prizes: x.prizes.length >= 2 ? x.prizes : starterPrizes(x.reward.name), reward: { ...x.reward, name: 'Mystery box' } }
    : { ...x, rewardMode: 'single', reward: { ...x.reward, name: x.prizes[0]?.name || '' } });

  const detailsTab = (
    <div className="flex flex-col gap-5">
      <fieldset disabled={live}>
        <legend className="text-sm font-semibold">A full card gets</legend>
        <div className="mt-2 inline-flex gap-1 rounded-md bg-surface p-1">
          {([['single', 'One reward'], ['mystery', 'Mystery box']] as const).map(([v, l]) => (
            <label key={v} className={live ? 'cursor-not-allowed' : 'cursor-pointer'}>
              <input type="radio" name="designer-reward-mode" value={v} checked={c.rewardMode === v} onChange={() => setMode(v)} className="peer sr-only" />
              <span className="flex h-9 items-center rounded-sm px-3.5 text-sm font-medium text-text-muted peer-checked:bg-surface-raised peer-checked:font-semibold peer-checked:text-text peer-checked:shadow-card peer-focus-visible:ring-2 peer-focus-visible:ring-focus">{l}</span>
            </label>
          ))}
        </div>
        {live && <p className="mt-2 text-xs text-text-muted">Locked after the card went live. You can still edit the prizes.</p>}
      </fieldset>
      {c.rewardMode === 'single' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reward" required hint={c.reward.name.length > REWARD_FITS ? `It’s the big text on wallet passes, and Apple cuts it off after about ${REWARD_FITS} characters. Try something shorter, and put the rest in Reward details.` : `What customers get, e.g. “Free coffee”. It’s the big text on the card, so up to ${REWARD_FITS} characters fits best.`}><TextInput value={c.reward.name} maxLength={60} onChange={(e) => set('reward', { ...c.reward, name: e.target.value })} /></Field>
          <Field label="Reward details" hint="Optional, e.g. “Any hot drink, any size”."><TextInput value={c.reward.details} maxLength={120} onChange={(e) => set('reward', { ...c.reward, details: e.target.value })} /></Field>
        </div>
      ) : (
        <MysteryEditor prizes={c.prizes} onChange={(prizes) => set('prizes', prizes)} idPrefix="designer-prize" />
      )}
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8">
      <div className="flex min-w-0 flex-col gap-5">
        {restored && dirty && (
          <Banner tone="info" title="Your unsaved changes are back"
            action={<Button variant="secondary" size="sm" onClick={discard}>Discard changes</Button>}>
            You left this page before saving. Save to keep them, or discard to go back to the saved card.
          </Banner>
        )}
        {live && <Banner tone="info" title="This card is live">The number of stamps and expiry are locked. Colours and text can still change.</Banner>}
        <Tabs tabs={[
          { value: 'design', label: 'Design', content: designTab },
          { value: 'details', label: 'Details', hasError: !c.reward.name.trim() || (c.rewardMode === 'mystery' && !prizesValid(c.prizes)), content: detailsTab },
          { value: 'form', label: 'Signup form', hasError: !hasContact, content: formTab },
          { value: 'locations', label: 'Locations', content: locationsTab },
          { value: 'terms', label: 'Terms & limits', content: termsTab },
        ]} />
        {msg && <Banner tone={msg.tone} title={msg.text} />}
        <div className="sticky bottom-0 z-[10] -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-bg px-4 py-3 shadow-pop sm:mx-0 sm:rounded-lg sm:border sm:px-4">
          <Button onClick={save} loading={pending} disabled={!dirty}><Save aria-hidden className="size-4" /> {dirty ? 'Save changes' : 'Saved'}</Button>
          {!live && (
            <ConfirmDialog
              trigger={<Button variant="secondary" disabled={dirty || !c.reward.name.trim() || !hasContact || (c.rewardMode === 'mystery' && !prizesValid(c.prizes))}><Rocket aria-hidden className="size-4" /> Go live</Button>}
              title={`Make “${c.name}” live?`} action="Go live" tone="primary"
              onConfirm={() => start(async () => { const r = await activateAction(c.id); if (r?.error) setMsg({ tone: 'danger', text: r.error }); })}
            >
              You’ll get a link and QR code for customers. After this, the number of stamps ({c.totalStamps}) and the expiry rule can’t change.
            </ConfirmDialog>
          )}
          {dirty && !live && <span className="text-xs text-text-muted">Save before going live.</span>}
        </div>
      </div>
      {/* stage: the card in a phone, the same as the new-card wizard */}
      <aside aria-label="Card preview" className="relative flex min-h-[680px] items-center justify-center overflow-hidden rounded-lg bg-[radial-gradient(90%_70%_at_80%_10%,rgba(255,178,63,.55),transparent_60%),radial-gradient(80%_80%_at_10%_100%,var(--tk-color-night),transparent_70%),linear-gradient(160deg,var(--tk-color-jacaranda),var(--tk-color-accent-hover))] py-8 lg:sticky lg:top-6">
        <GarukaMark className="pointer-events-none absolute -bottom-24 -right-20 size-[380px] opacity-[.14]" ring="#ffffff" dot="#ffffff" />
        <PhoneMockup design={design} playing={playing} onPlayingChange={setPlaying} views
          onTap={() => { setPlaying(false); setPreviewStamps((f) => (Math.min(f, c.totalStamps) >= c.totalStamps ? 0 : Math.min(f, c.totalStamps) + 1)); }} />
      </aside>
    </div>
  );
}

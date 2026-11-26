'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, Gift, MapPin, Palette, Rocket, SlidersHorizontal, Store } from 'lucide-react';
import { Banner } from '@/components/ui/feedback';
import { Field, TextInput } from '@/components/ui/field';
import { PhoneMockup } from '@/components/loyalty/pass-preview';
import { stampIcons } from '@/components/loyalty/stamp-strip';
import { GarukaMark } from '@/components/brand/garuka-mark';
import { MysteryEditor, prizesValid, starterPrizes } from '@/components/loyalty/mystery-editor';
import { BUSINESS_TYPES, STAMP_CHOICES, THEMES, themeById } from '@/lib/card-presets';
import { cn } from '@/lib/cn';
import type { Prize } from '@/lib/data/types';
import { analyseLogo, type LogoResult } from '@/lib/logo-canvas';
import { ImagePlus, Loader2 } from 'lucide-react';
import { createCardFromWizardAction } from '@/app/(app)/cards/actions';

// New-card wizard, inside the dashboard shell. The question card, tiles, inputs and
// review list use the same bordered-card language as the rest of the dashboard; the
// pill buttons and the phone stage keep the StampMate-derived treatment
// (replica/design/reference-stampmate.md). Colours, type, mark and copy are Garuka's.

type StepId = 'intro' | 'type' | 'look' | 'reward' | 'where' | 'review';
type State = {
  typeId: string | null; name: string; nameTouched: boolean; programName: string; themeId: string; icon: string;
  totalStamps: number; reward: string; locIds: string[]; step: number;
  rewardMode: 'single' | 'mystery'; prizes: Prize[];
  logo: LogoResult | null; logoStamp: boolean;
};
const KEY = 'garuka:new-card';
const ICON_NAMES: Record<string, string> = { cup: 'Cup', soda: 'Juice', scissors: 'Scissors', dumbbell: 'Dumbbell', utensils: 'Plate', croissant: 'Croissant', star: 'Star', heart: 'Heart', paw: 'Paw', flower: 'Flower' };

// dashboard language: bordered raised surfaces, accent ring + tint when chosen
const tileCls = 'relative flex w-full flex-col items-start justify-between gap-3 rounded-md border border-border bg-surface-raised p-4 text-left text-sm font-semibold shadow-card transition-[border-color,background-color] duration-[var(--tk-motion-fast)] hover:border-border-input';
const tileOn = 'border-accent bg-accent-subtle hover:border-accent';
const chipCls = 'grid h-11 min-w-11 place-items-center rounded-md border border-border bg-surface-raised px-3 text-base font-semibold tabular text-text transition-colors duration-[var(--tk-motion-fast)] hover:border-border-input peer-checked:border-accent peer-checked:bg-accent-subtle peer-checked:text-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus';
const inputCls = 'h-12';
const pillPrimary = 'inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-pill bg-accent px-5 text-base font-semibold text-on-accent shadow-[0_12px_26px_-10px_rgba(106,59,224,.7)] transition-[background-color,transform] duration-[var(--tk-motion-fast)] hover:bg-accent-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none';

export function CardWizard({ orgName, locations }: { orgName: string; locations: { id: string; name: string }[] }) {
  const steps: StepId[] = ['intro', 'type', 'look', 'reward', ...(locations.length ? (['where'] as const) : []), 'review'];
  const questions = steps.length - 1; // the intro isn't counted
  const initial: State = { typeId: null, name: '', nameTouched: false, programName: orgName, themeId: 'jacaranda', icon: 'star', totalStamps: 10, reward: '', locIds: locations.map((l) => l.id), step: 0, rewardMode: 'single', prizes: [], logo: null, logoStamp: true };
  const [s, setS] = useState<State>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [playing, setPlaying] = useState(true);
  const [filled, setFilled] = useState(3);
  const heading = useRef<HTMLHeadingElement>(null);
  const [hydrated, setHydrated] = useState(false);

  // keep answers through a reload of this tab
  useEffect(() => {
    try { const raw = sessionStorage.getItem(KEY); if (raw) setS({ ...initial, ...(JSON.parse(raw) as State) }); } catch { /* storage blocked */ }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // only save once the saved answers are back, or the empty start would overwrite them
  useEffect(() => { if (hydrated) { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ } } }, [s, hydrated]);

  const stepId = steps[Math.min(s.step, steps.length - 1)];
  const go = (step: number) => { setError(null); setS((x) => ({ ...x, step: Math.max(0, Math.min(steps.length - 1, step)) })); };
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } heading.current?.focus(); }, [s.step]);

  const pickType = (id: string) => {
    const t = BUSINESS_TYPES.find((b) => b.id === id)!;
    setS((x) => ({ ...x, typeId: id, icon: t.icon, reward: t.reward, totalStamps: t.stamps, themeId: t.theme, name: x.nameTouched ? x.name : t.cardName, step: steps.indexOf('look') }));
    setFilled(Math.min(3, t.stamps)); setPlaying(true); setError(null);
  };

  const [reading, setReading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    setReading(true); setLogoError(null);
    try {
      const logo = await analyseLogo(file);
      setS((x) => ({ ...x, logo, logoStamp: !!logo.symbol, themeId: 'logo' }));
    } catch (e) { setLogoError((e as Error).message); }
    setReading(false);
  };
  const logoTheme = s.logo ? { id: 'logo', name: 'From your logo', ...s.logo.theme } : null;
  const theme = s.themeId === 'logo' && logoTheme ? logoTheme : themeById(s.themeId);
  const type = BUSINESS_TYPES.find((b) => b.id === s.typeId);
  const design = {
    business: s.programName || orgName, programName: s.programName || orgName,
    reward: s.rewardMode === 'mystery' ? 'Mystery box' : s.reward || type?.reward || 'Your reward',
    total: s.totalStamps, filled: Math.min(filled, s.totalStamps), icon: s.icon,
    background: theme.background, foreground: theme.foreground, label: theme.label, stamp: theme.stamp,
    logoText: s.logo?.wordmark ? '' : (s.programName || orgName).slice(0, 24),
    logoUrl: s.logo?.wordmark, stampUrl: s.logo?.symbol && s.logoStamp ? s.logo.symbol : undefined,
  };
  const canNext = stepId === 'look' ? !!s.name.trim() : stepId === 'reward' ? (s.rewardMode === 'mystery' ? prizesValid(s.prizes) : !!s.reward.trim()) : true;

  const create = (goLive: boolean) => start(async () => {
    setError(null);
    // success redirects away, so forget the answers now and put them back on an error
    try { sessionStorage.removeItem(KEY); } catch { /* storage blocked */ }
    const r = await createCardFromWizardAction({
      name: s.name, programName: s.programName, icon: s.icon, totalStamps: s.totalStamps,
      reward: s.rewardMode === 'mystery' ? 'Mystery box' : s.reward, rewardMode: s.rewardMode, prizes: s.rewardMode === 'mystery' ? s.prizes : [],
      theme: { background: theme.background, foreground: theme.foreground, label: theme.label, stamp: theme.stamp },
      locationIds: s.locIds, goLive,
      logo: s.logo ? { wordmark: s.logo.wordmark, symbol: s.logoStamp ? s.logo.symbol : undefined } : undefined,
    });
    if (r?.error) {
      try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
      setError(r.error);
      if (r.step) setS((x) => ({ ...x, step: steps.indexOf(r.step === 2 ? 'look' : 'reward') }));
    }
  });

  // what the intro lists: the questions ahead, in order
  const ahead = [
    { icon: Store, t: 'Your kind of business', d: 'We suggest a stamp, a reward and colours.' },
    { icon: Palette, t: 'How the card looks', d: 'Names, colours and the stamp.' },
    { icon: Gift, t: 'What a full card gets', d: 'One reward, or a mystery box of prizes.' },
    ...(locations.length ? [{ icon: MapPin, t: 'Where it works', d: 'The locations customers can use it at.' }] : []),
    { icon: Rocket, t: 'Go live or fine-tune', d: 'Get your QR code now, or keep it as a draft.' },
  ];

  const title: Record<StepId, string> = {
    intro: 'Make a stamp card in a minute.', type: 'What kind of business is it?', look: 'How should the card look?',
    reward: 'What does a full card get?', where: 'Where can customers use it?', review: 'Ready to go?',
  };
  const lead: Record<StepId, string> = {
    intro: 'A few quick questions and your card is ready. Watch it come together on the phone as you answer.',
    type: 'We’ll suggest a stamp, a reward and colours. You can change all of it.',
    look: 'Name it, pick colours and a stamp. The phone follows along.',
    reward: 'Fewer stamps fill faster. Most shops pick between 6 and 10.',
    where: 'Customers can collect stamps at the locations you tick.',
    review: 'Go live now and get your QR code, or fine-tune the details first.',
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8">
        {stepId === 'intro'
          ? <Link href="/cards" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text hover:underline"><ArrowLeft aria-hidden className="size-4" />All cards</Link>
          : <button type="button" onClick={() => go(s.step - 1)} className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text hover:underline"><ArrowLeft aria-hidden className="size-4" />Back</button>}
        {stepId !== 'intro' && (
          <div className="flex min-w-[220px] flex-1 items-center justify-end gap-3 sm:flex-none">
            <div className="h-1.5 w-full max-w-[200px] overflow-hidden rounded-pill bg-nav-active" role="progressbar" aria-label="New card progress" aria-valuemin={1} aria-valuemax={questions} aria-valuenow={s.step}>
              <div className="h-full rounded-pill bg-accent transition-[width] duration-[var(--tk-motion-base)] ease-out" style={{ width: `${(s.step / questions) * 100}%` }} />
            </div>
            <p className="shrink-0 text-sm tabular text-text-muted">Step {s.step} of {questions}</p>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8">
      {/* question card */}
      <section aria-labelledby="wizard-title" className="flex min-w-0 flex-col rounded-lg border border-border bg-surface-raised p-5 shadow-card sm:p-8">
        <h1 id="wizard-title" ref={heading} tabIndex={-1}
          className={cn('text-balance font-extrabold outline-none tracking-[-0.035em]', stepId === 'intro' ? 'text-[2.5rem] leading-[1.02] sm:text-[3rem]' : 'text-3xl')}>
          {title[stepId]}
        </h1>
        <p className="mt-3 max-w-[52ch] text-base text-text-muted">{lead[stepId]}</p>

        <div className="mt-6 flex-1">
          {stepId === 'intro' && (
            <ol className="divide-y divide-border rounded-md border border-border">
              {ahead.map(({ icon: Icon, t, d }) => (
                <li key={t} className="flex items-center gap-4 px-4 py-3.5">
                  <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-sm bg-accent-subtle text-accent"><Icon className="size-[18px]" /></span>
                  <span className="min-w-0 flex-1"><span className="block font-semibold">{t}</span><span className="block text-sm text-text-muted">{d}</span></span>
                </li>
              ))}
            </ol>
          )}

          {stepId === 'type' && (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BUSINESS_TYPES.map((b) => {
                const Icon = stampIcons[b.icon];
                const on = s.typeId === b.id;
                return (
                  <li key={b.id}>
                    <button type="button" aria-pressed={on} onClick={() => pickType(b.id)} className={cn(tileCls, 'min-h-[100px]', on && tileOn)}>
                      <span aria-hidden className="grid size-9 place-items-center rounded-sm bg-accent-subtle text-accent"><Icon className="size-5" /></span>
                      {b.label}
                      {on && <Check aria-hidden className="absolute right-3.5 top-3.5 size-4 text-accent" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {stepId === 'look' && (
            <div className="flex flex-col gap-5">
              <section aria-labelledby="logo-title" className="rounded-md border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 id="logo-title" className="text-sm font-semibold tracking-normal">Logo <span className="font-normal text-text-muted">(optional)</span></h2>
                    <p className="text-xs text-text-muted">{s.logo ? ({ 'icon-text': 'We found a symbol and a wordmark.', 'icon-top': 'We found a symbol above a wordmark.', icon: 'We found a symbol.', text: 'We found a wordmark.' } as const)[s.logo.layout] + ' The card now uses them and your logo’s colours.' : 'Add it and we design the card from it: colours, header and stamp.'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-pill border border-border bg-surface-raised px-4 text-sm font-semibold hover:bg-surface has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
                      {reading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ImagePlus aria-hidden className="size-4" />}
                      {s.logo ? 'Change logo' : 'Upload your logo'}
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" aria-label={s.logo ? 'Change logo' : 'Upload your logo'}
                        onChange={(e) => { void onLogo(e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                    {s.logo && <button type="button" onClick={() => setS((x) => ({ ...x, logo: null, themeId: x.themeId === 'logo' ? (type?.theme ?? 'jacaranda') : x.themeId }))} className="text-sm font-semibold text-text-muted hover:text-text hover:underline">Remove</button>}
                  </div>
                </div>
                {logoError && <p role="alert" className="mt-3 text-sm text-danger">{logoError}</p>}
                {s.logo && (
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3 rounded-md p-3" style={{ background: s.logo.theme.background }}>
                      {s.logo.symbol && <img src={s.logo.symbol} alt="Logo symbol" className="size-10 object-contain" />}
                      {s.logo.wordmark && <img src={s.logo.wordmark} alt="Logo wordmark" className="h-8 max-w-[160px] object-contain" />}
                    </div>
                    {s.logo.symbol && (
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" className="size-4 accent-[var(--tk-color-accent)]" checked={s.logoStamp} onChange={(e) => setS((x) => ({ ...x, logoStamp: e.target.checked }))} />
                        Use the symbol as your stamp
                      </label>
                    )}
                  </div>
                )}
              </section>
              <Field label="Card name" hint="Only you see this, e.g. “Coffee card”.">
                <TextInput className={inputCls} value={s.name} maxLength={60} autoFocus onChange={(e) => setS((x) => ({ ...x, name: e.target.value, nameTouched: true }))} />
              </Field>
              <Field label="Name on the card" hint="Your business or programme name. Customers see this.">
                <TextInput className={inputCls} value={s.programName} maxLength={40} onChange={(e) => setS((x) => ({ ...x, programName: e.target.value }))} />
              </Field>
              <fieldset>
                <legend className="text-sm font-semibold">Colours</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[...(logoTheme ? [logoTheme] : []), ...THEMES].map((t) => (
                    <label key={t.id} className="cursor-pointer">
                      <input type="radio" name="theme" value={t.id} checked={s.themeId === t.id} onChange={() => setS((x) => ({ ...x, themeId: t.id }))} className="peer sr-only" />
                      <span className="sr-only">{t.name}</span>
                      <span aria-hidden title={t.name} className="grid size-9 place-items-center rounded-pill ring-offset-2 ring-offset-[var(--tk-color-surface-raised)] peer-checked:ring-2 peer-checked:ring-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-focus" style={{ background: t.background }}>
                        <span className="size-3 rounded-pill" style={{ background: t.stamp }} />
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-sm font-semibold">Stamp</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(stampIcons).map(([k, Icon]) => (
                    <label key={k} className="cursor-pointer">
                      <input type="radio" name="icon" value={k} checked={s.icon === k} onChange={() => setS((x) => ({ ...x, icon: k }))} className="peer sr-only" />
                      <span className="sr-only">{ICON_NAMES[k] ?? k}</span>
                      <span aria-hidden className={cn(chipCls, 'w-11 px-0')}><Icon className="size-5" /></span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {stepId === 'reward' && (
            <div className="flex flex-col gap-5">
              <fieldset>
                <legend className="text-sm font-semibold">Stamps to fill the card</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {STAMP_CHOICES.map((v) => (
                    <label key={v} className="cursor-pointer">
                      <input type="radio" name="stamps" value={v} checked={s.totalStamps === v} onChange={() => { setS((x) => ({ ...x, totalStamps: v })); setFilled(Math.min(filled, v)); }} className="peer sr-only" />
                      <span className={chipCls}>{v}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="sr-only">A full card gets</legend>
                <div className="inline-flex gap-1 rounded-md bg-surface p-1">
                  {([['single', 'One reward'], ['mystery', 'Mystery box']] as const).map(([v, l]) => (
                    <label key={v} className="cursor-pointer">
                      <input type="radio" name="rewardMode" value={v} checked={s.rewardMode === v} className="peer sr-only"
                        onChange={() => setS((x) => ({ ...x, rewardMode: v, prizes: v === 'mystery' && x.prizes.length < 2 ? starterPrizes(x.reward) : x.prizes }))} />
                      <span className="flex h-9 items-center rounded-sm px-3.5 text-sm font-medium text-text-muted peer-checked:bg-surface-raised peer-checked:font-semibold peer-checked:text-text peer-checked:shadow-card peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-focus">{l}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {s.rewardMode === 'single' ? (
                <Field label="Reward" required hint="What a full card gets, e.g. “Free coffee”.">
                  <TextInput className={inputCls} value={s.reward} maxLength={60} onChange={(e) => setS((x) => ({ ...x, reward: e.target.value }))} />
                </Field>
              ) : (
                <MysteryEditor prizes={s.prizes} onChange={(prizes) => setS((x) => ({ ...x, prizes }))} idPrefix="wizard-prize" />
              )}
            </div>
          )}

          {stepId === 'where' && (
            <fieldset>
              <legend className="sr-only">Locations</legend>
              <ul className="flex flex-col gap-2">
                {locations.map((l) => (
                  <li key={l.id}>
                    <label className={cn(tileCls, 'cursor-pointer flex-row items-center justify-start gap-3 has-[:checked]:border-accent has-[:checked]:bg-accent-subtle')}>
                      <input type="checkbox" className="size-5 accent-[var(--tk-color-accent)]" checked={s.locIds.includes(l.id)}
                        onChange={(e) => setS((x) => ({ ...x, locIds: e.target.checked ? [...x.locIds, l.id] : x.locIds.filter((i) => i !== l.id) }))} />
                      {l.name}
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-text-muted">Untick all to decide later. Add locations from the Locations page.</p>
            </fieldset>
          )}

          {stepId === 'review' && (
            <dl className="divide-y divide-border rounded-md border border-border">
              {([
                ['Card name', s.name, 'look'], ['Name on the card', s.programName || orgName, 'look'],
                ['Colours and stamp', `${theme.name}, ${s.logo?.symbol && s.logoStamp ? 'your logo’s symbol' : ICON_NAMES[s.icon] ?? s.icon}`, 'look'],
                ['Reward', s.rewardMode === 'mystery' ? `Mystery box of ${s.prizes.length} prizes after ${s.totalStamps} stamps` : `${s.reward} after ${s.totalStamps} stamps`, 'reward'],
                ...(locations.length ? [['Locations', s.locIds.length ? locations.filter((l) => s.locIds.includes(l.id)).map((l) => l.name).join(', ') : 'Decide later', 'where'] as const] : []),
              ] as const).map(([k, v, to]) => (
                <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 px-4 py-3">
                  <dt className="text-sm text-text-muted">{k}</dt>
                  <dd className="col-start-1 break-words font-medium">{v}</dd>
                  <dd className="col-start-2 row-span-2 row-start-1 self-center">
                    <button type="button" onClick={() => go(steps.indexOf(to))} className="text-sm font-semibold text-accent hover:underline">Change<span className="sr-only"> {k.toLowerCase()}</span></button>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {error && <div className="mt-5"><Banner tone="danger" title={error} /></div>}

        <div className="mt-6 flex flex-col gap-2.5">
          {stepId === 'intro' && <button type="button" className={pillPrimary} onClick={() => go(1)}>Start<ArrowRight aria-hidden className="size-4" /></button>}
          {(stepId === 'look' || stepId === 'reward' || stepId === 'where') && (
            <button type="button" className={pillPrimary} disabled={!canNext} onClick={() => go(s.step + 1)}>Next<ArrowRight aria-hidden className="size-4" /></button>
          )}
          {stepId === 'review' && (
            <>
              <button type="button" className={pillPrimary} disabled={pending} aria-busy={pending || undefined} onClick={() => create(true)}><Rocket aria-hidden className="size-4" />Create and go live</button>
              <button type="button" disabled={pending} onClick={() => create(false)} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-pill bg-surface text-sm font-semibold text-text hover:bg-nav-active disabled:opacity-40">
                <SlidersHorizontal aria-hidden className="size-4" />Fine-tune in the designer first
              </button>
              <p className="text-center text-xs text-text-muted">Going live locks the number of stamps ({s.totalStamps}). Colours and texts can still change later.</p>
            </>
          )}
          {stepId === 'intro' && <p className="text-center text-xs text-text-muted">Nothing goes live until you say so.</p>}
        </div>
      </section>

      {/* stage: the card in a phone */}
      <aside aria-label="Card preview" className="relative flex min-h-[640px] lg:sticky lg:top-6 items-center justify-center overflow-hidden rounded-lg bg-[radial-gradient(90%_70%_at_80%_10%,rgba(255,178,63,.55),transparent_60%),radial-gradient(80%_80%_at_10%_100%,var(--tk-color-night),transparent_70%),linear-gradient(160deg,var(--tk-color-jacaranda),var(--tk-color-accent-hover))] py-8">
        <GarukaMark className="pointer-events-none absolute -bottom-24 -right-20 size-[380px] opacity-[.14]" ring="#ffffff" dot="#ffffff" />
        <p className="sr-only" aria-live="polite">{design.programName}: {design.total}-stamp card, reward {design.reward}.</p>
        <PhoneMockup design={design} playing={playing} onPlayingChange={setPlaying}
          onTap={() => { setPlaying(false); setFilled((f) => (f >= s.totalStamps ? 0 : f + 1)); }} />
      </aside>
      </div>
    </>
  );
}

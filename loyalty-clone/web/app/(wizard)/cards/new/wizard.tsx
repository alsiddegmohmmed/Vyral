'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { ArrowLeft, ArrowRight, Check, Rocket, SlidersHorizontal } from 'lucide-react';
import { Banner } from '@/components/ui/feedback';
import { Field, TextInput } from '@/components/ui/field';
import { PhoneMockup } from '@/components/loyalty/pass-preview';
import { stampIcons } from '@/components/loyalty/stamp-strip';
import { GarukaMark } from '@/components/brand/garuka-mark';
import { MysteryEditor, prizesValid, starterPrizes } from '@/components/loyalty/mystery-editor';
import { BUSINESS_TYPES, STAMP_CHOICES, THEMES, themeById } from '@/lib/card-presets';
import { cn } from '@/lib/cn';
import type { Prize } from '@/lib/data/types';
import { createCardFromWizardAction } from '@/app/(app)/cards/actions';

// New-card wizard. Structure and proportions follow StampMate's /start (measured,
// see replica/design/reference-stampmate.md): a two-part frame, a white question
// card and a stage with the card in a phone. Everything you see is Garuka's own:
// colours, type, mark, phone drawing, wording and presets.

type StepId = 'intro' | 'type' | 'look' | 'reward' | 'where' | 'review';
type State = {
  typeId: string | null; name: string; nameTouched: boolean; programName: string; themeId: string; icon: string;
  totalStamps: number; reward: string; locIds: string[]; step: number;
  rewardMode: 'single' | 'mystery'; prizes: Prize[];
};
const KEY = 'garuka:new-card';
const ICON_NAMES: Record<string, string> = { cup: 'Cup', soda: 'Juice', scissors: 'Scissors', dumbbell: 'Dumbbell', utensils: 'Plate', croissant: 'Croissant', star: 'Star', heart: 'Heart', paw: 'Paw', flower: 'Flower' };

// shared pieces of the measured look
const tileCls = 'relative flex w-full flex-col items-start justify-between gap-2.5 rounded-[20px] bg-surface p-3.5 text-left text-sm font-medium transition-colors duration-[var(--tk-motion-fast)] hover:bg-nav-active';
const chipCls = 'grid h-12 min-w-12 place-items-center rounded-[14px] bg-surface px-3 font-mono text-base tabular text-text peer-checked:bg-accent-subtle peer-checked:text-accent peer-checked:ring-2 peer-checked:ring-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus';
const inputCls = 'h-12 rounded-[14px] border-transparent bg-surface px-4 text-base focus:border-accent';
const pillPrimary = 'inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-pill bg-accent px-5 text-base font-semibold text-on-accent shadow-[0_12px_26px_-10px_rgba(106,59,224,.7)] transition-[background-color,transform] duration-[var(--tk-motion-fast)] hover:bg-accent-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none';

export function CardWizard({ orgName, locations }: { orgName: string; locations: { id: string; name: string }[] }) {
  const steps: StepId[] = ['intro', 'type', 'look', 'reward', ...(locations.length ? (['where'] as const) : []), 'review'];
  const questions = steps.length - 1; // the intro isn't counted
  const initial: State = { typeId: null, name: '', nameTouched: false, programName: orgName, themeId: 'jacaranda', icon: 'star', totalStamps: 10, reward: '', locIds: locations.map((l) => l.id), step: 0, rewardMode: 'single', prizes: [] };
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

  const theme = themeById(s.themeId);
  const type = BUSINESS_TYPES.find((b) => b.id === s.typeId);
  const design = {
    business: s.programName || orgName, programName: s.programName || orgName,
    reward: s.rewardMode === 'mystery' ? 'Mystery box' : s.reward || type?.reward || 'Your reward',
    total: s.totalStamps, filled: Math.min(filled, s.totalStamps), icon: s.icon,
    background: theme.background, foreground: theme.foreground, label: theme.label, stamp: theme.stamp, logoText: (s.programName || orgName).slice(0, 24),
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
    });
    if (r?.error) {
      try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
      setError(r.error);
      if (r.step) setS((x) => ({ ...x, step: steps.indexOf(r.step === 2 ? 'look' : 'reward') }));
    }
  });

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
  const n = String(s.step).padStart(2, '0');

  return (
    <div className="grid gap-4 rounded-[44px] bg-[radial-gradient(120%_80%_at_30%_0%,var(--tk-color-paper),var(--tk-color-nav-active))] p-3 shadow-[0_40px_90px_-30px_rgba(0,0,0,.6)] sm:p-4 lg:min-h-[672px] lg:grid-cols-[minmax(0,1.11fr)_minmax(0,1fr)]">
      {/* question card */}
      <section aria-labelledby="wizard-title" className="flex min-w-0 flex-col rounded-[32px] bg-white px-5 pb-6 pt-6 text-text sm:px-[30px] sm:pb-[30px] sm:pt-7">
        {stepId === 'intro' ? (
          <p className="font-mono text-[11px] uppercase tracking-[.08em] text-text-muted">Garuka · New card</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={() => go(s.step - 1)} className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-surface pl-2 pr-3 text-[13px] font-medium text-text-muted hover:text-text">
                <ArrowLeft aria-hidden className="size-4" />Back
              </button>
              <p className="flex items-baseline gap-1.5">
                <span className="sr-only">Step {s.step} of {questions}</span>
                <b aria-hidden className="font-mono text-[26px] font-medium leading-none tracking-tight text-accent tabular">{n}</b>
                <span aria-hidden className="font-mono text-xs text-text-muted tabular">/ {String(questions).padStart(2, '0')}</span>
              </p>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-pill bg-surface" role="progressbar" aria-label="New card progress" aria-valuemin={1} aria-valuemax={questions} aria-valuenow={s.step}>
              <div className="h-full rounded-pill bg-accent transition-[width] duration-[var(--tk-motion-base)] ease-out" style={{ width: `${(s.step / questions) * 100}%` }} />
            </div>
          </>
        )}

        <h1 id="wizard-title" ref={heading} tabIndex={-1}
          className={cn('outline-none', stepId === 'intro' ? 'mt-6 max-w-[11ch] text-[44px] leading-[1] tracking-[-0.045em] sm:text-[60px]' : 'mt-6 text-[30px] leading-[1.05] tracking-[-0.04em] sm:text-[38px]')}>
          {title[stepId]}
        </h1>
        <p className="mt-3 max-w-[46ch] text-[15px] leading-[1.5] text-text-muted">{lead[stepId]}</p>

        <div className="mt-6 flex-1">
          {stepId === 'intro' && (
            <ul className="grid grid-cols-3 gap-2">
              {[
                { n: String(questions), l: 'quick questions', c: 'bg-accent text-on-accent' },
                { n: '1', l: 'minute', c: 'bg-[var(--tk-color-night)] text-white' },
                { n: '0', l: 'apps for customers', c: 'bg-[var(--tk-color-sunrise)] text-[var(--tk-color-night)]' },
              ].map((t) => (
                <li key={t.l} className={cn('flex min-h-[83px] flex-col justify-between rounded-[20px] px-4 py-3.5', t.c)}>
                  <span className="font-mono text-[28px] font-medium leading-none tabular">{t.n}</span>
                  <span className="text-[13px] font-medium leading-tight">{t.l}</span>
                </li>
              ))}
            </ul>
          )}

          {stepId === 'type' && (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BUSINESS_TYPES.map((b) => {
                const Icon = stampIcons[b.icon];
                const on = s.typeId === b.id;
                return (
                  <li key={b.id}>
                    <button type="button" aria-pressed={on} onClick={() => pickType(b.id)} className={cn(tileCls, 'min-h-[96px]', on && 'bg-accent-subtle ring-2 ring-accent')}>
                      <Icon aria-hidden className="size-[22px] text-accent" />
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
              <Field label="Card name" hint="Only you see this, e.g. “Coffee card”.">
                <TextInput className={inputCls} value={s.name} maxLength={60} autoFocus onChange={(e) => setS((x) => ({ ...x, name: e.target.value, nameTouched: true }))} />
              </Field>
              <Field label="Name on the card" hint="Your business or programme name. Customers see this.">
                <TextInput className={inputCls} value={s.programName} maxLength={40} onChange={(e) => setS((x) => ({ ...x, programName: e.target.value }))} />
              </Field>
              <fieldset>
                <legend className="text-sm font-semibold">Colours</legend>
                <div className="mt-2 flex flex-wrap gap-2 rounded-[20px] bg-surface p-3">
                  {THEMES.map((t) => (
                    <label key={t.id} className="cursor-pointer">
                      <input type="radio" name="theme" value={t.id} checked={s.themeId === t.id} onChange={() => setS((x) => ({ ...x, themeId: t.id }))} className="peer sr-only" />
                      <span className="sr-only">{t.name}</span>
                      <span aria-hidden title={t.name} className="grid size-9 place-items-center rounded-pill ring-offset-2 ring-offset-[var(--tk-color-surface)] peer-checked:ring-2 peer-checked:ring-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-focus" style={{ background: t.background }}>
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
                      <span aria-hidden className={cn(chipCls, 'w-12 px-0')}><Icon className="size-5" /></span>
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
                <div className="inline-flex gap-1 rounded-pill bg-surface p-1">
                  {([['single', 'One reward'], ['mystery', 'Mystery box']] as const).map(([v, l]) => (
                    <label key={v} className="cursor-pointer">
                      <input type="radio" name="rewardMode" value={v} checked={s.rewardMode === v} className="peer sr-only"
                        onChange={() => setS((x) => ({ ...x, rewardMode: v, prizes: v === 'mystery' && x.prizes.length < 2 ? starterPrizes(x.reward) : x.prizes }))} />
                      <span className="flex h-9 items-center rounded-pill px-4 text-sm font-medium text-text-muted peer-checked:bg-white peer-checked:text-text peer-checked:shadow-card peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-focus">{l}</span>
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
                    <label className={cn(tileCls, 'flex-row items-center justify-start gap-3 py-4 has-[:checked]:bg-accent-subtle has-[:checked]:ring-2 has-[:checked]:ring-accent')}>
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
            <dl className="divide-y divide-white overflow-hidden rounded-[20px] bg-surface">
              {([
                ['Card name', s.name, 'look'], ['Name on the card', s.programName || orgName, 'look'], ['Colours and stamp', `${theme.name}, ${ICON_NAMES[s.icon] ?? s.icon}`, 'look'],
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
          {stepId === 'intro' && <p className="text-xs text-text-muted">Nothing goes live until you say so.</p>}
        </div>
      </section>

      {/* stage: the card in a phone */}
      <aside aria-label="Card preview" className="relative flex min-h-[560px] items-center justify-center overflow-hidden rounded-[32px] bg-[radial-gradient(90%_70%_at_80%_10%,rgba(255,178,63,.55),transparent_60%),radial-gradient(80%_80%_at_10%_100%,var(--tk-color-night),transparent_70%),linear-gradient(160deg,var(--tk-color-jacaranda),var(--tk-color-accent-hover))] py-8">
        <GarukaMark className="pointer-events-none absolute -bottom-24 -right-20 size-[380px] opacity-[.14]" ring="#ffffff" dot="#ffffff" />
        <p className="sr-only" aria-live="polite">{design.programName}: {design.total}-stamp card, reward {design.reward}.</p>
        <PhoneMockup design={design} playing={playing} onPlayingChange={setPlaying}
          onTap={() => { setPlaying(false); setFilled((f) => (f >= s.totalStamps ? 0 : f + 1)); }} />
      </aside>
    </div>
  );
}

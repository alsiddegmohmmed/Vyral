'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { ArrowLeft, ArrowRight, Check, Rocket, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/feedback';
import { Field, TextInput } from '@/components/ui/field';
import { PassPreview } from '@/components/loyalty/pass-preview';
import { MysteryEditor, prizesValid, starterPrizes } from '@/components/loyalty/mystery-editor';
import type { Prize } from '@/lib/data/types';
import { stampIcons } from '@/components/loyalty/stamp-strip';
import { BUSINESS_TYPES, STAMP_CHOICES, THEMES, themeById } from '@/lib/card-presets';
import { cn } from '@/lib/cn';
import { createCardFromWizardAction } from '../actions';

// New-card wizard. One question per screen with the card beside it, updating as
// you answer (mechanism studied from StampMate's public wizard; steps, copy and
// presets are ours). Answers survive a reload in this browser tab.

type StepId = 'type' | 'look' | 'reward' | 'where' | 'review';
type State = {
  typeId: string | null; name: string; nameTouched: boolean; programName: string; themeId: string; icon: string;
  totalStamps: number; reward: string; locIds: string[]; step: number;
  rewardMode: 'single' | 'mystery'; prizes: Prize[];
};
const KEY = 'garuka:new-card';
const ICON_NAMES: Record<string, string> = { cup: 'Cup', soda: 'Juice', scissors: 'Scissors', dumbbell: 'Dumbbell', utensils: 'Plate', croissant: 'Croissant', star: 'Star', heart: 'Heart', paw: 'Paw', flower: 'Flower' };

export function CardWizard({ orgName, locations }: { orgName: string; locations: { id: string; name: string }[] }) {
  const steps: StepId[] = ['type', 'look', 'reward', ...(locations.length ? (['where'] as const) : []), 'review'];
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
    setS((x) => ({ ...x, typeId: id, icon: t.icon, reward: t.reward, totalStamps: t.stamps, themeId: t.theme, name: x.nameTouched ? x.name : t.cardName, step: 1 }));
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
    // a redirect means success; clear the saved answers
    if (r?.error) {
      try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
      setError(r.error);
      if (r.step) setS((x) => ({ ...x, step: steps.indexOf(r.step === 2 ? 'look' : 'reward') }));
    }
  });

  const title: Record<StepId, string> = {
    type: 'What kind of business is it?', look: 'How should the card look?', reward: 'What does a full card get?',
    where: 'Where can customers use it?', review: 'Ready to go?',
  };
  const lead: Record<StepId, string> = {
    type: 'We’ll suggest a stamp, a reward and colours. You can change all of it.',
    look: 'Name it, pick colours and a stamp. The card on the right follows along.',
    reward: 'Fewer stamps fill faster. Most shops pick between 6 and 10.',
    where: 'Customers can collect stamps at the locations you tick.',
    review: 'Go live now and get your QR code, or fine-tune the details first.',
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <section aria-labelledby="wizard-title" className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          {s.step === 0
            ? <Link href="/cards" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text hover:underline"><ArrowLeft aria-hidden className="size-4" />All cards</Link>
            : <button type="button" onClick={() => go(s.step - 1)} className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text hover:underline"><ArrowLeft aria-hidden className="size-4" />Back</button>}
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">New card · step <span className="tabular">{s.step + 1} of {steps.length}</span></p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-pill bg-surface" role="progressbar" aria-label="New card progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={s.step + 1}>
          <div className="h-full rounded-pill bg-accent transition-[width] duration-[var(--tk-motion-base)] ease-out" style={{ width: `${((s.step + 1) / steps.length) * 100}%` }} />
        </div>
        <h1 id="wizard-title" ref={heading} tabIndex={-1} className="mt-6 text-3xl outline-none">{title[stepId]}</h1>
        <p className="mt-2 text-base text-text-muted">{lead[stepId]}</p>

        <div className="mt-6">
          {stepId === 'type' && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {BUSINESS_TYPES.map((b) => {
                const Icon = stampIcons[b.icon];
                const on = s.typeId === b.id;
                return (
                  <li key={b.id}>
                    <button type="button" aria-pressed={on} onClick={() => pickType(b.id)}
                      className={cn('relative flex h-full min-h-[96px] w-full flex-col items-start justify-between gap-3 rounded-lg border bg-surface-raised p-4 text-left font-semibold shadow-card transition-colors duration-[var(--tk-motion-fast)] hover:border-border-input',
                        on ? 'border-accent bg-accent-subtle' : 'border-border')}>
                      <Icon aria-hidden className="size-5 text-accent" />
                      {b.label}
                      {on && <Check aria-hidden className="absolute right-3 top-3 size-4 text-accent" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {stepId === 'look' && (
            <div className="flex max-w-xl flex-col gap-6">
              <Field label="Card name" hint="Only you see this, e.g. “Coffee card”.">
                <TextInput value={s.name} maxLength={60} autoFocus onChange={(e) => setS((x) => ({ ...x, name: e.target.value, nameTouched: true }))} />
              </Field>
              <Field label="Name on the card" hint="Your business or programme name. Customers see this.">
                <TextInput value={s.programName} maxLength={40} onChange={(e) => setS((x) => ({ ...x, programName: e.target.value }))} />
              </Field>
              <fieldset>
                <legend className="text-sm font-semibold">Colours</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {THEMES.map((t) => (
                    <label key={t.id} className="cursor-pointer">
                      <input type="radio" name="theme" value={t.id} checked={s.themeId === t.id} onChange={() => setS((x) => ({ ...x, themeId: t.id }))} className="peer sr-only" />
                      <span className="sr-only">{t.name}</span>
                      <span aria-hidden title={t.name} className="grid size-11 place-items-center rounded-pill border-2 border-transparent ring-offset-2 peer-checked:border-accent peer-focus-visible:ring-2 peer-focus-visible:ring-focus" style={{ background: t.background }}>
                        <span className="size-3.5 rounded-pill" style={{ background: t.stamp }} />
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-text-muted">Exact colours, your logo and a custom stamp can be set in the designer.</p>
              </fieldset>
              <fieldset>
                <legend className="text-sm font-semibold">Stamp</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(stampIcons).map(([k, Icon]) => (
                    <label key={k} className="cursor-pointer">
                      <input type="radio" name="icon" value={k} checked={s.icon === k} onChange={() => setS((x) => ({ ...x, icon: k }))} className="peer sr-only" />
                      <span className="sr-only">{ICON_NAMES[k] ?? k}</span>
                      <span aria-hidden className="grid size-11 place-items-center rounded-md border border-border bg-surface-raised text-text peer-checked:border-accent peer-checked:bg-accent-subtle peer-checked:text-accent peer-focus-visible:ring-2 peer-focus-visible:ring-focus"><Icon className="size-5" /></span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {stepId === 'reward' && (
            <div className="flex max-w-xl flex-col gap-6">
              <fieldset>
                <legend className="text-sm font-semibold">Stamps to fill the card</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {STAMP_CHOICES.map((n) => (
                    <label key={n} className="cursor-pointer">
                      <input type="radio" name="stamps" value={n} checked={s.totalStamps === n} onChange={() => { setS((x) => ({ ...x, totalStamps: n })); setFilled(Math.min(filled, n)); }} className="peer sr-only" />
                      <span className="grid h-11 min-w-12 place-items-center rounded-md border border-border bg-surface-raised px-3 text-base font-semibold tabular peer-checked:border-accent peer-checked:bg-accent-subtle peer-checked:text-accent peer-focus-visible:ring-2 peer-focus-visible:ring-focus">{n}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-text-muted">Need more than 12? Set up to 30 in the designer before going live.</p>
              </fieldset>
              <fieldset>
                <legend className="text-sm font-semibold">A full card gets</legend>
                <div className="mt-2 inline-flex gap-1 rounded-md bg-surface p-1">
                  {([['single', 'One reward'], ['mystery', 'Mystery box']] as const).map(([v, l]) => (
                    <label key={v} className="cursor-pointer">
                      <input type="radio" name="rewardMode" value={v} checked={s.rewardMode === v} className="peer sr-only"
                        onChange={() => setS((x) => ({ ...x, rewardMode: v, prizes: v === 'mystery' && x.prizes.length < 2 ? starterPrizes(x.reward) : x.prizes }))} />
                      <span className="flex h-9 items-center rounded-sm px-3.5 text-sm font-medium text-text-muted peer-checked:bg-surface-raised peer-checked:font-semibold peer-checked:text-text peer-checked:shadow-card peer-focus-visible:ring-2 peer-focus-visible:ring-focus">{l}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {s.rewardMode === 'single' ? (
                <Field label="Reward" required hint="What a full card gets, e.g. “Free coffee”.">
                  <TextInput value={s.reward} maxLength={60} onChange={(e) => setS((x) => ({ ...x, reward: e.target.value }))} />
                </Field>
              ) : (
                <MysteryEditor prizes={s.prizes} onChange={(prizes) => setS((x) => ({ ...x, prizes }))} idPrefix="wizard-prize" />
              )}
            </div>
          )}

          {stepId === 'where' && (
            <fieldset className="max-w-xl">
              <legend className="sr-only">Locations</legend>
              <ul className="flex flex-col gap-2">
                {locations.map((l) => (
                  <li key={l.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-surface-raised p-4 font-medium has-[:checked]:border-accent has-[:checked]:bg-accent-subtle">
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
            <dl className="max-w-xl divide-y divide-border rounded-lg border border-border bg-surface-raised">
              {([
                ['Card name', s.name, 1], ['Name on the card', s.programName || orgName, 1], ['Colours and stamp', `${theme.name}, ${ICON_NAMES[s.icon] ?? s.icon}`, 1],
                ['Reward', s.rewardMode === 'mystery' ? `Mystery box of ${s.prizes.length} prizes after ${s.totalStamps} stamps` : `${s.reward} after ${s.totalStamps} stamps`, 2],
                ...(locations.length ? [['Locations', s.locIds.length ? locations.filter((l) => s.locIds.includes(l.id)).map((l) => l.name).join(', ') : 'Decide later', 3] as const] : []),
              ] as const).map(([k, v, step]) => (
                <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 px-4 py-3">
                  <dt className="text-sm text-text-muted">{k}</dt>
                  <dd className="col-start-1 break-words font-medium">{v}</dd>
                  <dd className="col-start-2 row-span-2 row-start-1 self-center">
                    <button type="button" onClick={() => go(step)} className="text-sm font-semibold text-accent hover:underline">Change<span className="sr-only"> {k.toLowerCase()}</span></button>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {error && <div className="mt-6 max-w-xl"><Banner tone="danger" title={error} /></div>}

        {stepId !== 'type' && (
          <div className="mt-8 flex max-w-xl flex-wrap items-center gap-3 border-t border-border pt-5">
            {stepId === 'review' ? (
              <>
                <Button size="lg" loading={pending} onClick={() => create(true)}><Rocket aria-hidden className="size-4" />Create and go live</Button>
                <Button size="lg" variant="secondary" disabled={pending} onClick={() => create(false)}><SlidersHorizontal aria-hidden className="size-4" />Fine-tune in the designer first</Button>
                <p className="w-full text-xs text-text-muted">Going live locks the number of stamps ({s.totalStamps}). Colours and texts can still change later.</p>
              </>
            ) : (
              <Button size="lg" disabled={!canNext} onClick={() => go(s.step + 1)}>Next<ArrowRight aria-hidden className="size-4" /></Button>
            )}
          </div>
        )}
      </section>

      <aside aria-label="Card preview" className="flex justify-center lg:sticky lg:top-6">
        <PassPreview design={design} play={{ playing, onChange: setPlaying }}
          onTap={() => { setPlaying(false); setFilled((f) => (f >= s.totalStamps ? 0 : f + 1)); }} />
      </aside>
    </div>
  );
}

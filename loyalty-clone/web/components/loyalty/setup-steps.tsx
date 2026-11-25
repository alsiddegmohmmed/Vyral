import Link from 'next/link';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { buttonClass } from '@/components/ui/button';

// First-run setup, in order. The sign-up rail and the dashboard checklist both
// read this list, so the steps a new owner sees never drift between the two.
export const SETUP_STEPS = [
  { key: 'account', title: 'Create your account', hint: 'Business name and sign-in' },
  { key: 'card', title: 'Create a card', hint: 'Name your first loyalty card' },
  { key: 'design', title: 'Design it', hint: 'Reward, stamps and colours' },
  { key: 'live', title: 'Go live', hint: 'Open it for customers to join' },
  { key: 'qr', title: 'Print your QR code', hint: 'Done when your first customer joins' },
  { key: 'phone', title: 'Pair a counter phone', hint: 'Give stamps at the till' },
] as const;

export type SetupKey = (typeof SETUP_STEPS)[number]['key'];
export type StepState = 'done' | 'current' | 'upcoming';

/** Number or check in a circle. Decorative: the row text carries the state. */
export function StepMarker({ state, n }: { state: StepState; n: number }) {
  return (
    <span aria-hidden className={cn('grid size-7 shrink-0 place-items-center rounded-pill text-xs font-semibold tabular',
      state === 'done' ? 'bg-accent text-on-accent' : state === 'current' ? 'border-2 border-accent bg-bg text-text' : 'border border-border bg-bg text-text-muted')}>
      {state === 'done' ? <Check className="size-4" strokeWidth={3} /> : n}
    </span>
  );
}

/** Vertical step list for the sign-up rail (reference pattern: rail with done / current / locked rows). */
export function StepRail({ current }: { current: number }) {
  return (
    <ol className="flex flex-col gap-1">
      {SETUP_STEPS.map((s, i) => {
        const state: StepState = i < current ? 'done' : i === current ? 'current' : 'upcoming';
        return (
          <li key={s.key} aria-current={state === 'current' ? 'step' : undefined}
            className={cn('flex items-center gap-3 rounded-md px-3 py-2.5', state === 'current' && 'bg-nav-active')}>
            <StepMarker state={state} n={i + 1} />
            <span className="min-w-0 flex-1">
              <span className={cn('block text-sm font-medium', state === 'upcoming' && 'text-text-muted')}>{s.title}</span>
              <span className="block text-xs text-text-muted">{s.hint}</span>
            </span>
            {state === 'current' && <ChevronRight aria-hidden className="size-4 text-text-muted" />}
            <span className="sr-only">{state === 'done' ? '(done)' : state === 'current' ? '(current step)' : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}

export type ChecklistItem = { key: SetupKey; done: boolean; href?: string; cta?: string };

/**
 * Dashboard first-run checklist. Shows until every step is done.
 * The first open step is "current" and carries the only call to action,
 * so there is always one obvious next thing to do.
 */
export function SetupChecklist({ items }: { items: ChecklistItem[] }) {
  const byKey = new Map(items.map((i) => [i.key, i]));
  const rows = SETUP_STEPS.map((s): { title: string; hint: string } & ChecklistItem => ({ ...s, ...(byKey.get(s.key) ?? { key: s.key, done: true }) }));
  const doneCount = rows.filter((r) => r.done).length;
  if (doneCount === rows.length) return null;
  const currentIdx = rows.findIndex((r) => !r.done);
  const pct = Math.round((doneCount / rows.length) * 100);
  return (
    <section aria-labelledby="setup-title" className="overflow-hidden rounded-lg border border-border bg-surface-raised shadow-card">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Setup checklist</p>
          <h2 id="setup-title" className="mt-1 text-lg">Get ready for your first regular</h2>
        </div>
        <div className="flex min-w-[180px] items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-surface" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={rows.length} aria-valuenow={doneCount}>
            <div className="h-full rounded-pill bg-accent transition-[width] duration-[var(--tk-motion-slow)] ease-out" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm tabular text-text-muted">{doneCount} of {rows.length} done</span>
        </div>
      </div>
      <ol className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r, i) => {
          const state: StepState = r.done ? 'done' : i === currentIdx ? 'current' : 'upcoming';
          return (
            <li key={r.key} aria-current={state === 'current' ? 'step' : undefined}
              className={cn('flex items-start gap-3 bg-surface-raised px-5 py-4', state === 'current' && 'bg-accent-subtle')}>
              <StepMarker state={state} n={i + 1} />
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-medium', r.done && 'text-text-muted line-through decoration-border-input')}>
                  {r.title}<span className="sr-only">{r.done ? ' (done)' : ''}</span>
                </p>
                <p className="mt-0.5 text-xs text-text-muted">{r.hint}</p>
                {state === 'current' && r.href && r.cta && (
                  <Link href={r.href} className={cn(buttonClass('primary', 'sm'), 'mt-3')}>{r.cta}<ChevronRight aria-hidden className="size-4" /></Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

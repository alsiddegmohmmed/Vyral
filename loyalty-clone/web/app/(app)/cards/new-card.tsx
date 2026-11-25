import Link from 'next/link';
import { Plus } from 'lucide-react';
import { buttonClass } from '@/components/ui/button';

/** "New card" opens the step-by-step wizard at /cards/new; at the plan limit it becomes the upgrade link. */
export function NewCardButton({ atLimit, tile = false }: { atLimit: boolean; tile?: boolean }) {
  if (atLimit) {
    return <Link href="/settings/billing" className={buttonClass('secondary')}>Upgrade for more cards</Link>;
  }
  if (tile) {
    return (
      <Link href="/cards/new" className="flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-bg p-6 text-text-muted transition-colors duration-[var(--tk-motion-fast)] hover:border-border-input hover:bg-surface hover:text-text">
        <span aria-hidden className="grid size-11 place-items-center rounded-pill bg-surface"><Plus className="size-5" /></span>
        <span className="text-sm font-semibold text-text">New card</span>
        <span aria-hidden className="max-w-[200px] text-center text-xs">Start another design, e.g. a pastry or lunch card</span>
      </Link>
    );
  }
  return <Link href="/cards/new" className={buttonClass('primary')}><Plus aria-hidden className="size-4" /> New card</Link>;
}

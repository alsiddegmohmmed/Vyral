import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
const badgeTone: Record<Tone, string> = {
  neutral: 'bg-surface text-text-muted border border-border',
  info: 'bg-info-bg text-info',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={cn('inline-flex h-6 items-center gap-1 rounded-pill px-2.5 text-xs font-semibold', badgeTone[tone])}>{children}</span>;
}

const bannerIcon = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: AlertCircle } as const;
export function Banner({ tone = 'info', title, children, action }: {
  tone?: Exclude<Tone, 'neutral'>; title: string; children?: React.ReactNode; action?: React.ReactNode;
}) {
  const Icon = bannerIcon[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex flex-wrap items-start gap-3 rounded-md p-3.5', badgeTone[tone])}>
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-0.5 text-text">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <div className="grid size-14 place-items-center rounded-pill bg-surface text-text-muted [&>svg]:size-7">{icon}</div>
      <h3 className="text-lg">{title}</h3>
      <p className="max-w-sm text-sm text-text-muted">{children}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('rounded-md bg-[linear-gradient(90deg,var(--tk-color-surface),var(--tk-color-border),var(--tk-color-surface))] bg-[length:200%_100%] animate-[shimmer_1.2s_linear_infinite]', className)}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden className={cn('size-5 animate-spin', className)} />;
}

export function StatTile({ label, value, delta, period, loading }: {
  label: string; value?: string; delta?: number; period?: string; loading?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4 shadow-card" aria-busy={loading || undefined}>
      <p className="text-sm text-text-muted">{label}</p>
      {loading ? <Skeleton className="mt-2 h-8 w-24" /> : <p className="mt-1 text-2xl tabular">{value ?? '—'}</p>}
      {delta !== undefined && !loading && (
        <p className={cn('mt-1 text-xs font-semibold tabular', delta >= 0 ? 'text-success' : 'text-danger')}>
          {delta >= 0 ? '▲ +' : '▼ −'}{Math.abs(delta)}% <span className="font-normal text-text-muted">{period}</span>
        </p>
      )}
    </div>
  );
}

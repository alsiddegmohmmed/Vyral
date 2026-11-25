import Link from 'next/link';
import { LayoutGrid, Users, Smartphone } from 'lucide-react';
import { PageHeader } from '@/components/shell/app-shell';
import { Badge, EmptyState } from '@/components/ui/feedback';
import { StampStrip } from '@/components/loyalty/stamp-strip';
import { getBilling, listCampaigns, PLAN_LIMITS } from '@/lib/data/api';
import { requireOwner } from '@/lib/session';
import { NewCardButton } from './new-card';

const statusBadge = { live: <Badge tone="success">Live</Badge>, draft: <Badge>Draft</Badge>, paused: <Badge tone="warning">Paused</Badge>, archived: <Badge>Archived</Badge> };

export default async function CardsPage() {
  const ctx = await requireOwner();
  const [cards, billing] = await Promise.all([listCampaigns(ctx), getBilling(ctx)]);
  const limit = PLAN_LIMITS[billing.plan].designs;
  const atLimit = cards.length >= limit;
  return (
    <>
      <PageHeader title="Cards" description={`${cards.length} of ${limit} card ${limit === 1 ? 'design' : 'designs'} on your plan`} actions={<NewCardButton atLimit={atLimit} />} />
      {cards.length === 0 ? (
        <EmptyState icon={<LayoutGrid aria-hidden />} title="Make your first card" action={<NewCardButton atLimit={false} />}>
          Pick a reward, choose your colours, and share a QR code. Customers join in seconds.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <li key={c.id}>
              <Link href={c.status === 'draft' ? `/cards/${c.id}/design` : `/cards/${c.id}`} className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface-raised shadow-card transition-shadow hover:shadow-pop">
                <div className="p-4" style={{ background: c.design.background, color: c.design.foreground }}>
                  <p className="truncate text-sm font-semibold" style={{ color: c.design.label }}>{c.programName}</p>
                  <StampStrip total={c.totalStamps} filled={Math.ceil(c.totalStamps * 0.6)} icon={c.design.icon} stamp={c.design.stamp} empty={`${c.design.foreground}55`} background={c.design.background} className="mt-3 w-full" />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 break-words text-lg group-hover:underline">{c.name}</h2>
                    {statusBadge[c.status]}
                  </div>
                  <p className="text-sm text-text-muted">{c.totalStamps} stamps for {c.reward.name.toLowerCase() || 'a reward'}</p>
                  <p className="mt-auto flex gap-4 pt-2 text-sm tabular text-text-muted">
                    <span className="inline-flex items-center gap-1.5"><Users aria-hidden className="size-4" />{c.customers} customers</span>
                    <span className="inline-flex items-center gap-1.5"><Smartphone aria-hidden className="size-4" />{c.inWallet} in a wallet</span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

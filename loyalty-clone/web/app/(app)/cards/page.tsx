import Link from 'next/link';
import { ArrowRight, LayoutGrid, Users, Smartphone } from 'lucide-react';
import { PageHeader } from '@/components/shell/app-shell';
import { Badge, EmptyState } from '@/components/ui/feedback';
import { StampStrip } from '@/components/loyalty/stamp-strip';
import { SetupChecklist, type ChecklistItem } from '@/components/loyalty/setup-steps';
import { getBilling, listCampaigns, listDevices, PLAN_LIMITS } from '@/lib/data/api';
import { requireOwner } from '@/lib/session';
import { NewCardButton } from './new-card';

const statusBadge = { live: <Badge tone="success">Live</Badge>, draft: <Badge>Draft</Badge>, paused: <Badge tone="warning">Paused</Badge>, archived: <Badge>Archived</Badge> };

export default async function CardsPage() {
  const ctx = await requireOwner();
  const [cards, billing, devices] = await Promise.all([listCampaigns(ctx), getBilling(ctx), listDevices(ctx)]);
  const limit = PLAN_LIMITS[billing.plan].designs;
  const atLimit = cards.length >= limit;

  // First-run checklist, worked out from data the owner already created.
  const activated = cards.find((c) => c.status !== 'draft');
  const draft = cards.find((c) => c.status === 'draft');
  const designed = !!activated || cards.some((c) => c.updatedAt !== c.createdAt);
  const checklist: ChecklistItem[] = [
    { key: 'account', done: true },
    { key: 'card', done: cards.length > 0 },
    { key: 'design', done: designed, href: draft ? `/cards/${draft.id}/design` : undefined, cta: 'Open the designer' },
    { key: 'live', done: !!activated, href: draft ? `/cards/${draft.id}/design` : undefined, cta: 'Review and go live' },
    { key: 'qr', done: cards.some((c) => c.customers > 0), href: activated ? `/cards/${activated.id}` : undefined, cta: 'Get the QR code' },
    { key: 'phone', done: devices.length > 0, href: '/settings/devices', cta: 'Pair a phone' },
  ];

  return (
    <>
      <PageHeader title="Cards" description={`${cards.length} of ${limit} card ${limit === 1 ? 'design' : 'designs'} on your plan`} actions={<NewCardButton atLimit={atLimit} />} />
      <div className="flex flex-col gap-8">
        <SetupChecklist items={checklist} />
        {cards.length === 0 ? (
          <EmptyState icon={<LayoutGrid aria-hidden />} title="Make your first card" action={<NewCardButton atLimit={false} />}>
            Choose a reward and your colours, then print one QR code. Customers join from their own phone in seconds.
          </EmptyState>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((c) => (
              <li key={c.id}>
                <Link href={c.status === 'draft' ? `/cards/${c.id}/design` : `/cards/${c.id}`}
                  className="group flex h-full flex-col rounded-lg border border-border bg-surface-raised p-3 shadow-card transition-[box-shadow,border-color] duration-[var(--tk-motion-base)] ease-out hover:border-border-input hover:shadow-pop">
                  {/* pass face: the merchant's own colours, framed like the card in a wallet */}
                  <div className="rounded-md p-4 shadow-card" style={{ background: c.design.background, color: c.design.foreground }}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold" style={{ color: c.design.label }}>{c.programName}</p>
                      <p className="shrink-0 text-xs tabular" style={{ color: c.design.label }}>{c.totalStamps} stamps</p>
                    </div>
                    <StampStrip total={c.totalStamps} filled={Math.ceil(c.totalStamps * 0.6)} icon={c.design.icon} stamp={c.design.stamp} empty={`${c.design.foreground}55`} background={c.design.background} className="mt-3 w-full" />
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 px-1 pb-1 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="min-w-0 break-words text-lg">{c.name}</h2>
                      {statusBadge[c.status]}
                    </div>
                    <p className="text-sm text-text-muted">{c.totalStamps} stamps for {c.reward.name.toLowerCase() || 'a reward'}</p>
                    <p className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm tabular text-text-muted">
                      <span className="inline-flex items-center gap-1.5"><Users aria-hidden className="size-4" />{c.customers} customers</span>
                      <span className="inline-flex items-center gap-1.5"><Smartphone aria-hidden className="size-4" />{c.inWallet} in a wallet</span>
                    </p>
                    <span className="mt-auto flex items-center justify-between border-t border-border pt-3 text-sm font-semibold">
                      {c.status === 'draft' ? 'Continue designing' : 'Open card'}
                      <ArrowRight aria-hidden className="size-4 transition-transform duration-[var(--tk-motion-fast)] group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
            {!atLimit && <li><NewCardButton atLimit={false} tile /></li>}
          </ul>
        )}
      </div>
    </>
  );
}

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Gift, Minus, Smartphone, Stamp, Trash2, UserCog, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/feedback';
import { StampStrip } from '@/components/loyalty/stamp-strip';
import { DataError, getCardDetail } from '@/lib/data/api';
import { requireOwner } from '@/lib/session';
import type { CardEvent } from '@/lib/data/types';
import { CardActions } from './card-actions';

const EVENT: Record<CardEvent['type'], { icon: typeof Stamp; text: (e: CardEvent) => string }> = {
  enrolled: { icon: UserPlus, text: () => 'Joined' },
  stamped: { icon: Stamp, text: (e) => `${e.actorLabel ?? 'Someone'} added ${e.quantity} ${e.quantity === 1 ? 'stamp' : 'stamps'}` },
  unstamped: { icon: Minus, text: (e) => `${e.actorLabel ?? 'Someone'} removed ${e.quantity} ${e.quantity === 1 ? 'stamp' : 'stamps'}` },
  reward_earned: { icon: Gift, text: () => 'Earned a reward' },
  reward_redeemed: { icon: CheckCircle2, text: (e) => `${e.actorLabel ?? 'Someone'} gave a reward` },
  apple_installed: { icon: Smartphone, text: () => 'Added to Apple Wallet' },
  apple_removed: { icon: Smartphone, text: () => 'Removed from Apple Wallet' },
  google_saved: { icon: Smartphone, text: () => 'Saved to Google Wallet' },
  google_removed: { icon: Smartphone, text: () => 'Removed from Google Wallet' },
  message_sent: { icon: CheckCircle2, text: () => 'Got a message' },
  card_restored: { icon: CheckCircle2, text: () => 'Got their card link again' },
  card_deleted: { icon: Trash2, text: (e) => `${e.actorLabel ?? 'Someone'} deleted the card` },
  customer_updated: { icon: UserCog, text: (e) => `${e.actorLabel ?? 'Someone'} edited the details` },
};

export default async function CardDetailPage({ params }: { params: Promise<{ id: string; cardId: string }> }) {
  const { id, cardId } = await params;
  const ctx = await requireOwner();
  const d = await getCardDetail(ctx, cardId).catch((e) => { if (e instanceof DataError) notFound(); throw e; });
  if (d.card.campaignId !== id) notFound();
  const { card, customer, campaign } = d;
  return (
    <div className="flex flex-col gap-6">
      <Link href={`/cards/${id}/customers`} className="text-sm text-text-muted hover:text-text hover:underline">← All customers</Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="who" className="rounded-lg border border-border p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="who" className="break-words text-xl">{customer.name || 'No name'}</h2>
                <p className="text-sm text-text-muted">{[customer.phoneE164, customer.email].filter(Boolean).join(' · ')}</p>
                <p className="mt-1 text-xs text-text-muted">Joined {new Date(customer.createdAt).toLocaleDateString()} · {customer.marketingConsent ? 'Agreed to offers' : 'No offers'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {card.status === 'deleted' ? <Badge tone="danger">Deleted</Badge> : card.appleInstalled ? <Badge tone="info">Apple Wallet</Badge> : card.googleSaved ? <Badge tone="info">Google Wallet</Badge> : <Badge>Web card</Badge>}
                {card.rewardsAvailable > 0 && <Badge tone="success">{card.rewardsAvailable} reward ready</Badge>}
              </div>
            </div>
            <div className="mt-4 rounded-md p-4" style={{ background: campaign.design.background }}>
              <StampStrip total={campaign.totalStamps} filled={card.currentStamps} icon={campaign.design.icon} stamp={campaign.design.stamp} empty={`${campaign.design.foreground}55`} background={campaign.design.background} className="w-full max-w-md" />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[['Stamps now', `${card.currentStamps}/${campaign.totalStamps}`], ['Lifetime stamps', card.totalStampsEarned], ['Rewards earned', card.totalRewardsEarned], ['Rewards given', card.totalRewardsRedeemed]].map(([k, v]) => (
                <div key={String(k)} className="rounded-md bg-surface p-3"><dt className="text-xs text-text-muted">{k}</dt><dd className="tabular text-lg font-semibold">{v}</dd></div>
              ))}
            </dl>
          </section>
          <section aria-labelledby="history" className="rounded-lg border border-border p-5">
            <h2 id="history" className="text-lg">History</h2>
            {d.events.length === 0 ? <p className="mt-3 text-sm text-text-muted">Nothing yet.</p> : (
              <ol className="mt-4 flex flex-col">
                {d.events.map((e, i) => {
                  const E = EVENT[e.type];
                  return (
                    <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {i < d.events.length - 1 && <span aria-hidden className="absolute left-4 top-8 h-[calc(100%-24px)] w-px bg-border" />}
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface"><E.icon aria-hidden className="size-4" /></span>
                      <div><p className="text-sm">{E.text(e)}</p><time dateTime={e.createdAt} className="text-xs text-text-muted">{new Date(e.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time></div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
        {card.status === 'active' && (
          <CardActions campaignId={id} cardId={card.id} firstName={customer.name.split(' ')[0] || 'this customer'} current={card.currentStamps} rewards={card.rewardsAvailable}
            customer={{ name: customer.name, email: customer.email ?? '', phone: customer.phoneE164 ?? '' }} rewardName={campaign.reward.name} serial={card.serial} />
        )}
      </div>
    </div>
  );
}

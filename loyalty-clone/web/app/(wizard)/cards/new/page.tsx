import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { getBilling, getOrg, listCampaigns, listLocations, PLAN_LIMITS } from '@/lib/data/api';
import { requireOwner } from '@/lib/session';
import { CardWizard } from './wizard';

export const metadata = { title: 'New card' };

export default async function NewCardPage() {
  const ctx = await requireOwner();
  const [org, billing, cards, locations] = await Promise.all([getOrg(ctx), getBilling(ctx), listCampaigns(ctx), listLocations(ctx)]);
  const limit = PLAN_LIMITS[billing.plan].designs;
  if (cards.length >= limit) {
    return (
      <div className="mx-auto max-w-xl rounded-[32px] bg-white p-8 text-[var(--tk-color-night)]">
        <h1 className="text-3xl">Your plan includes {limit} card {limit === 1 ? 'design' : 'designs'}</h1>
        <p className="mt-2 text-text-muted">Archive a card you no longer use, or choose a bigger plan.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/settings/billing" className={buttonClass('primary', 'lg')}>Upgrade for more cards</Link>
          <Link href="/cards" className={buttonClass('secondary', 'lg')}>Back to cards</Link>
        </div>
      </div>
    );
  }
  return <CardWizard orgName={org.name} locations={locations.map((l) => ({ id: l.id, name: l.name }))} />;
}

import Link from 'next/link';
import { PageHeader } from '@/components/shell/app-shell';
import { EmptyState } from '@/components/ui/feedback';
import { buttonClass } from '@/components/ui/button';
import { LayoutGrid } from 'lucide-react';
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
      <>
        <PageHeader title="New card" back={{ href: '/cards', label: 'All cards' }} />
        <EmptyState icon={<LayoutGrid aria-hidden />} title={`Your plan includes ${limit} card ${limit === 1 ? 'design' : 'designs'}`}
          action={<Link href="/settings/billing" className={buttonClass('primary')}>Upgrade for more cards</Link>}>
          Archive a card you no longer use, or choose a bigger plan.
        </EmptyState>
      </>
    );
  }
  return <CardWizard orgName={org.name} locations={locations.map((l) => ({ id: l.id, name: l.name }))} />;
}

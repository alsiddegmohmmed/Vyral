import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell/app-shell';
import { Badge } from '@/components/ui/feedback';
import { DataError, getCampaign } from '@/lib/data/api';
import { requireOwner } from '@/lib/session';
import { CardTabs } from './tabs';

export default async function CardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOwner();
  const c = await getCampaign(ctx, id).catch((e) => { if (e instanceof DataError) notFound(); throw e; });
  const badge = c.status === 'live' ? <Badge tone="success">Live</Badge> : c.status === 'paused' ? <Badge tone="warning">Paused</Badge> : <Badge>Draft</Badge>;
  return (
    <>
      <PageHeader title={c.name} badge={badge} back={{ href: '/cards', label: 'All cards' }}
        description={`${c.totalStamps} stamps for ${c.reward.name.toLowerCase() || 'a reward'}`} />
      <CardTabs id={id} draft={c.status === 'draft'} />
      <div className="pt-6 sm:pt-8">{children}</div>
    </>
  );
}

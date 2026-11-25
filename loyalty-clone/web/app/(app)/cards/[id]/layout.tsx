import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/feedback';
import { DataError, getCampaign } from '@/lib/data/api';
import { requireOwner } from '@/lib/session';
import { CardTabs } from './tabs';

export default async function CardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOwner();
  const c = await getCampaign(ctx, id).catch((e) => { if (e instanceof DataError) notFound(); throw e; });
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 break-words text-2xl">{c.name}</h1>
        {c.status === 'live' ? <Badge tone="success">Live</Badge> : c.status === 'paused' ? <Badge tone="warning">Paused</Badge> : <Badge>Draft</Badge>}
      </div>
      <CardTabs id={id} draft={c.status === 'draft'} />
      <div className="pt-6">{children}</div>
    </>
  );
}

import { getCampaign, listLocations } from '@/lib/data/api';
import { requireOwner } from '@/lib/session';
import { Designer } from './designer';

export default async function DesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOwner();
  const [campaign, locations] = await Promise.all([getCampaign(ctx, id), listLocations(ctx)]);
  return <Designer campaign={campaign} locations={locations} />;
}

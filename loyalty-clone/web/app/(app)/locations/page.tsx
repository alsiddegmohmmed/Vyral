import { MapPin } from 'lucide-react';
import { PageHeader } from '@/components/shell/app-shell';
import { EmptyState } from '@/components/ui/feedback';
import { getBilling, listLocations, PLAN_LIMITS } from '@/lib/data/api';
import { requireOwner } from '@/lib/session';
import { DeleteLocation, LocationDialog } from './client';

export default async function LocationsPage() {
  const ctx = await requireOwner();
  const [locs, billing] = await Promise.all([listLocations(ctx), getBilling(ctx)]);
  const limit = PLAN_LIMITS[billing.plan].locations;
  return (
    <>
      <PageHeader title="Locations" description={`${locs.length} of ${limit} on your plan. Shown on the back of your cards; phones may suggest the card nearby.`}
        actions={<LocationDialog disabled={locs.length >= limit} />} />
      {locs.length === 0 ? (
        <EmptyState icon={<MapPin aria-hidden />} title="Add the places where customers visit you" action={<LocationDialog disabled={false} />}>
          Each card can show up to 10 locations. iPhone and Android may show the card on the lock screen when customers are close.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {locs.map((l) => (
            <li key={l.id} className="flex flex-col gap-2 rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><h2 className="break-words text-lg">{l.name}</h2><p className="text-sm text-text-muted">{l.addressOnCard || l.address}</p></div>
                <div className="flex shrink-0 gap-1"><LocationDialog location={l} disabled={false} /><DeleteLocation id={l.id} name={l.name} /></div>
              </div>
              {l.relevantText && <p className="text-sm">“{l.relevantText}”</p>}
              <p className="text-xs tabular text-text-muted">{l.lat.toFixed(4)}, {l.lon.toFixed(4)} · on {l.cards} {l.cards === 1 ? 'card' : 'cards'}{l.showOnCard ? '' : ' · hidden on the card'}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

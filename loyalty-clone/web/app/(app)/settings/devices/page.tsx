import { Smartphone } from 'lucide-react';
import { PageHeader } from '@/components/shell/app-shell';
import { EmptyState } from '@/components/ui/feedback';
import { getBilling, listDevices, listLocations, PLAN_LIMITS } from '@/lib/data/api';
import { requireOwner } from '@/lib/session';
import { PairPhone, RevokeButton } from './client';

export default async function DevicesPage() {
  const ctx = await requireOwner();
  const [devices, locations, billing] = await Promise.all([listDevices(ctx), listLocations(ctx), getBilling(ctx)]);
  const limit = PLAN_LIMITS[billing.plan].devices;
  return (
    <>
      <PageHeader title="Counter phones" description={`Phones your staff use to stamp cards. ${devices.length} of ${limit} on your plan.`}
        actions={<PairPhone locations={locations.map((l) => ({ id: l.id, name: l.name }))} disabled={devices.length >= limit} />} />
      <p className="mb-5 max-w-2xl text-sm text-text-muted">A paired phone can only scan and stamp. It can’t see your customer list, billing or settings. Every stamp is logged with the phone’s name.</p>
      {devices.length === 0 ? (
        <EmptyState icon={<Smartphone aria-hidden />} title="No phones paired yet">Pair the phone at your counter. Staff open the scanner, type a short code, and they’re ready.</EmptyState>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {devices.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-semibold">{d.label}</p>
                <p className="text-sm text-text-muted">
                  {locations.find((l) => l.id === d.locationId)?.name ?? 'Any location'} · {d.lastSeenAt ? `last used ${new Date(d.lastSeenAt).toLocaleDateString()}` : 'not used yet'}
                </p>
              </div>
              <RevokeButton id={d.id} label={d.label} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

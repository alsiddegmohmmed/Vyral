import { StatTile } from '@/components/ui/feedback';
import { getCampaign, getInsights } from '@/lib/data/api';
import { requireOwner } from '@/lib/session';
import { DailyChart, RoiForm } from './client';

const money = (cents: number | undefined, cur: string) =>
  cents === undefined ? undefined : `${cur} ${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default async function InsightsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ days?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const ctx = await requireOwner();
  const [c, ins] = await Promise.all([getCampaign(ctx, id), getInsights(ctx, id, days)]);
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Period" className="flex gap-1 text-sm">
        {[7, 30, 90].map((d) => (
          <a key={d} href={`?days=${d}`} aria-current={d === days ? 'true' : undefined} className={`rounded-md px-3 py-1.5 ${d === days ? 'bg-surface font-semibold' : 'text-text-muted hover:text-text'}`}>Last {d} days</a>
        ))}
      </nav>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="New customers" value={String(ins.enrolled)} delta={ins.deltas.enrolled} period={`vs previous ${days} days`} />
        <StatTile label="Stamps given" value={String(ins.stamps)} delta={ins.deltas.stamps} period={`vs previous ${days} days`} />
        <StatTile label="Rewards earned" value={String(ins.earned)} />
        <StatTile label="Rewards given" value={String(ins.redeemed)} delta={ins.deltas.redeemed} period={`vs previous ${days} days`} />
      </div>
      <section aria-labelledby="daily" className="rounded-lg border border-border p-5">
        <h2 id="daily" className="text-lg">Stamps per day</h2>
        <DailyChart data={ins.daily} />
      </section>
      <section aria-labelledby="roi" className="grid gap-5 rounded-lg border border-border p-5 lg:grid-cols-[1fr_320px]">
        <div>
          <h2 id="roi" className="text-lg">What the card brings in</h2>
          <p className="mt-1 text-sm text-text-muted">An estimate: stamps × what a visit is worth, minus what the rewards you gave cost you.</p>
          {ins.net === undefined ? (
            <p className="mt-4 text-sm">Fill in the two amounts to see the estimate.</p>
          ) : (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <StatTile label="Visits worth" value={money(ins.revenue, ins.currency)} />
              <StatTile label="Rewards cost" value={money(ins.cost, ins.currency)} />
              <StatTile label="Estimated return" value={money(ins.net, ins.currency)} />
            </div>
          )}
        </div>
        <RoiForm id={id} currency={c.currency} stampValue={c.stampValueCents} rewardCost={c.reward.costCents} reward={c.reward} />
      </section>
    </div>
  );
}

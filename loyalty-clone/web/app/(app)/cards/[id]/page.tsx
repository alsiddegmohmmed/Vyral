import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Banner, SectionHeading } from '@/components/ui/feedback';
import { QRBlock } from '@/components/ui/qr-block';
import { cn } from '@/lib/cn';
import { getCampaign, getInsights } from '@/lib/data/api';
import { requireOwner } from '@/lib/session';
import { OverviewActions } from './overview-actions';

/** One number in the period card: label, big value, change against the previous period. */
/** Stamps per day as plain bars. Decorative detail; the exact numbers are on the Insights tab. */
function DailyBars({ daily }: { daily: { date: string; stamps: number }[] }) {
  const max = Math.max(1, ...daily.map((d) => d.stamps));
  const total = daily.reduce((n, d) => n + d.stamps, 0);
  const best = daily.reduce((b, d) => (d.stamps > b.stamps ? d : b), daily[0] ?? { date: '', stamps: 0 });
  const w = 100 / Math.max(1, daily.length);
  return (
    <figure className="px-5 pb-5">
      <svg role="img" aria-label={`Stamps per day over ${daily.length} days: ${total} in total${best.stamps ? `, most on ${best.date} (${best.stamps})` : ''}.`}
        viewBox="0 0 100 32" preserveAspectRatio="none" className="h-24 w-full">
        <line x1="0" x2="100" y1="31.8" y2="31.8" stroke="var(--tk-color-border)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
        {daily.map((d, i) => {
          const h = (d.stamps / max) * 30;
          return <rect key={d.date} x={i * w + w * 0.15} width={w * 0.7} y={32 - h} height={h} rx="0.6" fill="var(--tk-color-accent)" opacity={i === daily.length - 1 ? 1 : 0.55} />;
        })}
      </svg>
      <figcaption className="mt-2 flex justify-between text-xs text-text-muted tabular">
        <span>Stamps per day</span><span>{daily[0]?.date} – {daily.at(-1)?.date}</span>
      </figcaption>
    </figure>
  );
}

function Metric({ label, value, delta }: { label: string; value: number; delta?: number }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="mt-1 text-2xl tabular">{value}</dd>
      {delta !== undefined && (
        <dd className={cn('mt-1 text-xs font-semibold tabular', delta >= 0 ? 'text-success' : 'text-danger')}>
          {delta >= 0 ? '▲ +' : '▼ −'}{Math.abs(delta)}% <span className="sr-only">compared with the previous 30 days</span>
        </dd>
      )}
    </div>
  );
}

export default async function OverviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ live?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const ctx = await requireOwner();
  const c = await getCampaign(ctx, id);
  if (c.status === 'draft') redirect(`/cards/${id}/design`);
  const ins = await getInsights(ctx, id, 30);
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
  const joinUrl = `${origin}/j/${c.shortCode}`;
  const wallets: [string, number][] = [['Apple Wallet', ins.status.apple], ['Google Wallet', ins.status.google], ['Web card only', ins.status.web]];
  return (
    <div className="flex flex-col gap-8">
      {(sp.live || c.status === 'paused') && (
        <div className="flex flex-col gap-3">
          {sp.live && <Banner tone="success" title="Your card is live">Print the QR code and put it where customers pay. They join in seconds, no app needed.</Banner>}
          {c.status === 'paused' && <Banner tone="warning" title="This card is paused">New customers can’t join and the scanner won’t add stamps. You can still fix cards from the dashboard.</Banner>}
        </div>
      )}

      {/* period card: four headline numbers on the left, where the cards live on the right */}
      <section aria-labelledby="period" className="rounded-lg border border-border bg-surface-raised shadow-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 id="period" className="text-base font-semibold">Last 30 days</h2>
          <span className="hidden text-xs text-text-muted sm:inline">Changes compare with the 30 days before</span>
        </div>
        <div className="grid lg:grid-cols-[1fr_300px]">
          <div className="min-w-0">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-6 p-5 md:grid-cols-4">
              <Metric label="New customers" value={ins.enrolled} delta={ins.deltas.enrolled} />
              <Metric label="Stamps given" value={ins.stamps} delta={ins.deltas.stamps} />
              <Metric label="Rewards earned" value={ins.earned} />
              <Metric label="Rewards given" value={ins.redeemed} delta={ins.deltas.redeemed} />
            </dl>
            {ins.daily.length > 1 && <DailyBars daily={ins.daily} />}
          </div>
          <div aria-labelledby="where" role="group" className="border-t border-border p-5 lg:border-l lg:border-t-0">
            <h3 id="where" className="text-sm font-semibold">Where customers have the card</h3>
            <dl className="mt-2 divide-y divide-border">
              {wallets.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between py-2">
                  <dt className="text-sm text-text-muted">{k}</dt>
                  <dd className="text-lg font-semibold tabular">{v}</dd>
                </div>
              ))}
            </dl>
            <Link href={`/cards/${id}/customers`} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline">
              See customers <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4">
          <SectionHeading id="manage">Manage</SectionHeading>
          <OverviewActions id={id} status={c.status} />
        </div>
        <div className="flex flex-col gap-4">
          <SectionHeading id="share">Share your card</SectionHeading>
          <section aria-labelledby="share" className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface-raised p-5 shadow-card">
            <p className="self-start text-sm text-text-muted">Customers scan this to join. Print it and stand it by the till.</p>
            <QRBlock value={joinUrl} label={`QR code to join ${c.name}`} />
          </section>
        </div>
      </div>
    </div>
  );
}

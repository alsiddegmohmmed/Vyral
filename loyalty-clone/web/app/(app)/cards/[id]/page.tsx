import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Users } from 'lucide-react';
import { Banner, StatTile } from '@/components/ui/feedback';
import { buttonClass } from '@/components/ui/button';
import { QRBlock } from '@/components/ui/qr-block';
import { getCampaign, getInsights } from '@/lib/data/api';
import { requireOwner } from '@/lib/session';
import { OverviewActions } from './overview-actions';

export default async function OverviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ live?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const ctx = await requireOwner();
  const c = await getCampaign(ctx, id);
  if (c.status === 'draft') redirect(`/cards/${id}/design`);
  const ins = await getInsights(ctx, id, 30);
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
  const joinUrl = `${origin}/j/${c.shortCode}`;
  return (
    <div className="flex flex-col gap-6">
      {sp.live && <Banner tone="success" title="Your card is live">Print the QR code and put it where customers pay. They join in seconds, no app needed.</Banner>}
      {c.status === 'paused' && <Banner tone="warning" title="This card is paused">New customers can’t join and the scanner won’t add stamps. You can still fix cards from the dashboard.</Banner>}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="New customers" value={String(ins.enrolled)} delta={ins.deltas.enrolled} period="vs previous 30 days" />
            <StatTile label="Stamps given" value={String(ins.stamps)} delta={ins.deltas.stamps} period="vs previous 30 days" />
            <StatTile label="Rewards earned" value={String(ins.earned)} />
            <StatTile label="Rewards given" value={String(ins.redeemed)} delta={ins.deltas.redeemed} period="vs previous 30 days" />
          </div>
          <section aria-labelledby="where" className="rounded-lg border border-border p-5">
            <h2 id="where" className="text-lg">Where customers have the card</h2>
            <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
              {[['Apple Wallet', ins.status.apple], ['Google Wallet', ins.status.google], ['Web card only', ins.status.web]].map(([k, v]) => (
                <div key={k} className="rounded-md bg-surface p-3"><dt className="text-xs text-text-muted">{k}</dt><dd className="tabular text-xl font-bold">{v}</dd></div>
              ))}
            </dl>
            <Link href={`/cards/${id}/customers`} className={`${buttonClass('secondary', 'sm')} mt-4`}><Users aria-hidden className="size-4" /> See customers</Link>
          </section>
          <OverviewActions id={id} status={c.status} />
        </div>
        <section aria-labelledby="share" className="flex flex-col items-center gap-3 rounded-lg border border-border p-5">
          <h2 id="share" className="self-start text-lg">Share your card</h2>
          <p className="self-start text-sm text-text-muted">Customers scan this to join.</p>
          <QRBlock value={joinUrl} label={`QR code to join ${c.name}`} />
        </section>
      </div>
    </div>
  );
}

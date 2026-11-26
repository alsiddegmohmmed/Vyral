import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicCampaign } from '@/lib/data/api';
import { StampStrip } from '@/components/loyalty/stamp-strip';
import { JoinForm } from './join-form';

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const c = await getPublicCampaign((await params).code);
  return { title: c ? `Join ${c.programName}` : 'Card not found', robots: { index: false } };
}

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const c = await getPublicCampaign(code);
  if (!c) notFound();
  const d = c.design;
  return (
    <main className="min-h-dvh bg-surface">
      <div className="mx-auto w-full max-w-[440px] bg-bg sm:my-8 sm:overflow-hidden sm:rounded-xl sm:shadow-pop">
        <header className="px-5 pb-6 pt-8" style={{ background: d.background, color: d.foreground }}>
          {d.logoUrl ? <img src={d.logoUrl} alt={c.business} className="h-10 max-w-[180px] object-contain object-left" /> : <p className="text-sm font-semibold" style={{ color: d.label }}>{c.business}</p>}
          <h1 className="mt-1 text-2xl">{c.rewardMode === 'mystery' ? `${c.totalStamps} stamps, then a mystery box on us` : `${c.totalStamps} stamps, then ${c.reward.name.toLowerCase()} on us`}</h1>
          {c.description && <p className="mt-2 text-sm opacity-90">{c.description}</p>}
          <StampStrip total={c.totalStamps} filled={0} icon={d.icon} image={d.stampUrl} stamp={d.stamp} empty={`${d.foreground}66`} background={d.background} className="mt-5 w-full" />
        </header>
        {c.status !== 'live' ? (
          <p role="status" className="p-6 text-center text-text-muted">This card is paused for now. Ask at the counter.</p>
        ) : (
          <JoinForm shortCode={code} campaign={c} />
        )}
      </div>
    </main>
  );
}

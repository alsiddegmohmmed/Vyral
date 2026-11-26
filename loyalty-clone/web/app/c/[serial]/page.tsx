import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { Gift, MapPin, Smartphone } from 'lucide-react';
import { getPublicCard } from '@/lib/data/api';
import { StampStrip } from '@/components/loyalty/stamp-strip';
import { Banner } from '@/components/ui/feedback';
import { LiveRefresh } from './live-refresh';
import { MysteryBoxes } from './mystery-boxes';

export const metadata: Metadata = { title: 'Your card', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default async function CardPage({ params, searchParams }: { params: Promise<{ serial: string }>; searchParams: Promise<{ new?: string }> }) {
  const [{ serial }, sp] = await Promise.all([params, searchParams]);
  const card = await getPublicCard(serial);
  if (!card) notFound();
  const c = card.campaign, d = c.design;
  const toGo = c.totalStamps - card.currentStamps;
  const qrSvg = await QRCode.toString(card.qrPayload, { type: 'svg', margin: 3, errorCorrectionLevel: 'M' });
  const dead = card.status === 'deleted' || card.expired;

  return (
    <main className="min-h-dvh bg-surface pb-10">
      <LiveRefresh />
      <article aria-label={`${c.business} stamp card`} className="mx-auto w-full max-w-[440px] bg-bg sm:my-8 sm:overflow-hidden sm:rounded-xl sm:shadow-pop">
        {sp.new && !dead && <div className="bg-success-bg px-5 py-3 text-sm font-semibold text-success" role="status">You’re in! Save this page or add the card to your wallet below.</div>}
        <header className="px-5 pb-6 pt-6" style={{ background: d.background, color: d.foreground }}>
          {d.logoUrl ? <img src={d.logoUrl} alt={c.business} className="h-10 max-w-[180px] object-contain object-left" /> : <p className="text-sm font-semibold" style={{ color: d.label }}>{c.business}</p>}
          <h1 className="mt-1 text-2xl">{card.firstName ? `Hi ${card.firstName}` : c.programName}</h1>
          <StampStrip total={c.totalStamps} filled={card.currentStamps} icon={d.icon} image={d.stampUrl} stamp={d.stamp} empty={`${d.foreground}66`} background={d.background} className="mt-4 w-full" />
          <p className="mt-3 text-sm" aria-live="polite">
            {dead ? 'This card no longer works.' : card.rewardsAvailable > 0 ? 'Your reward is ready. Show this card at the counter.' : `${toGo} more ${toGo === 1 ? 'stamp' : 'stamps'} to ${c.reward.name.toLowerCase()}.`}
          </p>
        </header>
        {c.rewardMode === 'mystery' && card.prizes.length > 0 && !dead ? (
          <MysteryBoxes serial={card.serial} boxes={card.prizes} />
        ) : card.rewardsAvailable > 0 && !dead && (
          <p className="flex items-center gap-2 bg-success-bg px-5 py-3 text-sm font-semibold text-success"><Gift aria-hidden className="size-4" /> {card.rewardsAvailable} × {c.reward.name}</p>
        )}
        {card.noteText && <div className="border-b border-border px-5 py-4"><p className="text-sm">{card.noteText}</p></div>}
        {dead ? (
          <div className="p-5"><Banner tone="warning" title={card.status === 'deleted' ? 'This card was closed by the business' : 'This card has expired'}>Ask at the counter if you think this is a mistake.</Banner></div>
        ) : c.status === 'paused' ? (
          <div className="p-5"><Banner tone="info" title="Stamps are paused for now">Your stamps are safe. You can use the card again when the business resumes it.</Banner></div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-5 py-6">
            <div role="img" aria-label="Your card code. Show it to staff to scan." className="size-56 rounded-md bg-white p-1 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <p className="text-sm text-text-muted">Can’t scan? Staff can type <span className="font-mono font-semibold tracking-wider text-text">{card.manualCode}</span></p>
          </div>
        )}
        {c.newsText && (
          <section className="border-t border-border px-5 py-4" aria-labelledby="news">
            <h2 id="news" className="text-xs font-semibold uppercase tracking-wide text-text-muted">Latest from {c.business}</h2>
            <p className="mt-1 text-sm">{c.newsText}</p>
          </section>
        )}
        {!dead && (
          <section className="flex flex-col gap-2 border-t border-border bg-surface px-5 py-4" aria-labelledby="wallet">
            <h2 id="wallet" className="flex items-center gap-1.5 text-sm font-semibold"><Smartphone aria-hidden className="size-4" /> Keep it on your phone</h2>
            <p className="text-sm text-text-muted">Bookmark this page, or add it to your home screen. Apple Wallet and Google Wallet are coming soon.</p>
          </section>
        )}
        <details className="border-t border-border px-5 py-4 text-sm">
          <summary className="cursor-pointer font-semibold">About this card</summary>
          <dl className="mt-3 flex flex-col gap-3">
            {c.howToEarn && <div><dt className="text-text-muted">How to earn</dt><dd>{c.howToEarn}</dd></div>}
            <div><dt className="text-text-muted">Your reward</dt><dd>{c.rewardMode === 'mystery' ? 'A mystery box: every full card draws one of the business’s prizes.' : <>{c.reward.name}{c.reward.details ? ` — ${c.reward.details}` : ''}</>}</dd></div>
            {card.locations.length > 0 && <div><dt className="text-text-muted">Find us</dt>{card.locations.map((l) => <dd key={l.name} className="flex items-start gap-1.5"><MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />{l.name}: {l.addressOnCard}</dd>)}</div>}
            {c.links.length > 0 && <div><dt className="text-text-muted">Links</dt>{c.links.map((l) => (
              <dd key={l.label}><a className="underline" href={l.kind === 'whatsapp' ? `https://wa.me/${l.value.replace(/\D/g, '')}` : l.kind === 'instagram' ? `https://instagram.com/${l.value}` : l.kind === 'phone' ? `tel:${l.value}` : l.kind === 'email' ? `mailto:${l.value}` : l.value} rel="noopener noreferrer" target="_blank">{l.label}</a></dd>
            ))}</div>}
            {c.terms && <div><dt className="text-text-muted">Terms</dt><dd className="whitespace-pre-line">{c.terms}</dd></div>}
          </dl>
        </details>
      </article>
    </main>
  );
}

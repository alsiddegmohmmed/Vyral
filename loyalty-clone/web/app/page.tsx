import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { ArrowRight, Check, LifeBuoy, MessageCircle, QrCode, RefreshCw, ScanLine, ShieldCheck, Smartphone, Stamp, Wallet } from 'lucide-react';
import { buttonClass } from '@/components/ui/button';
import { getContextFromSession, PLAN_LIMITS, PRICES } from '@/lib/data/api';
import { SESSION_COOKIE } from '@/lib/session';

// Landing page. Copy and structure: replica/launch/landing.md. No testimonials,
// counts or logos until real customers agree to be quoted.
export const metadata: Metadata = {
  title: { absolute: 'Garuka: stamp cards with a counter that keeps going' },
  description: 'Digital stamp cards for cafés, salons and shops. The counter runs on any phone, re-pairs in seconds and fixes itself. Pay by MoMo, Airtel Money or card.',
};

const plans = [
  { id: 'starter', name: 'Starter', for: 'For one shop with one counter' },
  { id: 'growth', name: 'Growth', for: 'For a shop with a few branches' },
  { id: 'pro', name: 'Pro', for: 'For chains and franchises' },
] as const;

const faqs = [
  { q: 'Do my customers need to install an app?', a: 'No. They scan your QR code and the card opens in their browser. They can add it to Apple Wallet or Google Wallet, or keep it as a web card that works on any phone.' },
  { q: 'What if the phone at the counter breaks or gets lost?', a: 'Open the scanner on any other phone and type a new 6-digit pairing code from your dashboard. It takes about 30 seconds and costs nothing. You never need to buy a special device.' },
  { q: 'What if the internet drops while we stamp?', a: 'The counter tells staff plainly when nothing was saved, so nobody gets a stamp twice or loses one. Type the card’s code if the camera won’t read.' },
  { q: 'Can I pay with mobile money?', a: 'Yes. Pay in Rwandan francs with MTN MoMo, Airtel Money or card. Elsewhere, pay in US dollars by card.' },
  { q: 'What happens if I stop paying?', a: 'Your customers keep their cards and their stamps. Editing pauses until you choose a plan again. You can cancel from your dashboard in one click.' },
  { q: 'I already have customers on paper cards. Can I bring them over?', a: 'There’s no importer yet. You can add customers one by one from the Customers page and send each their card link by WhatsApp or SMS.' },
];

export default async function Landing() {
  const signedIn = !!(await getContextFromSession((await cookies()).get(SESSION_COOKIE)?.value).catch(() => null));
  const primary = signedIn
    ? <Link href="/cards" className={buttonClass('primary', 'lg')}>Open your dashboard <ArrowRight aria-hidden className="size-4" /></Link>
    : <Link href="/signup" className={buttonClass('primary', 'lg')}>Start 15 days free <ArrowRight aria-hidden className="size-4" /></Link>;

  return (
    <div className="min-h-dvh bg-bg text-text">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent">Skip to content</a>
      <header className="sticky top-0 z-[20] border-b border-border bg-bg/95 backdrop-blur">
        <nav aria-label="Site" className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold">
            <span aria-hidden className="grid size-8 place-items-center rounded-sm bg-accent text-on-accent"><Stamp className="size-[18px]" /></span>
            Garuka
          </Link>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <a href="#pricing" className="hidden h-10 items-center rounded-md px-3 text-sm font-medium text-text-muted hover:text-text sm:inline-flex">Pricing</a>
            <a href="#faq" className="hidden h-10 items-center rounded-md px-3 text-sm font-medium text-text-muted hover:text-text sm:inline-flex">Questions</a>
            {signedIn
              ? <Link href="/cards" className={buttonClass('primary', 'sm')}>Dashboard</Link>
              : <><Link href="/login" className={buttonClass('ghost', 'sm')}>Sign in</Link><Link href="/signup" className={buttonClass('primary', 'sm')}>Start free</Link></>}
          </div>
        </nav>
      </header>

      <main id="main">
        {/* 1. hero */}
        <section className="mx-auto grid max-w-[1200px] items-center gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:pb-24 lg:pt-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">Stamp cards for cafés, salons and shops</p>
            <h1 className="mt-3 text-[2.5rem] font-bold leading-[1.05] tracking-tight sm:text-[3.25rem]">A loyalty card your counter can’t break.</h1>
            <p className="mt-5 max-w-xl text-lg text-text-muted">Customers get a stamp card on their own phone. Your staff stamp it from any phone at the till, and if that phone fails, another one takes over in 30 seconds.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {primary}
              <a href="#how" className={buttonClass('secondary', 'lg')}>See how it works</a>
            </div>
            <p className="mt-4 text-sm text-text-muted">No card or MoMo needed to start. Customers need no app.</p>
          </div>
          <figure className="overflow-hidden rounded-lg border border-border bg-surface shadow-pass">
            <Image src="/landing/card-overview.jpg" alt="The Garuka dashboard for a café’s coffee card: new customers, stamps given and rewards for the last 30 days, a bar chart of stamps per day, and the QR code customers scan to join." width={1440} height={900} priority className="h-auto w-full" />
          </figure>
        </section>

        {/* 2. the problem */}
        <section aria-labelledby="problem" className="border-y border-border bg-surface">
          <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:py-20">
            <h2 id="problem" className="max-w-2xl text-2xl">Loyalty apps fail at the worst moment: with a customer waiting.</h2>
            <ul className="mt-8 grid gap-5 md:grid-cols-2">
              <li className="rounded-lg border border-border bg-surface-raised p-6">
                <p className="font-semibold">The stamping app freezes, closes or logs out</p>
                <p className="mt-2 text-text-muted">The queue waits, the stamp never lands, and some apps tell you to buy a new device to fix it.</p>
              </li>
              <li className="rounded-lg border border-border bg-surface-raised p-6">
                <p className="font-semibold">Help is slow, or it’s a bot</p>
                <p className="mt-2 text-text-muted">When the counter stops, you need a person now, not a ticket answered tomorrow.</p>
              </li>
            </ul>
          </div>
        </section>

        {/* 3. how it works */}
        <section id="how" aria-labelledby="how-title" className="mx-auto max-w-[1200px] scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
          <h2 id="how-title" className="text-2xl">Running in an afternoon</h2>
          <ol className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              { icon: Stamp, t: 'Design your card', d: 'Pick the reward, the number of stamps and your colours. You see the card as you build it.' },
              { icon: QrCode, t: 'Print one QR code', d: 'Stand it by the till. Customers scan it, type their name and phone, and the card is theirs.' },
              { icon: ScanLine, t: 'Stamp from any phone', d: 'Pair the phone at your counter with a short code. Staff scan the card and add a stamp in one tap.' },
            ].map(({ icon: Icon, t, d }, i) => (
              <li key={t} className="rounded-lg border border-border bg-surface-raised p-6 shadow-card">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="grid size-10 place-items-center rounded-md bg-accent-subtle text-accent"><Icon className="size-5" /></span>
                  <span className="text-sm font-semibold tabular text-text-muted">Step {i + 1}</span>
                </div>
                <p className="mt-4 text-lg font-semibold">{t}</p>
                <p className="mt-2 text-text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 4. features, led by the fixes */}
        <section aria-labelledby="features" className="border-t border-border bg-surface">
          <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-24">
            <div>
              <h2 id="features" className="text-2xl">Built so the counter keeps going</h2>
              <ul className="mt-8 flex flex-col gap-6">
                {[
                  { icon: RefreshCw, t: 'A counter that fixes itself', d: 'If a phone loses its pairing, the scanner asks for a new code on the spot. A self-check tests the camera, connection and clock.' },
                  { icon: Smartphone, t: 'Any phone, never a new device', d: 'Up to 10 counter phones on the smallest plan, re-paired free. A lost phone is revoked in one click.' },
                  { icon: LifeBuoy, t: 'Honest when something fails', d: '“Nothing was saved” means nothing was saved. Staff type the card’s code if the camera can’t read it.' },
                  { icon: MessageCircle, t: 'A person on WhatsApp', d: 'Report a problem from the scanner and it sends the phone’s details with it, so you don’t have to explain twice.' },
                  { icon: Wallet, t: 'A card on every phone', d: 'Apple Wallet, Google Wallet, or a web card that works anywhere. Send the link by WhatsApp or SMS.' },
                  { icon: ShieldCheck, t: 'Stamps you can trust', d: 'Every stamp is logged with the phone that gave it. Codes change after each reward, so old screenshots don’t work.' },
                ].map(({ icon: Icon, t, d }) => (
                  <li key={t} className="flex gap-4">
                    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-raised text-accent shadow-card"><Icon className="size-5" /></span>
                    <span><span className="block font-semibold">{t}</span><span className="mt-1 block text-text-muted">{d}</span></span>
                  </li>
                ))}
              </ul>
            </div>
            <figure className="overflow-hidden rounded-lg border border-border bg-bg shadow-pass">
              <Image src="/landing/setup.jpg" alt="The Garuka cards page for a new café, with a six-step setup checklist: create your account, create a card, design it, go live, print your QR code, pair a counter phone." width={1440} height={900} className="h-auto w-full" />
            </figure>
          </div>
        </section>

        {/* 5. pricing */}
        <section id="pricing" aria-labelledby="pricing-title" className="mx-auto max-w-[1200px] scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
          <h2 id="pricing-title" className="text-2xl">One flat price per shop</h2>
          <p className="mt-2 max-w-2xl text-text-muted">No price per staff member. Every plan has every feature, unlimited customers and 15 days free. Pay yearly and get 12 months for the price of 10.</p>
          <ul className="mt-8 grid gap-5 md:grid-cols-3">
            {plans.map((p) => {
              const lim = PLAN_LIMITS[p.id];
              return (
                <li key={p.id} className={p.id === 'growth' ? 'flex flex-col rounded-lg border-2 border-accent bg-surface-raised p-6 shadow-pop' : 'flex flex-col rounded-lg border border-border bg-surface-raised p-6 shadow-card'}>
                  <h3 className="text-lg">{p.name}</h3>
                  <p className="text-sm text-text-muted">{p.for}</p>
                  <p className="mt-5"><span className="text-3xl tabular">RWF {PRICES[p.id].RWF.toLocaleString('en-GB')}</span><span className="text-text-muted"> / month</span></p>
                  <p className="text-sm tabular text-text-muted">or US${PRICES[p.id].USD} / month by card</p>
                  <ul className="mt-5 flex flex-col gap-2 text-sm">
                    {[`${lim.designs} card designs`, `${lim.locations} ${lim.locations === 1 ? 'location' : 'locations'}`, `Up to ${lim.devices} counter phones`, 'Unlimited customers', 'Birthday and win-back messages'].map((l) => (
                      <li key={l} className="flex gap-2"><Check aria-hidden className="size-4 shrink-0 text-success" />{l}</li>
                    ))}
                  </ul>
                  <Link href="/signup" className={`${buttonClass(p.id === 'growth' ? 'primary' : 'secondary', 'md', true)} mt-6`}>Start free<span className="sr-only"> on {p.name}</span></Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-sm text-text-muted">Rwandan francs by MTN MoMo, Airtel Money or card. Elsewhere, US dollars by card. Cancel in one click from your dashboard.</p>
        </section>

        {/* 6. FAQ */}
        <section id="faq" aria-labelledby="faq-title" className="border-t border-border bg-surface">
          <div className="mx-auto max-w-[800px] scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
            <h2 id="faq-title" className="text-2xl">Questions owners ask</h2>
            <div className="mt-8 divide-y divide-border rounded-lg border border-border bg-surface-raised">
              {faqs.map((f) => (
                <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                    {f.q}<span aria-hidden className="text-xl leading-none text-text-muted transition-transform duration-[var(--tk-motion-fast)] group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 7. final call */}
        <section aria-labelledby="final" className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:py-24">
          <div className="flex flex-col items-start gap-6 rounded-xl bg-accent p-8 text-on-accent sm:p-12 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 id="final" className="text-2xl">Bring your regulars back.</h2>
              <p className="mt-2 max-w-xl">Garuka means “come back”. Set up your card today; your first customer can join this afternoon.</p>
            </div>
            <Link href={signedIn ? '/cards' : '/signup'} className="inline-flex h-12 shrink-0 items-center gap-2 rounded-md bg-bg px-5 font-semibold text-text hover:bg-surface">
              {signedIn ? 'Open your dashboard' : 'Start 15 days free'} <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-text-muted sm:px-6">
          <p>Garuka · Made in Kigali for shops everywhere.</p>
          <p className="flex gap-4"><Link href="/login" className="hover:text-text hover:underline">Sign in</Link><Link href="/signup" className="hover:text-text hover:underline">Start free</Link></p>
        </div>
      </footer>
    </div>
  );
}

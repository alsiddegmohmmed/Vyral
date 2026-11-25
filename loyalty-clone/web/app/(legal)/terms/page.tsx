import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL } from '@/lib/legal';
import { PLAN_LIMITS, PRICES } from '@/lib/data/api';

export const metadata: Metadata = { title: 'Terms of service', description: 'The agreement between Garuka and the businesses that use it: trial, plans, billing, cancelling, your data and ours.' };

// Facts (trial length, prices, limits, cancel and lock behaviour, deletion timings)
// match the code on 2026-11-25. Items marked [owner to confirm] are business
// decisions, not facts from the code.
export default function TermsPage() {
  const plans = (['starter', 'growth', 'pro'] as const).map((p) => `${p[0].toUpperCase()}${p.slice(1)}: RWF ${PRICES[p].RWF.toLocaleString('en-GB')} or US$${PRICES[p].USD} a month, ${PLAN_LIMITS[p].designs} card designs, ${PLAN_LIMITS[p].locations} ${PLAN_LIMITS[p].locations === 1 ? 'location' : 'locations'}, up to ${PLAN_LIMITS[p].devices} counter phones`);
  return (
    <>
      <h1>Terms of service</h1>
      <p className="text-sm text-text-muted">Last updated {LEGAL.updated}. In force from {LEGAL.effective}.</p>
      <p>These terms are the agreement between {LEGAL.entity} (“Garuka”, “we”) and the business that creates a Garuka account (“you”). By creating an account you agree to them. Our <Link href="/privacy">privacy notice</Link> explains how personal data is handled.</p>

      <h2>1. What Garuka is</h2>
      <p>Garuka lets you run digital stamp cards: you design a card, customers join from their own phone, and your staff stamp cards from paired counter phones. Cards work as a web page on any phone, and in Apple Wallet or Google Wallet where those are available.</p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must be at least 18 and able to act for the business you sign up.</li>
        <li>Keep your password to yourself. You’re responsible for what happens under your account and on the counter phones you pair. Remove a lost phone from Counter phones straight away.</li>
        <li>Give us a working email. We use it for account and billing messages.</li>
      </ul>

      <h2>3. Free trial</h2>
      <p>New accounts get 15 days free, with every feature and no payment details needed. When the trial ends, editing pauses until you choose a plan. Your customers keep their cards and stamps.</p>

      <h2>4. Plans and prices</h2>
      <ul>{plans.map((p) => <li key={p}>{p}</li>)}</ul>
      <p>Paying yearly costs 10 months’ price for 12 months. Prices are per business, not per staff member. We’ll give you at least 30 days’ notice by email before a price change affects you.</p>

      <h2>5. Paying</h2>
      <ul>
        <li><strong>In Rwandan francs</strong>: you pay through Flutterwave by MTN MoMo, Airtel Money or card. We send an invoice 7 days before each period ends.</li>
        <li><strong>In US dollars</strong>: you pay by card through Paddle, which sells the subscription to you as merchant of record and handles tax. Paddle’s own buyer terms also apply to that purchase.</li>
        <li>If a payment fails, everything keeps working for a short grace period. After that the account is locked: editing and messages pause, and your customers keep their cards.</li>
      </ul>

      <h2>6. Cancelling and refunds</h2>
      <ul>
        <li>Cancel any time from Plan &amp; billing in one click. Your plan runs to the end of the period you paid for, and you won’t be charged again. You can undo the cancellation before then.</li>
        <li>[Owner to confirm] If you’re charged in a way you didn’t expect, tell us within 14 days and we’ll refund that charge.</li>
        <li>Moving to a smaller plan is allowed once your cards, locations and phones fit its limits. We’ll tell you what to archive first.</li>
      </ul>

      <h2>7. Your customers and their data</h2>
      <ul>
        <li>Your customers’ details are yours. You are the controller of that data, and we handle it on your behalf as described in the privacy notice. Using Garuka includes this data processing agreement with us.</li>
        <li>You’re responsible for having a lawful basis for what you collect and send. Offers and news go only to customers who agreed, unless the law allows otherwise. The consent box on your join page starts unticked.</li>
        <li>Honour the rewards your cards show. Garuka keeps the count; the reward is your promise to your customer.</li>
        <li>Only ask your join form for what you need.</li>
      </ul>

      <h2>8. Using Garuka fairly</h2>
      <p>Don’t use Garuka to send spam, mislead customers, run anything illegal, collect data you have no right to, or break or overload the service. Don’t pretend to be another business. We may pause an account that does, and we’ll tell you why unless the law stops us.</p>

      <h2>9. What’s ours and what’s yours</h2>
      <p>Your logo, card designs, texts and customer data stay yours. You give us permission to use them only to run the service for you. Garuka’s software, name and brand stay ours.</p>

      <h2>10. Our service</h2>
      <ul>
        <li>We work to keep Garuka running, and the counter app is built to recover by itself. We can’t promise it will never be interrupted, especially when your internet connection or a third party (Apple, Google, payment providers) is down.</li>
        <li>Support: message us on WhatsApp from the counter app, or write to <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>.</li>
        <li>We may improve or change features. If we remove something you pay for, we’ll tell you first and you can cancel.</li>
      </ul>

      <h2>11. Deleting your account</h2>
      <p>You can delete your account from Settings. Your join page closes at once, and existing cards keep working for 7 days. Signing in during those 7 days cancels the deletion. After 7 days your business, cards, customers and history are erased. [Owner to confirm] Ask us before deleting if you want a copy of your customer list.</p>

      <h2>12. Liability</h2>
      <p>[Owner to confirm with a lawyer] Nothing in these terms limits liability that the law doesn’t allow us to limit. Otherwise, we aren’t liable for lost profits or indirect losses, and our total liability over any 12 months is limited to what you paid us in those 12 months.</p>

      <h2>13. Changes to these terms</h2>
      <p>If we change these terms in a way that matters, we’ll email you at least 30 days before the change takes effect. If you don’t agree, you can cancel before then.</p>

      <h2>14. Law</h2>
      <p>These terms are governed by the laws of {LEGAL.governingLaw}, and disputes go to {LEGAL.courts}, unless the law where your business is based gives you the right to use its courts.</p>

      <h2>Contact</h2>
      <p>{LEGAL.entity}, {LEGAL.address}. <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a></p>
    </>
  );
}

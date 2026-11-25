import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL, PROCESSORS } from '@/lib/legal';

export const metadata: Metadata = { title: 'Privacy notice', description: 'What Garuka collects, why, who handles it, how long it is kept, and your rights.' };

// Every statement here was checked against the code on 2026-11-25 (schema, jobs,
// cookies). If the code changes what is collected or kept, change this page too.
export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy notice</h1>
      <p className="text-sm text-text-muted">Last updated {LEGAL.updated}. In force from {LEGAL.effective}.</p>
      <p>Garuka gives shops digital stamp cards. This notice explains what we collect, why, who helps us handle it, how long we keep it, and what you can ask us to do. It’s written to be read, not skimmed past.</p>

      <h2>Who we are</h2>
      <p>Garuka is run by {LEGAL.entity}, {LEGAL.address}. For anything about your data, write to <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.</p>

      <h2>Two kinds of people use Garuka</h2>
      <ul>
        <li><strong>Business owners and their staff</strong> who run a stamp card. For their account data, <strong>we decide how it’s used</strong> (we are the controller).</li>
        <li><strong>Customers</strong> of those businesses who join a card. Their details belong to the business they joined. <strong>The business decides how they’re used, and we handle them on its behalf</strong> (the business is the controller; we are its processor). If you’re a customer, the business is your first contact, and we’ll help it answer you.</li>
      </ul>

      <h2>What we collect</h2>
      <h3>From business owners</h3>
      <ul>
        <li>Your email address and a password. We store only a scrambled form of the password (scrypt), never the password itself.</li>
        <li>Your business name, country and time zone, and anything you add in Settings: website, contact email, phone, address.</li>
        <li>Your locations: name, address, and the map position you choose for each.</li>
        <li>Your cards: the design, texts, rewards and rules you set.</li>
        <li>Billing records: your plan, invoices and payment status. Card and mobile-money details go straight to Paddle or Flutterwave; we never see full card numbers.</li>
        <li>Sign-in sessions, with the browser’s name and version, so you can see and end them.</li>
        <li>Counter phones: the name you give each phone, when it was last seen, and any “Report a problem” it sends (phone name, app version, browser, last error and self-check results; never customer details).</li>
      </ul>
      <h3>From customers who join a card</h3>
      <ul>
        <li>What the business’s join form asks for: usually your name and phone number, and sometimes your email, your birthday (day and month only) or other questions the business adds.</li>
        <li>Whether you agreed to receive news and offers, the exact words you agreed to, and when. The box always starts unticked.</li>
        <li>Your card’s history: when you joined, each stamp and reward, and which counter phone gave it.</li>
        <li>Whether your card is in Apple Wallet or Google Wallet, and the technical address those services give us to update the pass.</li>
      </ul>
      <h3>From everyone</h3>
      <ul>
        <li>Your IP address, briefly, to stop abuse such as repeated sign-in or join attempts. Those records are deleted within a day.</li>
        <li>We do <strong>not</strong> collect your phone’s location, and we don’t use advertising or tracking cookies.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li><strong>To run the service you asked for</strong>: the dashboard, the cards, the counter app, and stamps and rewards. This is needed to perform our contract with the business.</li>
        <li><strong>To send account emails</strong>: confirm your email, reset a password, send a customer their card link, remind an owner before a renewal.</li>
        <li><strong>To deliver the business’s messages</strong> to its customers’ cards, and its birthday and “we miss you” messages, as the business sets them up. Offers are sent only where the business has a lawful basis, such as the customer’s consent.</li>
        <li><strong>To bill</strong> businesses for their plan.</li>
        <li><strong>To keep Garuka safe</strong>: rate limits, signed QR codes that change after each reward, and logs of which phone gave each stamp. This is our legitimate interest in preventing fraud and abuse.</li>
      </ul>
      <p>We don’t sell personal data, and we don’t use it for advertising.</p>

      <h2>Who helps us handle it</h2>
      <p>These services process personal data for us, under contracts that limit them to doing so on our instructions:</p>
      <ul>
        {PROCESSORS.map((p) => <li key={p.name}><strong>{p.name}</strong> ({p.where}): {p.what}</li>)}
      </ul>
      <p>Some of these are outside Rwanda and the EU. Where data leaves those places we rely on the safeguards the law requires, such as standard contractual clauses. We’ll list any new service here before it starts handling personal data.</p>

      <h2>How long we keep it</h2>
      <ul>
        <li><strong>Sign-in sessions</strong> end after 30 days, or when you sign out.</li>
        <li><strong>Password-reset and email links</strong> stop working after an hour (reset) or 48 hours (confirm), and are deleted a day later.</li>
        <li><strong>A deleted customer</strong>: their card stops working at once, and their name, phone, email, birthday and answers are erased 30 days later. Stamp counts stay, without anything that identifies them.</li>
        <li><strong>A deleted business account</strong>: the join page closes at once. After 7 days the business, its cards, customers and history are erased, and the owner’s sign-in is removed the next day.</li>
        <li><strong>Billing records</strong> we hold (plan history and invoices) are erased with the business account. Paddle and Flutterwave keep their own payment records for as long as the law requires them to.</li>
        <li><strong>Counter phone problem reports</strong> are kept while the business account exists.</li>
      </ul>

      <h2>Your rights</h2>
      <p>You can ask to see the personal data we hold about you, to correct it, to delete it, to receive it in a common format, or to object to or limit how it’s used. You can withdraw consent to offers at any time, and that doesn’t affect what happened before.</p>
      <ul>
        <li><strong>Business owners</strong>: most of this is in your dashboard (Settings, and Delete account). For the rest, write to <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.</li>
        <li><strong>Customers</strong>: ask the business you joined, or write to us and we’ll pass it on and help it answer.</li>
      </ul>
      <p>We answer within 30 days. If you’re not satisfied, you can complain to Rwanda’s data protection authority, the National Cyber Security Authority (NCSA), or to the data protection authority where you live.</p>

      <h2>Cookies and browser storage</h2>
      <p>Garuka uses only what it needs to work, so there’s no cookie banner:</p>
      <ul>
        <li><code>lc_session</code>: keeps a business owner signed in. It ends when the browser closes, and the session behind it expires after 30 days.</li>
        <li><code>lc_device</code>: keeps a counter phone paired to its business, for up to 400 days, or until the owner removes the phone.</li>
        <li>The counter app saves its sound and vibration settings on the phone, and the card designer keeps unsaved edits in the browser tab until you save or close it.</li>
      </ul>

      <h2>Security</h2>
      <p>Passwords are stored scrambled. Sign-in cookies can’t be read by page scripts. Each business’s data is kept apart from every other business’s in the database. A paired counter phone can only scan and stamp: it can’t see the customer list, billing or settings. If a breach puts your data at risk, we’ll tell you and the authorities as the law requires.</p>

      <h2>Children</h2>
      <p>Garuka accounts are for businesses. Businesses shouldn’t enrol children under 16 without a parent’s or guardian’s agreement.</p>

      <h2>Changes</h2>
      <p>If we change this notice in a way that matters, we’ll email business owners and show the new date at the top before it takes effect.</p>

      <p className="mt-6 text-sm text-text-muted">See also our <Link href="/terms">terms of service</Link>.</p>
    </>
  );
}

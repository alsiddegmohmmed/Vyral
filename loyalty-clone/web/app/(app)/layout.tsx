import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { Banner } from '@/components/ui/feedback';
import { buttonClass } from '@/components/ui/button';
import { endSession, getBilling, getOrg } from '@/lib/data/api';
import { requireOwner, SESSION_COOKIE } from '@/lib/session';

async function signOut() {
  'use server';
  const jar = await cookies();
  const t = jar.get(SESSION_COOKIE)?.value;
  if (t) await endSession(t);
  jar.delete(SESSION_COOKIE);
  redirect('/login');
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOwner();
  const [org, billing] = await Promise.all([getOrg(ctx), getBilling(ctx)]);
  const banner =
    billing.planStatus === 'trialing' ? (
      <Banner tone={billing.daysLeft <= 3 ? 'warning' : 'info'} title={billing.daysLeft === 0 ? 'Your trial ends today' : `${billing.daysLeft} ${billing.daysLeft === 1 ? 'day' : 'days'} left in your trial`}
        action={<Link href="/settings/billing" className={buttonClass('secondary', 'sm')}>Choose a plan</Link>}>
        Everything keeps working while you choose.
      </Banner>
    ) : billing.planStatus === 'past_due' ? (
      <Banner tone="warning" title="Payment overdue" action={<Link href="/settings/billing" className={buttonClass('secondary', 'sm')}>Pay now</Link>}>Everything still works for now.</Banner>
    ) : billing.planStatus === 'locked' ? (
      <Banner tone="danger" title="Your account is locked" action={<Link href="/settings/billing" className={buttonClass('primary', 'sm')}>Pay to unlock</Link>}>Customers can still use their cards. Editing is paused.</Banner>
    ) : undefined;
  const planLabel = `${billing.plan[0].toUpperCase()}${billing.plan.slice(1)} plan`;
  return <AppShell orgName={org.name} planLabel={planLabel} banner={banner} signOut={signOut}>{children}</AppShell>;
}

import { PageHeader } from '@/components/shell/app-shell';
import { Banner } from '@/components/ui/feedback';
import { getBilling, getOrg, getSubscription, PLAN_LIMITS, PRICES } from '@/lib/data/api';
import { requireOwner } from '@/lib/session';
import { PlanChoice } from './plan-choice';
import { CancelPlan } from './cancel-plan';

// Named by who they're for (replica/launch/pricing.md).
const FOR = { starter: 'For one shop with one counter', growth: 'For a shop with a few branches', pro: 'For chains and franchises' } as const;

export default async function BillingPage() {
  const ctx = await requireOwner();
  const [b, sub, org] = await Promise.all([getBilling(ctx), getSubscription(ctx), getOrg(ctx)]);
  const renewsOn = sub ? new Date(sub.currentPeriodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: org.timezone || 'Africa/Kigali' }) : '';
  const plans = (['starter', 'growth', 'pro'] as const).map((p) => ({
    id: p, name: p[0].toUpperCase() + p.slice(1), audience: FOR[p], price: PRICES[p][b.currency],
    limits: [`${PLAN_LIMITS[p].designs} card ${PLAN_LIMITS[p].designs === 1 ? 'design' : 'designs'}`, `${PLAN_LIMITS[p].locations} ${PLAN_LIMITS[p].locations === 1 ? 'location' : 'locations'}`, `Up to ${PLAN_LIMITS[p].devices} counter phones, re-paired free`, 'Unlimited customers and messages', 'Birthday and “We miss you” messages'],
  }));
  return (
    <>
      <PageHeader title="Plan & billing" description={b.planStatus === 'trialing' ? `Free trial: ${b.daysLeft} ${b.daysLeft === 1 ? 'day' : 'days'} left.` : `You’re on ${b.plan[0].toUpperCase() + b.plan.slice(1)}.`} />
      {!(b.currency === 'USD' ? process.env.PADDLE_API_KEY : process.env.FLW_SECRET_KEY) && <Banner tone="info" title="No payment provider configured">In development, choosing a plan switches it directly. Add Paddle (cards) or Flutterwave (MTN MoMo, Airtel Money) keys to take real payments.</Banner>}
      <div className="mt-6"><PlanChoice plans={plans} current={b.planStatus === 'active' ? b.plan : undefined} currency={b.currency} recommended="growth" /></div>
      <p className="mt-4 text-xs text-text-muted">Pay yearly and get 12 months for the price of 10. Cancel any time from this page; you keep everything until the end of the period you paid for.</p>
      {sub && b.planStatus === 'active' && (
        <div className="mt-6 max-w-xl"><CancelPlan planName={b.plan[0].toUpperCase() + b.plan.slice(1)} renewsOn={renewsOn} cancelling={sub.cancelAtPeriodEnd} canUndo={sub.provider !== 'paddle'} /></div>
      )}
    </>
  );
}

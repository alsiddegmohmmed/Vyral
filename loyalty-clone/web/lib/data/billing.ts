// Billing data functions (Postgres). Our tables are the source of truth;
// providers only move money (architecture.md "Billing state machine").
import 'server-only';
import { one, q } from '@/lib/db/client';
import type { BillingUpdate } from '@/lib/integrations/contracts';

/** true when new (or stored earlier but never processed): process it. */
export async function recordWebhook(provider: 'paddle' | 'flutterwave', externalId: string, type: string, payload: unknown): Promise<boolean> {
  const r = await one(
    `insert into webhook_events (provider, external_id, type, payload) values ($1,$2,$3,$4)
     on conflict (provider, external_id) do update set type = excluded.type where webhook_events.processed_at is null returning id`,
    [provider, externalId, type, JSON.stringify(payload ?? {})]);
  return !!r;
}

export async function markWebhook(provider: 'paddle' | 'flutterwave', externalId: string, error?: string) {
  await q('update webhook_events set processed_at = now(), error = $3 where provider = $1 and external_id = $2', [provider, externalId, error?.slice(0, 500) ?? null]);
}

/** Recompute orgs.plan / plan_status from the org's live subscription (the entitlement). */
export async function recomputeEntitlement(orgId: string) {
  await q(
    `with s as (select plan, status, current_period_end, grace_until from subscriptions where org_id = $1 and status <> 'cancelled' order by created_at desc limit 1),
          last as (select plan, current_period_end from subscriptions where org_id = $1 order by current_period_end desc limit 1)
     update orgs o set
       plan = coalesce((select plan from s), (select plan from last), o.plan),
       plan_status = case
         when exists (select 1 from s where status = 'active') then 'active'
         when exists (select 1 from s where status = 'past_due' and coalesce(grace_until, current_period_end + interval '7 days') > now()) then 'past_due'
         when exists (select 1 from s) then 'locked'
         when exists (select 1 from last where current_period_end > now()) then 'active'   -- cancelled, paid to period end
         when o.plan_status = 'trialing' and o.trial_ends_at > now() then 'trialing'
         else 'locked' end,
       locked_at = case when o.locked_at is null then null else o.locked_at end
     where o.id = $1`, [orgId]);
  await q(`update orgs set locked_at = case when plan_status = 'locked' then coalesce(locked_at, now()) else null end where id = $1`, [orgId]);
}

export async function applyBillingUpdate(u: BillingUpdate): Promise<void> {
  if (u.kind === 'ignored') return;
  if (u.kind === 'subscription') {
    // insert or update by provider id; an older event never overwrites a newer one
    await q(
      `with cancel_others as (
         update subscriptions set status = 'cancelled' where org_id = $1 and status <> 'cancelled' and (provider <> $2 or provider_subscription_id is distinct from $4))
       insert into subscriptions (org_id, provider, provider_customer_id, provider_subscription_id, plan, billing_interval, status, current_period_start, current_period_end, cancel_at_period_end, provider_updated_at, grace_until)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, case when $7 = 'past_due' then $9::timestamptz + interval '7 days' end)
       on conflict (provider, provider_subscription_id) where provider_subscription_id is not null do update set
         plan = excluded.plan, billing_interval = excluded.billing_interval, status = excluded.status,
         current_period_start = excluded.current_period_start, current_period_end = excluded.current_period_end,
         cancel_at_period_end = excluded.cancel_at_period_end, provider_updated_at = excluded.provider_updated_at,
         provider_customer_id = coalesce(excluded.provider_customer_id, subscriptions.provider_customer_id), grace_until = excluded.grace_until
       where subscriptions.provider_updated_at is null or subscriptions.provider_updated_at < excluded.provider_updated_at`,
      [u.orgId, u.provider, u.providerCustomerId ?? null, u.providerSubscriptionId ?? null, u.plan, u.interval, u.status,
        u.currentPeriodStart, u.currentPeriodEnd, u.cancelAtPeriodEnd, u.occurredAt]);
    await recomputeEntitlement(u.orgId);
    return;
  }
  // payment
  if (u.provider === 'paddle') {
    // Paddle bills itself (merchant of record): keep a receipt row per transaction, idempotent on provider_ref
    await q(
      `insert into invoices (org_id, provider, provider_ref, amount_minor, currency, period_start, period_end, due_at, status, paid_at)
       values ($1, 'paddle', $2, $3, $4, $5, $5, $5, $6, case when $6 = 'paid' then $5::timestamptz end)
       on conflict (provider, provider_ref) where provider_ref is not null do update set status = excluded.status, paid_at = excluded.paid_at`,
      [u.orgId, u.providerRef, u.amountMinor, u.currency, u.occurredAt, u.status]);
    await recomputeEntitlement(u.orgId);
    return;
  }
  const inv = await one<{ id: string; plan: string; billingInterval: string; periodStart: string; periodEnd: string }>(
    `update invoices set status = $3, provider_ref = $4, paid_at = case when $3 = 'paid' then now() end
      where org_id = $1 and (id = $2::uuid or ($2::uuid is null and provider_ref = $4)) and status in ('open','failed')
        and ($3 <> 'paid' or ($5 >= amount_minor and currency = $6))
      returning id, plan, billing_interval, period_start, period_end`,
    [u.orgId, u.invoiceId ?? null, u.status, u.providerRef, u.amountMinor, u.currency]);
  if (!inv) {
    if (u.status === 'paid') throw new Error('payment did not match an open invoice (amount, currency or id)');
    return;
  }
  if (u.status === 'paid' && u.provider === 'flutterwave') {
    // prepaid period: the paid invoice becomes (or extends) the live subscription
    await q(
      `with up as (update subscriptions set plan = $3, billing_interval = $4, status = 'active', current_period_end = greatest(current_period_end, $6::timestamptz),
                     grace_until = null, provider_updated_at = now()
                    where org_id = $1 and provider = 'flutterwave' and status <> 'cancelled' returning id),
            ins as (insert into subscriptions (org_id, provider, plan, billing_interval, status, current_period_start, current_period_end, provider_updated_at)
                    select $1, 'flutterwave', $3, $4, 'active', $5, $6, now() where not exists (select 1 from up) returning id)
       update invoices set subscription_id = coalesce((select id from up), (select id from ins)) where id = $2`,
      [u.orgId, inv.id, inv.plan, inv.billingInterval, inv.periodStart, inv.periodEnd]);
  }
  await recomputeEntitlement(u.orgId);
}

/** Open (or reuse) the invoice for the org's next prepaid period. Same day = same invoice (double-click safe). */
export async function openInvoice(orgId: string, plan: 'starter' | 'growth' | 'pro', interval: 'month' | 'year', currency: 'RWF' | 'USD', amountMinor: number): Promise<string> {
  const r = await one<{ id: string }>(
    `with base as (select date_trunc('day', greatest(now(), coalesce((select max(current_period_end) from subscriptions where org_id = $1 and status <> 'cancelled'), now()))) as start)
     insert into invoices (org_id, provider, amount_minor, currency, period_start, period_end, due_at, plan, billing_interval)
     select $1, 'flutterwave', $5, $4, base.start, base.start + case when $3 = 'year' then interval '1 year' else interval '1 month' end, now(), $2, $3 from base
     on conflict (org_id, period_start) where status in ('open','paid')
       do update set amount_minor = excluded.amount_minor, plan = excluded.plan, billing_interval = excluded.billing_interval, currency = excluded.currency
       where invoices.status = 'open'
     returning id`, [orgId, plan, interval, currency, amountMinor]);
  if (!r) throw new Error('This period is already paid.');
  return r.id;
}

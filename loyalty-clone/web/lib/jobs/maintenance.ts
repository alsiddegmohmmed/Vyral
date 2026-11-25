import 'server-only';
import { q } from '@/lib/db/client';
import { deliverMessage } from '@/lib/data/api';
import { recomputeEntitlement } from '@/lib/data/billing';
import { sendEmail } from '@/lib/email';

/** Daily: trial ends, Flutterwave renewals (invoice 7 days ahead), past due -> grace -> locked -> paused. */
export async function runBilling() {
  const trialEnded = await q<{ id: string }>(
    `update orgs set plan_status = 'locked', locked_at = now()
      where plan_status = 'trialing' and trial_ends_at < now()
        and not exists (select 1 from subscriptions s where s.org_id = orgs.id and s.status <> 'cancelled') returning id`);
  const dueSoon = await q<{ orgId: string; plan: 'starter' | 'growth' | 'pro'; billingInterval: 'month' | 'year'; email: string; name: string }>(
    `select s.org_id, s.plan, s.billing_interval, u.email::text as email, o.name
       from subscriptions s join orgs o on o.id = s.org_id join org_members m on m.org_id = o.id and m.role = 'owner' join users u on u.id = m.user_id
      where s.provider = 'flutterwave' and s.status = 'active' and not s.cancel_at_period_end
        and s.current_period_end < now() + interval '7 days'
        and not exists (select 1 from invoices i where i.org_id = s.org_id and i.period_start >= date_trunc('day', s.current_period_end) and i.status in ('open','paid'))`);
  const { openInvoice } = await import('@/lib/data/billing');
  const { PRICES } = await import('@/lib/data/api');
  for (const s of dueSoon) {
    const amount = PRICES[s.plan].RWF * (s.billingInterval === 'year' ? 10 : 1);
    await openInvoice(s.orgId, s.plan, s.billingInterval, 'RWF', amount);
    await sendEmail({ to: s.email, orgId: s.orgId, kind: 'invoice', subject: 'Your Garuka plan renews soon',
      text: `Hi ${s.name},\n\nYour plan renews in a few days. Pay with MTN MoMo, Airtel Money or card from Plan & billing:\n${process.env.PUBLIC_BASE_URL ?? 'http://localhost:3100'}/settings/billing\n\nYour cards keep working while you pay.` });
  }
  const lapsed = await q<{ orgId: string }>(
    `update subscriptions set status = 'past_due', grace_until = current_period_end + interval '7 days'
      where provider = 'flutterwave' and status = 'active' and current_period_end < now() returning org_id`);
  const cancelled = await q<{ orgId: string }>(
    `update subscriptions set status = 'cancelled' where status <> 'cancelled' and cancel_at_period_end and current_period_end < now() returning org_id`);
  for (const { orgId } of [...lapsed, ...cancelled]) await recomputeEntitlement(orgId);
  const graceOver = await q<{ orgId: string }>(`select distinct org_id from subscriptions where status = 'past_due' and grace_until < now()`);
  for (const { orgId } of graceOver) await recomputeEntitlement(orgId);
  // 30 days locked: pause live cards (customers keep banked rewards; owner can still fix cards)
  const paused = await q(`update campaigns c set status = 'paused' from orgs o where o.id = c.org_id and o.plan_status = 'locked' and o.locked_at < now() - interval '30 days' and c.status = 'live' returning c.id`);
  return { trialEnded: trialEnded.length, invoicesOpened: dueSoon.length, pastDue: lapsed.length, cancelled: cancelled.length, paused: paused.length };
}

/** Daily: expired auth rows, idempotency keys, privacy scrub, scheduled account deletions. */
export async function runCleanup() {
  const counts: Record<string, number> = {};
  const run = async (name: string, sql: string) => { counts[name] = (await q(sql)).length; };
  await run('sessions', `delete from sessions where expires_at < now() returning 1`);
  await run('authTokens', `delete from auth_tokens where expires_at < now() - interval '1 day' returning 1`);
  await run('pairingCodes', `delete from pairing_codes where expires_at < now() returning 1`);
  await run('idempotencyKeys', `delete from idempotency_keys where created_at < now() - interval '7 days' returning 1`);
  await run('rateLimits', `delete from rate_limits where window_start < now() - interval '1 day' returning 1`);
  // customers deleted 30+ days ago lose their personal data; the ledger keeps counts only
  await run('scrubbedCustomers', `update customers set name = null, email = null, phone_e164 = null, birthday_month = null, birthday_day = null, extra = '{}', consent_text = null
                                   where deleted_at < now() - interval '30 days' and (name is not null or email is not null or phone_e164 is not null) returning 1`);
  await run('scrubbedEvents', `update card_events e set ip = null, user_agent = null, scan_lat = null, scan_lon = null
                                 from cards k where k.id = e.card_id and k.status = 'deleted' and k.deleted_at < now() - interval '30 days'
                                   and (e.ip is not null or e.user_agent is not null or e.scan_lat is not null) returning 1`);
  await run('deletedOrgs', `delete from orgs where deletion_scheduled_at < now() returning 1`);
  await run('orphanUsers', `delete from users u where not exists (select 1 from org_members m where m.user_id = u.id) and u.created_at < now() - interval '1 day' returning 1`);
  return counts;
}

/** Every few minutes: finish message fan-outs that didn't complete after the response. */
export async function runDeliveries() {
  const stuck = await q<{ id: string }>(`select id from messages where status in ('queued','sending') and created_at < now() - interval '2 minutes' order by created_at limit 20`);
  for (const { id } of stuck) await deliverMessage(id);
  return { resumed: stuck.length };
}

import 'server-only';
import { one, q } from '@/lib/db/client';

// Hourly. For every enabled automation whose org's local time is at or after its
// send hour, claim eligible cards in automation_sends (never twice per period;
// skipped/failed rows are re-claimed, max 3 attempts), write the note on the
// pass, and push it with a notification slot (max 3 per card per day).

const CLAIM_BIRTHDAY = `
with a as (
  select a.id, a.org_id, a.campaign_id, (now() at time zone o.timezone)::date as d
    from automations a join orgs o on o.id = a.org_id join campaigns c on c.id = a.campaign_id
   where a.enabled and a.kind = 'birthday' and c.status = 'live' and o.plan_status <> 'locked'
     and extract(hour from now() at time zone o.timezone) >= a.send_hour),
elig as (
  select distinct on (cu.id, a.id) a.id as aid, k.id as card_id, extract(year from a.d)::text as period_key
    from a join cards k on k.campaign_id = a.campaign_id and k.status = 'active' and (k.expires_at is null or k.expires_at > now()) and (k.apple_installed or k.google_saved)
    join customers cu on cu.id = k.customer_id and cu.deleted_at is null and cu.created_at::date < a.d
    join campaigns c on c.id = a.campaign_id
   where (not c.consent_enabled or cu.marketing_consent)
     and ((cu.birthday_month = extract(month from a.d) and cu.birthday_day = extract(day from a.d))
       or (cu.birthday_month = 2 and cu.birthday_day = 29 and extract(month from a.d) = 2 and extract(day from a.d) = 28
           and not ((extract(year from a.d)::int % 4 = 0 and extract(year from a.d)::int % 100 <> 0) or extract(year from a.d)::int % 400 = 0)))
     -- one birthday message per customer per org per year, even with several cards
     and not exists (select 1 from automation_sends s join automations x on x.id = s.automation_id join cards k2 on k2.id = s.card_id
                      where x.org_id = a.org_id and x.kind = 'birthday' and k2.customer_id = cu.id and s.period_key = extract(year from a.d)::text
                        and s.automation_id <> a.id and s.status = 'sent')
   order by cu.id, a.id, k.last_visit_at desc)
insert into automation_sends (automation_id, card_id, period_key)
select aid, card_id, period_key from elig
on conflict (automation_id, card_id, period_key) do update set status = 'pending', attempts = automation_sends.attempts + 1
  where automation_sends.status in ('skipped','failed') and automation_sends.attempts < 3
returning id, automation_id, card_id`;

const CLAIM_WINBACK = `
with a as (
  select a.id, a.campaign_id, a.days_inactive, a.enabled_at
    from automations a join orgs o on o.id = a.org_id join campaigns c on c.id = a.campaign_id
   where a.enabled and a.kind = 'winback' and c.status = 'live' and o.plan_status <> 'locked'
     and extract(hour from now() at time zone o.timezone) >= a.send_hour),
elig as (
  select a.id as aid, k.id as card_id, (k.last_visit_at at time zone 'UTC')::date::text as period_key
    from a join cards k on k.campaign_id = a.campaign_id and k.status = 'active' and (k.expires_at is null or k.expires_at > now()) and (k.apple_installed or k.google_saved)
    join customers cu on cu.id = k.customer_id and cu.deleted_at is null
    join campaigns c on c.id = a.campaign_id
   where (not c.consent_enabled or cu.marketing_consent)
     and k.last_visit_at < now() - make_interval(days => a.days_inactive)
     -- only absences that end after the automation was switched on (no day-one blast)
     and k.last_visit_at >= a.enabled_at - make_interval(days => a.days_inactive))
insert into automation_sends (automation_id, card_id, period_key)
select aid, card_id, period_key from elig
on conflict (automation_id, card_id, period_key) do update set status = 'pending', attempts = automation_sends.attempts + 1
  where automation_sends.status in ('skipped','failed') and automation_sends.attempts < 3
returning id, automation_id, card_id`;

export async function runAutomations() {
  const claimed = [...await q<{ id: string; automationId: string; cardId: string }>(CLAIM_BIRTHDAY), ...await q<{ id: string; automationId: string; cardId: string }>(CLAIM_WINBACK)];
  const { pushCardUpdate } = await import('@/lib/wallet/notify');
  const stats = { claimed: claimed.length, sent: 0, skipped: 0, failed: 0 };
  const perAutomation = new Map<string, { sent: number; skipped: number }>();
  for (const s of claimed) {
    try {
      const info = await one<{ kind: 'birthday' | 'winback'; body: string; business: string; firstName: string; orgId: string; campaignId: string }>(
        `with x as (select a.kind, replace(a.body, '{name}', coalesce(nullif(split_part(cu.name, ' ', 1), ''), 'friend')) as body, c.program_name as business,
                           a.org_id, a.campaign_id, k.id as card_id
                      from automations a join cards k on k.id = $2 join customers cu on cu.id = k.customer_id join campaigns c on c.id = a.campaign_id where a.id = $1),
              u as (update cards set note_text = x.body, note_updated_at = now() from x where cards.id = x.card_id)
         select kind, body, business, org_id, campaign_id from x`, [s.automationId, s.cardId]);
      const r = await pushCardUpdate(s.cardId, { reason: info!.kind, message: { header: info!.business, body: info!.body } });
      const status = r.notified ? 'sent' : 'skipped';
      await q(`update automation_sends set status = $2, reason = $3 where id = $1`, [s.id, status, r.notified ? null : 'daily limit or wallet not configured']);
      stats[status]++;
      const m = perAutomation.get(s.automationId) ?? { sent: 0, skipped: 0 };
      m[status]++; perAutomation.set(s.automationId, m);
    } catch (e) {
      await q(`update automation_sends set status = 'failed', reason = $2 where id = $1`, [s.id, String((e as Error).message).slice(0, 300)]);
      stats.failed++;
    }
  }
  // one history row per automation per run, for the Messages screen
  for (const [automationId, m] of perAutomation) {
    await q(`insert into messages (org_id, campaign_id, kind, body, status, recipients, delivered, skipped, started_at, finished_at)
             select org_id, campaign_id, kind, body, 'sent', $2, $3, $4, now(), now() from automations where id = $1`, [automationId, m.sent + m.skipped, m.sent, m.skipped]);
  }
  return stats;
}

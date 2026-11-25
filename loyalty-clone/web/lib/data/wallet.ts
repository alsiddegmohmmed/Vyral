// Wallet-facing data functions (Postgres). Called by lib/wallet/* and the
// Apple web service / Google callback routes. One statement each.
import 'server-only';
import { one, q } from '@/lib/db/client';
import { encodeBarcode } from '@/lib/barcode';
import type { WalletPassData } from '@/lib/integrations/contracts';

export async function getPassDataBySerial(serial: string): Promise<WalletPassData | null> {
  if (!/^[0-9A-Z]{26}$/.test(serial)) return null;
  const r = await one<Record<string, unknown> & { links: WalletPassData['campaign']['links']; locations: WalletPassData['campaign']['locations'] }>(
    `select k.id as card_id, k.serial, k.apple_auth_token, k.barcode_token, k.manual_code, split_part(coalesce(cu.name,''), ' ', 1) as first_name,
            k.status, (k.expires_at is not null and k.expires_at <= now()) as expired, k.current_stamps, k.rewards_available, k.note_text,
            k.pass_modified_at,
            exists (select 1 from pass_notifications n where n.card_id = k.id and n.channel = 'apple' and n.reason = 'reward_earned' and n.created_at >= coalesce(k.last_stamp_at, k.created_at) - interval '1 minute') as alert_reward,
            exists (select 1 from pass_notifications n where n.card_id = k.id and n.channel = 'apple' and n.reason = 'broadcast' and n.created_at >= coalesce(c.news_updated_at, 'infinity')) as alert_news,
            exists (select 1 from pass_notifications n where n.card_id = k.id and n.channel = 'apple' and n.reason in ('birthday','winback') and n.created_at >= coalesce(k.note_updated_at, 'infinity') - interval '1 minute') as alert_note,
            c.id as campaign_id, c.name, c.program_name, o.name as business, c.google_class_id, c.total_stamps,
            coalesce(c.description,'') as description, coalesce(c.how_to_earn,'') as how_to_earn, coalesce(c.terms,'') as terms,
            c.stamp_message, c.reward_message, c.news_text, c.background_color, c.foreground_color, c.label_color, c.stamp_color, c.stamp_icon, c.logo_text,
            (select r.name from rewards r where r.campaign_id = c.id and r.position = 1) as reward_name,
            (select coalesce(r.details,'') from rewards r where r.campaign_id = c.id and r.position = 1) as reward_details,
            coalesce((select json_agg(json_build_object('kind', l.kind, 'label', l.label, 'value', l.value) order by l.position) from campaign_links l where l.campaign_id = c.id), '[]') as links,
            coalesce((select json_agg(json_build_object('name', l.name, 'lat', l.lat, 'lon', l.lon, 'addressOnCard', coalesce(l.address_on_card, ''), 'relevantText', coalesce(l.relevant_text, '')))
                        from campaign_locations cl join locations l on l.id = cl.location_id where cl.campaign_id = c.id), '[]') as locations
       from cards k join customers cu on cu.id = k.customer_id join campaigns c on c.id = k.campaign_id join orgs o on o.id = k.org_id
      where k.serial = $1`, [serial]);
  if (!r) return null;
  return {
    cardId: r.cardId as string, serial: r.serial as string, appleAuthToken: r.appleAuthToken as string, qrPayload: encodeBarcode(r.barcodeToken as string),
    manualCode: r.manualCode as string, firstName: r.firstName as string, status: r.status as 'active' | 'deleted', expired: r.expired as boolean,
    currentStamps: r.currentStamps as number, rewardsAvailable: r.rewardsAvailable as number, totalStamps: r.totalStamps as number,
    noteText: (r.noteText as string) ?? undefined, newsText: (r.newsText as string) ?? undefined, passModifiedAt: r.passModifiedAt as string,
    appleAlert: { reward: r.alertReward as boolean, news: r.alertNews as boolean, note: r.alertNote as boolean },
    campaign: {
      id: r.campaignId as string, name: r.name as string, programName: r.programName as string, business: r.business as string,
      googleClassId: (r.googleClassId as string) ?? undefined, description: r.description as string, howToEarn: r.howToEarn as string, terms: r.terms as string,
      stampMessage: r.stampMessage as string, rewardMessage: r.rewardMessage as string,
      reward: { name: (r.rewardName as string) ?? '', details: (r.rewardDetails as string) ?? '' },
      design: { background: r.backgroundColor as string, foreground: r.foregroundColor as string, label: r.labelColor as string, stamp: r.stampColor as string, icon: r.stampIcon as string, logoText: (r.logoText as string) ?? '' },
      links: r.links, locations: r.locations.slice(0, 10),
    },
  };
}

export async function getPassDataByCardId(cardId: string): Promise<WalletPassData | null> {
  if (!/^[0-9a-f-]{36}$/.test(cardId)) return null;
  const r = await one<{ serial: string }>('select serial from cards where id = $1', [cardId]);
  return r ? getPassDataBySerial(r.serial) : null;
}

export async function checkAppleAuth(serial: string, token: string): Promise<boolean> {
  if (!token || token.length < 16) return false;
  return !!(await one('select 1 from cards where serial = $1 and apple_auth_token = $2', [serial, token]));
}

export async function registerAppleDevice(deviceLibraryId: string, pushToken: string, serial: string): Promise<'created' | 'exists'> {
  const r = await one<{ created: number }>(
    `with c as (select id, org_id, campaign_id from cards where serial = $3),
          d as (insert into apple_devices (device_library_id, push_token) values ($1, $2)
                on conflict (device_library_id) do update set push_token = excluded.push_token returning device_library_id),
          r as (insert into apple_registrations (device_library_id, card_id) select d.device_library_id, c.id from d, c on conflict do nothing returning card_id),
          u as (update cards set apple_installed = true, apple_installed_at = coalesce(apple_installed_at, now()) from r where cards.id = r.card_id and not cards.apple_installed returning cards.id),
          e as (insert into card_events (org_id, campaign_id, card_id, type, source) select c.org_id, c.campaign_id, c.id, 'apple_installed', 'customer' from c, u)
     select (select count(*) from r)::int as created`, [deviceLibraryId, pushToken, serial]);
  return r && r.created > 0 ? 'created' : 'exists';
}

export async function unregisterAppleDevice(deviceLibraryId: string, serial: string): Promise<void> {
  await q(
    `with c as (select id, org_id, campaign_id from cards where serial = $2),
          r as (delete from apple_registrations ar using c where ar.device_library_id = $1 and ar.card_id = c.id returning ar.card_id),
          u as (update cards set apple_installed = false from r
                 where cards.id = r.card_id and not exists (select 1 from apple_registrations x where x.card_id = r.card_id and x.device_library_id <> $1) returning cards.id),
          e as (insert into card_events (org_id, campaign_id, card_id, type, source) select c.org_id, c.campaign_id, c.id, 'apple_removed', 'customer' from c, u)
     delete from apple_devices d where d.device_library_id = $1
        and not exists (select 1 from apple_registrations x where x.device_library_id = $1 and x.card_id not in (select card_id from r))`, [deviceLibraryId, serial]);
}

export async function appleSerialsSince(deviceLibraryId: string, sinceMs: number | null): Promise<string[]> {
  return (await q<{ serial: string }>('select serial from apple_updated_serials($1, $2)', [deviceLibraryId, sinceMs])).map((r) => r.serial);
}

export async function applePushTokensForCard(cardId: string) {
  return q<{ deviceLibraryId: string; pushToken: string }>(
    'select d.device_library_id, d.push_token from apple_registrations r join apple_devices d on d.device_library_id = r.device_library_id where r.card_id = $1', [cardId]);
}

export async function dropAppleDevice(deviceLibraryId: string): Promise<void> {
  await q(
    `with r as (select card_id from apple_registrations where device_library_id = $1),
          d as (delete from apple_devices where device_library_id = $1)
     update cards set apple_installed = exists (select 1 from apple_registrations x where x.card_id = cards.id and x.device_library_id <> $1)
       from r where cards.id = r.card_id`, [deviceLibraryId]);
}

export async function setGoogleObjectId(cardId: string, objectId: string) { await q('update cards set google_object_id = $2 where id = $1', [cardId, objectId]); }
export async function setGoogleClassId(campaignId: string, classId: string) { await q('update campaigns set google_class_id = $2 where id = $1', [campaignId, classId]); }

export async function recordGoogleCallback(nonce: string, objectId: string, event: 'save' | 'del', payload: unknown): Promise<boolean> {
  const r = await one<{ fresh: number }>(
    `with w as (insert into webhook_events (provider, external_id, type, payload, processed_at) values ('google_wallet', $1, $3, $4, now())
                on conflict (provider, external_id) do nothing returning id),
          k as (update cards set google_saved = ($3 = 'save'), google_saved_at = case when $3 = 'save' then now() else google_saved_at end
                 from w where cards.google_object_id = $2 returning cards.id, cards.org_id, cards.campaign_id),
          e as (insert into card_events (org_id, campaign_id, card_id, type, source)
                select org_id, campaign_id, id, case when $3 = 'save' then 'google_saved' else 'google_removed' end, 'customer' from k)
     select (select count(*) from w)::int as fresh`, [nonce, objectId, event, JSON.stringify(payload ?? {})]);
  return (r?.fresh ?? 0) > 0;
}

export async function claimNotificationSlot(cardId: string, channel: 'apple' | 'google', reason: 'reward_earned' | 'broadcast' | 'birthday' | 'winback', messageId?: string): Promise<boolean> {
  const r = await one<{ ok: boolean }>('select claim_notification_slot($1, $2, $3, $4) as ok', [cardId, channel, reason, messageId ?? null]);
  return !!r?.ok;
}

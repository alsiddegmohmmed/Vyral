-- 0008: mystery box rewards (mechanism studied from StampMate's public wizard;
-- see replica/design/reference-stampmate.md). A card can give one fixed reward
-- (default) or a mystery box: when the card fills, the server draws one prize
-- from a weighted list. The draw happens inside apply_card_transaction, under the
-- card lock and the idempotency key, so a replayed or doubled scan can never
-- redraw. Won prizes are snapshotted (name + tier) so later edits to the list
-- don't change what a customer already won.

alter table campaigns add column reward_mode text not null default 'single'
  check (reward_mode in ('single', 'mystery'));

create table reward_prizes (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  position     smallint not null check (position between 1 and 6),
  name         text not null check (length(name) between 1 and 60),
  weight       int not null check (weight between 1 and 100),       -- relative chance
  tier         text not null default 'common' check (tier in ('common', 'rare', 'legendary')),
  created_at   timestamptz not null default now(),
  unique (campaign_id, position)
);
alter table reward_prizes enable row level security;

create table card_prizes (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  card_id      uuid not null,
  campaign_id  uuid not null,
  prize_name   text not null,
  tier         text not null check (tier in ('common', 'rare', 'legendary')),
  earned_at    timestamptz not null default now(),
  opened_at    timestamptz,             -- the customer revealed it on the web card
  redeemed_at  timestamptz,             -- handed over at the counter
  foreign key (org_id, card_id) references cards(org_id, id) on delete cascade
);
create index card_prizes_waiting_idx on card_prizes (card_id, earned_at) where redeemed_at is null;
alter table card_prizes enable row level security;

-- weighted draw; with no prizes listed it falls back to the card's single reward
create or replace function draw_prize(p_campaign uuid) returns jsonb
language plpgsql as $$
declare
  tot  int;
  pick int;
  acc  int := 0;
  r    record;
begin
  select coalesce(sum(weight), 0) into tot from reward_prizes where campaign_id = p_campaign;
  if tot = 0 then
    return jsonb_build_object('name', coalesce((select name from rewards where campaign_id = p_campaign and position = 1), 'Reward'), 'tier', 'common');
  end if;
  pick := floor(random() * tot)::int;           -- 0 .. tot-1
  for r in select name, tier, weight from reward_prizes where campaign_id = p_campaign order by position loop
    acc := acc + r.weight;
    if pick < acc then
      return jsonb_build_object('name', r.name, 'tier', r.tier);
    end if;
  end loop;
  return jsonb_build_object('name', r.name, 'tier', r.tier);
end $$;

create or replace function replace_reward_prizes(p_campaign uuid, p_prizes jsonb) returns void
language plpgsql as $$
begin
  delete from reward_prizes where campaign_id = p_campaign;
  insert into reward_prizes (campaign_id, position, name, weight, tier)
  select p_campaign, e.ord, e.v->>'name', (e.v->>'weight')::int, coalesce(e.v->>'tier', 'common')
    from jsonb_array_elements(p_prizes) with ordinality as e(v, ord);
end $$;

create or replace function apply_card_transaction(
  p_org_id            uuid,
  p_card_id           uuid,
  p_stamps            int,           -- may be negative (remove stamps)
  p_redeem            int,           -- rewards to redeem, >= 0
  p_source            text,          -- 'scanner' | 'dashboard'
  p_actor_user_id     uuid,
  p_actor_label       text,
  p_idempotency_key   text,
  p_scanner_device_id uuid default null,
  p_location_id       uuid default null,
  p_lat               double precision default null,
  p_lon               double precision default null
) returns jsonb
language plpgsql as $$
declare
  c         cards;
  camp      campaigns;
  total     int;
  new_cur   int;
  earned    int := 0;
  net_today int;
  req_hash  text;
  prev      idempotency_keys;
  loc_name  text;
  res       jsonb;
  won       jsonb := '[]'::jsonb;   -- mystery box: prizes drawn in this transaction
  given     jsonb := '[]'::jsonb;   -- mystery box: prizes handed over in this transaction
  prize     jsonb;
begin
  if p_source not in ('scanner','dashboard') then
    raise exception 'invalid_source';
  end if;
  if p_stamps = 0 and p_redeem = 0 then
    raise exception 'empty_transaction';
  end if;
  if p_redeem < 0 then
    raise exception 'invalid_redeem';
  end if;
  if p_idempotency_key is null then
    raise exception 'idempotency_key_required';
  end if;

  -- 0. the card must exist in this org (clean error before touching the key table)
  perform 1 from cards where id = p_card_id and org_id = p_org_id;
  if not found then
    raise exception 'card_not_found';
  end if;

  -- 1. claim the key (a concurrent duplicate blocks here until the first commits)
  req_hash := md5(concat_ws('|', p_card_id, p_stamps, p_redeem, p_source));
  insert into idempotency_keys (org_id, key, card_id, request_hash)
  values (p_org_id, p_idempotency_key, p_card_id, req_hash)
  on conflict (org_id, key) do nothing;
  if not found then
    select * into prev from idempotency_keys where org_id = p_org_id and key = p_idempotency_key;
    if prev.request_hash <> req_hash then
      raise exception 'idempotency_key_reused';
    end if;
    return prev.result || jsonb_build_object('replayed', true);
  end if;

  -- 2. lock the card
  select * into c from cards where id = p_card_id and org_id = p_org_id for update;
  if not found then
    raise exception 'card_not_found';
  end if;
  if c.status <> 'active' then
    raise exception 'card_deleted';
  end if;
  select * into camp from campaigns where id = c.campaign_id;

  -- 3. rules
  if p_source = 'scanner' then
    if c.expires_at is not null and c.expires_at <= now() then
      raise exception 'card_expired';
    end if;
    if camp.status <> 'live' then
      raise exception 'campaign_not_live';
    end if;
    if abs(p_stamps) > camp.max_stamps_per_transaction then
      raise exception 'too_many_stamps';
    end if;
    if p_stamps > 0 and camp.stamp_cooldown_minutes > 0 and c.last_stamp_at is not null
       and c.last_stamp_at > now() - make_interval(mins => camp.stamp_cooldown_minutes) then
      raise exception 'cooldown_active';
    end if;
    if p_stamps > 0 and camp.max_stamps_per_day > 0 then
      select coalesce(sum(case type when 'stamped' then quantity else -quantity end), 0)
        into net_today
        from card_events
       where card_id = c.id and type in ('stamped','unstamped')
         and created_at > now() - interval '24 hours';
      if net_today + p_stamps > camp.max_stamps_per_day then
        raise exception 'daily_limit_reached';
      end if;
    end if;
  else
    if abs(p_stamps) > 100 or p_redeem > 100 then
      raise exception 'too_many_stamps';
    end if;
  end if;

  total := camp.total_stamps;

  -- 4. stamps
  if p_stamps < 0 then
    if c.current_stamps + p_stamps < 0 then
      raise exception 'not_enough_stamps';
    end if;
    new_cur := c.current_stamps + p_stamps;
  else
    new_cur := c.current_stamps + p_stamps;
    earned  := new_cur / total;
    new_cur := new_cur % total;
  end if;

  -- 5. redemption (a reward earned in this same transaction can be redeemed now)
  if p_redeem > c.rewards_available + earned then
    raise exception 'no_reward_available';
  end if;

  update cards set
    current_stamps         = new_cur,
    rewards_available      = c.rewards_available + earned - p_redeem,
    total_stamps_earned    = greatest(c.total_stamps_earned + p_stamps, 0),
    total_rewards_earned   = c.total_rewards_earned + earned,
    total_rewards_redeemed = c.total_rewards_redeemed + p_redeem,
    last_stamp_at          = case when p_stamps > 0 then now() else c.last_stamp_at end,
    last_visit_at          = case when p_stamps > 0 or p_redeem > 0 then now() else c.last_visit_at end,
    previous_barcode_token = case when p_redeem > 0 then c.barcode_token else c.previous_barcode_token end,
    barcode_token          = case when p_redeem > 0 then random_token(16) else c.barcode_token end,
    barcode_rotated_at     = case when p_redeem > 0 then now() else c.barcode_rotated_at end
  where id = c.id
  returning * into c;

  -- 5b. mystery box: draw one prize per reward earned (server-side, inside the lock,
  --     so a replay or a double tap can't redraw), then hand over the oldest ones
  if camp.reward_mode = 'mystery' then
    for i in 1..earned loop
      prize := draw_prize(camp.id);
      insert into card_prizes (org_id, card_id, campaign_id, prize_name, tier)
      values (p_org_id, c.id, c.campaign_id, prize->>'name', prize->>'tier');
      won := won || jsonb_build_array(prize);
    end loop;
    if p_redeem > 0 then
      with r as (
        select id from card_prizes where card_id = c.id and redeemed_at is null
         order by earned_at, id limit p_redeem for update
      ), u as (
        update card_prizes cp set redeemed_at = now() from r where cp.id = r.id returning cp.prize_name, cp.tier
      )
      select coalesce(jsonb_agg(jsonb_build_object('name', prize_name, 'tier', tier)), '[]'::jsonb) into given from u;
    end if;
  end if;

  -- 6. ledger
  if p_location_id is not null then
    select name into loc_name from locations where id = p_location_id and org_id = p_org_id;
  end if;
  insert into card_events (org_id, campaign_id, card_id, type, quantity, source, actor_user_id,
                           scanner_device_id, actor_label, location_id, location_name,
                           idempotency_key, scan_lat, scan_lon, meta)
  select p_org_id, c.campaign_id, c.id, e.type, e.qty, p_source, p_actor_user_id,
         p_scanner_device_id, p_actor_label, p_location_id, loc_name,
         p_idempotency_key, p_lat, p_lon, e.meta
    from (values
            (case when p_stamps > 0 then 'stamped' else 'unstamped' end, abs(p_stamps), p_stamps <> 0, '{}'::jsonb),
            ('reward_earned',   earned,   earned > 0,   case when jsonb_array_length(won) > 0 then jsonb_build_object('prizes', won) else '{}'::jsonb end),
            ('reward_redeemed', p_redeem, p_redeem > 0, case when jsonb_array_length(given) > 0 then jsonb_build_object('prizes', given) else '{}'::jsonb end)
         ) as e(type, qty, keep, meta)
   where e.keep;

  -- 7. remember the result for replays
  res := jsonb_build_object('card', to_jsonb(c), 'earned', earned, 'redeemed', p_redeem, 'replayed', false,
                            'prizes_earned', won, 'prizes_redeemed', given);
  update idempotency_keys set result = res where org_id = p_org_id and key = p_idempotency_key;
  return res;
end $$;

-- schema.sql: v1 schema for the loyalty clone (see architecture.md)
-- Target: Postgres 15+ on Supabase. auth.users is provided by Supabase Auth.
--
-- Conventions
--   * uuid primary keys, created_at / updated_at timestamptz (UTC) on every table
--   * org_id (the merchant business) on everything a merchant owns = the tenant key
--   * money: integer minor units (cents) + currency char(3)
--   * status fields: check constraints, not free text
--   * access: RLS is ENABLED on every table with NO policies, so the anon/public
--     Supabase key can read and write nothing. All access goes through the server
--     (service role) data layer, where every query is scoped by org_id
--     (see architecture.md "Access rules").
--   * stamp/reward balance changes ONLY through apply_card_transaction(): it locks
--     the card row, is idempotent on a client-supplied key and writes the ledger.

create extension if not exists pgcrypto;   -- gen_random_uuid(), gen_random_bytes()
create extension if not exists citext;     -- case-insensitive emails / usernames
create extension if not exists pg_trgm;    -- customer search

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- 26-char Crockford base32 of 128 random bits: card serials, unguessable
create or replace function random_token(n_bytes int default 16) returns text
language plpgsql volatile as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  bytes bytea := gen_random_bytes(n_bytes);
  bits int := 0; acc int := 0; out text := ''; i int;
begin
  for i in 0 .. n_bytes - 1 loop
    acc := (acc << 8) | get_byte(bytes, i);
    bits := bits + 8;
    while bits >= 5 loop
      bits := bits - 5;
      out := out || substr(alphabet, ((acc >> bits) & 31) + 1, 1);
    end loop;
    acc := acc & ((1 << bits) - 1);
  end loop;
  if bits > 0 then
    out := out || substr(alphabet, ((acc << (5 - bits)) & 31) + 1, 1);
  end if;
  return out;
end $$;

-- ---------------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------------

create table orgs (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (length(name) between 1 and 80),
  timezone              text not null default 'UTC',          -- IANA, e.g. Africa/Kigali
  country               char(2),                              -- ISO 3166-1 alpha-2
  default_currency      char(3) not null default 'USD',
  -- business details printed on the back of the pass (issuer block)
  website               text,
  email                 citext,
  phone                 text,
  address_line1         text,
  address_line2         text,
  city                  text,
  region                text,
  postal_code           text,
  -- entitlement snapshot, written ONLY by the billing module from `subscriptions`
  plan                  text not null default 'starter'
                          check (plan in ('starter','growth','pro')),
  plan_status           text not null default 'trialing'
                          check (plan_status in ('trialing','active','past_due','cancelled','locked')),
  trial_ends_at         timestamptz not null default now() + interval '15 days',
  locked_at             timestamptz,                  -- set when plan_status becomes 'locked'
  deletion_scheduled_at timestamptz,                  -- account delete: purged by job after this
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create trigger orgs_updated before update on orgs for each row execute function set_updated_at();

-- one bad timezone must never abort the hourly automation tick for every org
create or replace function orgs_validate_timezone() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'invalid timezone: %', new.timezone using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger orgs_timezone_valid before insert or update of timezone on orgs
  for each row execute function orgs_validate_timezone();

-- who can sign in to an org. v1: one owner. 'staff' is modelled now so the
-- staff-logins feature (should) is a UI change, not a migration.
create table org_members (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'owner' check (role in ('owner','staff')),
  label       text,                                   -- "Front counter", shown in audit log
  location_id uuid,                                   -- fk added after locations
  status      text not null default 'active' check (status in ('active','disabled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, user_id)
);
create index org_members_user_idx on org_members (user_id);
create trigger org_members_updated before update on org_members for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- locations (account level, attached to many cards)
-- ---------------------------------------------------------------------------

create table locations (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references orgs(id) on delete cascade,
  name              text not null check (length(name) between 1 and 80),
  address           text,                       -- the searched address
  lat               double precision not null check (lat between -90 and 90),
  lon               double precision not null check (lon between -180 and 180),
  address_on_card   text,                       -- how it is printed on the pass back
  show_on_card      boolean not null default true,
  relevant_text     text check (length(relevant_text) <= 120),   -- lock-screen text near this place
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index locations_org_idx on locations (org_id);
create trigger locations_updated before update on locations for each row execute function set_updated_at();

alter table org_members
  add constraint org_members_location_fk foreign key (location_id)
  references locations(id) on delete set null;
create index org_members_location_idx on org_members (location_id);

-- ---------------------------------------------------------------------------
-- campaigns = one card design / loyalty programme
-- ---------------------------------------------------------------------------

create table campaigns (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references orgs(id) on delete cascade,
  name                  text not null check (length(name) between 1 and 60),
  short_code            text not null unique default lower(random_token(5)),  -- /j/{short_code}
  status                text not null default 'draft'
                          check (status in ('draft','live','paused','archived')),
  card_type             text not null default 'single'
                          check (card_type in ('single','multi')),          -- v1 creates 'single' only
  total_stamps          smallint not null default 10 check (total_stamps between 1 and 30),
  -- text on the pass
  program_name          text not null,                 -- big name on the pass (logoText / programName)
  description           text check (length(description) <= 500),
  how_to_earn           text check (length(how_to_earn) <= 300),
  terms                 text check (length(terms) <= 4000),
  terms_url             text,
  hide_terms            boolean not null default false,
  -- lock-screen messages
  stamp_message         text not null default 'You have {n} stamps' check (length(stamp_message) <= 120),
  reward_message        text not null default 'Your reward is ready!' check (length(reward_message) <= 120),
  -- latest broadcast shown on every pass of this campaign (back field + changeMessage)
  news_text             text check (length(news_text) <= 300),
  news_updated_at       timestamptz,
  -- design
  design_version        int not null default 1,        -- bump on any visual change; images cached by it
  background_color      text not null default '#1F2937' check (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  foreground_color      text not null default '#FFFFFF' check (foreground_color ~ '^#[0-9A-Fa-f]{6}$'),
  label_color           text not null default '#D1D5DB' check (label_color ~ '^#[0-9A-Fa-f]{6}$'),
  stamp_color           text not null default '#FFFFFF' check (stamp_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_path             text,                          -- storage paths
  icon_path             text,
  strip_background_path text,
  stamp_icon            text not null default 'cup',   -- built-in icon key or 'custom'
  stamp_icon_path       text,
  unstamp_icon_path     text,
  -- signup form behaviour
  default_country       char(2),
  consent_enabled       boolean not null default true,
  consent_text          text,
  consent_default_checked boolean not null default false,
  -- expiry of individual cards
  expiry_mode           text not null default 'never'
                          check (expiry_mode in ('never','fixed_date','days_after_join')),
  expiry_date           timestamptz,
  expiry_days           int check (expiry_days between 1 and 3650),
  -- anti-fraud: minimum minutes between two stamp transactions on one card (0 = off)
  stamp_cooldown_minutes smallint not null default 0 check (stamp_cooldown_minutes between 0 and 1440),
  max_stamps_per_transaction smallint not null default 5 check (max_stamps_per_transaction between 1 and 30),
  max_stamps_per_day    smallint not null default 0 check (max_stamps_per_day between 0 and 100),  -- rolling 24h, 0 = off
  -- ROI inputs (Insights)
  stamp_value_cents     int check (stamp_value_cents >= 0),
  currency              char(3) not null default 'USD',
  activated_at          timestamptz,
  last_pushed_at        timestamptz,                   -- "update all cards" cooldown
  google_class_id       text unique,                   -- {issuerId}.c_{opaque}; never reused (Google can't delete)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint expiry_fields check (
    (expiry_mode = 'never')
    or (expiry_mode = 'fixed_date' and expiry_date is not null)
    or (expiry_mode = 'days_after_join' and expiry_days is not null)
  ),
  constraint live_has_activation check (status = 'draft' or activated_at is not null),
  unique (org_id, id)
);
create index campaigns_org_idx on campaigns (org_id, status);
create unique index campaigns_org_name_uq on campaigns (org_id, lower(name)) where status <> 'archived';
create trigger campaigns_updated before update on campaigns for each row execute function set_updated_at();

-- rewards: v1 has exactly one (position 1, stamps_required = total_stamps).
-- A table, not columns, so multi-reward (should) needs no migration.
create table rewards (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references campaigns(id) on delete cascade,
  position         smallint not null check (position between 1 and 30),
  name             text not null check (length(name) between 1 and 60),
  details          text check (length(details) <= 300),
  stamps_required  smallint not null check (stamps_required between 1 and 30),
  cost_cents       int check (cost_cents >= 0),          -- ROI: what the reward costs the merchant
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (campaign_id, position)
);
create trigger rewards_updated before update on rewards for each row execute function set_updated_at();

-- signup form fields. System keys (name, email, phone, birthday) map to customer
-- columns; anything else lands in customers.extra (jsonb) under `key`.
create table campaign_fields (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  key          text not null check (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  label        text not null check (length(label) between 1 and 60),
  type         text not null check (type in ('name','email','phone','birthday','text','number','date','url')),
  required     boolean not null default false,
  position     smallint not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (campaign_id, key)
);
create index campaign_fields_order_idx on campaign_fields (campaign_id, position);
-- at most one of each system type per form
create unique index campaign_fields_system_uq on campaign_fields (campaign_id, type)
  where type in ('name','email','phone','birthday');
create trigger campaign_fields_updated before update on campaign_fields for each row execute function set_updated_at();

create table campaign_links (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  kind         text not null check (kind in ('url','phone','email','address','whatsapp','instagram')),
  label        text not null check (length(label) between 1 and 40),
  value        text not null check (length(value) <= 500),
  position     smallint not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index campaign_links_order_idx on campaign_links (campaign_id, position);
create trigger campaign_links_updated before update on campaign_links for each row execute function set_updated_at();

create table campaign_locations (
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  location_id  uuid not null references locations(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (campaign_id, location_id)
);
create index campaign_locations_location_idx on campaign_locations (location_id);

-- Apple Wallet shows at most 10 locations per pass: enforce it at the source.
create or replace function campaign_locations_limit() returns trigger
language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext('campaign_locations:' || new.campaign_id::text));
  if tg_op = 'UPDATE' and new.campaign_id = old.campaign_id then
    return new;
  end if;
  if (select count(*) from campaign_locations where campaign_id = new.campaign_id) >= 10 then
    raise exception 'a card can have at most 10 locations' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger campaign_locations_max10 before insert or update on campaign_locations
  for each row execute function campaign_locations_limit();

-- ---------------------------------------------------------------------------
-- customers and cards
-- ---------------------------------------------------------------------------

-- One person per org. The original keeps customer data on the card; we keep a
-- customer so one person can hold several of a merchant's cards, a lost card can
-- be restored by email/phone, and birthdays live in one place.
create table customers (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references orgs(id) on delete cascade,
  name              text check (length(name) <= 120),
  email             citext check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone_e164        text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  birthday_month    smallint check (birthday_month between 1 and 12),
  birthday_day      smallint check (birthday_day between 1 and 31),
  extra             jsonb not null default '{}'::jsonb,       -- custom form fields
  marketing_consent boolean not null default false,
  consent_at        timestamptz,
  consent_text      text,                                     -- the exact text they agreed to
  deleted_at        timestamptz,                              -- soft delete, PII scrubbed by job
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint birthday_both check ((birthday_month is null) = (birthday_day is null)),
  -- every live customer is reachable / restorable: forms always require email or phone
  constraint contact_required check (deleted_at is not null or email is not null or phone_e164 is not null),
  unique (org_id, id),
  constraint birthday_valid check (
    birthday_month is null
    or birthday_day <= case when birthday_month = 2 then 29
                            when birthday_month in (4,6,9,11) then 30 else 31 end
  )
);
-- dedupe: one live customer per email and per phone inside an org
create unique index customers_org_email_uq on customers (org_id, email)
  where email is not null and deleted_at is null;
create unique index customers_org_phone_uq on customers (org_id, phone_e164)
  where phone_e164 is not null and deleted_at is null;
create index customers_org_birthday_idx on customers (org_id, birthday_month, birthday_day)
  where deleted_at is null and birthday_month is not null;
create index customers_org_created_idx on customers (org_id, created_at desc);
-- dashboard search: "contains" over name / email / phone
create index customers_search_trgm_idx on customers
  using gin ((coalesce(name,'') || ' ' || coalesce(email::text,'') || ' ' || coalesce(phone_e164,'')) gin_trgm_ops);
create trigger customers_updated before update on customers for each row execute function set_updated_at();

create table cards (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references orgs(id) on delete cascade,
  campaign_id            uuid not null,
  customer_id            uuid not null,
  -- Apple serialNumber / Google object suffix. Stable for the life of the pass.
  serial                 text not null unique default random_token(16),
  -- what the QR carries is 'v1.' || barcode_token || '.' || HMAC (computed in the app,
  -- key in env). The token rotates on every redemption so old screenshots stop working.
  barcode_token          text not null unique default random_token(16),
  previous_barcode_token text,                       -- lets the scanner say "card replaced"
  barcode_rotated_at     timestamptz,
  -- 8 chars staff can type when a QR won't scan (shown under the QR as altText)
  manual_code            text not null default random_token(5),
  -- Apple PassKit web service auth token for this pass (>= 16 chars)
  apple_auth_token       text not null default random_token(20),
  status                 text not null default 'active'
                           check (status in ('active','deleted')),
  current_stamps         smallint not null default 0 check (current_stamps >= 0),
  rewards_available      int not null default 0 check (rewards_available >= 0),
  total_stamps_earned    int not null default 0 check (total_stamps_earned >= 0),   -- net of corrections
  total_rewards_earned   int not null default 0 check (total_rewards_earned >= 0),
  total_rewards_redeemed int not null default 0 check (total_rewards_redeemed >= 0),
  last_stamp_at          timestamptz,
  last_visit_at          timestamptz not null default now(),   -- join, stamp or redeem
  expires_at             timestamptz,
  -- per-card message (birthday / win-back / farewell on delete) shown on the pass,
  -- as a back field with changeMessage
  note_text              text check (length(note_text) <= 300),
  note_updated_at        timestamptz,
  -- wallet state
  apple_installed        boolean not null default false,
  apple_installed_at     timestamptz,
  google_object_id       text unique,
  google_saved           boolean not null default false,
  google_saved_at        timestamptz,
  platform_hint          text check (platform_hint in ('ios','android','other')),
  web_card_seen_at       timestamptz,     -- written at most once an hour (keeps the hot row quiet)
  version                int not null default 1,     -- bumps on every pass-visible change
  -- Apple: Last-Modified of the pass, and the source of the passesUpdatedSince tag.
  -- Bumped by the trigger below, and explicitly by campaign-level pushes (design, news).
  pass_modified_at       timestamptz not null default clock_timestamp(),
  deleted_at             timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint deleted_consistent check ((status = 'deleted') = (deleted_at is not null)),
  unique (org_id, id),
  unique (org_id, manual_code),
  -- tenant integrity: a card's campaign and customer must belong to the card's org
  foreign key (org_id, campaign_id) references campaigns(org_id, id) on delete cascade,
  foreign key (org_id, customer_id) references customers(org_id, id) on delete cascade
);
create unique index cards_one_per_customer_uq on cards (campaign_id, customer_id)
  where status = 'active';
create index cards_customer_idx on cards (customer_id);
create index cards_campaign_list_idx on cards (campaign_id, status, last_visit_at desc);
create index cards_winback_idx on cards (campaign_id, last_visit_at)
  where status = 'active' and (apple_installed or google_saved);
create index cards_prev_barcode_idx on cards (previous_barcode_token) where previous_barcode_token is not null;
create trigger cards_updated before update on cards for each row execute function set_updated_at();

-- any pass-visible change bumps version + pass_modified_at
create or replace function cards_touch_pass() returns trigger
language plpgsql as $$
begin
  if (new.current_stamps, new.rewards_available, new.note_text, new.status, new.expires_at, new.barcode_token)
     is distinct from
     (old.current_stamps, old.rewards_available, old.note_text, old.status, old.expires_at, old.barcode_token) then
    new.version := old.version + 1;
    new.pass_modified_at := clock_timestamp();
  end if;
  return new;
end $$;
create trigger cards_touch_pass_trg before update on cards for each row execute function cards_touch_pass();


-- ---------------------------------------------------------------------------
-- counter devices: the scanner on a shop phone is PAIRED (owner scans a pairing
-- QR), never signed in as the owner. A device can only call /api/scan/*.
-- Devices are revoked, never deleted, so the audit log keeps its actor.
-- ---------------------------------------------------------------------------

create table scanner_devices (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  label         text not null check (length(label) between 1 and 40),   -- "Front counter"
  token_hash    text not null unique,                 -- sha256 of the device token (token shown once)
  location_id   uuid,
  paired_by     uuid references auth.users(id) on delete set null,
  last_seen_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, id),
  foreign key (location_id) references locations(id) on delete set null
);
create index scanner_devices_org_idx on scanner_devices (org_id) where revoked_at is null;
create index scanner_devices_location_idx on scanner_devices (location_id);
create index scanner_devices_paired_by_idx on scanner_devices (paired_by);
create trigger scanner_devices_updated before update on scanner_devices for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- the ledger: every enrol / stamp / reward / wallet event, append-only
-- ---------------------------------------------------------------------------

create table card_events (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references orgs(id) on delete cascade,
  campaign_id        uuid not null,
  card_id            uuid not null,
  type               text not null check (type in (
                       'enrolled','stamped','unstamped','reward_earned','reward_redeemed',
                       'apple_installed','apple_removed','google_saved','google_removed',
                       'message_sent','card_restored','card_deleted','customer_updated')),
  quantity           int not null default 1,
  source             text not null check (source in ('scanner','dashboard','customer','system','api')),
  actor_user_id      uuid references auth.users(id) on delete set null,
  scanner_device_id  uuid,
  actor_label        text,                         -- denormalised: survives user / device removal
  location_id        uuid references locations(id) on delete set null,
  location_name      text,                         -- denormalised: survives location removal
  idempotency_key    text,                         -- audit only; dedupe lives in idempotency_keys
  scan_lat           double precision,
  scan_lon           double precision,
  ip                 inet,
  user_agent         text,
  meta               jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  foreign key (org_id, card_id) references cards(org_id, id) on delete cascade,
  foreign key (org_id, campaign_id) references campaigns(org_id, id) on delete cascade,
  foreign key (org_id, scanner_device_id) references scanner_devices(org_id, id)
);
create index card_events_card_idx on card_events (card_id, created_at desc);
create index card_events_campaign_time_idx on card_events (campaign_id, created_at desc);
create index card_events_campaign_type_time_idx on card_events (campaign_id, type, created_at);  -- insights
create index card_events_org_time_idx on card_events (org_id, created_at desc);
create index card_events_actor_idx on card_events (actor_user_id) where actor_user_id is not null;
create index card_events_device_idx on card_events (scanner_device_id) where scanner_device_id is not null;
create index card_events_location_idx on card_events (location_id) where location_id is not null;

-- Ledger rows are immutable, with one exception: personal / actor references may be
-- set to NULL (FK "set null" on user or location delete, and the privacy scrub job).
-- Every other column must stay exactly as written.
create or replace function card_events_immutable() returns trigger
language plpgsql as $$
begin
  if (new.id, new.org_id, new.campaign_id, new.card_id, new.type, new.quantity, new.source,
      new.scanner_device_id, new.actor_label, new.location_name, new.idempotency_key,
      new.meta, new.created_at)
     is not distinct from
     (old.id, old.org_id, old.campaign_id, old.card_id, old.type, old.quantity, old.source,
      old.scanner_device_id, old.actor_label, old.location_name, old.idempotency_key,
      old.meta, old.created_at)
     and (new.actor_user_id is null or new.actor_user_id = old.actor_user_id)
     and (new.location_id   is null or new.location_id   = old.location_id)
     and (new.ip            is null or new.ip            = old.ip)
     and (new.user_agent    is null or new.user_agent    = old.user_agent)
     and (new.scan_lat      is null or new.scan_lat      = old.scan_lat)
     and (new.scan_lon      is null or new.scan_lon      = old.scan_lon)
  then
    return new;      -- only nulling of personal / actor fields
  end if;
  raise exception 'card_events is append-only';
end $$;
create trigger card_events_no_update before update on card_events
  for each row execute function card_events_immutable();

-- idempotency for card transactions: the key row is the serialisation point and
-- stores the request fingerprint + the result, so a replay returns the ORIGINAL
-- outcome and a reused key with a different request is rejected.
create table idempotency_keys (
  org_id        uuid not null references orgs(id) on delete cascade,
  key           text not null check (length(key) between 8 and 100),
  card_id       uuid not null,
  request_hash  text not null,
  result        jsonb,
  created_at    timestamptz not null default now(),
  primary key (org_id, key)
);
create index idempotency_keys_created_idx on idempotency_keys (created_at);   -- pruned after 7 days
create index idempotency_keys_card_idx on idempotency_keys (card_id);

-- ---------------------------------------------------------------------------
-- apply_card_transaction: the only way balances change
--   * idempotent on (org, key): a retried Submit returns the original result with
--     "replayed": true and writes nothing; the same key with a different request
--     raises idempotency_key_reused. If the transaction fails, the key is rolled
--     back too, so a retry after an error runs normally.
--   * locks the card row (two scanners at once serialise here)
--   * single-reward rule: when stamps reach total_stamps, bank a reward and
--     carry the overflow (10-stamp card at 9 + 3 stamps = 1 reward, 2 stamps).
--     v1 rewards.stamps_required always equals campaigns.total_stamps (the app
--     writes both; the function reads total_stamps).
--   * unstamping can't go below 0 and never forfeits a banked reward; it reduces
--     the lifetime total too (corrections don't inflate insights)
--   * scanner: card/campaign state, expiry, per-transaction cap, daily cap (net
--     of corrections, rolling 24h) and cooldown
--   * dashboard (owner): may correct paused campaigns and expired cards, capped at
--     100 stamps per transaction; never deleted cards
--   * a redemption rotates the barcode token (anti-screenshot)
-- Returns jsonb: {card: {...}, earned, redeemed, replayed}. Errors raise P0001 with
-- a stable message key the API maps to user-facing text.
-- ---------------------------------------------------------------------------

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

  -- 6. ledger
  if p_location_id is not null then
    select name into loc_name from locations where id = p_location_id and org_id = p_org_id;
  end if;
  insert into card_events (org_id, campaign_id, card_id, type, quantity, source, actor_user_id,
                           scanner_device_id, actor_label, location_id, location_name,
                           idempotency_key, scan_lat, scan_lon)
  select p_org_id, c.campaign_id, c.id, e.type, e.qty, p_source, p_actor_user_id,
         p_scanner_device_id, p_actor_label, p_location_id, loc_name,
         p_idempotency_key, p_lat, p_lon
    from (values
            (case when p_stamps > 0 then 'stamped' else 'unstamped' end, abs(p_stamps), p_stamps <> 0),
            ('reward_earned',   earned,   earned > 0),
            ('reward_redeemed', p_redeem, p_redeem > 0)
         ) as e(type, qty, keep)
   where e.keep;

  -- 7. remember the result for replays
  res := jsonb_build_object('card', to_jsonb(c), 'earned', earned, 'redeemed', p_redeem, 'replayed', false);
  update idempotency_keys set result = res where org_id = p_org_id and key = p_idempotency_key;
  return res;
end $$;

-- ---------------------------------------------------------------------------
-- Apple Wallet web service (device registrations for pass updates)
-- ---------------------------------------------------------------------------

create table apple_devices (
  device_library_id  text primary key,                 -- from Apple, opaque
  push_token         text not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger apple_devices_updated before update on apple_devices for each row execute function set_updated_at();

create table apple_registrations (
  device_library_id  text not null references apple_devices(device_library_id) on delete cascade,
  card_id            uuid not null references cards(id) on delete cascade,
  created_at         timestamptz not null default now(),
  primary key (device_library_id, card_id)
);
create index apple_registrations_card_idx on apple_registrations (card_id);

-- Apple "passesUpdatedSince": the tag we hand out is the request time (epoch ms).
-- A device asking with tag T gets every pass modified after T - 120 s. The look-back
-- covers transactions that took their timestamp before T but committed after it
-- (re-sending a serial is harmless; Apple re-fetches and gets a 304). Keep every
-- write transaction that touches cards well under 120 s (fan-out chunks of 500).
create or replace function apple_updated_serials(p_device text, p_since_ms bigint)
returns table (serial text) language sql stable as $$
  select c.serial
    from apple_registrations r
    join cards c on c.id = r.card_id
   where r.device_library_id = p_device
     and (p_since_ms is null
          or c.pass_modified_at > to_timestamp(p_since_ms / 1000.0) - interval '120 seconds')
$$;

-- ---------------------------------------------------------------------------
-- messages: broadcasts and automation sends, with per-card delivery rows
-- ---------------------------------------------------------------------------

create table messages (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs(id) on delete cascade,
  campaign_id      uuid not null,
  kind             text not null check (kind in ('broadcast','birthday','winback')),
  body             text not null check (length(body) between 1 and 300),
  status           text not null default 'queued'
                     check (status in ('queued','sending','sent','failed','cancelled')),
  recipients       int not null default 0,
  delivered        int not null default 0,
  failed           int not null default 0,
  created_by       uuid references auth.users(id) on delete set null,
  scheduled_for    timestamptz not null default now(),
  started_at       timestamptz,
  finished_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (org_id, campaign_id) references campaigns(org_id, id) on delete cascade
);
create index messages_campaign_time_idx on messages (campaign_id, created_at desc);
create index messages_org_idx on messages (org_id);
create index messages_queue_idx on messages (status, scheduled_for) where status in ('queued','sending');
create index messages_created_by_idx on messages (created_by) where created_by is not null;
create trigger messages_updated before update on messages for each row execute function set_updated_at();

create table message_deliveries (
  id            uuid primary key default gen_random_uuid(),
  message_id    uuid not null references messages(id) on delete cascade,
  card_id       uuid not null references cards(id) on delete cascade,
  channel       text not null check (channel in ('apple','google')),
  status        text not null default 'pending'
                  check (status in ('pending','sent','failed','skipped')),
  error         text,
  attempts      smallint not null default 0,
  sent_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (message_id, card_id, channel)            -- fan-out retries can't double-send
);
create index message_deliveries_card_idx on message_deliveries (card_id, created_at desc);
create index message_deliveries_pending_idx on message_deliveries (message_id, status) where status = 'pending';
create trigger message_deliveries_updated before update on message_deliveries for each row execute function set_updated_at();

-- automations: birthday and win-back, one of each per campaign
create table automations (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references orgs(id) on delete cascade,
  campaign_id    uuid not null,
  kind           text not null check (kind in ('birthday','winback')),
  enabled        boolean not null default false,
  body           text not null check (length(body) between 1 and 300),
  days_inactive  smallint check (days_inactive between 7 and 365),     -- winback only
  send_hour      smallint not null default 10 check (send_hour between 0 and 23),  -- org local time
  enabled_at     timestamptz,                    -- reset on EVERY off->on; win-back only counts lapses ending after it
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (campaign_id, kind),
  constraint winback_days check ((kind = 'winback') = (days_inactive is not null)),
  foreign key (org_id, campaign_id) references campaigns(org_id, id) on delete cascade
);
create index automations_org_idx on automations (org_id);
create index automations_due_idx on automations (enabled, send_hour) where enabled;
create trigger automations_updated before update on automations for each row execute function set_updated_at();

-- the never-send-twice guarantee
--   birthday: period_key = '2027'            (once per calendar year)
--   winback:  period_key = last_visit_at::date (once per lapse; a new visit = new key)
create table automation_sends (
  id             uuid primary key default gen_random_uuid(),
  automation_id  uuid not null references automations(id) on delete cascade,
  card_id        uuid not null references cards(id) on delete cascade,
  period_key     text not null,
  message_id     uuid references messages(id) on delete set null,
  -- written 'pending' BEFORE the wallet call, then 'sent' / 'failed' / 'skipped' (budget).
  -- The tick re-claims skipped/failed rows for the same period (see architecture.md).
  status         text not null default 'pending' check (status in ('pending','sent','skipped','failed')),
  attempts       smallint not null default 0,
  reason         text,
  created_at     timestamptz not null default now(),
  unique (automation_id, card_id, period_key)
);
create index automation_sends_card_idx on automation_sends (card_id);
create index automation_sends_retry_idx on automation_sends (automation_id, period_key) where status in ('pending','skipped','failed');
create index automation_sends_message_idx on automation_sends (message_id) where message_id is not null;

-- every user-visible wallet notification, for the per-pass budget
-- (Google hard limit: 3 notifying updates per pass per rolling 24h; we apply the
-- same budget to Apple). The sender checks this before any notifying update.
create table pass_notifications (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null references cards(id) on delete cascade,
  channel     text not null check (channel in ('apple','google')),
  reason      text not null check (reason in ('reward_earned','broadcast','birthday','winback')),
  message_id  uuid references messages(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index pass_notifications_budget_idx on pass_notifications (card_id, channel, created_at desc);
create index pass_notifications_message_idx on pass_notifications (message_id) where message_id is not null;

-- Claim one notification slot atomically. Every sender (reward notify, broadcast,
-- birthday, win-back) calls this in the same transaction as its delivery row,
-- BEFORE calling Apple/Google. Concurrent senders for one card serialise on the
-- advisory lock, so the budget can never be overrun. Returns false = over budget.
create or replace function claim_notification_slot(
  p_card_id uuid, p_channel text, p_reason text, p_message_id uuid default null, p_budget int default 3
) returns boolean
language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext('notify:' || p_card_id::text || ':' || p_channel));
  if (select count(*) from pass_notifications
       where card_id = p_card_id and channel = p_channel
         and created_at > now() - interval '24 hours') >= p_budget then
    return false;
  end if;
  insert into pass_notifications (card_id, channel, reason, message_id)
  values (p_card_id, p_channel, p_reason, p_message_id);
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- billing: OUR tables are the source of truth; providers only move money.
--   paddle      = international cards (merchant of record, true auto-renew)
--   flutterwave = Rwanda MTN MoMo / Airtel Money / local cards (no auto-debit:
--                 we invoice each prepaid period and send a payment prompt)
-- ---------------------------------------------------------------------------

create table subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null references orgs(id) on delete cascade,
  provider                  text not null check (provider in ('paddle','flutterwave','manual','stripe')),
  provider_customer_id      text,
  provider_subscription_id  text,                 -- null for flutterwave (we run the renewals)
  plan                      text not null check (plan in ('starter','growth','pro')),
  billing_interval          text not null check (billing_interval in ('month','year')),
  status                    text not null check (status in ('active','past_due','cancelled')),
  current_period_start      timestamptz not null,
  current_period_end        timestamptz not null,
  grace_until               timestamptz,          -- past_due keeps working until here
  cancel_at_period_end      boolean not null default false,
  provider_updated_at       timestamptz,          -- event time of the last applied webhook; older events are ignored
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint period_order check (current_period_end > current_period_start)
);
-- history is kept: at most one non-cancelled subscription per org
create unique index subscriptions_one_live_per_org_uq on subscriptions (org_id) where status <> 'cancelled';
create index subscriptions_org_idx on subscriptions (org_id, created_at desc);
create unique index subscriptions_provider_sub_uq on subscriptions (provider, provider_subscription_id)
  where provider_subscription_id is not null;
create index subscriptions_renewal_idx on subscriptions (current_period_end) where status <> 'cancelled';
create trigger subscriptions_updated before update on subscriptions for each row execute function set_updated_at();

-- one row per billing period we expect money for (all providers; drives MoMo renewals)
create table invoices (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs(id) on delete cascade,
  subscription_id  uuid references subscriptions(id) on delete set null,
  provider         text not null check (provider in ('paddle','flutterwave','manual','stripe')),
  provider_ref     text,                          -- tx_ref / transaction id
  amount_minor     bigint not null check (amount_minor >= 0),   -- RWF has no minor unit: store whole francs
  currency         char(3) not null,
  period_start     timestamptz not null,
  period_end       timestamptz not null,
  status           text not null default 'open' check (status in ('open','paid','failed','void')),
  due_at           timestamptz not null,
  paid_at          timestamptz,
  reminders_sent   smallint not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (subscription_id, period_start)          -- the renewal job can't bill a period twice
);
-- first checkout has no subscription yet: still one open/paid invoice per org per period
create unique index invoices_org_period_uq on invoices (org_id, period_start) where status in ('open','paid');
create index invoices_subscription_idx on invoices (subscription_id);
create unique index invoices_provider_ref_uq on invoices (provider, provider_ref) where provider_ref is not null;
create index invoices_org_idx on invoices (org_id, created_at desc);
create index invoices_open_due_idx on invoices (due_at) where status = 'open';
create trigger invoices_updated before update on invoices for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- inbound webhooks (billing provider, Google Wallet callbacks): dedupe table
-- ---------------------------------------------------------------------------

create table webhook_events (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null check (provider in ('paddle','flutterwave','stripe','google_wallet')),
  external_id   text not null,                 -- provider event id; Google callbacks: the nonce
  type          text not null,
  payload       jsonb not null,
  processed_at  timestamptz,
  error         text,
  created_at    timestamptz not null default now(),
  unique (provider, external_id)
);
create index webhook_events_unprocessed_idx on webhook_events (created_at) where processed_at is null;

-- ---------------------------------------------------------------------------
-- RLS: on everywhere, no policies. Only the server (service role) gets in.
-- ---------------------------------------------------------------------------

alter table orgs                enable row level security;
alter table org_members         enable row level security;
alter table locations           enable row level security;
alter table campaigns           enable row level security;
alter table rewards             enable row level security;
alter table campaign_fields     enable row level security;
alter table campaign_links      enable row level security;
alter table campaign_locations  enable row level security;
alter table customers           enable row level security;
alter table cards               enable row level security;
alter table card_events         enable row level security;
alter table apple_devices       enable row level security;
alter table apple_registrations enable row level security;
alter table messages            enable row level security;
alter table message_deliveries  enable row level security;
alter table automations         enable row level security;
alter table automation_sends    enable row level security;
alter table webhook_events      enable row level security;
alter table pass_notifications  enable row level security;
alter table subscriptions       enable row level security;
alter table invoices            enable row level security;
alter table scanner_devices     enable row level security;
alter table idempotency_keys    enable row level security;

-- Supabase exposes public functions at /rest/v1/rpc/*: only the server may call ours.
revoke execute on all functions in schema public from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on all functions in schema public from anon, authenticated';
  end if;
end $$;

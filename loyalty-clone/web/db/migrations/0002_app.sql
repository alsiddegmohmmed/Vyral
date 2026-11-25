-- 0002: tables and columns the build and backend steps needed.

alter table campaigns add column if not exists logo_text text not null default '';
alter table messages add column if not exists skipped int not null default 0;
alter table messages add column if not exists web_cards int not null default 0;

-- sessions: we store only the sha256 of the cookie token
create table sessions (
  token_hash    text primary key,
  user_id       uuid not null references users(id) on delete cascade,
  org_id        uuid not null references orgs(id) on delete cascade,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '30 days'
);
create index sessions_user_idx on sessions (user_id);
create index sessions_org_idx on sessions (org_id);
create index sessions_expiry_idx on sessions (expires_at);

-- one-time tokens for email verification and password reset (sha256 stored)
create table auth_tokens (
  token_hash  text primary key,
  user_id     uuid not null references users(id) on delete cascade,
  kind        text not null check (kind in ('verify_email','reset_password')),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index auth_tokens_user_idx on auth_tokens (user_id, kind);

create table pairing_codes (
  code         text primary key check (code ~ '^[0-9A-Z]{6}$'),
  org_id       uuid not null references orgs(id) on delete cascade,
  label        text not null check (length(label) between 1 and 40),
  location_id  uuid references locations(id) on delete set null,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);
create index pairing_codes_org_idx on pairing_codes (org_id);
create index pairing_codes_location_idx on pairing_codes (location_id);

-- every email we send (or would send in dev): audit + dev outbox
create table outbox_emails (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references orgs(id) on delete cascade,
  to_email     citext not null,
  subject      text not null,
  body_text    text not null,
  kind         text not null,
  status       text not null default 'queued' check (status in ('queued','sent','failed','logged')),
  provider_id  text,
  error        text,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz
);
create index outbox_emails_status_idx on outbox_emails (status, created_at);
create index outbox_emails_org_idx on outbox_emails (org_id);

-- job runs: retries and the dead-letter log
create table job_runs (
  id           uuid primary key default gen_random_uuid(),
  job          text not null,
  status       text not null default 'running' check (status in ('running','ok','failed')),
  attempt      smallint not null default 1,
  details      jsonb not null default '{}'::jsonb,
  error        text,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz
);
create index job_runs_job_idx on job_runs (job, started_at desc);
create index job_runs_failed_idx on job_runs (started_at) where status = 'failed';

-- atomic join (review C1): an existing person is never returned or updated.
-- Returns ('created', serial) or ('sent', null). One statement = one transaction.
create or replace function join_campaign(
  p_short_code text, p_name text, p_email text, p_phone text,
  p_bmonth smallint, p_bday smallint, p_extra jsonb, p_consent boolean, p_consent_text text
) returns table (status text, serial text, card_id uuid)
language plpgsql as $$
declare
  camp campaigns;
  cust_id uuid;
  new_card cards;
begin
  select * into camp from campaigns where short_code = p_short_code;
  if not found or camp.status <> 'live' then
    raise exception 'closed';
  end if;
  if exists (select 1 from customers c where c.org_id = camp.org_id and c.deleted_at is null
              and ((p_email is not null and c.email = p_email) or (p_phone is not null and c.phone_e164 = p_phone))) then
    return query select 'sent'::text, null::text, null::uuid; return;
  end if;
  begin
    insert into customers (org_id, name, email, phone_e164, birthday_month, birthday_day, extra, marketing_consent, consent_at, consent_text)
    values (camp.org_id, nullif(p_name, ''), p_email, p_phone, p_bmonth, p_bday, coalesce(p_extra, '{}'::jsonb), p_consent,
            case when p_consent then now() end, case when p_consent then p_consent_text end)
    returning id into cust_id;
  exception when unique_violation then
    -- a concurrent join with the same email/phone won the race
    return query select 'sent'::text, null::text, null::uuid; return;
  end;
  insert into cards (org_id, campaign_id, customer_id, expires_at)
  values (camp.org_id, camp.id, cust_id,
          case camp.expiry_mode when 'fixed_date' then camp.expiry_date
                                when 'days_after_join' then now() + make_interval(days => camp.expiry_days) end)
  returning * into new_card;
  insert into card_events (org_id, campaign_id, card_id, type, source)
  values (camp.org_id, camp.id, new_card.id, 'enrolled', 'customer');
  return query select 'created'::text, new_card.serial, new_card.id;
end $$;

alter table users          enable row level security;
alter table sessions       enable row level security;
alter table auth_tokens    enable row level security;
alter table pairing_codes  enable row level security;
alter table outbox_emails  enable row level security;
alter table job_runs       enable row level security;
revoke execute on all functions in schema public from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on all functions in schema public from anon, authenticated';
  end if;
end $$;

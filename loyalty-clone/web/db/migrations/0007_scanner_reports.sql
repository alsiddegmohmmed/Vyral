-- 0007: "Report a problem" from a counter phone (fixes.md #1 and #4).
-- A short diagnostics bundle the owner sees on Counter phones. It never holds
-- customer data: device label, app version, user agent, last error (scrubbed
-- in the app) and the self-check results. Size-capped by check constraints.
create table scanner_reports (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  device_id     uuid,
  device_label  text not null check (length(device_label) between 1 and 60),
  app_version   text not null check (length(app_version) between 1 and 40),
  user_agent    text not null default '' check (length(user_agent) <= 300),
  last_error    text check (length(last_error) <= 500),
  checks        jsonb not null default '[]'::jsonb check (jsonb_typeof(checks) = 'array' and octet_length(checks::text) <= 4000),
  created_at    timestamptz not null default now(),
  foreign key (org_id, device_id) references scanner_devices(org_id, id) on delete set null (device_id)
);
create index scanner_reports_org_idx on scanner_reports (org_id, created_at desc);
create index scanner_reports_device_idx on scanner_reports (device_id);
alter table scanner_reports enable row level security;

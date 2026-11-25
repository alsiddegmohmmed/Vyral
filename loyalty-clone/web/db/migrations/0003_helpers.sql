-- 0003: one-call helpers (no client-side transactions) and a rate limiter.

create or replace function replace_campaign_fields(p_campaign uuid, p_fields jsonb) returns void
language plpgsql as $$
begin
  delete from campaign_fields where campaign_id = p_campaign;
  insert into campaign_fields (campaign_id, key, label, type, required, position)
  select p_campaign, f.key, f.label, f.type, f.required, (f.ord - 1)::smallint
    from jsonb_to_recordset(p_fields) with ordinality as f(key text, label text, type text, required boolean, ord bigint);
end $$;

create or replace function replace_campaign_links(p_campaign uuid, p_links jsonb) returns void
language plpgsql as $$
begin
  delete from campaign_links where campaign_id = p_campaign;
  insert into campaign_links (campaign_id, kind, label, value, position)
  select p_campaign, l.kind, l.label, l.value, (l.ord - 1)::smallint
    from jsonb_to_recordset(p_links) with ordinality as l(kind text, label text, value text, ord bigint)
   where coalesce(l.label, '') <> '' and coalesce(l.value, '') <> '';
end $$;

-- replaces a card's locations (only the org's own; the max-10 trigger still applies)
create or replace function replace_campaign_locations(p_org uuid, p_campaign uuid, p_ids uuid[]) returns void
language plpgsql as $$
begin
  delete from campaign_locations where campaign_id = p_campaign;
  insert into campaign_locations (campaign_id, location_id)
  select p_campaign, l.id from locations l where l.org_id = p_org and l.id = any(p_ids);
  update cards set pass_modified_at = clock_timestamp() where campaign_id = p_campaign and status = 'active';
end $$;

-- fixed-window rate limiter: returns the hit count in the current window
create table rate_limits (
  key           text primary key,
  window_start  timestamptz not null,
  hits          int not null
);
create or replace function rate_hit(p_key text, p_window_seconds int) returns int
language sql as $$
  insert into rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits;
$$;
alter table rate_limits enable row level security;
revoke execute on all functions in schema public from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on all functions in schema public from anon, authenticated';
  end if;
end $$;

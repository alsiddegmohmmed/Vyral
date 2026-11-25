-- 0005: fixes from /replica-test (bugs.md B-001, B-002, B-007, B-012)

-- B-001 (S1): "WITH ORDINALITY cannot be used with a column definition list".
-- Read the JSON array element by element instead.
create or replace function replace_campaign_fields(p_campaign uuid, p_fields jsonb) returns void
language plpgsql as $$
begin
  delete from campaign_fields where campaign_id = p_campaign;
  insert into campaign_fields (campaign_id, key, label, type, required, position)
  select p_campaign, e.v->>'key', e.v->>'label', e.v->>'type', coalesce((e.v->>'required')::boolean, false), (e.ord - 1)::smallint
    from jsonb_array_elements(p_fields) with ordinality as e(v, ord);
end $$;

create or replace function replace_campaign_links(p_campaign uuid, p_links jsonb) returns void
language plpgsql as $$
begin
  delete from campaign_links where campaign_id = p_campaign;
  insert into campaign_links (campaign_id, kind, label, value, position)
  select p_campaign, e.v->>'kind', e.v->>'label', e.v->>'value', (e.ord - 1)::smallint
    from jsonb_array_elements(p_links) with ordinality as e(v, ord)
   where coalesce(e.v->>'label', '') <> '' and coalesce(e.v->>'value', '') <> '';
end $$;

-- B-007 (S2): a redemption rotates the typed code too, not only the QR token.
create or replace function cards_rotate_manual_code() returns trigger
language plpgsql as $$
begin
  if new.barcode_token is distinct from old.barcode_token then
    new.manual_code := random_token(5);
  end if;
  return new;
end $$;
create trigger cards_rotate_manual_code_trg before update of barcode_token on cards
  for each row execute function cards_rotate_manual_code();

-- B-002 (S2): a customer of one card can join the business's other cards.
-- B-012 (S2): a business scheduled for deletion takes no new members.
-- Privacy (review C1) unchanged: an existing person never gets a card URL back
-- or has their details changed; the response is 'sent' and the link goes to the
-- contact on file. serial is returned only so the app can email it.
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
  select c.* into camp from campaigns c join orgs o on o.id = c.org_id
   where c.short_code = p_short_code and o.deletion_scheduled_at is null;
  if not found or camp.status <> 'live' then
    raise exception 'closed';
  end if;
  select c.id into cust_id from customers c
   where c.org_id = camp.org_id and c.deleted_at is null
     and ((p_email is not null and c.email = p_email) or (p_phone is not null and c.phone_e164 = p_phone))
   limit 1;
  if cust_id is not null then
    if exists (select 1 from cards k where k.customer_id = cust_id and k.campaign_id = camp.id and k.status = 'active') then
      return query select 'sent'::text, (select k.serial from cards k where k.customer_id = cust_id and k.campaign_id = camp.id and k.status = 'active'), null::uuid;
      return;
    end if;
    -- known person, new card for them (their details stay as they are)
    insert into cards (org_id, campaign_id, customer_id, expires_at)
    values (camp.org_id, camp.id, cust_id,
            case camp.expiry_mode when 'fixed_date' then camp.expiry_date
                                  when 'days_after_join' then now() + make_interval(days => camp.expiry_days) end)
    returning * into new_card;
    insert into card_events (org_id, campaign_id, card_id, type, source) values (camp.org_id, camp.id, new_card.id, 'enrolled', 'customer');
    return query select 'sent'::text, new_card.serial, new_card.id;
    return;
  end if;
  begin
    insert into customers (org_id, name, email, phone_e164, birthday_month, birthday_day, extra, marketing_consent, consent_at, consent_text)
    values (camp.org_id, nullif(p_name, ''), p_email, p_phone, p_bmonth, p_bday, coalesce(p_extra, '{}'::jsonb), p_consent,
            case when p_consent then now() end, case when p_consent then p_consent_text end)
    returning id into cust_id;
  exception when unique_violation then
    return query select 'sent'::text, null::text, null::uuid; return;
  end;
  insert into cards (org_id, campaign_id, customer_id, expires_at)
  values (camp.org_id, camp.id, cust_id,
          case camp.expiry_mode when 'fixed_date' then camp.expiry_date
                                when 'days_after_join' then now() + make_interval(days => camp.expiry_days) end)
  returning * into new_card;
  insert into card_events (org_id, campaign_id, card_id, type, source) values (camp.org_id, camp.id, new_card.id, 'enrolled', 'customer');
  return query select 'created'::text, new_card.serial, new_card.id;
end $$;

revoke execute on all functions in schema public from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on all functions in schema public from anon, authenticated';
  end if;
end $$;

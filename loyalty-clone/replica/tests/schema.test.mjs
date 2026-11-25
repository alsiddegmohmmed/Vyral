// Schema tests: run against PGlite (real Postgres compiled to WASM).
//   cd "$(mktemp -d)" && npm i @electric-sql/pglite@0.3 && cp <this file> . \
//     && node schema.test.mjs <path>/replica/schema.sql
// Not covered here: true multi-connection concurrency (PGlite is single-connection).
// The card row lock, the idempotency-key insert and the notification advisory lock are
// standard Postgres; add a two-connection race test against real Postgres in /replica-test.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import fs from 'node:fs';

const db = new PGlite({ extensions: { pgcrypto, citext, pg_trgm } });
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];
const expectErr = async (name, sql, params, re) => {
  try { await db.query(sql, params); ok(name, false, '(no error)'); }
  catch (e) { ok(name, re.test(e.message), `-> ${e.message}`); }
};

// --- Supabase stand-ins -------------------------------------------------------
await db.exec(`create schema auth; create table auth.users (id uuid primary key default gen_random_uuid());
               create role anon; create role authenticated; create role service_role;`);
await db.exec(fs.readFileSync(process.argv[2], 'utf8'));
ok('schema loads', true);

const nTables = (await one(`select count(*)::int n from pg_tables where schemaname='public'`)).n;
ok('table count', nTables === 23, `(${nTables})`);
ok('RLS on every table', (await one(`select count(*)::int n from pg_tables where schemaname='public' and not rowsecurity`)).n === 0);
const anonExec = (await one(`select has_function_privilege('anon', 'random_token(int)', 'execute') a`)).a;
ok('anon cannot call our functions via RPC', anonExec === false);
const tok = await one(`select random_token(16) a, random_token(16) b`);
ok('random_token 26 chars, unique', tok.a.length === 26 && tok.a !== tok.b, tok.a);

// --- fixtures -----------------------------------------------------------------
const u = (await one(`insert into auth.users default values returning id`)).id;
const org = (await one(`insert into orgs (name, timezone) values ('Cafe Neza','Africa/Kigali') returning id`)).id;
await q(`insert into org_members (org_id,user_id) values ($1,$2)`, [org, u]);
const camp = await one(`insert into campaigns (org_id,name,program_name,total_stamps,status,activated_at,max_stamps_per_transaction)
  values ($1,'Coffee card','Cafe Neza',10,'live',now(),5) returning id, short_code`, [org]);
ok('short_code generated', /^[0-9a-z]{8}$/.test(camp.short_code), camp.short_code);
await q(`insert into rewards (campaign_id,position,name,stamps_required) values ($1,1,'Free coffee',10)`, [camp.id]);
const newCustomer = async (name, email = null, phone = null) =>
  (await one(`insert into customers (org_id,name,email,phone_e164) values ($1,$2,$3,$4) returning id`, [org, name, email, phone ?? (email ? null : '+25078' + Math.floor(1e6 + Math.random() * 8e6))])).id;
const newCard = async (custId) => await one(`insert into cards (org_id,campaign_id,customer_id) values ($1,$2,$3) returning *`, [org, camp.id, custId]);
const cust = (await one(`insert into customers (org_id,name,email,birthday_month,birthday_day) values ($1,'Aline','Aline@Example.com',2,29) returning id`, [org])).id;
const card = await newCard(cust);
ok('card serial + manual code', card.serial.length === 26 && card.manual_code.length === 8, card.manual_code);

let keyN = 0;
const tx = async (cardId, stamps, redeem, src = 'scanner', key = `key-${++keyN}-xxxxxxxx`) =>
  (await one(`select apply_card_transaction($1,$2,$3,$4,$5,$6,'owner',$7) r`, [org, cardId, stamps, redeem, src, u, key])).r;
const txErr = (name, cardId, stamps, redeem, src, re, key) =>
  expectErr(name, `select apply_card_transaction($1,$2,$3,$4,$5,$6,'owner',$7)`, [org, cardId, stamps, redeem, src, u, key ?? `err-${++keyN}-xxxxxxxx`], re);

// --- stamping rules -----------------------------------------------------------
let r = await tx(card.id, 5, 0);
ok('stamp 5', r.card.current_stamps === 5 && r.earned === 0 && r.replayed === false);
r = await tx(card.id, 4, 0);
r = await tx(card.id, 3, 0, 'scanner', 'replay-key-aaaa');
ok('overflow: 9+3 on a 10-card = 1 reward, 2 stamps', r.card.current_stamps === 2 && r.card.rewards_available === 1 && r.earned === 1);
await tx(card.id, 1, 0);                                     // something happens in between
r = await tx(card.id, 3, 0, 'scanner', 'replay-key-aaaa');
ok('replay returns the ORIGINAL result, flagged', r.replayed === true && r.earned === 1 && r.card.current_stamps === 2);
ok('replay wrote nothing', (await one(`select current_stamps from cards where id=$1`, [card.id])).current_stamps === 3);
ok('replay did not duplicate ledger', (await one(`select count(*)::int n from card_events where idempotency_key='replay-key-aaaa'`)).n === 2);
await txErr('same key, different request -> rejected', card.id, 5, 0, 'scanner', /idempotency_key_reused/, 'replay-key-aaaa');
const custB = await newCustomer('Bob'); const cardB = await newCard(custB);
await txErr('same key on another card -> rejected', cardB.id, 3, 0, 'scanner', /idempotency_key_reused/, 'replay-key-aaaa');
await txErr('failed attempt...', card.id, 0, 5, 'scanner', /no_reward_available/, 'retry-after-error');
r = await tx(card.id, 1, 0, 'scanner', 'retry-after-error');
ok('...then the same key can run once fixed (key rolled back with the error)', r.replayed === false);
r = await tx(card.id, 0, 1);
ok('redeem 1', r.card.rewards_available === 0 && r.card.total_rewards_redeemed === 1 && r.redeemed === 1);
ok('redemption rotated the barcode', r.card.previous_barcode_token === card.barcode_token && r.card.barcode_token !== card.barcode_token);
await txErr('redeem with none available', card.id, 0, 1, 'scanner', /no_reward_available/);
await txErr('remove more stamps than held', card.id, -50, 0, 'dashboard', /not_enough_stamps/);
const before = (await one(`select total_stamps_earned t from cards where id=$1`, [card.id])).t;
r = await tx(card.id, -1, 0);
ok('unstamp reduces lifetime total (corrections do not inflate insights)', r.card.total_stamps_earned === before - 1);
await txErr('scanner per-transaction cap', card.id, 6, 0, 'scanner', /too_many_stamps/);
await txErr('dashboard cap (typo guard)', card.id, 10000, 0, 'dashboard', /too_many_stamps/);
r = await tx(card.id, 10, 1, 'dashboard');
ok('dashboard: earn + redeem in one transaction', r.earned === 1 && r.redeemed === 1);
await expectErr('wrong org cannot touch card', `select apply_card_transaction(gen_random_uuid(),$1,1,0,'scanner',$2,'o','wrong-org-xxxxxx')`, [card.id, u], /card_not_found/);
await txErr('unknown source rejected', card.id, 1, 0, 'api', /invalid_source/);

await q(`update campaigns set stamp_cooldown_minutes=5 where id=$1`, [camp.id]);
await txErr('scanner cooldown blocks a quick second stamp', card.id, 1, 0, 'scanner', /cooldown_active/);
r = await tx(card.id, 1, 0, 'dashboard');
ok('dashboard is not blocked by cooldown', r.replayed === false);
await q(`update campaigns set stamp_cooldown_minutes=0, max_stamps_per_day=3 where id=$1`, [camp.id]);
const cardC = await newCard(await newCustomer('Cleo'));
await tx(cardC.id, 3, 0);
await tx(cardC.id, -3, 0, 'dashboard');
r = await tx(cardC.id, 1, 0);
ok('daily cap is net of corrections (+3, owner -3, +1 allowed)', r.card.current_stamps === 1);
await tx(cardC.id, 2, 0);
await txErr('daily cap reached', cardC.id, 1, 0, 'scanner', /daily_limit_reached/);
await q(`update campaigns set max_stamps_per_day=0 where id=$1`, [camp.id]);

// --- Apple update tags / Last-Modified ------------------------------------------
await q(`insert into apple_devices values ('dev1','tok', now(), now())`);
await q(`insert into apple_registrations (device_library_id, card_id) values ('dev1',$1), ('dev1',$2)`, [card.id, cardB.id]);
const t0 = Date.now();
await new Promise(res => setTimeout(res, 5));
const pm0 = (await one(`select pass_modified_at from cards where id=$1`, [cardB.id])).pass_modified_at;
await tx(cardB.id, 1, 0);
const pm1 = (await one(`select pass_modified_at, version from cards where id=$1`, [cardB.id]));
ok('visible change bumps pass_modified_at + version', pm1.pass_modified_at > pm0 && pm1.version > 1);
const ser = (await q(`select serial from apple_updated_serials('dev1', $1)`, [t0])).map(x => x.serial);
ok('passesUpdatedSince returns the changed pass', ser.includes(cardB.serial));
const old = (await q(`select serial from apple_updated_serials('dev1', $1)`, [Date.now() + 10 * 60 * 1000])).length;
ok('far-future tag returns nothing', old === 0);
const lookback = (await q(`select serial from apple_updated_serials('dev1', $1)`, [Date.now() + 60 * 1000])).length;
ok('tag look-back (120 s) still re-sends a pass changed just before the tag', lookback >= 1);
await q(`update cards set web_card_seen_at=now() where id=$1`, [cardB.id]);
ok('web-card view does not change Last-Modified', (await one(`select pass_modified_at from cards where id=$1`, [cardB.id])).pass_modified_at.getTime() === pm1.pass_modified_at.getTime());

// --- card state ------------------------------------------------------------------
await q(`update cards set expires_at = now() - interval '1 day' where id=$1`, [card.id]);
await txErr('scanner rejects expired card', card.id, 1, 0, 'scanner', /card_expired/);
await txErr('empty transaction rejected', card.id, 0, 0, 'dashboard', /empty_transaction/);
await q(`update cards set current_stamps = 1 where id=$1`, [card.id]);
r = await tx(card.id, -1, 0, 'dashboard');
ok('owner can still correct an expired card', r.card.current_stamps === 0);
await q(`update cards set expires_at = null where id=$1`, [card.id]);
await q(`update campaigns set status='paused' where id=$1`, [camp.id]);
await txErr('scanner rejects paused campaign', card.id, 1, 0, 'scanner', /campaign_not_live/);
r = await tx(card.id, 1, 0, 'dashboard');
ok('owner can correct cards on a paused campaign', r.card.current_stamps === 1);
await q(`update campaigns set status='live' where id=$1`, [camp.id]);
await q(`update cards set status='deleted', deleted_at=now() where id=$1`, [card.id]);
await txErr('deleted card rejected, even for the owner', card.id, 1, 0, 'dashboard', /card_deleted/);
const card2 = await newCard(cust);
ok('new card allowed after the old one was deleted', !!card2.id);
await expectErr('second active card for same customer', `insert into cards (org_id,campaign_id,customer_id) values ($1,$2,$3)`, [org, camp.id, cust], /cards_one_per_customer_uq/);

// --- tenant integrity --------------------------------------------------------------
const orgB = (await one(`insert into orgs (name) values ('Salon B') returning id`)).id;
const campB = (await one(`insert into campaigns (org_id,name,program_name) values ($1,'B card','B') returning id`, [orgB])).id;
await expectErr('card cannot mix orgs (campaign of org B)', `insert into cards (org_id,campaign_id,customer_id) values ($1,$2,$3)`, [org, campB, cust], /foreign key/);
await expectErr('message cannot target another org\'s campaign', `insert into messages (org_id,campaign_id,kind,body) values ($1,$2,'broadcast','x')`, [org, campB], /foreign key/);

// --- customers ----------------------------------------------------------------
await expectErr('duplicate email, different case', `insert into customers (org_id,email) values ($1,'aline@example.COM')`, [org], /customers_org_email_uq/);
await expectErr('bad phone format', `insert into customers (org_id,phone_e164) values ($1,'0788123456')`, [org], /check/);
await expectErr('Feb 30 birthday', `insert into customers (org_id,phone_e164,birthday_month,birthday_day) values ($1,'+250788000001',2,30)`, [org], /birthday_valid/);
await expectErr('customer needs email or phone', `insert into customers (org_id,name) values ($1,'Nobody')`, [org], /contact_required/);
ok('search finds customer', (await q(`select id from customers where (coalesce(name,'')||' '||coalesce(email::text,'')||' '||coalesce(phone_e164,'')) ilike '%alin%'`)).length === 1);

// --- ledger ---------------------------------------------------------------------
await expectErr('ledger is append-only', `update card_events set quantity=99`, [], /append-only/);
await q(`update card_events set ip='10.0.0.1'::inet where false`);   // syntax sanity
const scrub = await db.query(`update card_events set ip=null, user_agent=null, scan_lat=null, scan_lon=null where card_id=$1`, [cardB.id]);
ok('privacy scrub can null personal fields', scrub.affectedRows >= 1);
await expectErr('...but cannot rewrite them', `update card_events set actor_label='someone else' where card_id=$1`, [cardB.id], /append-only/);
const loc = (await one(`insert into locations (org_id,name,lat,lon) values ($1,'Kimihurura',-1.95,30.09) returning id`, [org])).id;
await one(`select apply_card_transaction($1,$2,1,0,'dashboard',$3,'owner','with-location-xx',null,$4)`, [org, cardB.id, u, loc]);
await q(`delete from locations where id=$1`, [loc]);
const evLoc = await one(`select location_id, location_name from card_events where idempotency_key='with-location-xx'`);
ok('deleting a used location works, ledger keeps its name', evLoc.location_id === null && evLoc.location_name === 'Kimihurura');
const u2 = (await one(`insert into auth.users default values returning id`)).id;
await one(`select apply_card_transaction($1,$2,1,0,'dashboard',$3,'Manager','by-user-two-xxxx')`, [org, cardB.id, u2]);
await q(`delete from auth.users where id=$1`, [u2]);
ok('deleting a user who stamped works, ledger keeps the label', (await one(`select actor_user_id, actor_label from card_events where idempotency_key='by-user-two-xxxx'`)).actor_label === 'Manager');
const dev = (await one(`insert into scanner_devices (org_id,label,token_hash) values ($1,'Front counter','h1') returning id`, [org])).id;
await one(`select apply_card_transaction($1,$2,1,0,'scanner',null,'Front counter','by-device-xxxxxx',$3)`, [org, cardB.id, dev]);
ok('paired device stamps without an owner login', (await one(`select scanner_device_id from card_events where idempotency_key='by-device-xxxxxx'`)).scanner_device_id === dev);

// --- campaign constraints ----------------------------------------------------------
await expectErr('stamps > 30', `insert into campaigns (org_id,name,program_name,total_stamps) values ($1,'x','x',31)`, [org], /check/);
await expectErr('live needs activated_at', `insert into campaigns (org_id,name,program_name,status) values ($1,'y','y','live')`, [org], /live_has_activation/);
await expectErr('fixed_date expiry needs date', `insert into campaigns (org_id,name,program_name,expiry_mode) values ($1,'z','z','fixed_date')`, [org], /expiry_fields/);
await expectErr('duplicate card name in org', `insert into campaigns (org_id,name,program_name) values ($1,'COFFEE CARD','x')`, [org], /campaigns_org_name_uq/);
await expectErr('invalid timezone rejected', `insert into orgs (name,timezone) values ('Bad','Mars/Olympus')`, [], /invalid timezone/);
const ids = [];
for (let i = 0; i < 10; i++) {
  const l = (await one(`insert into locations (org_id,name,lat,lon) values ($1,$2,-1.95,30.06) returning id`, [org, 'L' + i])).id;
  await q(`insert into campaign_locations values ($1,$2)`, [camp.id, l]); ids.push(l);
}
const l11 = (await one(`insert into locations (org_id,name,lat,lon) values ($1,'L11',-1.95,30.06) returning id`, [org])).id;
await expectErr('11th location on a card', `insert into campaign_locations values ($1,$2)`, [camp.id, l11], /at most 10/);
const camp2 = (await one(`insert into campaigns (org_id,name,program_name) values ($1,'Second','S') returning id`, [org])).id;
await q(`insert into campaign_locations values ($1,$2)`, [camp2, l11]);
await expectErr('...and not by moving one in with UPDATE', `update campaign_locations set campaign_id=$1 where campaign_id=$2`, [camp.id, camp2], /at most 10/);

// --- automations & messages ----------------------------------------------------------
const auto = (await one(`insert into automations (org_id,campaign_id,kind,body,enabled) values ($1,$2,'birthday','Happy birthday!',true) returning id`, [org, camp.id])).id;
await expectErr('winback needs days_inactive', `insert into automations (org_id,campaign_id,kind,body) values ($1,$2,'winback','We miss you')`, [org, camp.id], /winback_days/);
const claim = async () => (await q(`insert into automation_sends (automation_id,card_id,period_key) values ($1,$2,'2027')
   on conflict (automation_id,card_id,period_key) do update set status='pending', attempts = automation_sends.attempts + 1
   where automation_sends.status in ('skipped','failed') returning id, status`, [auto, card2.id]));
let c1 = await claim();
ok('automation send starts as pending', c1.length === 1 && c1[0].status === 'pending');
await q(`update automation_sends set status='sent' where id=$1`, [c1[0].id]);
ok('birthday never sent twice in a year', (await claim()).length === 0);
await q(`update automation_sends set status='skipped' where id=$1`, [c1[0].id]);
ok('a budget-skipped send is re-claimed on the next tick', (await claim()).length === 1);

const m = (await one(`insert into messages (org_id,campaign_id,kind,body) values ($1,$2,'broadcast','Double stamps Friday') returning id`, [org, camp.id])).id;
await q(`insert into message_deliveries (message_id,card_id,channel) values ($1,$2,'apple')`, [m, card2.id]);
await expectErr('delivery row unique per channel', `insert into message_deliveries (message_id,card_id,channel) values ($1,$2,'apple')`, [m, card2.id], /unique|duplicate/);
const slots = [];
for (let i = 0; i < 4; i++) slots.push((await one(`select claim_notification_slot($1,'google','broadcast') s`, [card2.id])).s);
ok('notification budget: 3 slots then refused', JSON.stringify(slots) === '[true,true,true,false]', JSON.stringify(slots));
ok('budget is per channel', (await one(`select claim_notification_slot($1,'apple','birthday') s`, [card2.id])).s === true);

// --- billing ------------------------------------------------------------------------
const sub = (await one(`insert into subscriptions (org_id,provider,plan,billing_interval,status,current_period_start,current_period_end)
  values ($1,'flutterwave','starter','month','active',now(),now()+interval '1 month') returning id`, [org])).id;
const ps = new Date().toISOString();
const inv = `insert into invoices (org_id,subscription_id,provider,amount_minor,currency,period_start,period_end,due_at) values ($1,$2,'flutterwave',30000,'RWF',$3,$3::timestamptz+interval '1 month',$3)`;
await q(inv, [org, sub, ps]);
await expectErr('renewal job cannot bill a period twice', inv, [org, sub, ps], /invoices_/);
const ps2 = new Date(Date.now() + 864e5).toISOString();
await q(inv, [org, null, ps2]);
await expectErr('first checkout (no subscription yet): double-click cannot make 2 invoices', inv, [org, null, ps2], /invoices_org_period_uq/);
await expectErr('only one live subscription per org', `insert into subscriptions (org_id,provider,plan,billing_interval,status,current_period_start,current_period_end) values ($1,'paddle','growth','year','active',now(),now()+interval '1 year')`, [org], /subscriptions_one_live_per_org_uq/);
await q(`update subscriptions set status='cancelled' where id=$1`, [sub]);
await q(`insert into subscriptions (org_id,provider,plan,billing_interval,status,current_period_start,current_period_end) values ($1,'paddle','growth','year','active',now(),now()+interval '1 year')`, [org]);
ok('switching provider keeps history', (await one(`select count(*)::int n from subscriptions where org_id=$1`, [org])).n === 2);

// --- account deletion ----------------------------------------------------------------
await q(`delete from orgs where id=$1`, [org]);
const left = (await one(`select (select count(*) from cards)+(select count(*) from card_events)+(select count(*) from customers where org_id=$1)+(select count(*) from scanner_devices)+(select count(*) from idempotency_keys) n`, [org])).n;
ok('deleting an org cascades everything (account delete / GDPR)', Number(left) === 0, `(${left} rows left)`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

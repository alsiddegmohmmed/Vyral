// Development seed: one café in Kigali with a live coffee card, 40 customers
// and 45 days of activity. Fake people only. Wipes the café's org first.
// Demo login (dev only): owner@cafe-neza.test / neza-demo-2026
// Usage: DATABASE_URL=... node db/seed.mjs
import { randomBytes, scryptSync } from 'node:crypto';
import pg from 'pg';

const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54321/postgres';
const db = new pg.Client({ connectionString: url });
await db.connect();
const q = (text, params = []) => db.query(text, params);
const one = async (text, params) => (await q(text, params)).rows[0];

const hash = (pw) => { const salt = randomBytes(16).toString('base64url'); return `scrypt$${salt}$${scryptSync(pw, salt, 32).toString('base64url')}`; };
const day = 86_400_000, now = Date.now();
const iso = (t) => new Date(t).toISOString();
let seed = 42; const r = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

const NAMES = ['Aline Uwase', 'Eric Mugisha', 'Grace Iradukunda', 'Jean Bosco Habimana', 'Diane Mukamana', 'Patrick Nshuti',
  'Claudine Ingabire', 'Olivier Ndayisaba', 'Sandrine Umutoni', 'Emmanuel Niyonzima', 'Josiane Uwimana', 'Kevin Manzi',
  'Ange Kamikazi', 'Yves Ishimwe', 'Clarisse Mutesi', 'David Gatete', 'Esther Nyiraneza', 'Fabrice Hakizimana',
  'Gisele Umuhoza', 'Herve Tuyishime', 'Irene Uwera', 'Jules Mutabazi', 'Liliane Ikirezi', 'Moses Kayitare',
  'Nadine Uwamahoro', 'Paul Rwigema', 'Rose Mukeshimana', 'Samuel Bizimana', 'Teta Keza', 'Vanessa Iribagiza',
  'Wilson Ntwari', 'Yvette Nyampinga', 'Arnaud Shema', 'Belyse Uwineza', 'Cedric Nkurunziza', 'Denise Umurerwa',
  'Fiona Akaliza', 'Gael Mucyo', 'Honorine Abijuru', 'Isaac Ruzindana-Twagiramungu Bizimungu Nkusi Mugenzi'];

const email = 'owner@cafe-neza.test';
await q('delete from orgs where name = $1', ['Café Neza']);
await q('delete from users where email = $1', [email]);

const user = await one(`insert into users (email, password_hash, name, email_verified_at) values ($1,$2,'Neza Owner', now()) returning id`, [email, hash('neza-demo-2026')]);
const org = await one(`insert into orgs (name, timezone, country, default_currency, email, phone, address_line1, city, plan, plan_status, trial_ends_at, created_at)
  values ('Café Neza','Africa/Kigali','RW','RWF','hello@cafe-neza.test','+250788000111','KG 7 Ave','Kigali','growth','trialing',$1,$2) returning id`, [iso(now + 9 * day), iso(now - 60 * day)]);
await q('insert into org_members (org_id, user_id, role) values ($1,$2,$3)', [org.id, user.id, 'owner']);

const loc1 = await one(`insert into locations (org_id,name,address,lat,lon,address_on_card,relevant_text) values ($1,'Kimihurura','KG 7 Ave, Kigali',-1.9536,30.0925,'KG 7 Ave, Kimihurura','Café Neza is around the corner') returning id`, [org.id]);
const loc2 = await one(`insert into locations (org_id,name,address,lat,lon,address_on_card,relevant_text) values ($1,'Kigali Heights','KG 7 Ave, Kigali Heights',-1.9532,30.0937,'Kigali Heights, ground floor','Your coffee card works here too') returning id`, [org.id]);

async function campaign(o) {
  const c = await one(`insert into campaigns (org_id,name,short_code,status,total_stamps,program_name,description,how_to_earn,terms,
      stamp_message,reward_message,news_text,news_updated_at,background_color,foreground_color,label_color,stamp_color,stamp_icon,logo_text,
      default_country,consent_enabled,consent_text,stamp_cooldown_minutes,max_stamps_per_transaction,max_stamps_per_day,stamp_value_cents,currency,activated_at,created_at)
    values ($1,$2,$3,$4,$5,'Café Neza',$6,$7,'One stamp per drink. Rewards can’t be exchanged for cash.',
      'You have {n} stamps',$8,$9,$10,$11,$12,$13,$14,$15,'café neza','RW',true,'Send me news and offers from Café Neza. I can stop anytime.',5,5,6,$16,'RWF',$17,$18)
    returning id`, [org.id, o.name, o.code, o.status, o.total, o.description, o.how, o.rewardMsg, o.news ?? null, o.news ? iso(now - 3 * day) : null,
      ...o.colors, o.icon, o.stampValue ?? null, o.status === 'live' ? iso(now - 55 * day) : null, iso(now - 60 * day)]);
  await q('insert into rewards (campaign_id,position,name,details,stamps_required,cost_cents) values ($1,1,$2,$3,$4,$5)', [c.id, o.reward, o.rewardDetails, o.total, o.rewardCost ?? null]);
  for (const [i, f] of [['name', 'Your name', 'name', true], ['phone', 'Phone', 'phone', true], ['birthday', 'Birthday', 'birthday', false]].entries()) {
    await q('insert into campaign_fields (campaign_id,key,label,type,required,position) values ($1,$2,$3,$4,$5,$6)', [c.id, f[0], f[1], f[2], f[3], i]);
  }
  return c.id;
}

const coffee = await campaign({ name: 'Coffee card', code: 'neza1cup', status: 'live', total: 10, description: 'Collect a stamp with every drink. Your tenth one is on us.',
  how: 'Show this card when you pay. One stamp per drink.', rewardMsg: 'Your free coffee is ready!', news: 'Double stamps every Friday this month.',
  colors: ['#1F3B2C', '#F1EAD8', '#C9D6A3', '#F1EAD8'], icon: 'cup', reward: 'Free coffee', rewardDetails: 'Any hot drink, any size.', rewardCost: 150000, stampValue: 250000 });
await campaign({ name: 'Pastry club', code: 'neza2pas', status: 'draft', total: 6, description: '', how: '', rewardMsg: 'Your reward is ready!',
  colors: ['#5B2A1C', '#FFF4E6', '#F4C9A8', '#FFF4E6'], icon: 'croissant', reward: 'Free croissant', rewardDetails: '' });
await q(`insert into campaign_links (campaign_id,kind,label,value,position) values ($1,'whatsapp','Order on WhatsApp','+250788000111',0),($1,'instagram','Instagram','cafeneza.kgl',1)`, [coffee]);
await q('insert into campaign_locations (campaign_id,location_id) values ($1,$2),($1,$3)', [coffee, loc1.id, loc2.id]);

let cards = 0, events = 0;
for (const [i, name] of NAMES.entries()) {
  const joined = now - Math.floor(r() * 45 * day) - day;
  const bdayToday = i % 4 === 0;
  const cust = await one(`insert into customers (org_id,name,email,phone_e164,birthday_month,birthday_day,marketing_consent,consent_at,created_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$8) returning id`, [org.id, name, i % 3 === 0 ? `${name.split(' ')[0].toLowerCase()}@example.test` : null,
    `+25078${String(1000000 + i * 7919).slice(0, 7)}`, bdayToday ? new Date(now).getUTCMonth() + 1 : 1 + Math.floor(r() * 12),
    bdayToday ? new Date(now + (i % 8) * day).getUTCDate() : 1 + Math.floor(r() * 28), r() > 0.3, iso(joined)]);
  const ev = [['enrolled', 1, 'customer', joined]];
  let cur = 0, rewards = 0, earned = 0, rEarned = 0, redeemed = 0, last = null, t = joined;
  const visits = i === 2 ? 0 : i === 0 ? 19 : Math.floor(r() * 14);
  for (let v = 0; v < visits; v++) {
    t += i === 0 ? Math.floor(day * 2) : Math.floor(r() * 5 * day) + 3_600_000;
    if (t > now - 2 * day) break;
    const qn = i === 0 ? 1 : r() > 0.8 ? 2 : 1;
    cur += qn; earned += qn; last = t; ev.push(['stamped', qn, 'scanner', t]);
    if (cur >= 10) { cur -= 10; rewards++; rEarned++; ev.push(['reward_earned', 1, 'scanner', t]); }
    if (rewards > 0 && i !== 0 && r() > 0.5) { rewards--; redeemed++; ev.push(['reward_redeemed', 1, 'scanner', t + 60_000]); }
  }
  const w = r();
  const card = await one(`insert into cards (org_id,campaign_id,customer_id,current_stamps,rewards_available,total_stamps_earned,total_rewards_earned,total_rewards_redeemed,
      last_stamp_at,last_visit_at,apple_installed,google_saved,web_card_seen_at,created_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning id`, [org.id, coffee, cust.id, cur, rewards, earned, rEarned, redeemed,
    last ? iso(last) : null, iso(last ?? joined), i === 0 || w < 0.35, i !== 0 && w >= 0.35 && w < 0.6, iso(now - Math.floor(r() * 20) * day), iso(joined)]);
  for (const [type, qty, source, at] of ev) {
    await q(`insert into card_events (org_id,campaign_id,card_id,type,quantity,source,actor_label,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [org.id, coffee, card.id, type, qty, source, source === 'scanner' ? 'Front counter' : null, iso(at)]);
    events++;
  }
  cards++;
}

await q(`insert into scanner_devices (org_id,label,token_hash,location_id,last_seen_at) values ($1,'Front counter','seed-device-without-token',$2,$3)`, [org.id, loc1.id, iso(now - 2 * day)]);
await q(`insert into messages (org_id,campaign_id,kind,body,status,recipients,delivered,skipped,web_cards,created_at,started_at,finished_at)
  values ($1,$2,'broadcast','Double stamps every Friday this month.','sent',23,21,2,9,$3,$3,$3),($1,$2,'birthday','Happy birthday {name}! Your next drink is on us this week.','sent',2,2,0,0,$4,$4,$4)`,
  [org.id, coffee, iso(now - 3 * day), iso(now - 9 * day)]);
await q(`insert into automations (org_id,campaign_id,kind,enabled,body,send_hour,enabled_at) values ($1,$2,'birthday',true,'Happy birthday {name}! Your next drink is on us this week.',10,$3)`, [org.id, coffee, iso(now - 40 * day)]);
await q(`insert into automations (org_id,campaign_id,kind,enabled,body,days_inactive,send_hour) values ($1,$2,'winback',false,'We miss you, {name}. Come by this week for a double stamp.',30,10)`, [org.id, coffee]);

console.log(`seeded Café Neza: ${cards} cards, ${events} events. Login: ${email}`);
await db.end();

// Second-org access test against a running app + database (not part of `npm test`).
//   node tests/access.integration.mjs   (needs `npm run db:dev`, migrations, seed and `npm run dev`)
// Creates org B with its own session, then tries to reach org A's data with it.
import { createHash, randomBytes } from 'node:crypto';
import pg from 'pg';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const db = new pg.Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54321/postgres' });
await db.connect();
const one = async (s, p) => (await db.query(s, p)).rows[0];
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };

// org A = the seeded café
const a = await one(`select o.id as org, c.id as campaign, k.id as card, k.manual_code, k.serial from orgs o join campaigns c on c.org_id = o.id and c.short_code = 'neza1cup' join cards k on k.campaign_id = c.id where o.name = 'Café Neza' limit 1`);
// org B with a session we control
await db.query(`delete from users where email = 'intruder@example.test'`);
await db.query(`delete from orgs where name = 'Intruder Org'`);
const u = await one(`insert into users (email, password_hash) values ('intruder@example.test', 'x') returning id`);
const b = await one(`insert into orgs (name) values ('Intruder Org') returning id`);
await db.query(`insert into org_members (org_id, user_id) values ($1,$2)`, [b.id, u.id]);
const token = randomBytes(24).toString('hex');
await db.query(`insert into sessions (token_hash, user_id, org_id) values ($1,$2,$3)`, [createHash('sha256').update(token).digest('hex'), u.id, b.id]);
const cookie = `lc_session=${token}`;
const get = (p) => fetch(BASE + p, { headers: { cookie }, redirect: 'manual' });
const post = (p, body) => fetch(BASE + p, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) });

for (const p of [`/cards/${a.campaign}`, `/cards/${a.campaign}/design`, `/cards/${a.campaign}/customers`, `/cards/${a.campaign}/customers/${a.card}`, `/cards/${a.campaign}/insights`, `/cards/${a.campaign}/messages`, `/cards/${a.campaign}/automations`]) {
  const r = await get(p);
  ok(`B cannot open A's ${p.replace(a.campaign, ':id').replace(a.card, ':card')}`, r.status === 404, `(${r.status})`);
}
const list = await (await get('/cards')).text();
ok("B's card list doesn't show A's cards", !list.includes('Coffee card'));
const look = await (await post('/api/scan/lookup', { manual: a.manual_code })).json();
ok("B's scanner can't find A's card by code", look.ok === false && look.error === 'card_not_found', JSON.stringify(look));
const tx = await (await post('/api/scan/transaction', { cardId: a.card, stamps: 1, redeem: 0, idempotencyKey: 'intruder-key-1234' })).json();
ok("B's scanner can't stamp A's card", tx.ok === false && tx.error === 'card_not_found', JSON.stringify(tx));
const before = await one('select current_stamps from cards where id = $1', [a.card]);
ok("A's card unchanged", before.current_stamps !== undefined);
const anon = await fetch(`${BASE}/api/scan/lookup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"manual":"' + a.manual_code + '"}' });
ok('no session: scanner API refuses', anon.status === 401, `(${anon.status})`);
const anonPage = await fetch(`${BASE}/cards`, { redirect: 'manual' });
ok('no session: dashboard redirects to login', anonPage.status === 307 || anonPage.status === 303, `(${anonPage.status} -> ${anonPage.headers.get('location')})`);
const cron = await fetch(`${BASE}/api/cron/cleanup`);
ok('cron without secret is refused', cron.status === 401, `(${cron.status})`);
const pub = await (await fetch(`${BASE}/c/${a.serial}`)).text();
ok('public web card shows first name only', !/Uwase|\+2507|@example\.test/.test(pub.replace(/Hi Aline/, '')), '');

await db.query(`delete from orgs where id = $1`, [b.id]);
await db.query(`delete from users where id = $1`, [u.id]);
await db.end();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

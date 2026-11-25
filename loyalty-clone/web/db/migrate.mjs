// Applies db/migrations/*.sql in order, once each, recorded in schema_migrations.
// Usage: DATABASE_URL=... node db/migrate.mjs
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54321/postgres';
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
const done = new Set((await client.query('select name from schema_migrations')).rows.map((r) => r.name));
const dir = path.join(path.dirname(new URL(import.meta.url).pathname), 'migrations');
let applied = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
  if (done.has(f)) continue;
  const sql = fs.readFileSync(path.join(dir, f), 'utf8');
  // the whole file + its record in one simple-protocol call = one implicit transaction
  await client.query(`${sql}\n;insert into schema_migrations (name) values ('${f.replace(/'/g, "''")}');`);
  console.log('applied', f); applied++;
}
console.log(applied ? `${applied} migration(s) applied` : 'up to date');
await client.end();

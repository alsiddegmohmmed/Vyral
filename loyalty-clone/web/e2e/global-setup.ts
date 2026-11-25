import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { closeDb, sql } from './support/db';

/** Fresh demo café before every run; throwaway test accounts (example.test) removed. */
export default async function globalSetup() {
  await cleanupThrowaways();
  execFileSync(process.execPath, [path.join(__dirname, '../db/seed.mjs')], { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  await sql('delete from rate_limits');
  await closeDb();
}

export async function cleanupThrowaways() {
  await sql(`delete from orgs where id in (select m.org_id from org_members m join users u on u.id = m.user_id where u.email::text like '%@example.test')`);
  await sql(`delete from users where email::text like '%@example.test'`);
}

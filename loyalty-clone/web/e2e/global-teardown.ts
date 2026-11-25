import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { closeDb, sql } from './support/db';
import { cleanupThrowaways } from './global-setup';

/** Leave the dev database as we found it: throwaway accounts gone, demo café reseeded. */
export default async function globalTeardown() {
  await cleanupThrowaways();
  await sql('delete from rate_limits');
  await closeDb();
  execFileSync(process.execPath, [path.join(__dirname, '../db/seed.mjs')], { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
}

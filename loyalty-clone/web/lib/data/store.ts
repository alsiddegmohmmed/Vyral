// FAKE data store for the build step: an in-memory DB persisted to
// .data/dev-db.json. Replaced by Postgres in /replica-backend; only
// lib/data/api.ts touches it.
//
// The dev server can run routes in separate workers, each with its own memory,
// so every read checks the file's mtime and reloads when another worker wrote.
import fs from 'node:fs';
import path from 'node:path';
import { buildSeed } from './seed';
import type { DB } from './types';

const file = path.join(process.cwd(), '.data', 'dev-db.json');
const g = globalThis as unknown as { __loyaltyDb?: DB; __loyaltyMtime?: number };

const mtime = () => { try { return fs.statSync(file).mtimeMs; } catch { return -1; } };

export function db(): DB {
  const m = mtime();
  if (!g.__loyaltyDb || m !== g.__loyaltyMtime) {
    if (m < 0) {
      g.__loyaltyDb = buildSeed();
      save();
    } else {
      g.__loyaltyDb = JSON.parse(fs.readFileSync(file, 'utf8')) as DB;
      g.__loyaltyMtime = m;
    }
  }
  return g.__loyaltyDb!;
}

export function save() {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(g.__loyaltyDb));
  g.__loyaltyMtime = mtime();
}

export function resetToSeed() {
  g.__loyaltyDb = buildSeed();
  save();
}

import 'server-only';
import pg from 'pg';

// Every atomic write is ONE statement or ONE SQL function call. The app never
// holds a transaction open (see replica/backend.md "Transactions"), which keeps
// requests short on real Postgres and makes the dev pglite multiplexer safe.

// timestamptz -> ISO string; int8/numeric counts -> number
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString());
pg.types.setTypeParser(20, (v) => Number(v));

const g = globalThis as unknown as { __pgPool?: pg.Pool };

function pool(): pg.Pool {
  if (!g.__pgPool) {
    const connectionString = process.env.DATABASE_URL ?? (process.env.NODE_ENV === 'production' ? undefined : 'postgres://postgres:postgres@127.0.0.1:54321/postgres');
    if (!connectionString) throw new Error('DATABASE_URL is not set');
    g.__pgPool = new pg.Pool({ connectionString, max: Number(process.env.PG_POOL_MAX ?? 5), idleTimeoutMillis: 30_000 });
  }
  return g.__pgPool;
}

const camel = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** Run a query; rows come back with camelCase keys. */
export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool().query(text, params);
  return res.rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) out[camel(k)] = v;
    return out as T;
  });
}

export async function one<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | undefined> {
  return (await q<T>(text, params))[0];
}

/** Postgres error code helper (23505 unique_violation, P0001 raise). */
export const pgCode = (e: unknown) => (e as { code?: string })?.code;
export const pgMessage = (e: unknown) => (e as { message?: string })?.message ?? '';

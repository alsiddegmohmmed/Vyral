import 'server-only';
import { one, q } from '@/lib/db/client';

/**
 * Runs a job with up to 3 attempts. Every attempt is a job_runs row; a run that
 * fails 3 times stays 'failed' = the dead-letter log (query job_runs where status = 'failed').
 */
export async function runJob(job: string, fn: () => Promise<Record<string, unknown>>) {
  let lastError = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const run = await one<{ id: string }>('insert into job_runs (job, attempt) values ($1, $2) returning id', [job, attempt]);
    try {
      const details = await fn();
      await q(`update job_runs set status = 'ok', details = $2, finished_at = now() where id = $1`, [run!.id, JSON.stringify(details)]);
      return { ok: true as const, attempt, details };
    } catch (e) {
      lastError = String((e as Error).message).slice(0, 1000);
      await q(`update job_runs set status = 'failed', error = $2, finished_at = now() where id = $1`, [run!.id, lastError]);
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  return { ok: false as const, error: lastError };
}

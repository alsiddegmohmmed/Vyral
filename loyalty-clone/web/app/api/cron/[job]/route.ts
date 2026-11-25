import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { runJob } from '@/lib/jobs/run';
import { runAutomations } from '@/lib/jobs/automations';
import { runBilling, runCleanup, runDeliveries } from '@/lib/jobs/maintenance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const JOBS: Record<string, () => Promise<Record<string, unknown>>> = {
  automations: runAutomations, billing: runBilling, cleanup: runCleanup, deliveries: runDeliveries,
};

// Vercel Cron calls these with "Authorization: Bearer $CRON_SECRET" (see vercel.json).
export async function GET(req: Request, { params }: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get('authorization') ?? '';
  const want = `Bearer ${secret}`;
  if (!secret || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { job } = await params;
  const fn = JOBS[job];
  if (!fn) return NextResponse.json({ error: 'unknown job' }, { status: 404 });
  const r = await runJob(job, fn);
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}

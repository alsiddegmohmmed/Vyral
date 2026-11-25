import { Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/feedback';
import { PageHeader } from '@/components/shell/app-shell';
import { EmptyState } from '@/components/ui/feedback';
import { getBilling, listDevices, listLocations, listScannerReports, PLAN_LIMITS } from '@/lib/data/api';
import { seenLabel } from '@/lib/scanner-health';
import { requireOwner } from '@/lib/session';
import { PairPhone, RevokeButton } from './client';

export default async function DevicesPage() {
  const ctx = await requireOwner();
  const [devices, locations, billing, reports] = await Promise.all([listDevices(ctx), listLocations(ctx), getBilling(ctx), listScannerReports(ctx, 20)]);
  const now = Date.now();
  const limit = PLAN_LIMITS[billing.plan].devices;
  return (
    <>
      <PageHeader title="Counter phones" description={`Phones your staff use to stamp cards. ${devices.length} of ${limit} on your plan.`}
        actions={<PairPhone locations={locations.map((l) => ({ id: l.id, name: l.name }))} disabled={devices.length >= limit} />} />
      <p className="mb-5 max-w-2xl text-sm text-text-muted">A paired phone can only scan and stamp. It can’t see your customer list, billing or settings. Every stamp is logged with the phone’s name.</p>
      {devices.length === 0 ? (
        <EmptyState icon={<Smartphone aria-hidden />} title="No phones paired yet">Pair the phone at your counter. Staff open the scanner, type a short code, and they’re ready.</EmptyState>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {devices.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold">{d.label}{seenLabel(d.lastSeenAt, now).online && <Badge tone="success">Online</Badge>}</p>
                <p className="text-sm text-text-muted">
                  {locations.find((l) => l.id === d.locationId)?.name ?? 'Any location'} · {seenLabel(d.lastSeenAt, now).online ? 'Scanner open now' : seenLabel(d.lastSeenAt, now).text}
                </p>
              </div>
              <RevokeButton id={d.id} label={d.label} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 max-w-2xl text-sm text-text-muted">Paired phones stay signed in until you remove them. If a phone says it needs pairing again, pair it here and type the new code on the phone; it carries on without a restart.</p>

      <section aria-labelledby="reports-h" className="mt-10">
        <h2 id="reports-h" className="text-lg">Problem reports</h2>
        <p className="mb-4 mt-1 max-w-2xl text-sm text-text-muted">Sent from a phone’s scanner settings with “Report a problem”. They hold the phone’s name, app version, browser, last error and self-check results, never customer details.</p>
        {reports.length === 0 ? (
          <p className="text-sm text-text-muted">No problems reported.</p>
        ) : (
          <ul aria-label="Problem reports" className="divide-y divide-border rounded-lg border border-border">
            {reports.map((r) => {
              const bad = r.checks.filter((c) => c.status !== 'ok');
              return (
                <li key={r.id} className="flex flex-col gap-1.5 p-4 text-sm">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{r.deviceLabel}</span>
                    <Badge tone={bad.some((c) => c.status === 'fail') ? 'danger' : bad.length ? 'warning' : 'success'}>
                      {bad.length ? `${bad.length} ${bad.length === 1 ? 'check' : 'checks'} need attention` : 'All checks OK'}
                    </Badge>
                    <time dateTime={r.createdAt} className="text-text-muted">{new Date(r.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time>
                  </p>
                  {bad.map((c) => <p key={c.id}><span className="font-medium capitalize">{c.id}:</span> {c.detail}</p>)}
                  <p className="text-text-muted">Last error: {r.lastError ?? 'none recorded'}</p>
                  <p className="break-words text-xs text-text-muted">Version {r.appVersion} · {r.userAgent || 'unknown browser'}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

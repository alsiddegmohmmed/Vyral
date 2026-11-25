// Pure logic for the self-recovering counter phone (fixes.md #1, #3, #4).
// No imports, no I/O: used by the scanner UI, the scan API routes and
// tests/scanner-health.test.mjs alike.

export type UnpairedReason = 'not_paired' | 'device_unknown' | 'device_removed' | 'cookie_missing' | 'session_expired';

/** What the re-pair screen says, by why the server answered 401. */
export function repairCopy(reason: UnpairedReason | undefined, label?: string | null): { title: string; body: string; firstTime: boolean } {
  const name = label ? `“${label}”` : 'This phone';
  switch (reason) {
    case 'device_removed':
      return { title: 'This phone needs pairing again', firstTime: false,
        body: `${name} was removed from Counter phones on the dashboard. Ask the owner for a new code and type it below. Nothing else on the phone needs to change.` };
    case 'cookie_missing':
      return { title: 'This phone needs pairing again', firstTime: false,
        body: `${name} is still listed on Counter phones, but this browser forgot its sign-in (cleared data, a private tab or a different browser). Type a new code from the owner below. The old entry can be removed afterwards.` };
    case 'session_expired':
      return { title: 'This phone needs pairing again', firstTime: false,
        body: 'The sign-in on this phone has ended. Type a pairing code from Counter phones below, or sign in again as the owner.' };
    case 'device_unknown':
      return { title: 'This phone needs pairing again', firstTime: false,
        body: 'This phone’s pairing isn’t recognised any more. Ask the owner for a new code from Counter phones and type it below.' };
    default:
      return { title: 'Set up this phone', firstTime: true,
        body: 'On the dashboard, open Counter phones and tap Pair a phone. Type the 6-character code here.' };
  }
}

export const UNPAIRED_REASONS: UnpairedReason[] = ['not_paired', 'device_unknown', 'device_removed', 'cookie_missing', 'session_expired'];
export const asReason = (v: unknown): UnpairedReason => (UNPAIRED_REASONS.includes(v as UnpairedReason) ? (v as UnpairedReason) : 'not_paired');

/**
 * Call `send` once; if it failed at the network level (null), wait and call it
 * exactly once more. Only for requests that are safe to repeat (reads, or
 * writes carrying the same idempotency key).
 */
export async function retryOnce<T>(send: () => Promise<T | null>, waitMs = 700, sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))): Promise<{ value: T | null; attempts: number }> {
  const first = await send();
  if (first !== null) return { value: first, attempts: 1 };
  await sleep(waitMs);
  return { value: await send(), attempts: 2 };
}

/** A new build is live and the phone may reload now (never while a card is open). */
export function shouldApplyUpdate(loaded: string, latest: string | null | undefined, view: string): boolean {
  return !!latest && latest !== loaded && view === 'camera';
}
export const updateReady = (loaded: string, latest: string | null | undefined) => !!latest && latest !== loaded;

// ---------------------------------------------------------------- self-check

export type CheckStatus = 'ok' | 'warn' | 'fail';
export type CheckId = 'network' | 'pairing' | 'camera' | 'decoder' | 'clock';
export type CheckResult = { id: CheckId; label: string; status: CheckStatus; detail: string; hint?: string };

export type Probe = {
  network: { ok: boolean; ms?: number };
  pairing: { status: 'paired'; who: string; role: string } | { status: 'unpaired'; reason: UnpairedReason } | { status: 'unknown' };
  camera: 'granted' | 'denied' | 'prompt' | 'unsupported' | 'insecure' | 'unknown';
  decoder: 'native' | 'wasm' | 'failed';
  clockSkewMs?: number | null;
};

export function evaluateChecks(p: Probe): CheckResult[] {
  const out: CheckResult[] = [];
  out.push(p.network.ok
    ? { id: 'network', label: 'Connection', status: p.network.ms != null && p.network.ms > 3000 ? 'warn' : 'ok',
        detail: p.network.ms != null ? `Reached the server in ${Math.round(p.network.ms)} ms.` : 'Reached the server.',
        hint: p.network.ms != null && p.network.ms > 3000 ? 'The connection is slow. Move closer to the Wi-Fi or switch to mobile data.' : undefined }
    : { id: 'network', label: 'Connection', status: 'fail', detail: 'Can’t reach the server.',
        hint: 'Check Wi-Fi or mobile data, then run the check again. Nothing is saved while offline.' });

  if (p.pairing.status === 'paired') {
    out.push({ id: 'pairing', label: 'Pairing', status: 'ok',
      detail: p.pairing.role === 'device' ? `Paired as “${p.pairing.who}”.` : `Signed in as the owner (${p.pairing.who}).` });
  } else if (p.pairing.status === 'unpaired') {
    out.push({ id: 'pairing', label: 'Pairing', status: 'fail', detail: repairCopy(p.pairing.reason).title + '.',
      hint: 'Ask the owner for a new code from Counter phones on the dashboard.' });
  } else {
    out.push({ id: 'pairing', label: 'Pairing', status: 'warn', detail: 'Couldn’t check the pairing without a connection.', hint: 'Fix the connection first.' });
  }

  const cam: Record<Probe['camera'], Omit<CheckResult, 'id' | 'label'>> = {
    granted: { status: 'ok', detail: 'The camera is allowed.' },
    prompt: { status: 'warn', detail: 'The browser will ask for the camera the first time.', hint: 'Tap Start camera and choose Allow.' },
    denied: { status: 'fail', detail: 'The camera is blocked for this site.', hint: 'Open the browser’s site settings, allow the camera, then reload. Typing the code still works meanwhile.' },
    insecure: { status: 'fail', detail: 'The camera needs a secure (https) address.', hint: 'Open the scanner from its https link.' },
    unsupported: { status: 'fail', detail: 'This browser can’t use a camera.', hint: 'Use Chrome on Android or Safari on iPhone. Typing the code still works.' },
    unknown: { status: 'warn', detail: 'This browser doesn’t say whether the camera is allowed.', hint: 'Tap Start camera to find out.' },
  };
  out.push({ id: 'camera', label: 'Camera', ...cam[p.camera] });

  out.push(p.decoder === 'failed'
    ? { id: 'decoder', label: 'QR reader', status: 'fail', detail: 'The QR reader didn’t load.', hint: 'Reload the page. If it keeps failing, type the code under the QR instead.' }
    : { id: 'decoder', label: 'QR reader', status: 'ok', detail: p.decoder === 'native' ? 'Using the phone’s built-in QR reader.' : 'The QR reader loaded.' });

  if (p.clockSkewMs != null) {
    const min = Math.round(Math.abs(p.clockSkewMs) / 60_000);
    out.push(min >= 5
      ? { id: 'clock', label: 'Clock', status: 'warn', detail: `The phone’s clock is ${min} minutes off.`, hint: 'Turn on automatic date and time in the phone’s settings.' }
      : { id: 'clock', label: 'Clock', status: 'ok', detail: 'The phone’s clock is right.' });
  }
  return out;
}

export const overallStatus = (checks: CheckResult[]): CheckStatus =>
  checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'ok';

// ---------------------------------------------------------------- problem report

/** Remove anything that could identify a customer or a card from free text. */
export function scrubText(text: string, max = 500): string {
  return text
    .replace(/v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[qr]')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[email]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
    .replace(/\b[0-9A-Z]{26}\b/g, '[serial]')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, '[number]')
    .replace(/\b(?=[0-9A-Z]*\d)(?=[0-9A-Z]*[A-Z])[0-9A-Z]{6,12}\b/g, '[code]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export type ReportBundle = { appVersion: string; userAgent: string; lastError: string | null; checks: { id: string; status: CheckStatus; detail: string }[] };

/** Whitelist and cap what a phone sends: no customer data can ride along. */
export function buildReport(input: { appVersion?: unknown; userAgent?: unknown; lastError?: unknown; checks?: unknown }): ReportBundle {
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  const ids: string[] = ['network', 'pairing', 'camera', 'decoder', 'clock'];
  const checks = (Array.isArray(input.checks) ? input.checks : []).slice(0, 8).flatMap((c) => {
    const r = c as Record<string, unknown>;
    if (!ids.includes(String(r?.id)) || !['ok', 'warn', 'fail'].includes(String(r?.status))) return [];
    return [{ id: String(r.id), status: r.status as CheckStatus, detail: scrubText(str(r.detail, 200), 160) }];
  });
  // a leading ISO timestamp is kept as is (the date would otherwise look like a phone number to the scrub)
  const raw = str(input.lastError, 1000);
  const stamp = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z) /.exec(raw)?.[1];
  const lastError = stamp ? `${stamp} ${scrubText(raw.slice(stamp.length + 1), 470)}` : scrubText(raw);
  return {
    appVersion: str(input.appVersion, 40).replace(/[^\w.+-]/g, '') || 'unknown',
    userAgent: str(input.userAgent, 300),
    lastError: lastError || null,
    checks,
  };
}

// ---------------------------------------------------------------- owner view

/** "Online now" for a phone seen in the last 3 minutes, else a plain "last seen". */
export function seenLabel(lastSeenAt: string | null | undefined, now = Date.now()): { online: boolean; text: string } {
  if (!lastSeenAt) return { online: false, text: 'Not used yet' };
  const s = Math.max(0, (now - +new Date(lastSeenAt)) / 1000);
  if (s < 180) return { online: true, text: 'Online now' };
  const m = Math.round(s / 60);
  if (m < 60) return { online: false, text: `Last seen ${m} min ago` };
  const h = Math.round(m / 60);
  if (h < 24) return { online: false, text: `Last seen ${h} h ago` };
  const d = Math.round(h / 24);
  return { online: false, text: d === 1 ? 'Last seen yesterday' : `Last seen ${d} days ago` };
}

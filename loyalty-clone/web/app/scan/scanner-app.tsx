'use client';
import { Component, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Camera, CheckCircle2, Flashlight, Gift, History, Keyboard, RefreshCw, Settings2, WifiOff, X, XCircle } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Stepper, Switch } from '@/components/ui/controls';
import { StampStrip } from '@/components/loyalty/stamp-strip';
import { txErrorMessage } from '@/lib/data/rules';
import { cn } from '@/lib/cn';
import { APP_VERSION } from '@/lib/version';
import {
  asReason, buildReport, evaluateChecks, overallStatus, repairCopy, retryOnce, scrubText, shouldApplyUpdate, updateReady,
  type CheckResult, type Probe, type UnpairedReason,
} from '@/lib/scanner-health';
import type { ScanLookup } from '@/lib/data/api';

type Found = Extract<ScanLookup, { ok: true }>['card'];
type View =
  | { v: 'checking' } | { v: 'offline' } | { v: 'pair'; reason?: UnpairedReason; error?: string } | { v: 'camera' } | { v: 'manual'; error?: string }
  | { v: 'card'; card: Found } | { v: 'result'; ok: boolean; title: string; detail: string } | { v: 'history' } | { v: 'settings' };

type Prefs = { vibrate: boolean; beep: boolean; confirm: boolean };
const PREFS_KEY = 'lc-scanner-prefs';
const DEVICE_KEY = 'lc-scanner-device'; // { id, label } of the pairing this phone last had: tells "cookie lost" from "never paired"
const ERROR_KEY = 'lc-scanner-last-error';
const loadPrefs = (): Prefs => { try { return { vibrate: true, beep: false, confirm: false, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }; } catch { return { vibrate: true, beep: false, confirm: false }; } };

const store = {
  get<T>(k: string): T | null { try { return JSON.parse(localStorage.getItem(k) ?? 'null') as T | null; } catch { return null; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
type DeviceHint = { id: string; label: string };
/** Remember the last thing that went wrong (scrubbed: no card codes or customer details) for "Report a problem". */
export function recordError(message: string) { store.set(ERROR_KEY, { at: new Date().toISOString(), message: scrubText(message, 300) }); }
const lastError = () => { const e = store.get<{ at: string; message: string }>(ERROR_KEY); return e ? `${e.at} ${e.message}` : null; };

/** fetch for the scanner: sends the remembered device id, times out, and returns null on a network failure (never throws). */
async function api(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), init.timeoutMs ?? 15_000);
  const hint = store.get<DeviceHint>(DEVICE_KEY);
  try {
    return await fetch(path, {
      ...init, cache: 'no-store', signal: ctl.signal,
      headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...(hint?.id ? { 'x-scanner-device': hint.id } : {}), ...init.headers },
    });
  } catch (e) {
    recordError(`${path}: ${(e as Error).name === 'AbortError' ? 'timed out' : 'network error'}`);
    return null;
  } finally { clearTimeout(t); }
}
const reasonOf = async (r: Response) => asReason(((await r.json().catch(() => ({}))) as { reason?: string }).reason);

const msg = (key: string) => (txErrorMessage as Record<string, string>)[key] ?? 'That didn’t work. Try again.';
const ago = (iso: string) => { const d = Math.round((Date.now() - +new Date(iso)) / 86_400_000); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; };

/** The scanner, inside an error boundary: a crash shows "Restart scanner", never a white screen. */
export function ScannerApp({ supportUrl }: { supportUrl?: string | null }) {
  const [run, setRun] = useState(0);
  return (
    <ScannerErrorBoundary onRestart={() => setRun((n) => n + 1)}>
      <Scanner key={run} supportUrl={supportUrl ?? null} />
    </ScannerErrorBoundary>
  );
}

class ScannerErrorBoundary extends Component<{ children: React.ReactNode; onRestart: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { recordError(`crash: ${error.name}: ${error.message}`); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main data-scanner className="flex min-h-dvh flex-col bg-scanner-bg text-scanner-text">
        <div role="alert" className="m-auto flex w-full max-w-[440px] flex-col items-center gap-4 px-4 text-center">
          <AlertTriangle aria-hidden className="size-16 text-scanner-danger" />
          <h1 className="text-2xl">The scanner stopped</h1>
          <p className="text-scanner-muted">Stamps that were already saved are safe. Restart the scanner to carry on; the phone stays paired.</p>
          <Button size="scanner" block className={lightBtn} onClick={() => { this.setState({ failed: false }); this.props.onRestart(); }}>
            <RefreshCw aria-hidden className="size-5" /> Restart scanner
          </Button>
        </div>
      </main>
    );
  }
}

function Scanner({ supportUrl }: { supportUrl: string | null }) {
  const [view, setView] = useState<View>({ v: 'checking' });
  const [who, setWho] = useState('');
  const [latest, setLatest] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>({ vibrate: true, beep: false, confirm: false });
  const viewRef = useRef(view.v);

  const [prefsLoaded, setPrefsLoaded] = useState(false);
  useEffect(() => { setPrefs(loadPrefs()); setPrefsLoaded(true); }, []);
  // only save after loading, or the first render's defaults overwrite what was stored (B-015)
  useEffect(() => { if (!prefsLoaded) return; try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* private mode */ } }, [prefs, prefsLoaded]);

  // anything uncaught still lands in "last error" for Report a problem
  useEffect(() => {
    const onErr = (e: ErrorEvent) => recordError(`error: ${e.message}`);
    const onRej = (e: PromiseRejectionEvent) => recordError(`rejection: ${(e.reason as Error)?.message ?? String(e.reason)}`);
    window.addEventListener('error', onErr); window.addEventListener('unhandledrejection', onRej);
    return () => { window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onRej); };
  }, []);

  const toPair = useCallback((reason: UnpairedReason, error?: string) => setView({ v: 'pair', reason, error }), []);

  /** Who am I? Also the heartbeat (keeps "Online" on the owner's Counter phones page) and the update check. */
  const status = useCallback(async (mode: 'start' | 'beat') => {
    const { value: r } = mode === 'start' ? await retryOnce(() => api('/api/scan/status')) : { value: await api('/api/scan/status') };
    if (!r) { if (mode === 'start') setView({ v: 'offline' }); return; }
    if (r.status === 401) {
      const reason = await reasonOf(r);
      // never yank an open card away: a heartbeat only moves idle screens to re-pair
      if (mode === 'start' || ['camera', 'manual', 'history', 'settings', 'offline'].includes(viewRef.current)) toPair(reason);
      return;
    }
    if (!r.ok) { if (mode === 'start') setView({ v: 'offline' }); return; }
    const d = (await r.json()) as { who: string; role: string; deviceId: string | null; version: string };
    setWho(d.who); setLatest(d.version);
    if (d.role === 'device' && d.deviceId) store.set(DEVICE_KEY, { id: d.deviceId, label: d.who });
    if (mode === 'start' || viewRef.current === 'offline' || viewRef.current === 'checking') setView({ v: 'camera' });
  }, [toPair]);

  useEffect(() => { void status('start'); }, [status]);
  useEffect(() => {
    const beat = () => { if (document.visibilityState === 'visible') void status('beat'); };
    const t = setInterval(beat, 60_000);
    document.addEventListener('visibilitychange', beat);
    window.addEventListener('online', beat);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', beat); window.removeEventListener('online', beat); };
  }, [status]);

  // a new build is live: apply it on the next return to the camera, never mid-card
  useEffect(() => {
    const prev = viewRef.current;
    viewRef.current = view.v;
    if (prev !== 'camera' && prev !== 'checking' && shouldApplyUpdate(APP_VERSION, latest, view.v)) window.location.reload();
  }, [view.v, latest]);

  const feedback = (ok: boolean) => {
    if (prefs.vibrate) navigator.vibrate?.(ok ? 60 : [80, 60, 80]);
    if (prefs.beep) {
      try { const a = new AudioContext(); const o = a.createOscillator(); o.frequency.value = ok ? 880 : 220; o.connect(a.destination); o.start(); o.stop(a.currentTime + 0.12); } catch { /* no audio */ }
    }
  };

  const lookup = async (body: { qr?: string; manual?: string }) => {
    // a lookup only reads, so one automatic retry is always safe
    const { value: r } = await retryOnce(() => api('/api/scan/lookup', { method: 'POST', body: JSON.stringify(body), timeoutMs: 10_000 }));
    if (!r) { feedback(false); setView({ v: 'result', ok: false, title: 'No connection', detail: 'Nothing was saved. We tried twice. Check Wi-Fi or mobile data and scan again.' }); return; }
    if (r.status === 401) { toPair(await reasonOf(r)); return; }
    if (!r.ok) { recordError(`lookup: HTTP ${r.status}`); feedback(false); setView({ v: 'result', ok: false, title: 'Something went wrong', detail: 'Nothing was saved. Scan the card again.' }); return; }
    const data = (await r.json()) as ScanLookup;
    if (data.ok) { feedback(true); setView({ v: 'card', card: data.card }); void status('beat'); }
    else if (body.manual && data.error === 'card_not_found') setView({ v: 'manual', error: 'No card with that code. Check the letters and numbers.' });
    else { feedback(false); setView({ v: 'result', ok: false, title: data.error === 'card_replaced' ? 'This card was replaced' : 'Can’t use this card', detail: msg(data.error) }); }
  };

  const ready = updateReady(APP_VERSION, latest);
  const busyScreen = view.v === 'card' || view.v === 'result';
  return (
    <main data-scanner className="flex min-h-dvh flex-col bg-scanner-bg text-scanner-text">
      <header className="flex h-14 items-center justify-between gap-2 px-3">
        <span className="truncate px-2 text-sm text-scanner-muted">{who && view.v !== 'pair' ? `Scanner · ${who}` : 'Scanner'}</span>
        <div className="flex shrink-0 items-center gap-1">
          {ready && (busyScreen
            ? <span role="status" className="rounded-pill bg-scanner-surface px-3 py-1 text-xs text-scanner-muted">Update ready · installs after this card</span>
            : <button type="button" onClick={() => window.location.reload()} className="rounded-pill bg-scanner-surface px-3 py-1 text-xs text-scanner-text underline-offset-2 hover:underline">Update ready · install now</button>)}
          {!['checking', 'pair', 'offline'].includes(view.v) && (
            <>
              <IconButton aria-label="Recent scans" variant="ghost" className="text-scanner-text hover:bg-scanner-surface" icon={<History aria-hidden className="size-5" />} onClick={() => setView({ v: 'history' })} />
              <IconButton aria-label="Scanner settings" variant="ghost" className="text-scanner-text hover:bg-scanner-surface" icon={<Settings2 aria-hidden className="size-5" />} onClick={() => setView({ v: 'settings' })} />
            </>
          )}
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-4 pb-6">
        {view.v === 'checking' && <p role="status" className="m-auto text-scanner-muted">Starting…</p>}
        {view.v === 'offline' && <Offline onRetry={() => { setView({ v: 'checking' }); void status('start'); }} />}
        {view.v === 'pair' && <Pair reason={view.reason} error={view.error} onPaired={() => { setView({ v: 'checking' }); void status('start'); }} />}
        {view.v === 'camera' && <CameraView onCode={(qr) => lookup({ qr })} onManual={() => setView({ v: 'manual' })} />}
        {view.v === 'manual' && <Manual error={view.error} onSubmit={(manual) => lookup({ manual })} onBack={() => setView({ v: 'camera' })} />}
        {view.v === 'card' && (
          <Transaction card={view.card} confirm={prefs.confirm} onDone={(ok, title, detail) => { feedback(ok); setView({ v: 'result', ok, title, detail }); }}
            onCancel={() => setView({ v: 'camera' })} onSignedOut={toPair} />
        )}
        {view.v === 'result' && <Result ok={view.ok} title={view.title} detail={view.detail} onNext={() => setView({ v: 'camera' })} />}
        {view.v === 'history' && <HistoryView onBack={() => setView({ v: 'camera' })} />}
        {view.v === 'settings' && <SettingsView prefs={prefs} setPrefs={setPrefs} supportUrl={supportUrl} onBack={() => setView({ v: 'camera' })} />}
      </div>
    </main>
  );
}

const darkBtn = 'bg-scanner-surface text-scanner-text hover:bg-scanner-surface/80';
const lightBtn = 'bg-scanner-text text-scanner-bg hover:bg-white';
const inputCls = 'h-14 w-full rounded-md border-2 border-scanner-muted bg-scanner-bg px-4 text-center font-mono text-2xl uppercase tracking-[.3em] text-scanner-text placeholder:text-scanner-muted/50';

function Offline({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="m-auto flex w-full flex-col items-center gap-4 text-center">
      <WifiOff aria-hidden className="size-14 text-scanner-danger" />
      <h1 className="text-2xl">Can’t reach the server</h1>
      <p className="text-scanner-muted">This phone has no connection right now. Check Wi-Fi or mobile data. The scanner tries again by itself when the connection is back.</p>
      <Button size="scanner" block onClick={onRetry} className={lightBtn}>Try again</Button>
    </div>
  );
}

function Pair({ reason, error, onPaired }: { reason?: UnpairedReason; error?: string; onPaired: () => void }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState(error);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => { setLabel(store.get<DeviceHint>(DEVICE_KEY)?.label ?? null); }, []);
  const copy = repairCopy(reason, label);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(undefined);
    const r = await api('/api/scan/pair', { method: 'POST', body: JSON.stringify({ code }) });
    setBusy(false);
    if (r?.ok) onPaired(); else setErr(r ? ((await r.json().catch(() => ({}))) as { error?: string }).error ?? 'Pairing failed.' : 'No connection. Check Wi-Fi or mobile data and try again.');
  };
  return (
    <form onSubmit={submit} className="m-auto flex w-full flex-col gap-4">
      <div role={copy.firstTime ? undefined : 'alert'} className="flex flex-col gap-2">
        <h1 className="text-2xl">{copy.title}</h1>
        <p className="text-sm text-scanner-muted">{copy.body}</p>
      </div>
      <label htmlFor="pair-code" className="text-sm font-semibold">Pairing code</label>
      <input id="pair-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))} autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false}
        aria-invalid={!!err || undefined} aria-describedby={err ? 'pair-err' : undefined} className={inputCls} placeholder="ABC123" />
      {err && <p id="pair-err" role="alert" className="text-sm font-medium text-scanner-danger">{err}</p>}
      <Button type="submit" size="scanner" block loading={busy} disabled={code.length < 6} className={lightBtn}>Pair this phone</Button>
      <p className="text-center text-sm text-scanner-muted">Are you the owner? <Link href="/login" className="font-semibold text-scanner-text underline">Sign in</Link> to scan with your account.</p>
    </form>
  );
}

function CameraView({ onCode, onManual }: { onCode: (qr: string) => void; onManual: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'idle' | 'starting' | 'on' | 'denied' | 'unsupported'>('idle');
  const [torch, setTorch] = useState<{ supported: boolean; on: boolean }>({ supported: false, on: false });
  const stream = useRef<MediaStream | null>(null);
  const done = useRef(false);

  const stop = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
  useEffect(() => () => stop(), []);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setState('unsupported'); return; }
    setState('starting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      stream.current = s;
      const v = video.current!; v.srcObject = s; await v.play();
      const track = s.getVideoTracks()[0];
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
      setTorch({ supported: !!caps.torch, on: false });
      setState('on');
      // native detector when present (Android Chrome), else the self-hosted WASM ponyfill
      const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill');
      prepareZXingModule({ overrides: { locateFile: (p: string, prefix: string) => (p.endsWith('.wasm') ? '/zxing/zxing_reader.wasm' : prefix + p) } });
      const Native = (globalThis as unknown as { BarcodeDetector?: typeof BarcodeDetector }).BarcodeDetector;
      const detector = Native ? new Native({ formats: ['qr_code'] }) : new BarcodeDetector({ formats: ['qr_code'] });
      const loop = async () => {
        if (done.current || !stream.current) return;
        try {
          const [hit] = await detector.detect(v);
          if (hit?.rawValue) { done.current = true; stop(); onCode(hit.rawValue); return; }
        } catch { /* frame not ready */ }
        setTimeout(loop, 90);
      };
      void loop();
    } catch (e) {
      recordError(`camera: ${(e as Error).name}: ${(e as Error).message}`);
      setState((e as Error).name === 'NotAllowedError' ? 'denied' : 'unsupported');
    }
  };

  const toggleTorch = async () => {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) return;
    try { await track.applyConstraints({ advanced: [{ torch: !torch.on } as MediaTrackConstraintSet] }); setTorch((t) => ({ ...t, on: !t.on })); } catch { setTorch({ supported: false, on: false }); }
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-scanner-surface">
        <video ref={video} playsInline muted className={cn('absolute inset-0 size-full object-cover', state !== 'on' && 'hidden')} />
        {state === 'on' && <div aria-hidden className="absolute inset-[18%] rounded-lg border-4 border-scanner-text/80" />}
        {state !== 'on' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {state === 'denied' ? (
              <>
                <XCircle aria-hidden className="size-10 text-scanner-danger" />
                <p className="font-semibold">Camera blocked</p>
                <p className="text-sm text-scanner-muted">Allow the camera for this site in your browser settings, then reload. Or type the code instead.</p>
              </>
            ) : state === 'unsupported' ? (
              <p className="text-sm text-scanner-muted">This browser can’t use the camera here. Type the code under the customer’s QR instead.</p>
            ) : (
              <>
                <Camera aria-hidden className="size-10" />
                <p className="text-sm text-scanner-muted">We use the camera only to read the customer’s card.</p>
                <Button size="lg" onClick={start} loading={state === 'starting'} className={lightBtn}>Start camera</Button>
              </>
            )}
          </div>
        )}
        {state === 'on' && torch.supported && (
          <IconButton aria-label={torch.on ? 'Turn torch off' : 'Turn torch on'} aria-pressed={torch.on} size="lg" variant="ghost"
            className="absolute right-3 top-3 bg-scanner-bg/60 text-scanner-text" icon={<Flashlight aria-hidden className="size-6" />} onClick={toggleTorch} />
        )}
      </div>
      <p role="status" className="text-center text-sm text-scanner-muted">{state === 'on' ? 'Point the camera at the customer’s card' : ' '}</p>
      <Button size="lg" block onClick={() => { stop(); onManual(); }} className={darkBtn}><Keyboard aria-hidden className="size-5" /> Type the code instead</Button>
    </div>
  );
}

function Manual({ error, onSubmit, onBack }: { error?: string; onSubmit: (code: string) => void; onBack: () => void }) {
  const [code, setCode] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(code); }} className="flex flex-1 flex-col gap-4 pt-4">
      <h1 className="text-xl">Type the card code</h1>
      <p className="text-sm text-scanner-muted">It’s the 8 characters under the customer’s QR code.</p>
      <label htmlFor="manual-code" className="sr-only">Card code</label>
      <input id="manual-code" autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 8))}
        autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-invalid={!!error || undefined} aria-describedby={error ? 'manual-err' : undefined} className={inputCls} placeholder="9Y77BKHV" />
      {error && <p id="manual-err" role="alert" className="text-sm font-medium text-scanner-danger">{error}</p>}
      <Button type="submit" size="scanner" block disabled={code.length !== 8} className={lightBtn}>Find card</Button>
      <Button size="lg" block onClick={onBack} className={darkBtn}>Back to camera</Button>
    </form>
  );
}

function Transaction({ card, confirm, onDone, onCancel, onSignedOut }: {
  card: Found; confirm: boolean; onDone: (ok: boolean, title: string, detail: string) => void; onCancel: () => void; onSignedOut: (reason: UnpairedReason) => void;
}) {
  const [add, setAdd] = useState(card.rewardsAvailable > 0 ? 0 : 1);
  const [redeem, setRedeem] = useState(false);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [offline, setOffline] = useState(false);
  // one idempotency key per exact request: a new key whenever the amounts change.
  // While a send is unconfirmed (offline) the amounts are locked, so Retry resends this same key.
  const key = useRef(crypto.randomUUID());
  useEffect(() => { key.current = crypto.randomUUID(); }, [add, redeem]);
  const retryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (offline) retryRef.current?.focus(); }, [offline]);

  const after = card.currentStamps + add;
  const earns = Math.floor(after / card.totalStamps);
  // mystery box: the prize is drawn by the server when the card fills, and the customer opens it on their
  // card first (the little three-tap game). Staff can hand over the oldest box only once it's been opened,
  // so a box is never given away before the customer has seen what's inside.
  const mystery = card.rewardMode === 'mystery';
  const waiting = card.prizes?.[0];
  const unopened = mystery && !!waiting && waiting.opened === false;
  const canRedeem = mystery ? card.rewardsAvailable > 0 && !!waiting && !unopened : card.rewardsAvailable + earns > 0;
  const tierName = (t: string) => t[0].toUpperCase() + t.slice(1);
  const giveLabel = mystery ? (waiting ? `Give ${waiting.name}` : 'Give the mystery prize') : `Give 1 ${card.rewardName.toLowerCase()}`;
  const outcome = add === 0 && !redeem ? 'Choose stamps or a reward.'
    : [add > 0 && `Add ${add} ${add === 1 ? 'stamp' : 'stamps'}`,
      earns > 0 && (mystery ? `this completes the card: ${earns === 1 ? 'a mystery box for them to open' : `${earns} mystery boxes for them to open`}` : `this completes the card: ${earns} ${card.rewardName.toLowerCase()} earned`),
      redeem && (mystery ? `give ${waiting?.name ?? 'the prize'}` : `give 1 ${card.rewardName.toLowerCase()}`)].filter(Boolean).join(' · ');

  const submit = async () => {
    setBusy(true);
    const r = await api('/api/scan/transaction', { method: 'POST', body: JSON.stringify({ cardId: card.id, stamps: add, redeem: redeem ? 1 : 0, idempotencyKey: key.current }) });
    setBusy(false);
    if (!r) { setOffline(true); return; }
    if (r.status === 401) { onSignedOut(await reasonOf(r)); return; }
    const data = await r.json().catch(() => ({ ok: false, error: 'server' }));
    if (!data.ok) { if (r.status >= 500) recordError(`transaction: HTTP ${r.status}`); onDone(false, 'Not saved', msg(data.error)); return; }
    const res = data.result as { earned: number; redeemed: number; currentStamps: number; replayed?: boolean; prizesEarned?: { name: string; tier: string }[]; prizesRedeemed?: { name: string; tier: string }[] };
    const title = [add > 0 && `${add} ${add === 1 ? 'stamp' : 'stamps'} added`, res.redeemed > 0 && 'Reward given'].filter(Boolean).join(' · ');
    const left = card.totalStamps - res.currentStamps;
    const gave = (res.prizesRedeemed ?? []).map((p) => p.name).join(', ');
    // the prize stays a surprise: the customer opens the box on their card, then staff hand it over
    const boxes = (res.prizesEarned ?? []).length;
    const earnedLine = res.earned > 0 ? (boxes ? `${boxes === 1 ? 'A mystery box is' : `${boxes} mystery boxes are`} ready. Ask them to open it on their card, then scan again to hand over the prize. ` : `${res.earned} ${card.rewardName.toLowerCase()} earned! `) : '';
    onDone(true, title, `${card.firstName} has ${res.currentStamps} of ${card.totalStamps}. ${earnedLine}${gave ? `Hand over: ${gave}. ` : ''}${left} more to the next reward.`);
  };

  return (
    <div className="flex flex-1 flex-col gap-4 pt-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-scanner-muted">{card.campaignName}</p>
          <h1 className="truncate text-2xl">{card.firstName || 'Customer'}</h1>
          <p className="text-xs tabular text-scanner-muted">Lifetime {card.totalStampsEarned} stamps · Last visit {ago(card.lastVisitAt)}</p>
        </div>
        <IconButton aria-label="Cancel" variant="ghost" className="text-scanner-text hover:bg-scanner-surface" icon={<X aria-hidden className="size-6" />} onClick={onCancel} />
      </div>
      <StampStrip total={card.totalStamps} filled={card.currentStamps} icon={card.design.icon} stamp="#f4f5f7" empty="#5b6470" background="#1c2128" className="w-full rounded-lg" />
      {offline ? (
        <div role="alert" className="flex flex-1 flex-col gap-3 rounded-lg bg-scanner-surface p-4">
          <div className="flex items-center gap-2"><WifiOff aria-hidden className="size-6 shrink-0 text-scanner-danger" /><h2 className="text-lg">No connection — nothing was saved</h2></div>
          <p className="text-sm text-scanner-muted">Not saved yet: {outcome.toLowerCase()}. Check Wi-Fi or mobile data, then tap Retry. Retry is safe: if the first try did get through, the card is never stamped twice.</p>
          <Button ref={retryRef} size="scanner" block loading={busy} onClick={submit} className={cn('mt-auto', lightBtn)}><RefreshCw aria-hidden className="size-5" /> Retry</Button>
          <Button size="lg" block onClick={onCancel} className={cn(darkBtn, 'border border-scanner-muted')}>Cancel</Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-2 rounded-lg bg-scanner-surface p-4">
            <p className="text-sm text-scanner-muted">Stamps to add</p>
            <Stepper label="Stamps to add" value={add} onChange={setAdd} min={0} max={card.maxStampsPerTransaction} size="scanner" />
          </div>
          {canRedeem && (
            <button type="button" aria-pressed={redeem} onClick={() => setRedeem(!redeem)}
              className={cn('flex min-h-16 items-center gap-3 rounded-lg border-2 px-4 text-left', redeem ? 'border-scanner-success bg-scanner-surface' : 'border-scanner-surface')}>
              <Gift aria-hidden className="size-6 shrink-0" />
              <span className="flex-1"><span className="block font-semibold">{giveLabel}</span>
                <span className="text-xs text-scanner-muted">
                  {mystery && waiting ? `Mystery box · ${tierName(waiting.tier)} · ` : ''}
                  {card.rewardsAvailable + earns} {card.rewardsAvailable + earns === 1 ? 'reward' : 'rewards'} ready{earns > 0 && card.rewardsAvailable === 0 ? ' after these stamps' : ''}
                </span></span>
              <span aria-hidden className={cn('size-6 rounded-full border-2', redeem ? 'border-scanner-success bg-scanner-success' : 'border-scanner-muted')} />
            </button>
          )}
          {unopened && (
            <div role="status" className="flex min-h-16 items-center gap-3 rounded-lg border-2 border-dashed border-scanner-muted px-4">
              <Gift aria-hidden className="size-6 shrink-0" />
              <span className="flex-1"><span className="block font-semibold">{card.firstName || 'The customer'} has a mystery box to open</span>
                <span className="text-xs text-scanner-muted">Ask them to open it on their card (three taps), then scan again to hand over the prize.</span></span>
            </div>
          )}
          <p className="text-center text-sm text-scanner-muted" aria-live="polite">{outcome}</p>
          {asking ? (
            <div className="flex flex-col gap-2" role="group" aria-label="Confirm">
              <Button size="scanner" block loading={busy} onClick={submit} className={lightBtn}>Yes, save it</Button>
              <Button size="lg" block onClick={() => setAsking(false)} className={darkBtn}>Change</Button>
            </div>
          ) : (
            <Button size="scanner" block loading={busy} disabled={add === 0 && !redeem} onClick={() => (confirm ? setAsking(true) : submit())} className={cn('mt-auto', lightBtn)}>
              {add > 0 ? `Add ${add} ${add === 1 ? 'stamp' : 'stamps'}${redeem ? ' + reward' : ''}` : 'Give reward'}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function Result({ ok, title, detail, onNext }: { ok: boolean; title: string; detail: string; onNext: () => void }) {
  const [paused, setPaused] = useState(false);
  const [left, setLeft] = useState(ok ? 3 : 6);
  useEffect(() => {
    if (paused) return;
    if (left <= 0) { onNext(); return; }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left, paused, onNext]);
  return (
    <div role="alert" className="m-auto flex w-full flex-col items-center gap-4 text-center">
      {ok ? <CheckCircle2 aria-hidden className="size-20 text-scanner-success" /> : <XCircle aria-hidden className="size-20 text-scanner-danger" />}
      <h1 className="text-2xl">{title}</h1>
      <p className="text-scanner-muted">{detail}</p>
      <Button size="scanner" block onClick={onNext} className={cn('mt-4', lightBtn)}>Scan next</Button>
      <button type="button" className="text-sm text-scanner-muted underline" onClick={() => setPaused((p) => !p)}>
        {paused ? 'Resume' : `Back to the camera in ${left} s — stay here`}
      </button>
    </div>
  );
}

function HistoryView({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<{ id: string; type: string; quantity: number; createdAt: string; firstName: string; actorLabel?: string }[] | null>(null);
  useEffect(() => { fetch('/api/scan/history', { cache: 'no-store' }).then((r) => r.json()).then((d) => setRows(d.events ?? [])).catch(() => setRows([])); }, []);
  return (
    <div className="flex flex-1 flex-col gap-4 pt-2">
      <div className="flex items-center justify-between"><h1 className="text-xl">Recent scans</h1><Button size="sm" onClick={onBack} className={darkBtn}>Back</Button></div>
      {rows === null ? <p role="status" className="text-scanner-muted">Loading…</p> : rows.length === 0 ? <p className="text-scanner-muted">Nothing scanned on this phone yet.</p> : (
        <ul className="flex flex-col divide-y divide-scanner-surface">
          {rows.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span><span className="font-semibold">{e.firstName || 'Customer'}</span> · {e.type === 'stamped' ? `+${e.quantity} ${e.quantity === 1 ? 'stamp' : 'stamps'}` : e.type === 'unstamped' ? `−${e.quantity}` : 'reward given'}</span>
              <time dateTime={e.createdAt} className="shrink-0 text-scanner-muted">{new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {ago(e.createdAt)}</time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Runs every self-check probe. Read-only: nothing is saved, the camera is not switched on. */
async function probePhone(): Promise<Probe> {
  const t0 = performance.now();
  const v = await api('/api/scan/version', { timeoutMs: 8000 }).then((r) => (r?.ok ? r.json() as Promise<{ version: string; serverTime: string }> : null)).catch(() => null);
  const ms = performance.now() - t0;

  let pairing: Probe['pairing'] = { status: 'unknown' };
  if (v) {
    const r = await api('/api/scan/status', { timeoutMs: 8000 });
    if (r?.ok) { const d = await r.json(); pairing = { status: 'paired', who: d.who, role: d.role }; }
    else if (r?.status === 401) pairing = { status: 'unpaired', reason: await reasonOf(r) };
  }

  let camera: Probe['camera'] = 'unknown';
  if (!window.isSecureContext) camera = 'insecure';
  else if (!navigator.mediaDevices?.getUserMedia) camera = 'unsupported';
  else {
    try { camera = (await navigator.permissions.query({ name: 'camera' as PermissionName })).state as Probe['camera']; } catch { camera = 'unknown'; }
  }

  let decoder: Probe['decoder'] = 'failed';
  try {
    const res = await fetch('/zxing/zxing_reader.wasm', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await WebAssembly.compile(await res.arrayBuffer());
    decoder = 'wasm';
  } catch (e) {
    recordError(`decoder: ${(e as Error).message}`);
    if ('BarcodeDetector' in globalThis) decoder = 'native';
  }

  return { network: { ok: !!v, ms }, pairing, camera, decoder, clockSkewMs: v ? Date.now() - ms / 2 - Date.parse(v.serverTime) : null };
}

const statusWord = { ok: 'OK', warn: 'Check', fail: 'Problem' } as const;

function SettingsView({ prefs, setPrefs, supportUrl, onBack }: { prefs: Prefs; setPrefs: (p: Prefs) => void; supportUrl: string | null; onBack: () => void }) {
  const [checks, setChecks] = useState<CheckResult[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState<{ state: 'idle' | 'sending' | 'sent' | 'error'; text?: string }>({ state: 'idle' });

  const runChecks = async () => {
    setChecking(true);
    const c = evaluateChecks(await probePhone());
    setChecks(c); setChecking(false);
    return c;
  };
  const sendReport = async () => {
    setReport({ state: 'sending' });
    const c = checks ?? (await runChecks());
    const bundle = buildReport({ appVersion: APP_VERSION, userAgent: navigator.userAgent, lastError: lastError(), checks: c });
    const r = await api('/api/scan/report', { method: 'POST', body: JSON.stringify(bundle) });
    if (r?.ok) setReport({ state: 'sent', text: 'Sent. The owner can read it on Counter phones in the dashboard.' });
    else setReport({ state: 'error', text: !r ? 'No connection, so the report wasn’t sent. Try again when the phone is online.'
      : r.status === 401 ? 'This phone isn’t paired, so it can’t send reports. Pair it first.'
      : ((await r.json().catch(() => ({}))) as { error?: string }).error ?? 'The report wasn’t sent. Try again.' });
  };
  const overall = checks ? overallStatus(checks) : null;

  return (
    <div className="flex flex-1 flex-col gap-5 pt-2 [&_label]:text-scanner-text">
      <div className="flex items-center justify-between"><h1 className="text-xl">Scanner settings</h1><Button size="sm" onClick={onBack} className={darkBtn}>Done</Button></div>
      <Switch label="Vibrate on scan" checked={prefs.vibrate} onCheckedChange={(v) => setPrefs({ ...prefs, vibrate: v })} />
      <Switch label="Beep on scan" checked={prefs.beep} onCheckedChange={(v) => setPrefs({ ...prefs, beep: v })} />
      <Switch label="Ask to confirm before saving" checked={prefs.confirm} onCheckedChange={(v) => setPrefs({ ...prefs, confirm: v })} />
      <p className="text-xs text-scanner-muted">Saved on this phone only.</p>

      <section aria-labelledby="selfcheck-h" className="flex flex-col gap-3 border-t border-scanner-surface pt-5">
        <h2 id="selfcheck-h" className="text-lg">Check this phone</h2>
        <p className="text-sm text-scanner-muted">Tests the connection, the pairing, the camera permission and the QR reader. Nothing is saved.</p>
        <Button size="lg" block loading={checking} onClick={() => void runChecks()} className={darkBtn}>{checks ? 'Check again' : 'Check this phone'}</Button>
        <div role="status" aria-live="polite">
          {checks && (
            <>
              <p className="mb-2 text-sm font-semibold">{overall === 'ok' ? 'All good. This phone is ready to scan.' : overall === 'warn' ? 'Ready, with something to look at.' : 'Something needs fixing. See the hints below.'}</p>
              <ul aria-label="Check results" className="flex flex-col divide-y divide-scanner-surface rounded-lg bg-scanner-surface/40">
                {checks.map((c) => (
                  <li key={c.id} className="flex gap-3 p-3 text-sm">
                    {c.status === 'ok' ? <CheckCircle2 aria-hidden className="size-5 shrink-0 text-scanner-success" />
                      : c.status === 'warn' ? <AlertTriangle aria-hidden className="size-5 shrink-0 text-scanner-text" />
                      : <XCircle aria-hidden className="size-5 shrink-0 text-scanner-danger" />}
                    <div className="min-w-0">
                      <p><span className="font-semibold">{c.label}: {statusWord[c.status]}.</span> {c.detail}</p>
                      {c.hint && <p className="text-scanner-muted">{c.hint}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="report-h" className="flex flex-col gap-3 border-t border-scanner-surface pt-5">
        <h2 id="report-h" className="text-lg">Something wrong?</h2>
        <p className="text-sm text-scanner-muted">Sends the owner this phone’s name, the app version, the browser, the last error and the check results. No customer details are sent.</p>
        <Button size="lg" block loading={report.state === 'sending'} onClick={() => void sendReport()} className={darkBtn}>Report a problem</Button>
        {report.state === 'sent' && <p role="status" className="text-sm text-scanner-success">{report.text}</p>}
        {report.state === 'error' && <p role="alert" className="text-sm font-medium text-scanner-danger">{report.text}</p>}
        {supportUrl
          ? <a href={supportUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-scanner-text underline">Contact support on WhatsApp</a>
          : <p className="text-sm text-scanner-muted">Contact support: not set up yet.</p>}
      </section>
      <p className="text-xs text-scanner-muted">App version {APP_VERSION}</p>
    </div>
  );
}

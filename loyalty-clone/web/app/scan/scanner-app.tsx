'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, CheckCircle2, Flashlight, Gift, History, Keyboard, Settings2, X, XCircle } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Stepper, Switch } from '@/components/ui/controls';
import { StampStrip } from '@/components/loyalty/stamp-strip';
import { txErrorMessage } from '@/lib/data/rules';
import { cn } from '@/lib/cn';
import type { ScanLookup } from '@/lib/data/api';

type Found = Extract<ScanLookup, { ok: true }>['card'];
type View =
  | { v: 'checking' } | { v: 'pair'; error?: string } | { v: 'camera' } | { v: 'manual'; error?: string }
  | { v: 'card'; card: Found } | { v: 'result'; ok: boolean; title: string; detail: string } | { v: 'history' } | { v: 'settings' };

type Prefs = { vibrate: boolean; beep: boolean; confirm: boolean };
const PREFS_KEY = 'lc-scanner-prefs';
const loadPrefs = (): Prefs => { try { return { vibrate: true, beep: false, confirm: false, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }; } catch { return { vibrate: true, beep: false, confirm: false }; } };

const msg = (key: string) => (txErrorMessage as Record<string, string>)[key] ?? 'That didn’t work. Try again.';
const ago = (iso: string) => { const d = Math.round((Date.now() - +new Date(iso)) / 86_400_000); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; };

export function ScannerApp() {
  const [view, setView] = useState<View>({ v: 'checking' });
  const [who, setWho] = useState('');
  const [prefs, setPrefs] = useState<Prefs>({ vibrate: true, beep: false, confirm: false });

  useEffect(() => { setPrefs(loadPrefs()); }, []);
  useEffect(() => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* private mode */ } }, [prefs]);

  const check = useCallback(async () => {
    const r = await fetch('/api/scan/history', { cache: 'no-store' }).catch(() => null);
    if (r?.ok) { setWho((await r.json()).who); setView({ v: 'camera' }); } else setView({ v: 'pair' });
  }, []);
  useEffect(() => { void check(); }, [check]);

  const feedback = (ok: boolean) => {
    if (prefs.vibrate) navigator.vibrate?.(ok ? 60 : [80, 60, 80]);
    if (prefs.beep) {
      try { const a = new AudioContext(); const o = a.createOscillator(); o.frequency.value = ok ? 880 : 220; o.connect(a.destination); o.start(); o.stop(a.currentTime + 0.12); } catch { /* no audio */ }
    }
  };

  const lookup = async (body: { qr?: string; manual?: string }) => {
    const r = await fetch('/api/scan/lookup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    if (!r) { feedback(false); setView({ v: 'result', ok: false, title: 'No connection', detail: 'Nothing was saved. Check the internet and scan again.' }); return; }
    if (r.status === 401) { setView({ v: 'pair', error: 'This phone was signed out. Pair it again.' }); return; }
    const data = (await r.json()) as ScanLookup;
    if (data.ok) { feedback(true); setView({ v: 'card', card: data.card }); }
    else if (body.manual && data.error === 'card_not_found') setView({ v: 'manual', error: 'No card with that code. Check the letters and numbers.' });
    else { feedback(false); setView({ v: 'result', ok: false, title: data.error === 'card_replaced' ? 'This card was replaced' : 'Can’t use this card', detail: msg(data.error) }); }
  };

  return (
    <main className="flex min-h-dvh flex-col bg-scanner-bg text-scanner-text">
      <header className="flex h-14 items-center justify-between px-3">
        <span className="truncate px-2 text-sm text-scanner-muted">{who ? `Scanner · ${who}` : 'Scanner'}</span>
        {view.v !== 'checking' && view.v !== 'pair' && (
          <div className="flex gap-1">
            <IconButton aria-label="Recent scans" variant="ghost" className="text-scanner-text hover:bg-scanner-surface" icon={<History aria-hidden className="size-5" />} onClick={() => setView({ v: 'history' })} />
            <IconButton aria-label="Scanner settings" variant="ghost" className="text-scanner-text hover:bg-scanner-surface" icon={<Settings2 aria-hidden className="size-5" />} onClick={() => setView({ v: 'settings' })} />
          </div>
        )}
      </header>
      <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-4 pb-6">
        {view.v === 'checking' && <p role="status" className="m-auto text-scanner-muted">Starting…</p>}
        {view.v === 'pair' && <Pair error={view.error} onPaired={check} />}
        {view.v === 'camera' && <CameraView onCode={(qr) => lookup({ qr })} onManual={() => setView({ v: 'manual' })} />}
        {view.v === 'manual' && <Manual error={view.error} onSubmit={(manual) => lookup({ manual })} onBack={() => setView({ v: 'camera' })} />}
        {view.v === 'card' && (
          <Transaction card={view.card} confirm={prefs.confirm} onDone={(ok, title, detail) => { feedback(ok); setView({ v: 'result', ok, title, detail }); }}
            onCancel={() => setView({ v: 'camera' })} onSignedOut={() => setView({ v: 'pair', error: 'This phone was signed out. Pair it again.' })} />
        )}
        {view.v === 'result' && <Result ok={view.ok} title={view.title} detail={view.detail} onNext={() => setView({ v: 'camera' })} />}
        {view.v === 'history' && <HistoryView onBack={() => setView({ v: 'camera' })} />}
        {view.v === 'settings' && <SettingsView prefs={prefs} setPrefs={setPrefs} onBack={() => setView({ v: 'camera' })} />}
      </div>
    </main>
  );
}

const darkBtn = 'bg-scanner-surface text-scanner-text hover:bg-scanner-surface/80';
const lightBtn = 'bg-scanner-text text-scanner-bg hover:bg-white';
const inputCls = 'h-14 w-full rounded-md border-2 border-scanner-muted bg-scanner-bg px-4 text-center font-mono text-2xl uppercase tracking-[.3em] text-scanner-text placeholder:text-scanner-muted/50';

function Pair({ error, onPaired }: { error?: string; onPaired: () => void }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState(error);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(undefined);
    const r = await fetch('/api/scan/pair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) }).catch(() => null);
    setBusy(false);
    if (r?.ok) onPaired(); else setErr(r ? (await r.json()).error : 'No connection. Try again.');
  };
  return (
    <form onSubmit={submit} className="m-auto flex w-full flex-col gap-4">
      <h1 className="text-2xl">Set up this phone</h1>
      <p className="text-sm text-scanner-muted">On the dashboard, open <strong className="text-scanner-text">Counter phones</strong> and tap <strong className="text-scanner-text">Pair a phone</strong>. Type the 6-character code here.</p>
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
  card: Found; confirm: boolean; onDone: (ok: boolean, title: string, detail: string) => void; onCancel: () => void; onSignedOut: () => void;
}) {
  const [add, setAdd] = useState(card.rewardsAvailable > 0 ? 0 : 1);
  const [redeem, setRedeem] = useState(false);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  // one idempotency key per exact request: a new key whenever the amounts change
  const key = useRef(crypto.randomUUID());
  useEffect(() => { key.current = crypto.randomUUID(); }, [add, redeem]);

  const after = card.currentStamps + add;
  const earns = Math.floor(after / card.totalStamps);
  const canRedeem = card.rewardsAvailable + earns > 0;
  const outcome = add === 0 && !redeem ? 'Choose stamps or a reward.'
    : [add > 0 && `Add ${add} ${add === 1 ? 'stamp' : 'stamps'}`, earns > 0 && `this completes the card: ${earns} ${card.rewardName.toLowerCase()} earned`, redeem && `give 1 ${card.rewardName.toLowerCase()}`].filter(Boolean).join(' · ');

  const submit = async () => {
    setBusy(true);
    const r = await fetch('/api/scan/transaction', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cardId: card.id, stamps: add, redeem: redeem ? 1 : 0, idempotencyKey: key.current }) }).catch(() => null);
    setBusy(false);
    if (!r) { onDone(false, 'No connection', 'Nothing was saved. Check the internet and try again.'); return; }
    if (r.status === 401) { onSignedOut(); return; }
    const data = await r.json();
    if (!data.ok) { onDone(false, 'Not saved', msg(data.error)); return; }
    const res = data.result as { earned: number; redeemed: number; currentStamps: number };
    const title = [add > 0 && `${add} ${add === 1 ? 'stamp' : 'stamps'} added`, res.redeemed > 0 && 'Reward given'].filter(Boolean).join(' · ');
    const left = card.totalStamps - res.currentStamps;
    onDone(true, title, `${card.firstName} has ${res.currentStamps} of ${card.totalStamps}. ${res.earned > 0 ? `${res.earned} ${card.rewardName.toLowerCase()} earned! ` : ''}${left} more to the next reward.`);
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
      <div className="flex flex-col items-center gap-2 rounded-lg bg-scanner-surface p-4">
        <p className="text-sm text-scanner-muted">Stamps to add</p>
        <Stepper label="Stamps to add" value={add} onChange={setAdd} min={0} max={card.maxStampsPerTransaction} size="scanner" />
      </div>
      {canRedeem && (
        <button type="button" aria-pressed={redeem} onClick={() => setRedeem(!redeem)}
          className={cn('flex min-h-16 items-center gap-3 rounded-lg border-2 px-4 text-left', redeem ? 'border-scanner-success bg-scanner-surface' : 'border-scanner-surface')}>
          <Gift aria-hidden className="size-6 shrink-0" />
          <span className="flex-1"><span className="block font-semibold">Give 1 {card.rewardName.toLowerCase()}</span>
            <span className="text-xs text-scanner-muted">{card.rewardsAvailable + earns} {card.rewardsAvailable + earns === 1 ? 'reward' : 'rewards'} ready{earns > 0 && card.rewardsAvailable === 0 ? ' after these stamps' : ''}</span></span>
          <span aria-hidden className={cn('size-6 rounded-full border-2', redeem ? 'border-scanner-success bg-scanner-success' : 'border-scanner-muted')} />
        </button>
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

function SettingsView({ prefs, setPrefs, onBack }: { prefs: Prefs; setPrefs: (p: Prefs) => void; onBack: () => void }) {
  return (
    <div className="flex flex-1 flex-col gap-5 pt-2 [&_label]:text-scanner-text">
      <div className="flex items-center justify-between"><h1 className="text-xl">Scanner settings</h1><Button size="sm" onClick={onBack} className={darkBtn}>Done</Button></div>
      <Switch label="Vibrate on scan" checked={prefs.vibrate} onCheckedChange={(v) => setPrefs({ ...prefs, vibrate: v })} />
      <Switch label="Beep on scan" checked={prefs.beep} onCheckedChange={(v) => setPrefs({ ...prefs, beep: v })} />
      <Switch label="Ask to confirm before saving" checked={prefs.confirm} onCheckedChange={(v) => setPrefs({ ...prefs, confirm: v })} />
      <p className="text-xs text-scanner-muted">Saved on this phone only.</p>
    </div>
  );
}

'use client';
import { useId, useRef, useState } from 'react';
import { ImageUp, Trash2 } from 'lucide-react';
import { Button } from './button';

/** Upload one card image (validated on the server from the file's bytes). */
export function ImageUpload({ label, hint, kind, campaignId, url, onChange }: {
  label: string; hint: string; kind: 'logo' | 'icon' | 'stamp'; campaignId: string; url?: string; onChange: (url?: string) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upload = async (file: File) => {
    setBusy(true); setError(null);
    const fd = new FormData(); fd.set('file', file); fd.set('kind', kind); fd.set('campaignId', campaignId);
    const r = await fetch('/api/images', { method: 'POST', body: fd }).catch(() => null);
    setBusy(false);
    if (!r) { setError('No connection. Try again.'); return; }
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { setError(body.error ?? 'That didn’t upload. Try again.'); return; }
    onChange(body.url);
  };
  const remove = async () => {
    setBusy(true);
    await fetch('/api/images', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, campaignId }) }).catch(() => null);
    setBusy(false); onChange(undefined);
  };
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <div className="flex items-center gap-3">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-surface">
          {url ? <img src={url} alt={`Current ${kind}`} className="max-h-full max-w-full object-contain" /> : <ImageUp aria-hidden className="size-6 text-text-subtle" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <input id={id} ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-describedby={`${id}-hint ${id}-err`}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
          <Button size="sm" variant="secondary" loading={busy} onClick={() => input.current?.click()}>{url ? 'Replace' : 'Upload'}</Button>
          {url && <Button size="sm" variant="ghost" onClick={remove} disabled={busy}><Trash2 aria-hidden className="size-4" /> Remove</Button>}
        </div>
      </div>
      <p id={`${id}-hint`} className="text-xs text-text-muted">{hint}</p>
      <p id={`${id}-err`} role={error ? 'alert' : undefined} className="text-xs font-medium text-danger">{error}</p>
    </div>
  );
}

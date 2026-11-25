'use client';
import { useId } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { contrastRatio, legibility, parseHex } from '@/lib/contrast';
import { cn } from '@/lib/cn';

/** Colour input with a live readability check against the colour it sits on/under. */
export function ColorField({ label, value, onChange, against, againstLabel }: {
  label: string; value: string; onChange: (v: string) => void; against: string; againstLabel: string;
}) {
  const id = useId();
  const valid = !!parseHex(value);
  const ratio = valid ? contrastRatio(value, against) : null;
  const level = ratio ? legibility(ratio) : null;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={valid ? (value.length === 4 ? `#${[...value.slice(1)].map((c) => c + c).join('')}` : value) : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="size-10 shrink-0 cursor-pointer rounded-md border border-border-input bg-bg p-1"
        />
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!valid || undefined}
          aria-describedby={`${id}-check`}
          spellCheck={false}
          className={cn('h-10 w-28 rounded-md border px-3 font-mono text-sm uppercase', valid ? 'border-border-input' : 'border-danger')}
        />
      </div>
      <p id={`${id}-check`} aria-live="polite" className={cn('flex items-center gap-1 text-xs font-medium', !valid || level === 'poor' ? 'text-danger' : level === 'large-only' ? 'text-warning' : 'text-success')}>
        {!valid ? (
          <>Use a hex colour like #1F2937</>
        ) : level === 'good' ? (
          <><CheckCircle2 aria-hidden className="size-3.5" /> Readable on {againstLabel} · {ratio!.toFixed(1)}:1</>
        ) : (
          <><AlertTriangle aria-hidden className="size-3.5" /> {level === 'poor' ? 'Hard to read' : 'Only OK for big text'} on {againstLabel} · {ratio!.toFixed(1)}:1</>
        )}
      </p>
    </div>
  );
}

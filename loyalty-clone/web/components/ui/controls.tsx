'use client';
import * as RSwitch from '@radix-ui/react-switch';
import * as RRadio from '@radix-ui/react-radio-group';
import { Minus, Plus } from 'lucide-react';
import { useId } from 'react';
import { cn } from '@/lib/cn';
import { IconButton } from './button';

export function Switch({ label, checked, onCheckedChange, disabled }: {
  label: string; checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <RSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="relative h-6 w-10 shrink-0 rounded-pill bg-border-input transition-colors data-[state=checked]:bg-accent disabled:opacity-50"
      >
        <RSwitch.Thumb className="block size-5 translate-x-0.5 rounded-pill bg-white shadow-card transition-transform duration-[var(--tk-motion-fast)] data-[state=checked]:translate-x-[18px]" />
      </RSwitch.Root>
    </div>
  );
}

export function SegmentedControl<T extends string>({ label, value, onChange, options }: {
  label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
  return (
    <RRadio.Root
      aria-label={label}
      value={value}
      onValueChange={(v) => onChange(v as T)}
      className="inline-flex rounded-md border border-border bg-surface p-0.5"
    >
      {options.map((o) => (
        <RRadio.Item
          key={o.value}
          value={o.value}
          className="h-9 rounded-[calc(var(--tk-radius-md)-2px)] px-3 text-sm font-medium text-text-muted data-[state=checked]:bg-bg data-[state=checked]:text-text data-[state=checked]:shadow-card"
        >
          {o.label}
        </RRadio.Item>
      ))}
    </RRadio.Root>
  );
}

export function Stepper({ label, value, onChange, min = 0, max = 99, size = 'md' }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; size?: 'md' | 'scanner';
}) {
  const big = size === 'scanner';
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-3">
      <IconButton
        aria-label={`Fewer (${label})`}
        variant="secondary"
        size={big ? 'scanner' : 'md'}
        className={big ? 'border-2 border-scanner-muted bg-transparent text-scanner-text hover:bg-scanner-surface' : undefined}
        icon={<Minus aria-hidden className={big ? 'size-7' : 'size-4'} />}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - 1))}
      />
      <input
        aria-label={label}
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ''));
          if (!Number.isNaN(n)) onChange(clamp(n));
        }}
        className={cn('tabular bg-transparent text-center font-bold outline-offset-4', big ? 'w-24 text-scanner' : 'w-12 text-xl')}
      />
      <IconButton
        aria-label={`More (${label})`}
        variant={big ? 'primary' : 'secondary'}
        size={big ? 'scanner' : 'md'}
        className={big ? 'bg-scanner-text text-scanner-bg hover:bg-white' : undefined}
        icon={<Plus aria-hidden className={big ? 'size-7' : 'size-4'} />}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + 1))}
      />
    </div>
  );
}

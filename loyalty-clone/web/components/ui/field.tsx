'use client';
import { createContext, useContext, useId } from 'react';
import { AlertCircle, Lock } from 'lucide-react';
import { cn } from '@/lib/cn';

type FieldCtx = { id: string; hintId: string; errorId: string; invalid: boolean; disabled?: boolean };
const Ctx = createContext<FieldCtx | null>(null);
export const useField = () => useContext(Ctx);

export function Field({
  label, hint, error, required, locked, children, className,
}: {
  label: string; hint?: React.ReactNode; error?: string; required?: boolean; locked?: boolean;
  children: React.ReactNode; className?: string;
}) {
  const id = useId();
  const ctx: FieldCtx = { id, hintId: `${id}-hint`, errorId: `${id}-error`, invalid: !!error, disabled: locked };
  return (
    <Ctx.Provider value={ctx}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-semibold">
          {label}
          {required && <span className="font-normal text-text-muted">(required)</span>}
          {locked && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-text-muted">
              <Lock aria-hidden className="size-3.5" /> Locked after the card went live
            </span>
          )}
        </label>
        {children}
        {hint && !error && <p id={ctx.hintId} className="text-xs text-text-muted">{hint}</p>}
        {error && (
          <p id={ctx.errorId} className="flex items-center gap-1 text-xs font-medium text-danger">
            <AlertCircle aria-hidden className="size-3.5 shrink-0" /> {error}
          </p>
        )}
      </div>
    </Ctx.Provider>
  );
}

export const inputClass = (invalid?: boolean) =>
  cn(
    'w-full rounded-md border bg-bg px-3 text-base sm:text-sm text-text placeholder:text-text-subtle',
    'transition-colors duration-[var(--tk-motion-fast)]',
    'disabled:bg-surface disabled:text-text-muted disabled:cursor-not-allowed',
    invalid ? 'border-danger' : 'border-border-input',
  );

function aria(f: FieldCtx | null, hasHint = true) {
  if (!f) return {};
  return {
    id: f.id,
    'aria-invalid': f.invalid || undefined,
    'aria-describedby': f.invalid ? f.errorId : hasHint ? f.hintId : undefined,
    disabled: f.disabled || undefined,
  };
}

export function TextInput({ className, inputSize = 'md', ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { inputSize?: 'md' | 'lg' }) {
  const f = useField();
  return <input className={cn(inputClass(f?.invalid), inputSize === 'lg' ? 'h-12' : 'h-10', className)} {...aria(f)} {...rest} />;
}

export function Textarea({
  className, max, value, ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { max?: number; value: string }) {
  const f = useField();
  const n = value.length;
  const tone = max && n > max ? 'text-danger' : max && n >= max * 0.9 ? 'text-warning' : 'text-text-muted';
  return (
    <div className="flex flex-col gap-1">
      <textarea
        className={cn(inputClass(f?.invalid || (!!max && n > max)), 'min-h-24 py-2.5 [field-sizing:content] max-h-60', className)}
        value={value}
        {...aria(f)}
        {...rest}
      />
      {max && (
        <p className={cn('self-end text-xs tabular', tone)} aria-live="polite">
          {n} / {max}
        </p>
      )}
    </div>
  );
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const f = useField();
  return (
    <select className={cn(inputClass(f?.invalid), 'h-10 pr-8', className)} {...aria(f)} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({ label, className, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  const id = useId();
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-[18px] shrink-0 accent-[var(--tk-color-accent)]" {...rest} />
      <label htmlFor={id} className="text-sm leading-5">{label}</label>
    </div>
  );
}

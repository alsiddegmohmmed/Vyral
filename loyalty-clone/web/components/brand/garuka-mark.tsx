import { cn } from '@/lib/cn';

// Garuka "Full Circle" mark, from the brand kit (v1.0, Nov 2026). 256 grid:
// ring r80, stroke 44 (0.55 r), flat ends, gap from -10° to +55°;
// dot r22 (half the stroke) on the ring's path at +22.5°, halfway through the gap.
// Rules: the ring is one colour; the dot is Sunrise whenever colour is available,
// otherwise it takes the ring's colour. Never close the ring, move the dot,
// swap the colours, or stretch the mark. Minimum: symbol 16 px.
export const RING_PATH = 'M173.9 62.5 A80 80 0 1 0 206.8 141.9';
export const DOT = { cx: 201.9, cy: 97.4, r: 22 } as const;

type MarkProps = { className?: string; ring?: string; dot?: string; title?: string; spin?: boolean };

/** The symbol alone. Decorative unless a title is given. */
export function GarukaMark({ className, ring = 'currentColor', dot = 'var(--tk-color-sunrise)', title, spin = false }: MarkProps) {
  return (
    <svg viewBox="0 0 256 256" className={cn('shrink-0', className)} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <path d={RING_PATH} fill="none" stroke={ring} strokeWidth={44} />
      <circle {...DOT} fill={dot} className={spin ? 'garuka-orbit' : undefined} />
    </svg>
  );
}

/**
 * Mark + lowercase wordmark. Size it with font-size: the mark is 0.86em and
 * the gap to the word is one dot diameter (kit: Lockup). Colours via props or currentColor.
 */
export function GarukaLockup({ className, ring, dot, word }: { className?: string; ring?: string; dot?: string; word?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-[0.22em] leading-none', className)}>
      <GarukaMark className="size-[0.86em]" ring={ring} dot={dot} />
      <span className="font-extrabold tracking-[-0.055em]" style={{ color: word }}>garuka</span>
    </span>
  );
}

/** The loader: the dot orbits the ring once per beat. Replaces every spinner. */
export function GarukaSpinner({ className }: { className?: string }) {
  return <GarukaMark className={cn('size-5', className)} spin />;
}

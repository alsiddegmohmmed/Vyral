import { Coffee, Scissors, Dumbbell, Utensils, Star, Heart, PawPrint, Flower2, CupSoda, Croissant, type LucideIcon } from 'lucide-react';

export const stampIcons: Record<string, LucideIcon> = {
  cup: Coffee, soda: CupSoda, scissors: Scissors, dumbbell: Dumbbell, utensils: Utensils,
  croissant: Croissant, star: Star, heart: Heart, paw: PawPrint, flower: Flower2,
};

/** Columns per row: 5 up to 10 stamps, 6 up to 18, 8 up to 30 (components.md). */
export const stampColumns = (total: number) => (total <= 10 ? 5 : total <= 18 ? 6 : 8);

/**
 * The one stamp-grid renderer. Pure SVG so the same markup renders on the server
 * to PNG (pass strip images via resvg) and in the browser (designer, web card, scanner).
 */
export function StampStrip({ total, filled, icon = 'cup', stamp = '#ffffff', empty = 'rgba(255,255,255,.28)', background = 'transparent', className, image, label, landing }: {
  total: number; filled: number; icon?: string; stamp?: string; empty?: string; background?: string; className?: string; image?: string;
  /** accessible name; defaults to "N of M stamps" */
  label?: string;
  /** browser only: the newest stamp drops in (self-filling preview) */
  landing?: boolean;
}) {
  const cols = stampColumns(total);
  const rows = Math.ceil(total / cols);
  const cell = 100, pad = 14, r = cell / 2 - pad;
  const w = cols * cell, h = rows * cell;
  const Icon = stampIcons[icon] ?? Coffee;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label ?? `${filled} of ${total} stamps`} className={className} style={{ background }}>
      {Array.from({ length: total }, (_, i) => {
        const cx = (i % cols) * cell + cell / 2;
        const cy = Math.floor(i / cols) * cell + cell / 2;
        const on = i < filled;
        const isReward = i === total - 1;
        return (
          <g key={i} className={landing && on && i === filled - 1 ? 'stamp-land' : undefined}>
            <circle cx={cx} cy={cy} r={r} fill={on ? stamp : 'none'} stroke={on ? stamp : empty} strokeWidth={4} strokeDasharray={on ? undefined : '6 6'} />
            {isReward && <circle cx={cx} cy={cy} r={r + 8} fill="none" stroke={on ? stamp : empty} strokeWidth={3} />}
            {on && image
              ? <image href={image} x={cx - r + 4} y={cy - r + 4} width={(r - 4) * 2} height={(r - 4) * 2} preserveAspectRatio="xMidYMid meet" aria-hidden />
              : <Icon x={cx - 18} y={cy - 18} width={36} height={36} color={on ? background === 'transparent' ? '#111' : background : empty} strokeWidth={2.2} aria-hidden />}
          </g>
        );
      })}
    </svg>
  );
}

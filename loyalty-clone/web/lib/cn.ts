import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Our type scale names (tokens.json "type") so `text-scanner` is read as a font
// size and `text-scanner-text` / `text-text-muted` as colours.
const twMerge = extendTailwindMerge({
  extend: {
    theme: { text: ['xs', 'sm', 'base', 'lg', 'xl', '2xl', 'display', 'scanner'] },
  },
});

/** Join class names; later Tailwind utilities override earlier conflicting ones. */
export const cn = (...v: ClassValue[]) => twMerge(clsx(v));

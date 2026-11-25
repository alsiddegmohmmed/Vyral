// Same WCAG 2 maths as replica/design/contrast.py, for live checks in the
// card designer (ColorField) where merchants pick their own colours.
const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function parseHex(value: string): [number, number, number] | null {
  const m = HEX.exec(value.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]) {
  const ch = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrastRatio(fg: string, bg: string): number | null {
  const a = parseHex(fg), b = parseHex(bg);
  if (!a || !b) return null;
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export type Legibility = 'good' | 'large-only' | 'poor';
export function legibility(ratio: number): Legibility {
  if (ratio >= 4.5) return 'good';
  if (ratio >= 3) return 'large-only';
  return 'poor';
}

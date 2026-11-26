// Logo → card design, the pure part (no DOM, unit-tested in tests/logo-parts.test.mjs).
// The mechanism was studied from StampMate's wizard, whose server splits an uploaded
// logo into a header wordmark, a stamp symbol and colours (replica/design/
// reference-stampmate.md). Ours runs in the owner's browser and nothing leaves it
// until the card is created. Steps: find the background, knock it out, split the
// artwork by empty columns/rows into symbol and text, read the ink colours, and turn
// them into a card theme that passes WCAG contrast.

export type RGB = [number, number, number];
export type Box = { x: number; y: number; w: number; h: number };
export type Layout = 'icon-text' | 'icon-top' | 'text' | 'icon';
export type CardTheme = { background: string; foreground: string; label: string; stamp: string };

const dist = (a: RGB, b: RGB) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
export const hex = (c: RGB) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
export const fromHex = (h: string): RGB => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16)) as RGB;
const lum = ([r, g, b]: RGB) => {
  const ch = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};
export const contrast = (a: RGB, b: RGB) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const quant = (c: RGB) => `${c[0] >> 4},${c[1] >> 4},${c[2] >> 4}`;

/**
 * Background = the colour most of the border agrees on. A mostly transparent border
 * means the logo already has no background (null).
 */
export function findBackground(px: Uint8ClampedArray, w: number, h: number): RGB | null {
  const counts = new Map<string, { n: number; sum: RGB }>();
  let clear = 0, total = 0;
  const visit = (x: number, y: number) => {
    const i = (y * w + x) * 4; total++;
    if (px[i + 3] < 16) { clear++; return; }
    const c: RGB = [px[i], px[i + 1], px[i + 2]]; const k = quant(c);
    const e = counts.get(k) ?? { n: 0, sum: [0, 0, 0] as RGB };
    e.n++; e.sum = [e.sum[0] + c[0], e.sum[1] + c[1], e.sum[2] + c[2]]; counts.set(k, e);
  };
  for (let x = 0; x < w; x++) { visit(x, 0); visit(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { visit(0, y); visit(w - 1, y); }
  if (clear / total > 0.5) return null;
  const best = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  if (!best || best.n / total < 0.35) return null; // busy border: treat as no flat background
  return best.sum.map((v) => v / best.n) as RGB;
}

/** Foreground strength 0–255 per pixel: transparent and background-coloured pixels drop out, edges stay soft. */
export function buildMask(px: Uint8ClampedArray, w: number, h: number, bg: RGB | null): Uint8Array {
  const m = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4, a = px[i + 3];
    if (a < 16) continue;
    if (!bg) { m[p] = a; continue; }
    const d = dist([px[i], px[i + 1], px[i + 2]], bg);
    m[p] = d <= 28 ? 0 : d >= 64 ? a : Math.round((a * (d - 28)) / 36);
  }
  return m;
}

function bbox(m: Uint8Array, w: number, area: Box): Box | null {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = area.y; y < area.y + area.h; y++) for (let x = area.x; x < area.x + area.w; x++) {
    if (m[y * w + x] > 64) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Runs of filled lines along one axis, split where the gap is at least `minGap`. */
function runs(filled: boolean[], minGap: number): [number, number][] {
  const out: [number, number][] = [];
  let start = -1, gap = 0;
  filled.forEach((f, i) => {
    if (f) { if (start < 0) start = i; else if (gap >= minGap) { out.push([start, i - gap - 1]); start = i; } gap = 0; }
    else if (start >= 0) gap++;
  });
  if (start >= 0) out.push([start, filled.length - 1 - gap]);
  return out;
}

const squarish = (b: Box) => b.h / b.w >= 0.55 && b.h / b.w <= 1.8;

/**
 * Split the artwork: a squarish first part followed by a wider rest is a symbol plus
 * wordmark (side by side or stacked). One squarish shape is a symbol on its own;
 * anything else is treated as a wordmark.
 */
export function splitLayout(m: Uint8Array, w: number, h: number): { layout: Layout; all: Box; icon?: Box; text?: Box } | null {
  const all = bbox(m, w, { x: 0, y: 0, w, h });
  if (!all) return null;
  const cols = Array.from({ length: all.w }, (_, i) => { for (let y = all.y; y < all.y + all.h; y++) if (m[y * w + all.x + i] > 64) return true; return false; });
  const minColGap = Math.max(3, Math.round(all.w * 0.025));
  const cr = runs(cols, minColGap);
  if (cr.length >= 2) {
    const icon = bbox(m, w, { x: all.x + cr[0][0], y: all.y, w: cr[0][1] - cr[0][0] + 1, h: all.h });
    const text = bbox(m, w, { x: all.x + cr[1][0], y: all.y, w: all.x + all.w - (all.x + cr[1][0]), h: all.h });
    if (icon && text && squarish(icon) && text.w > icon.w * 1.2) return { layout: 'icon-text', all, icon, text };
  }
  const rows = Array.from({ length: all.h }, (_, j) => { for (let x = all.x; x < all.x + all.w; x++) if (m[(all.y + j) * w + x] > 64) return true; return false; });
  const rr = runs(rows, Math.max(3, Math.round(all.h * 0.04)));
  if (rr.length >= 2) {
    const icon = bbox(m, w, { x: all.x, y: all.y + rr[0][0], w: all.w, h: rr[0][1] - rr[0][0] + 1 });
    const text = bbox(m, w, { x: all.x, y: all.y + rr[1][0], w: all.w, h: all.y + all.h - (all.y + rr[1][0]) });
    if (icon && text && squarish(icon) && text.w > icon.w * 1.2) return { layout: 'icon-top', all, icon, text };
  }
  return all.w / all.h < 1.6 ? { layout: 'icon', all, icon: all } : { layout: 'text', all, text: all };
}

/** The logo's ink (most used solid colour) and an accent (the next clearly different one, if it is used enough). */
export function inkColours(px: Uint8ClampedArray, m: Uint8Array): { ink: RGB; accent: RGB | null } | null {
  const counts = new Map<string, { n: number; sum: RGB }>();
  let solid = 0;
  for (let p = 0; p < m.length; p++) {
    if (m[p] < 200) continue;
    const i = p * 4, c: RGB = [px[i], px[i + 1], px[i + 2]], k = quant(c);
    const e = counts.get(k) ?? { n: 0, sum: [0, 0, 0] as RGB };
    e.n++; e.sum = [e.sum[0] + c[0], e.sum[1] + c[1], e.sum[2] + c[2]]; counts.set(k, e); solid++;
  }
  if (!solid) return null;
  const ranked = [...counts.values()].sort((a, b) => b.n - a.n).map((e) => ({ c: e.sum.map((v) => v / e.n) as RGB, share: e.n / solid }));
  const ink = ranked[0].c;
  const acc = ranked.find((r) => dist(r.c, ink) > 70 && r.share >= 0.05);
  return { ink, accent: acc ? acc.c : null };
}

/** Darken (or lighten) `c` towards black (white) until it reaches `ratio` against `bg`. */
function reach(c: RGB, bg: RGB, ratio: number, towards: RGB): RGB {
  let out = c;
  for (let t = 0; t <= 1.0001 && contrast(out, bg) < ratio; t += 0.05) out = mix(c, towards, t);
  return out;
}

/**
 * The card theme from the logo. Light logos get a soft tinted card (or their own
 * background), dark backgrounds stay dark. Text 4.5:1, labels 4.5:1, stamps 3:1.
 */
export function themeFromLogo({ ink, accent, bg }: { ink: RGB; accent: RGB | null; bg: RGB | null }): CardTheme {
  const white: RGB = [255, 255, 255], black: RGB = [20, 17, 15];
  let card: RGB;
  if (bg && lum(bg) < 0.18) card = bg;                            // the logo sits on a dark ground: keep it
  else if (bg && lum(bg) < 0.92) card = bg;                       // a tinted light ground: keep it
  else card = mix(white, ink, 0.07);                              // white or transparent: a soft tint of the ink
  const dark = lum(card) < 0.18;
  if (!dark && lum(ink) > 0.5 && !bg) card = mix(black, ink, 0.12); // a pale logo on nothing reads best on a dark card
  const isDark = lum(card) < 0.18;
  const toward = isDark ? white : black;
  const foreground = isDark ? reach(mix(white, ink, 0.1), card, 7, white) : reach(mix(black, ink, 0.25), card, 7, black);
  const label = reach(ink, card, 4.5, toward);
  const stamp = reach(accent && contrast(accent, card) >= contrast(ink, card) ? accent : ink, card, 3, toward);
  return { background: hex(card), foreground: hex(foreground), label: hex(label), stamp: hex(stamp) };
}

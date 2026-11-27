// Pass images: the stamp strip as SVG (same layout rules as
// components/loyalty/stamp-strip.tsx), PNG rendering through @resvg/resvg-js when
// it is installed, and tiny solid-colour PNGs made in code as placeholders.
//
// @resvg/resvg-js is NOT installed yet. Add it with:
//   npm i @resvg/resvg-js
// Until then renderStripPng() throws and buildPkpass() falls back to placeholders.
//
// Kept free of `@/` imports so `node --test` can load it directly.
import { deflateSync, crc32 } from 'node:zlib';
import { stripColumns } from './reward-first';

/** Columns per row: 5 up to 10 stamps, 6 up to 18, 8 up to 30 (mirrors stampColumns in stamp-strip.tsx). */
export const stampColumns = (total: number) => (total <= 10 ? 5 : total <= 18 ? 6 : 8);

/**
 * Apple storeCard strip, in points (@1x). architecture.md "Images": render at
 * 1125×432 (@3x) and keep the stamps inside the bottom 369 px (123 pt), because
 * Apple's sources disagree on the strip height.
 */
export const STRIP = { width: 375, height: 144, safeHeight: 123 } as const;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGBA = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/i;
/** Merchant colours end up inside SVG attributes, so only plain colour syntax gets through. */
const safeColour = (c: string | undefined, fallback: string) => (c && (HEX.test(c) || RGBA.test(c) || c === 'none' || c === 'transparent') ? c : fallback);

export type StripOptions = {
  total: number;
  filled: number;
  /** Filled stamp colour. */
  stamp?: string;
  /** Outline colour of an empty slot. */
  empty?: string;
  /** Strip background; 'transparent' lets the pass background show through. */
  background?: string;
  /** Output scale: 1, 2 or 3 (@1x/@2x/@3x). */
  scale?: 1 | 2 | 3;
};

/**
 * The stamp strip as an SVG string, Reward first: a band of stamps along the bottom, the top
 * left free for the reward text. Circles only: filled or dashed-empty, with an extra ring on the
 * last (reward) slot, like the web component. No icons.
 */
export function renderStripSvg(o: StripOptions): string {
  const total = Math.max(1, Math.min(30, Math.floor(o.total)));
  const filled = Math.max(0, Math.min(total, Math.floor(o.filled)));
  const scale = o.scale ?? 3;
  const stamp = safeColour(o.stamp, '#ffffff');
  const empty = safeColour(o.empty, 'rgba(255,255,255,0.45)');
  const background = safeColour(o.background, 'transparent');

  // Reward first: Apple draws the reward (the primary field) over the top-left of the strip, so
  // the stamps sit in a band along the bottom: one row up to 6, two up to 12, then three.
  const W = STRIP.width * scale, H = STRIP.height * scale;
  const cols = stripColumns(total);
  const rows = Math.ceil(total / cols);
  const bandH = (rows === 1 ? 56 : rows === 2 ? 84 : 96) * scale;
  const cell = 100, pad = 14, r = cell / 2 - pad;
  const gw = cols * cell, gh = rows * cell;

  const circles: string[] = [];
  for (let i = 0; i < total; i++) {
    const cx = (i % cols) * cell + cell / 2;
    const cy = Math.floor(i / cols) * cell + cell / 2;
    const on = i < filled;
    circles.push(
      on
        ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${stamp}" stroke="${stamp}" stroke-width="4"/>`
        : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${empty}" stroke-width="4" stroke-dasharray="6 6"/>`,
    );
    if (i === total - 1) circles.push(`<circle cx="${cx}" cy="${cy}" r="${r + 8}" fill="none" stroke="${on ? stamp : empty}" stroke-width="3"/>`);
  }

  const margin = 6 * scale;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    background === 'transparent' ? '' : `<rect width="${W}" height="${H}" fill="${background}"/>`,
    `<svg x="${margin}" y="${H - bandH - margin}" width="${W - 2 * margin}" height="${bandH}" viewBox="-10 -10 ${gw + 20} ${gh + 20}" preserveAspectRatio="xMidYMid meet">`,
    ...circles,
    '</svg></svg>',
  ].join('');
}

type ResvgModule = { Resvg: new (svg: string, opts?: unknown) => { render(): { asPng(): Uint8Array } } };

/** PNG of the strip via @resvg/resvg-js. Throws "not installed" when the package is absent. */
export async function renderStripPng(o: StripOptions): Promise<Buffer> {
  let mod: ResvgModule;
  try {
    // A variable specifier keeps TypeScript and the bundler from requiring the package at build time.
    const name = '@resvg/resvg-js';
    mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ name)) as ResvgModule;
  } catch {
    throw new Error('@resvg/resvg-js is not installed (run: npm i @resvg/resvg-js)');
  }
  const png = new mod.Resvg(renderStripSvg(o), { fitTo: { mode: 'original' } }).render().asPng();
  return Buffer.from(png);
}

// ------------------------------------------------------------ placeholder PNGs

function parseColour(c: string | undefined): [number, number, number, number] {
  if (!c || c === 'transparent') return [0, 0, 0, 0];
  if (HEX.test(c)) {
    const h = c.length === 4 ? c.slice(1).split('').map((x) => x + x).join('') : c.slice(1);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255];
  }
  const m = RGBA.exec(c) ? c.match(/[\d.]+/g) : null;
  if (m) return [Number(m[0]), Number(m[1]), Number(m[2]), m[3] !== undefined ? Math.round(Number(m[3]) * 255) : 255];
  return [0, 0, 0, 255];
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}

/**
 * A valid solid-colour RGBA PNG, built in code (zlib only). PLACEHOLDER art for
 * icon/logo/strip until real merchant images and resvg rendering are wired in.
 */
export function solidPng(width: number, height: number, colour = 'transparent'): Buffer {
  const [r, g, b, a] = parseColour(colour);
  const row = Buffer.alloc(1 + width * 4);
  for (let x = 0; x < width; x++) row.set([r, g, b, a], 1 + x * 4); // filter byte 0 = None
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

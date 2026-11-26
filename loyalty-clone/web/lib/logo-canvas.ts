'use client';
// Logo → card design, the browser part: decode the file, run lib/logo-parts on its
// pixels, and cut the symbol (stamp) and wordmark (card header) out as PNGs with the
// background knocked out. Nothing is uploaded until the card is created.
import { buildMask, findBackground, hex, inkColours, splitLayout, themeFromLogo, type Box, type CardTheme, type Layout } from './logo-parts';

export type LogoResult = { layout: Layout; theme: CardTheme; ink: string; wordmark?: string; symbol?: string };

const MAX_SIDE = 900;

function load(file: File): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('We couldn’t read this image. Try a PNG, JPEG, WebP or SVG.')); };
    img.src = url;
  });
}

/** Copy `box` of the knocked-out artwork onto a new canvas of size w×h, centred with padding. */
function cut(src: HTMLCanvasElement, box: Box, w: number, h: number, pad: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const s = Math.min((w - pad * 2) / box.w, (h - pad * 2) / box.h);
  const dw = box.w * s, dh = box.h * s;
  const x = c.getContext('2d')!; x.imageSmoothingQuality = 'high';
  x.drawImage(src, box.x, box.y, box.w, box.h, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return c.toDataURL('image/png');
}

export async function analyseLogo(file: File): Promise<LogoResult> {
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) throw new Error('Use a PNG, JPEG, WebP or SVG file.');
  if (file.size > 5 * 1024 * 1024) throw new Error('This file is over 5 MB. Try a smaller export.');
  const img = await load(file);
  const iw = img.naturalWidth || 600, ih = img.naturalHeight || 600;
  const k = Math.min(1, MAX_SIDE / Math.max(iw, ih)) * (Math.max(iw, ih) < 300 ? 300 / Math.max(iw, ih) : 1);
  const w = Math.max(1, Math.round(iw * k)), h = Math.max(1, Math.round(ih * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const bg = findBackground(data.data, w, h);
  const mask = buildMask(data.data, w, h, bg);
  const parts = splitLayout(mask, w, h);
  const inks = inkColours(data.data, mask);
  if (!parts || !inks) throw new Error('We couldn’t find a logo in this image. Try one with a plain background.');
  // knock the background out of the working canvas
  for (let p = 0; p < mask.length; p++) data.data[p * 4 + 3] = Math.min(data.data[p * 4 + 3], mask[p]);
  ctx.putImageData(data, 0, 0);
  const out: LogoResult = { layout: parts.layout, theme: themeFromLogo({ ...inks, bg }), ink: hex(inks.ink) };
  if (parts.icon) out.symbol = cut(c, parts.icon, 360, 360, 28);
  if (parts.text) {
    const r = parts.text.w / parts.text.h, hh = 120, ww = Math.max(320, Math.min(720, Math.round(hh * r)));
    out.wordmark = cut(c, parts.text, ww, hh, 6);
  }
  return out;
}

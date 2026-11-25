// Upload checks from the file's own bytes (never the browser's content-type).
// No imports, so Node tests can load it directly.
export type ImageKind = 'logo' | 'icon' | 'stamp';
export const MAX_BYTES = 1024 * 1024;
export const MIN_SIZE: Record<ImageKind, [number, number]> = { logo: [160, 50], icon: [87, 87], stamp: [100, 100] };

export type Checked = { ok: true; mime: 'image/png' | 'image/jpeg' | 'image/webp'; width: number; height: number } | { ok: false; error: string };

export function inspectImage(b: Uint8Array, kind: ImageKind): Checked {
  if (b.length === 0) return { ok: false, error: 'The file is empty.' };
  if (b.length > MAX_BYTES) return { ok: false, error: 'Images can be up to 1 MB. Try a smaller or compressed file.' };
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let mime: 'image/png' | 'image/jpeg' | 'image/webp' | null = null, w = 0, h = 0;
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    mime = 'image/png'; w = dv.getUint32(16); h = dv.getUint32(20);
  } else if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    mime = 'image/jpeg';
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { h = dv.getUint16(i + 5); w = dv.getUint16(i + 7); break; }
      i += 2 + dv.getUint16(i + 2);
    }
  } else if (b.length > 30 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') {
    mime = 'image/webp';
    const f = String.fromCharCode(...b.slice(12, 16));
    if (f === 'VP8X') { w = 1 + (b[24] | (b[25] << 8) | (b[26] << 16)); h = 1 + (b[27] | (b[28] << 8) | (b[29] << 16)); }
    else if (f === 'VP8 ') { w = dv.getUint16(26, true) & 0x3fff; h = dv.getUint16(28, true) & 0x3fff; }
    else if (f === 'VP8L') { const v = dv.getUint32(21, true); w = (v & 0x3fff) + 1; h = ((v >> 14) & 0x3fff) + 1; }
  }
  if (!mime) return { ok: false, error: 'Use a PNG, JPEG or WebP image. (SVG and other files aren’t accepted.)' };
  if (!w || !h || w > 4096 || h > 4096) return { ok: false, error: 'We couldn’t read this image’s size. Try exporting it again as PNG.' };
  const [mw, mh] = MIN_SIZE[kind];
  if (w < mw || h < mh) return { ok: false, error: `This ${kind} is ${w}×${h}. Use at least ${mw}×${mh} pixels so it stays sharp.` };
  return { ok: true, mime, width: w, height: h };
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectImage } from '../lib/image-check.ts';

const png = (w, h) => { const b = new Uint8Array(33); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); const dv = new DataView(b.buffer); dv.setUint32(16, w); dv.setUint32(20, h); return b; };

test('reads PNG size from the bytes and enforces minimums', () => {
  assert.deepEqual(inspectImage(png(480, 150), 'logo'), { ok: true, mime: 'image/png', width: 480, height: 150 });
  assert.equal(inspectImage(png(40, 40), 'icon').ok, false);
});
test('refuses SVG, unknown files, empty and oversized files', () => {
  assert.equal(inspectImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'logo').ok, false);
  assert.equal(inspectImage(new Uint8Array(0), 'logo').ok, false);
  assert.equal(inspectImage(new Uint8Array(1024 * 1024 + 1), 'logo').ok, false);
});
test('reads JPEG size from the SOF marker', () => {
  const b = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x96, 0x01, 0xe0, 0x03, 0, 0, 0, 0]);
  assert.deepEqual(inspectImage(b, 'logo'), { ok: true, mime: 'image/jpeg', width: 480, height: 150 });
});

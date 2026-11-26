import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMask, contrast, findBackground, fromHex, inkColours, splitLayout, themeFromLogo } from '../lib/logo-parts.ts';

/** A w×h RGBA buffer filled with `bg`, with solid rectangles painted on. */
function img(w, h, bg, rects) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) px.set(bg, p * 4);
  for (const [x, y, rw, rh, c] of rects) for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) px.set(c, (j * w + i) * 4);
  return px;
}
const WHITE = [255, 255, 255, 255], GREEN = [18, 58, 45, 255], LIME = [150, 200, 50, 255], CLEAR = [0, 0, 0, 0];
const run = (px, w, h) => { const bg = findBackground(px, w, h); const m = buildMask(px, w, h, bg); return { bg, m, parts: splitLayout(m, w, h), inks: inkColours(px, m) }; };

test('a symbol next to a wordmark splits into icon + text, background found', () => {
  const w = 300, h = 100;
  // symbol 60×60, then "letters" (blocks with small gaps) to the right
  const letters = Array.from({ length: 6 }, (_, k) => [110 + k * 28, 35, 22, 30, GREEN]);
  const { bg, parts, inks } = run(img(w, h, WHITE, [[20, 20, 60, 60, GREEN], [35, 35, 20, 20, LIME], ...letters]), w, h);
  assert.deepEqual(bg.map(Math.round), [255, 255, 255]);
  assert.equal(parts.layout, 'icon-text');
  assert.ok(Math.abs(parts.icon.w - 60) <= 1 && Math.abs(parts.icon.h - 60) <= 1);
  assert.ok(parts.text.x >= 110 && parts.text.w > 120);
  assert.deepEqual(inks.ink.map(Math.round), [18, 58, 45]);
  assert.ok(inks.accent, 'the lime part is found as an accent');
});

test('a wordmark alone is text, a lone square is a symbol', () => {
  assert.equal(run(img(300, 80, WHITE, [[20, 25, 260, 30, GREEN]]), 300, 80).parts.layout, 'text');
  assert.equal(run(img(120, 120, WHITE, [[30, 30, 60, 60, GREEN]]), 120, 120).parts.layout, 'icon');
});

test('a symbol above a wordmark is icon-top', () => {
  const r = run(img(240, 200, WHITE, [[95, 10, 50, 50, GREEN], [20, 110, 200, 40, GREEN]]), 240, 200);
  assert.equal(r.parts.layout, 'icon-top');
});

test('a transparent logo has no background, and nothing paints means no parts', () => {
  const r = run(img(200, 80, CLEAR, [[20, 20, 160, 40, GREEN]]), 200, 80);
  assert.equal(r.bg, null);
  assert.equal(r.parts.layout, 'text');
  assert.equal(run(img(50, 50, WHITE, []), 50, 50).parts, null);
});

test('the card theme from any logo passes contrast: text and labels 4.5:1, stamps 3:1', () => {
  const cases = [
    { ink: [18, 58, 45], accent: [150, 200, 50], bg: [237, 237, 231] },   // dark green on beige (the StampMate test logo)
    { ink: [255, 220, 90], accent: null, bg: null },                     // pale yellow, transparent
    { ink: [255, 255, 255], accent: null, bg: [20, 30, 90] },            // white on navy
    { ink: [230, 40, 60], accent: null, bg: [255, 255, 255] },           // red on white
  ];
  for (const c of cases) {
    const t = themeFromLogo(c);
    const card = fromHex(t.background);
    assert.ok(contrast(fromHex(t.foreground), card) >= 4.5, `text ${JSON.stringify(c)}`);
    assert.ok(contrast(fromHex(t.label), card) >= 4.5, `label ${JSON.stringify(c)}`);
    assert.ok(contrast(fromHex(t.stamp), card) >= 3, `stamp ${JSON.stringify(c)}`);
  }
});

import { deflateSync } from 'node:zlib';
import { test, expect } from './support/fixtures';
import { coffeeCampaign, createSessionToken, one, sql } from './support/db';

// a real, valid PNG (solid colour) built in Node: CRC + zlib, no files on disk
function png(w: number, h: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0x3c)]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(Array(h).fill(row)))), chunk('IEND', Buffer.alloc(0))]);
}

test.describe('S04 card images', () => {
  test.afterEach(async () => {
    const c = await coffeeCampaign();
    await sql('update campaigns set logo_image_id = null, icon_image_id = null, stamp_image_id = null where id = $1', [c!.id]);
  });

  test('F02-H2 upload a logo: shown in the designer, on the join page and served safely', async ({ page, checkA11y, loginAsOwner }) => {
    await loginAsOwner();
    const c = await coffeeCampaign();
    await page.goto(`/cards/${c!.id}/design`);
    await page.getByLabel('Logo', { exact: true }).setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png(480, 150) });
    await expect(page.getByRole('img', { name: 'Current logo' })).toBeVisible();
    await checkA11y('S04 with logo');
    const row = await one<{ logo_image_id: string }>('select logo_image_id from campaigns where id = $1', [c!.id]);
    expect(row!.logo_image_id).toBeTruthy();
    const res = await page.request.get(`/api/images/${row!.logo_image_id}`);
    expect(res.headers()['content-type']).toBe('image/png');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    await page.goto('/j/neza1cup');
    await expect(page.getByRole('img', { name: 'Café Neza' })).toBeVisible();
  });

  test('F02-N3 refuses SVG, a too-small icon, and another business’s card', async ({ page, request, loginAsOwner, guard }) => {
    await loginAsOwner();
    guard.allowConsole(/status of 422/); // the refusals below are the point of this test
    const c = await coffeeCampaign();
    await page.goto(`/cards/${c!.id}/design`);
    await page.getByLabel('Logo', { exact: true }).setInputFiles({ name: 'x.svg', mimeType: 'image/png', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') });
    await expect(page.getByRole('alert').filter({ hasText: /PNG, JPEG or WebP/ })).toBeVisible();
    await page.getByLabel('Icon', { exact: true }).setInputFiles({ name: 'i.png', mimeType: 'image/png', buffer: png(40, 40) });
    await expect(page.getByRole('alert').filter({ hasText: /at least 87×87/ })).toBeVisible();
    // a second business can't attach images to this card
    await sql(`delete from users where email = 'img-intruder@example.test'`); await sql(`delete from orgs where name = 'Img Intruder'`);
    const u = await one<{ id: string }>(`insert into users (email, password_hash) values ('img-intruder@example.test','x') returning id`);
    const o = await one<{ id: string }>(`insert into orgs (name) values ('Img Intruder') returning id`);
    await sql('insert into org_members (org_id, user_id) values ($1,$2)', [o!.id, u!.id]);
    const token = await createSessionToken('img-intruder@example.test');
    const r = await request.post('/api/images', { headers: { cookie: `lc_session=${token}` }, multipart: { kind: 'logo', campaignId: c!.id, file: { name: 'l.png', mimeType: 'image/png', buffer: png(480, 150) } } });
    expect(r.status()).toBe(404);
    expect((await one<{ logo_image_id: string | null }>('select logo_image_id from campaigns where id = $1', [c!.id]))!.logo_image_id).toBeNull();
    await sql('delete from orgs where id = $1', [o!.id]); await sql('delete from users where id = $1', [u!.id]);
  });
});

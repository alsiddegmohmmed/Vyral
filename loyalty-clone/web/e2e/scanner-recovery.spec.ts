// fixes.md #1, #3, #4: a counter phone that recovers by itself. Re-pair from the
// error screen, no silent logout, self-check, resilient scan loop, safe updates,
// problem reports to the owner.
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { test, expect, watch } from './support/fixtures';
import { cardById, clearRateLimits, coffeeCampaign, newCard, one, relaxScannerLimits, seedOrg, sql } from './support/db';

const BASE = 'http://localhost:3100';
type Guard = Parameters<typeof watch>[1];

/** A phone paired the way the scanner does it (POST /api/scan/pair), with its own cookie jar. */
async function pairedPhone(browser: Browser, guard: Guard, label: string): Promise<{ ctx: BrowserContext; p: Page; deviceId: string }> {
  const org = await seedOrg();
  const code = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '7');
  await sql(`insert into pairing_codes (code, org_id, label, expires_at) values ($1, $2, $3, now() + interval '10 minutes')`, [code, org!.id, label]);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const r = await ctx.request.post(`${BASE}/api/scan/pair`, { data: { code } });
  expect(r.status(), await r.text()).toBe(200);
  const d = await one<{ id: string }>(`select id from scanner_devices where org_id = $1 and label = $2 and revoked_at is null order by created_at desc limit 1`, [org!.id, label]);
  const p = await ctx.newPage();
  watch(p, guard);
  return { ctx, p, deviceId: d!.id };
}

async function findByCode(p: Page, code: string) {
  await p.getByRole('button', { name: 'Type the code instead' }).click();
  await p.getByLabel('Card code').fill(code);
  await p.getByRole('button', { name: 'Find card' }).click();
}

test.beforeEach(async () => {
  await clearRateLimits();
  const camp = await coffeeCampaign();
  await sql(`update campaigns set status = 'live' where id = $1`, [camp!.id]);
  await relaxScannerLimits(camp!.id);
});
test.afterEach(async () => {
  const org = await seedOrg();
  await sql(`update scanner_devices set revoked_at = now() where org_id = $1 and label like 'Till %' and revoked_at is null`, [org!.id]);
});

test.describe('re-pair from the error screen', () => {
  test('R1 revoked phone: "needs pairing again" with the code input; a new code restores it without a reload @mobile', async ({ browser, page, loginAsOwner, guard, checkA11y }) => {
    guard.allowConsole(/status of 401/);
    const { ctx, p, deviceId } = await pairedPhone(browser, guard, 'Till R1');
    await p.goto(`${BASE}/scan`);
    await expect(p.getByText('Scanner · Till R1')).toBeVisible();

    // the owner removes the phone while it sits at the counter
    await sql('update scanner_devices set revoked_at = now() where id = $1', [deviceId]);
    const card = await newCard('Repair Rosa');
    await findByCode(p, card.manual_code);
    await expect(p.getByRole('heading', { name: 'This phone needs pairing again' })).toBeVisible();
    await expect(p.getByRole('alert').filter({ hasText: '“Till R1” was removed from Counter phones' })).toBeVisible();
    await expect(p.getByLabel('Pairing code')).toBeVisible();
    await checkA11y('re-pair screen', p);
    await p.evaluate(() => { (window as unknown as { __sameLoad: number }).__sameLoad = 1; });

    // owner makes a new code on Counter phones
    await loginAsOwner();
    await page.goto('/settings/devices');
    await page.getByRole('button', { name: 'Pair a phone' }).click();
    const dlg = page.getByRole('dialog', { name: 'Pair a phone' });
    await dlg.getByLabel('Name for this phone').fill('Till R1 again');
    await dlg.getByRole('button', { name: 'Get pairing code' }).click();
    const code = (await dlg.getByText(/^[0-9A-Z]{6}$/).textContent())!.trim();

    await p.getByLabel('Pairing code').fill(code);
    await p.getByRole('button', { name: 'Pair this phone' }).click();
    await expect(p.getByText('Scanner · Till R1 again')).toBeVisible();
    expect(await p.evaluate(() => (window as unknown as { __sameLoad?: number }).__sameLoad), 'pairing restored the phone without a reload').toBe(1);
    await findByCode(p, card.manual_code);
    await p.getByRole('button', { name: 'Add 1 stamp' }).click();
    await expect(p.getByRole('heading', { name: '1 stamp added' })).toBeVisible();
    await ctx.close();
  });

  test('R2 cookie gone but the pairing still exists: the scanner says so plainly', async ({ browser, guard }) => {
    guard.allowConsole(/status of 401/);
    const { ctx, p } = await pairedPhone(browser, guard, 'Till R2');
    await p.goto(`${BASE}/scan`);
    await expect(p.getByText('Scanner · Till R2')).toBeVisible();
    await ctx.clearCookies();
    await p.reload();
    await expect(p.getByRole('heading', { name: 'This phone needs pairing again' })).toBeVisible();
    await expect(p.getByText(/“Till R2” is still listed on Counter phones, but this browser forgot its sign-in/)).toBeVisible();
    await ctx.close();
  });

  test('R3 paired device cookie lasts 400 days and the device token has no expiry', async ({ browser, guard }) => {
    const { ctx } = await pairedPhone(browser, guard, 'Till R3');
    const c = (await ctx.cookies()).find((x) => x.name === 'lc_device')!;
    expect(c.httpOnly).toBe(true);
    expect(c.expires - Date.now() / 1000).toBeGreaterThan(399 * 86400);
    const cols = await sql<{ column_name: string }>(`select column_name from information_schema.columns where table_name = 'scanner_devices' and column_name like '%expire%'`);
    expect(cols, 'scanner_devices must not grow an expiry column').toEqual([]);
    await ctx.close();
  });
});

test.describe('resilient scan loop (owner session)', () => {
  test.beforeEach(async ({ loginAsOwner }) => { await loginAsOwner(); });

  test('R4 submit times out after the server saved: Retry resends the same key, exactly one stamp', async ({ page, guard }) => {
    guard.allowConsole(/ERR_INTERNET_DISCONNECTED|ERR_FAILED/);
    const card = await newCard('Retry Rehema');
    const keys: string[] = [];
    await page.route('**/api/scan/transaction', async (route) => {
      keys.push(route.request().postDataJSON().idempotencyKey);
      if (keys.length === 1) { await route.fetch(); await route.abort('internetdisconnected'); } // saved, but the answer is lost
      else await route.continue();
    });
    await page.goto('/scan');
    await findByCode(page, card.manual_code);
    await page.getByRole('button', { name: 'Add 1 stamp' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'No connection — nothing was saved' });
    await expect(alert).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeFocused();
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByRole('heading', { name: '1 stamp added' })).toBeVisible();
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
    expect((await cardById(card.id))!.current_stamps).toBe(1);
    const ev = await one<{ n: number }>(`select count(*)::int as n from card_events where card_id = $1 and type = 'stamped'`, [card.id]);
    expect(ev!.n).toBe(1);
  });

  test('R5 fully offline at submit: Retry while offline keeps the card open; back online, one stamp', async ({ page, context, guard }) => {
    guard.allowConsole(/ERR_INTERNET_DISCONNECTED/);
    const card = await newCard('Offline Olivier');
    await page.goto('/scan');
    await findByCode(page, card.manual_code);
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Add 1 stamp' }).click();
    await expect(page.getByRole('heading', { name: 'No connection — nothing was saved' })).toBeVisible();
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByRole('heading', { name: 'No connection — nothing was saved' })).toBeVisible();
    expect((await cardById(card.id))!.current_stamps).toBe(0);
    await context.setOffline(false);
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByRole('heading', { name: '1 stamp added' })).toBeVisible();
    expect((await cardById(card.id))!.current_stamps).toBe(1);
  });

  test('R6 a dropped lookup is retried once automatically', async ({ page, guard }) => {
    guard.allowConsole(/ERR_INTERNET_DISCONNECTED|ERR_FAILED/);
    const card = await newCard('Lookup Lina');
    let n = 0;
    await page.route('**/api/scan/lookup', (route) => (++n === 1 ? route.abort('internetdisconnected') : route.continue()));
    await page.goto('/scan');
    await findByCode(page, card.manual_code);
    await expect(page.getByRole('heading', { name: 'Lookup' })).toBeVisible();
    expect(n).toBe(2);
  });

  test('R7 a crash shows "Restart scanner", not a white screen; restarting carries on', async ({ page, guard }) => {
    // a malformed server answer makes the card screen throw while rendering
    guard.allowConsole(/Cannot read properties of null|The above error occurred|ScannerErrorBoundary|rewardsAvailable/);
    const card = await newCard('Crash Claude');
    let broken = true;
    await page.route('**/api/scan/lookup', (route) => (broken ? route.fulfill({ json: { ok: true, card: null } }) : route.continue()));
    await page.goto('/scan');
    await findByCode(page, card.manual_code);
    await expect(page.getByRole('heading', { name: 'The scanner stopped' })).toBeVisible();
    broken = false;
    await page.getByRole('button', { name: 'Restart scanner' }).click();
    await expect(page.getByRole('button', { name: 'Type the code instead' })).toBeVisible();
    await findByCode(page, card.manual_code);
    await expect(page.getByRole('heading', { name: 'Crash' })).toBeVisible();
    // the crash is kept (scrubbed) for Report a problem
    const last = await page.evaluate(() => localStorage.getItem('lc-scanner-last-error'));
    expect(last).toMatch(/crash: TypeError/);
  });

  test('R8 "Check this phone" runs every check and shows plain results', async ({ page, checkA11y }) => {
    await page.goto('/scan');
    await page.getByRole('button', { name: 'Scanner settings' }).click();
    await page.getByRole('button', { name: 'Check this phone' }).click();
    const list = page.getByRole('list', { name: 'Check results' });
    await expect(list.getByRole('listitem')).toHaveCount(5);
    await expect(list).toContainText(/Connection: OK\. Reached the server in \d+ ms\./);
    await expect(list).toContainText('Pairing: OK. Signed in as the owner');
    await expect(list).toContainText(/Camera: (OK|Check|Problem)\./);
    await expect(list).toContainText(/QR reader: OK\./);
    await expect(list).toContainText(/Clock: OK\./);
    await expect(page.getByRole('button', { name: 'Check again' })).toBeVisible();
    await checkA11y('self-check results');
  });

  test('R9 a new build waits: "Update ready" while a card is open, applied on return to the camera', async ({ page }) => {
    const card = await newCard('Update Uwase');
    await page.route('**/api/scan/status', async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, json: { ...(await res.json()), version: 'next-build' } });
    });
    await page.goto('/scan');
    await expect(page.getByRole('button', { name: 'Update ready · install now' })).toBeVisible();
    await page.evaluate(() => { (window as unknown as { __sameLoad: number }).__sameLoad = 1; });
    await findByCode(page, card.manual_code);
    await expect(page.getByRole('heading', { name: 'Update' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Update ready · installs after this card' })).toBeVisible();
    await page.getByRole('button', { name: 'Add 1 stamp' }).click();
    await expect(page.getByRole('heading', { name: '1 stamp added' })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __sameLoad?: number }).__sameLoad), 'no reload while the card was open').toBe(1);
    const loaded = page.waitForEvent('load');
    await page.getByRole('button', { name: 'Scan next' }).click().catch(() => { /* the 3 s auto-return may get there first */ });
    await loaded;
    await expect(page.getByRole('button', { name: 'Type the code instead' })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __sameLoad?: number }).__sameLoad), 'the update applied on return to the camera').toBeUndefined();
    expect((await cardById(card.id))!.current_stamps).toBe(1);
  });
});

test.describe('owner sees phone health', () => {
  test('R10 "Report a problem" lands on Counter phones, with no customer data; phone shows Online', async ({ browser, page, loginAsOwner, guard, checkA11y }) => {
    const { ctx, p } = await pairedPhone(browser, guard, 'Till RP');
    await p.goto(`${BASE}/scan`);
    await expect(p.getByText('Scanner · Till RP')).toBeVisible();
    // an earlier error that mentions a card code and a phone number (written raw, as if by an old build)
    await p.evaluate(() => localStorage.setItem('lc-scanner-last-error', JSON.stringify({ at: '2026-11-25T10:00:00.000Z', message: 'lookup 9Y77BKHV failed for +250 788 600 222' })));
    await p.getByRole('button', { name: 'Scanner settings' }).click();
    await p.getByRole('button', { name: 'Report a problem' }).click();
    await expect(p.getByRole('status').filter({ hasText: 'Sent. The owner can read it on Counter phones' })).toBeVisible();
    const row = await one<{ last_error: string; checks: unknown[]; device_label: string; app_version: string }>(
      `select last_error, checks, device_label, app_version from scanner_reports where device_label = 'Till RP' order by created_at desc limit 1`);
    expect(row).toMatchObject({ device_label: 'Till RP', app_version: 'dev' });
    expect(row!.last_error).not.toMatch(/9Y77BKHV|788/);
    expect(row!.checks.length).toBeGreaterThanOrEqual(4);

    await loginAsOwner();
    await page.goto('/settings/devices');
    const phone = page.getByRole('listitem').filter({ hasText: 'Till RP' }).first();
    await expect(phone.getByText('Online', { exact: true })).toBeVisible();
    const reports = page.getByRole('list', { name: 'Problem reports' });
    await expect(reports.getByRole('listitem').filter({ hasText: 'Till RP' }).first()).toContainText('Last error: 2026-11-25T10:00:00.000Z lookup [code] failed for [number]');
    await expect(reports).not.toContainText('9Y77BKHV');
    await checkA11y('counter phones with reports');
    await ctx.close();
    await sql(`delete from scanner_reports where device_label = 'Till RP'`);
  });

  test('R11 the report API refuses an unpaired phone and keeps only whitelisted fields', async ({ browser, guard }) => {
    const anon = await browser.newContext();
    const r = await anon.request.post(`${BASE}/api/scan/report`, { data: { lastError: 'x' } });
    expect(r.status()).toBe(401);
    expect(await r.json()).toMatchObject({ reason: 'not_paired' });
    await anon.close();
    const { ctx } = await pairedPhone(browser, guard, 'Till RA');
    const ok = await ctx.request.post(`${BASE}/api/scan/report`, { data: { appVersion: 'v9', userAgent: 'probe', lastError: 'card amani@example.com', customerName: 'Amani', checks: [{ id: 'network', status: 'ok', detail: 'fine' }] } });
    expect(ok.status()).toBe(200);
    const row = await one<{ last_error: string; checks: unknown[] }>(`select last_error, checks from scanner_reports where device_label = 'Till RA' order by created_at desc limit 1`);
    expect(row).toEqual({ last_error: 'card [email]', checks: [{ id: 'network', status: 'ok', detail: 'fine' }] });
    await sql(`delete from scanner_reports where device_label = 'Till RA'`);
    await ctx.close();
  });
});

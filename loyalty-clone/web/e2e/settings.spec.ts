// F10 locations, F13 counter phones (pairing), F14 plan and billing, S20 settings.
import { test, expect } from './support/fixtures';
import { clearRateLimits, coffeeCampaign, newCard, one, seedOrg, sql } from './support/db';
import { expectNoHorizontalScroll } from './support/flows';

test.beforeEach(async ({ loginAsOwner }) => { await loginAsOwner(); await clearRateLimits(); });

test.describe('F10 locations', () => {
  test.beforeEach(async () => {
    const org = await seedOrg();
    await sql(`delete from locations where org_id = $1 and name not in ('Kimihurura','Kigali Heights')`, [org!.id]);
    await sql(`insert into locations (org_id,name,address,lat,lon,address_on_card,relevant_text)
               select $1,'Kigali Heights','KG 7 Ave, Kigali Heights',-1.9532,30.0937,'Kigali Heights, ground floor','Your coffee card works here too'
                where not exists (select 1 from locations where org_id = $1 and name = 'Kigali Heights')`, [org!.id]);
  });

  test('F10-H1 add a location, see it listed and attachable on the card @mobile', async ({ page, checkA11y }) => {
    await page.goto('/locations');
    await checkA11y('S18 locations');
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Add location' }).click();
    const dlg = page.getByRole('dialog', { name: 'Add a location' });
    await checkA11y('S18 add location dialog');
    await dlg.getByLabel(/^Name/).fill('Nyamirambo Kiosk ☕');
    await dlg.getByLabel('Address', { exact: true }).fill('KN 2 Ave');
    await dlg.getByLabel('Latitude').fill('-1.9750');
    await dlg.getByLabel('Longitude').fill('30.0430');
    await dlg.getByLabel(/^Nearby text/).fill('Coffee two minutes away');
    await dlg.getByRole('button', { name: 'Save location' }).click();
    await expect(dlg.getByText('Saved')).toBeVisible();
    await dlg.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('heading', { name: 'Nyamirambo Kiosk ☕' })).toBeVisible();
    await expect(page.getByText('3 of 3 on your plan.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add location' })).toBeDisabled();
    const camp = await coffeeCampaign();
    await page.goto(`/cards/${camp!.id}/design`);
    await page.getByRole('tab', { name: 'Locations' }).click();
    await expect(page.getByRole('checkbox', { name: /Nyamirambo Kiosk/ })).toBeVisible();
  });

  test('F10-E1 after saving one location, Add location opens an empty form again', async ({ page }) => {
    const org = await seedOrg();
    await sql(`delete from locations where org_id = $1 and name = 'Kigali Heights'`, [org!.id]);
    await page.goto('/locations');
    await page.getByRole('button', { name: 'Add location' }).click();
    let dlg = page.getByRole('dialog', { name: 'Add a location' });
    await dlg.getByLabel(/^Name/).fill('First New');
    await dlg.getByLabel('Latitude').fill('-1.95');
    await dlg.getByLabel('Longitude').fill('30.06');
    await dlg.getByRole('button', { name: 'Save location' }).click();
    await expect(dlg.getByText('Saved')).toBeVisible();
    await dlg.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Add location' }).click();
    dlg = page.getByRole('dialog', { name: 'Add a location' });
    await expect(dlg.getByLabel(/^Name/), 'the reopened dialog shows the old "Saved" message instead of a form').toBeVisible();
  });

  test('F10-E2 invalid coordinates are refused with a clear message', async ({ page }) => {
    const org = await seedOrg();
    await sql(`delete from locations where org_id = $1 and name = 'Kigali Heights'`, [org!.id]);
    await page.goto('/locations');
    await page.getByRole('button', { name: 'Add location' }).click();
    const dlg = page.getByRole('dialog', { name: 'Add a location' });
    await dlg.getByLabel(/^Name/).fill('Bad Place');
    await dlg.getByLabel('Latitude').fill('123');
    await dlg.getByLabel('Longitude').fill('abc');
    await dlg.getByRole('button', { name: 'Save location' }).click();
    await expect(dlg.getByRole('alert')).toHaveText(/valid latitude and longitude/);
  });

  test('F10-E3 edit and delete a location', async ({ page }) => {
    await page.goto('/locations');
    await page.getByRole('button', { name: 'Edit Kigali Heights' }).click();
    const dlg = page.getByRole('dialog', { name: 'Edit Kigali Heights' });
    await dlg.getByLabel(/^Name/).fill('Kigali Heights Mall');
    await dlg.getByRole('button', { name: 'Save location' }).click();
    await expect(dlg.getByText('Saved')).toBeVisible();
    await dlg.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Delete Kigali Heights Mall' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete location' }).click();
    await expect(page.getByRole('heading', { name: 'Kigali Heights Mall' })).toHaveCount(0);
  });
});

test.describe('F13 counter phones', () => {
  test.beforeEach(async () => {
    const org = await seedOrg();
    await sql(`update scanner_devices set revoked_at = now() where org_id = $1 and label <> 'Front counter' and revoked_at is null`, [org!.id]);
    await sql(`delete from pairing_codes where org_id = $1`, [org!.id]);
  });

  test('F13-H1 pair a phone with a code; it can scan but not open the dashboard; revoke stops it @mobile', async ({ page, browser, checkA11y }) => {
    await page.goto('/settings/devices');
    await checkA11y('S19 counter phones');
    await page.getByRole('button', { name: 'Pair a phone' }).click();
    const dlg = page.getByRole('dialog', { name: 'Pair a phone' });
    await dlg.getByLabel('Name for this phone').fill('Back bar ☕');
    await dlg.getByRole('button', { name: 'Get pairing code' }).click();
    const code = (await dlg.getByText(/^[0-9A-Z]{6}$/).textContent())!.trim();

    const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await phone.newPage();
    await p.goto('http://localhost:3100/scan');
    await checkA11y('S27 pair', p);
    await p.getByLabel('Pairing code').fill(code.toLowerCase());
    await p.getByRole('button', { name: 'Pair this phone' }).click();
    await expect(p.getByText('Scanner · Back bar ☕')).toBeVisible();
    // stamp something
    const card = await newCard('Paired Pat');
    const camp = await coffeeCampaign();
    await sql('update campaigns set stamp_cooldown_minutes = 0, max_stamps_per_day = 0 where id = $1', [camp!.id]);
    await p.getByRole('button', { name: 'Type the code instead' }).click();
    await p.getByLabel('Card code').fill(card.manual_code);
    await p.getByRole('button', { name: 'Find card' }).click();
    await p.getByRole('button', { name: 'Add 1 stamp' }).click();
    await expect(p.getByRole('heading', { name: '1 stamp added' })).toBeVisible();
    const ev = await one<{ actor_label: string }>(`select actor_label from card_events where card_id = $1 and type = 'stamped'`, [card.id]);
    expect(ev!.actor_label).toBe('Back bar ☕');
    // a paired phone cannot open the dashboard
    await p.goto('http://localhost:3100/cards');
    await expect(p).toHaveURL(/\/login/);
    // the same code can't pair a second phone
    const thief = await browser.newContext();
    const t = await thief.newPage();
    await t.goto('http://localhost:3100/scan');
    await t.getByLabel('Pairing code').fill(code);
    await t.getByRole('button', { name: 'Pair this phone' }).click();
    await expect(t.getByRole('alert').filter({ hasText: 'That code didn’t work' })).toBeVisible();
    await thief.close();
    // revoke
    await page.reload();
    await page.getByRole('listitem').filter({ hasText: 'Back bar ☕' }).getByRole('button', { name: 'Remove' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Remove phone' }).click();
    await expect(page.getByText('Back bar ☕')).toHaveCount(0);
    await p.goto('http://localhost:3100/scan');
    await expect(p.getByRole('heading', { name: 'This phone needs pairing again' })).toBeVisible();
    await expect(p.getByText(/“Back bar ☕” was removed from Counter phones/)).toBeVisible();
    await phone.close();
  });

  test('F13-E1 pairing a second phone shows a new code, not the used one', async ({ page }) => {
    await page.goto('/settings/devices');
    await page.getByRole('button', { name: 'Pair a phone' }).click();
    let dlg = page.getByRole('dialog', { name: 'Pair a phone' });
    await dlg.getByLabel('Name for this phone').fill('Till one');
    await dlg.getByRole('button', { name: 'Get pairing code' }).click();
    const first = (await dlg.getByText(/^[0-9A-Z]{6}$/).textContent())!.trim();
    await dlg.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Pair a phone' }).click();
    dlg = page.getByRole('dialog', { name: 'Pair a phone' });
    await expect(dlg.getByLabel('Name for this phone'), `the dialog re-shows the first code ${first} instead of a form`).toBeVisible();
  });

  test('F13-E2 wrong or expired code is refused; 11th try in 10 minutes is rate limited', async ({ browser }) => {
    const org = await seedOrg();
    await sql(`insert into pairing_codes (code, org_id, label, expires_at) values ('OLD123', $1, 'Old', now() - interval '1 minute')`, [org!.id]);
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto('http://localhost:3100/scan');
    await p.getByLabel('Pairing code').fill('OLD123');
    await p.getByRole('button', { name: 'Pair this phone' }).click();
    await expect(p.getByRole('alert').filter({ hasText: 'That code didn’t work' })).toBeVisible();
    for (let i = 0; i < 10; i++) await p.request.post('http://localhost:3100/api/scan/pair', { data: { code: 'ZZZZZZ' } });
    const r = await p.request.post('http://localhost:3100/api/scan/pair', { data: { code: 'ZZZZZZ' } });
    expect((await r.json()).error).toMatch(/Too many tries/);
    await ctx.close();
  });

  test('F13-N1 a paired phone cannot read the customer list through the API', async ({ browser, page }) => {
    // device context only (no owner cookie)
    await page.goto('/settings/devices');
    await page.getByRole('button', { name: 'Pair a phone' }).click();
    const dlg = page.getByRole('dialog', { name: 'Pair a phone' });
    await dlg.getByLabel('Name for this phone').fill('API probe');
    await dlg.getByRole('button', { name: 'Get pairing code' }).click();
    const code = (await dlg.getByText(/^[0-9A-Z]{6}$/).textContent())!.trim();
    const ctx = await browser.newContext();
    const r = await ctx.request.post('http://localhost:3100/api/scan/pair', { data: { code } });
    expect(r.status()).toBe(200);
    const camp = await coffeeCampaign();
    const res = await ctx.request.get(`http://localhost:3100/cards/${camp!.id}/customers`, { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(res.status());
    await ctx.close();
  });
});

test.describe('F14 plan and billing (payments simulated in dev)', () => {
  test.afterEach(async () => {
    const org = await seedOrg();
    if (org) await sql(`update orgs set plan = 'growth', plan_status = 'trialing' where id = $1`, [org.id]);
  });

  test('F14-H1 choose a plan in dev mode switches it directly @mobile', async ({ page, checkA11y }) => {
    await page.goto('/settings/billing');
    await checkA11y('S21 billing');
    await expectNoHorizontalScroll(page);
    await expect(page.getByText('No payment provider configured')).toBeVisible();
    await expect(page.getByText(/RWF 35,000/)).toBeVisible();
    await page.getByRole('button', { name: 'Choose Pro' }).click();
    await expect(page.getByText(/Plan changed \(development mode/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Plan & billing' })).toBeVisible();
    await expect(page.getByText('You’re on Pro.')).toBeVisible();
    await expect(page.getByText(/left in your trial/)).toHaveCount(0);
  });

  test('F14-E1 locked account: banner says editing is paused, and editing is refused', async ({ page }) => {
    const org = await seedOrg();
    await sql(`update orgs set plan_status = 'locked' where id = $1`, [org!.id]);
    const camp = await coffeeCampaign();
    await page.goto(`/cards/${camp!.id}/messages`);
    await expect(page.getByText('Your account is locked')).toBeVisible();
    await expect(page.getByText('Editing is paused.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Message' }).fill('Sent while locked');
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Send now' }).click();
    await page.waitForLoadState('networkidle');
    const m = await one<{ n: number }>(`select count(*)::int as n from messages where body = 'Sent while locked'`);
    expect(m!.n, 'a locked account could still send a message to every customer').toBe(0);
  });

  test('F14-E2 downgrade below current usage is refused or explained', async ({ page }) => {
    await page.goto('/settings/billing');
    await page.getByRole('button', { name: 'Choose Starter' }).click();
    await expect(page.getByRole('main').getByRole('status').or(page.getByRole('main').getByRole('alert')).first()).toBeVisible();
    const o = await one<{ plan: string }>(`select plan from orgs where name = 'Café Neza'`);
    const designs = await one<{ n: number }>(`select count(*)::int as n from campaigns c join orgs o on o.id = c.org_id where o.name = 'Café Neza' and c.status <> 'archived'`);
    if (o!.plan === 'starter') {
      await page.goto('/cards');
      await expect(page.getByText(`${designs!.n} of 1 card design on your plan`)).toBeVisible();
      expect(designs!.n, 'downgraded to Starter (1 design) while using more designs, without any warning').toBeLessThanOrEqual(1);
    }
  });

  test('F14-N1 webhooks reject unsigned events', async ({ request }) => {
    const r = await request.post('/api/webhooks/paddle', { data: { event_type: 'subscription.updated' } });
    expect(r.status()).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
  });
});

test.describe('S20 settings', () => {
  test('F01-E11 settings: business name with emoji saves; invalid time zone refused', async ({ page, checkA11y }) => {
    await page.goto('/settings');
    await checkA11y('S20 settings');
    await page.getByLabel(/^Business name/).fill('Café Neza ☕ Kimihurura');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('main').getByText('Saved', { exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' }).getByText('Café Neza ☕ Kimihurura')).toBeVisible();
    await sql(`update orgs set name = 'Café Neza' where name = 'Café Neza ☕ Kimihurura'`);
  });

  test('F01-E12 delete account: the join page closes at once (cards keep working until the 7-day purge)', async ({ page, browser, loginAsOwner, guard }) => {
    // throwaway business with a live card
    const email = `qa-del-${Date.now()}@example.test`;
    const anon = await browser.newContext();
    const p = await anon.newPage();
    await p.goto('http://localhost:3100/signup');
    await p.getByLabel('Business name').fill('Closing Down');
    await p.getByLabel('Email').fill(email);
    await p.getByLabel('Password').fill('long-enough-1');
    await p.getByRole('button', { name: 'Create account' }).click();
    await expect(p).toHaveURL(/\/cards$/);
    await p.getByRole('button', { name: 'New card' }).first().click();
    await p.getByRole('dialog').getByLabel('Card name').fill('Closing card');
    await p.getByRole('dialog').getByRole('button', { name: 'Create and design' }).click();
    await p.getByRole('button', { name: 'Go live' }).click();
    await p.getByRole('alertdialog').getByRole('button', { name: 'Go live' }).click();
    await expect(p.getByText('Your card is live')).toBeVisible();
    const camp = await one<{ short_code: string }>(`select c.short_code from campaigns c join orgs o on o.id = c.org_id where o.name = 'Closing Down' order by c.created_at desc limit 1`);
    await p.goto('http://localhost:3100/settings');
    await p.getByRole('button', { name: 'Delete account' }).click();
    const dlg = p.getByRole('alertdialog', { name: 'Delete your account?' });
    await expect(dlg.getByRole('button', { name: 'Delete account' })).toBeDisabled();
    await dlg.getByRole('textbox').fill('Closing Down');
    await dlg.getByRole('button', { name: 'Delete account' }).click();
    await expect(p).toHaveURL(/\/login\?deleted=1/);
    await anon.close();
    void loginAsOwner;
    // B-012: joining closes immediately; the expected 404 is not a console bug
    guard.allowConsole(/status of 404/);
    await page.goto(`/j/${camp!.short_code}`);
    await expect(page.getByRole('button', { name: 'Get my card' }), 'join form still open for a business scheduled for deletion').toHaveCount(0);
  });
});

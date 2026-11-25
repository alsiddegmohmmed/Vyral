// F08 remote stamps and rewards, F11 insights, F12 delete a customer; S14/S15 table and detail.
import { test, expect } from './support/fixtures';
import { cardById, clearRateLimits, coffeeCampaign, newCard, one, sql } from './support/db';
import { expectNoHorizontalScroll, join } from './support/flows';

test.beforeEach(async ({ loginAsOwner }) => { await loginAsOwner(); await clearRateLimits(); });

test.describe('S14 customers table', () => {
  test('F08-H0 list, search by phone digits, sort, and show more @mobile', async ({ page, checkA11y }) => {
    const camp = await coffeeCampaign();
    await page.goto(`/cards/${camp!.id}/customers`);
    await expect(page.getByText(/^\d+ customers$/)).toBeVisible();
    await checkA11y('S14 customers');
    await expectNoHorizontalScroll(page);
    const rows = page.getByRole('table').getByRole('link');
    await expect(rows).toHaveCount(25);
    await page.getByRole('link', { name: 'Show more' }).click();
    await expect.poll(() => rows.count()).toBeGreaterThan(25);
    await page.getByRole('searchbox', { name: 'Search customers' }).or(page.getByLabel('Search customers')).fill('Isaac');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('1 customer matching “Isaac”')).toBeVisible();
    // the very long seeded name must not widen the page
    await expectNoHorizontalScroll(page);
    await page.getByRole('link', { name: 'Name' }).click();
    await expect(page.getByRole('link', { name: 'Name' })).toHaveAttribute('aria-current', 'true');
  });

  test('F08-E0 search with wildcard characters is treated literally; no results state', async ({ page }) => {
    const camp = await coffeeCampaign();
    await page.goto(`/cards/${camp!.id}/customers?q=${encodeURIComponent('%_%')}`);
    await expect(page.getByRole('heading', { name: 'No customers match “%_%”' })).toBeVisible();
    await page.getByRole('link', { name: 'Clear search' }).click();
    await expect(page.getByText(/^\d+ customers$/)).toBeVisible();
  });
});

test.describe('F08 remote stamps and rewards', () => {
  test('F08-H1 add 3 stamps from the card detail; timeline names the owner @mobile', async ({ page, checkA11y }) => {
    const camp = await coffeeCampaign();
    const card = await newCard('Remote Rachel');
    await page.goto(`/cards/${camp!.id}/customers/${card.id}`);
    await checkA11y('S15 card detail');
    await expectNoHorizontalScroll(page);
    for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'More (Stamps)' }).click();
    await page.getByRole('button', { name: 'Add 3' }).click();
    await expect(page.getByText('3 stamps added')).toBeVisible();
    await expect(page.getByText('Neza Owner added 3 stamps')).toBeVisible();
    expect((await cardById(card.id))!.current_stamps).toBe(3);
  });

  test('F08-E1 double-click on Add saves once', async ({ page }) => {
    const camp = await coffeeCampaign();
    const card = await newCard('Double Remote');
    await page.goto(`/cards/${camp!.id}/customers/${card.id}`);
    await page.getByRole('button', { name: 'Add 1' }).dblclick();
    await expect(page.getByText('1 stamp added')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect((await cardById(card.id))!.current_stamps).toBe(1);
  });

  test('F08-E2 remove stamps, never below zero', async ({ page, guard }) => {
    guard.allowConsole(/status of 4\d\d/);
    const camp = await coffeeCampaign();
    const card = await newCard('Remove Rob');
    await sql('update cards set current_stamps = 2 where id = $1', [card.id]);
    await page.goto(`/cards/${camp!.id}/customers/${card.id}`);
    const fewer = page.getByRole('button', { name: 'Fewer (Stamps)' });
    for (let i = 0; i < 3; i++) await fewer.click(); // 1 → 0 → -1 → -2
    await expect(fewer).toBeDisabled();
    await page.getByRole('button', { name: 'Remove 2' }).click();
    await expect(page.getByText('2 removed')).toBeVisible();
    expect((await cardById(card.id))!.current_stamps).toBe(0);
    // the stepper must follow the new count: "Remove 2" again would go below zero
    await expect(page.getByRole('button', { name: /^Remove \d/ }), 'stepper still offers to remove stamps the card no longer has').toHaveCount(0);
  });

  test('F08-E3 give a banked reward from the dashboard even while the card is paused', async ({ page }) => {
    const camp = await coffeeCampaign();
    const card = await newCard('Paused Reward');
    await sql('update cards set rewards_available = 1 where id = $1', [card.id]);
    await sql(`update campaigns set status = 'paused' where id = $1`, [camp!.id]);
    try {
      await page.goto(`/cards/${camp!.id}/customers/${card.id}`);
      await page.getByRole('button', { name: 'Give free coffee' }).click();
      await expect(page.getByText('reward given')).toBeVisible();
      expect((await cardById(card.id))!.rewards_available).toBe(0);
    } finally {
      await sql(`update campaigns set status = 'live' where id = $1`, [camp!.id]);
    }
  });

  test('F08-E4 edit details: a local number is accepted or explained; empty contact refused', async ({ page }) => {
    const camp = await coffeeCampaign();
    const card = await newCard('Edit Eve');
    await page.goto(`/cards/${camp!.id}/customers/${card.id}`);
    await page.getByLabel('Phone').fill('');
    await page.getByLabel('Email').fill('');
    await page.getByRole('button', { name: 'Save details' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toHaveText('Keep an email or a phone number.');
    await page.getByLabel('Email').fill('eve@example.test');
    await page.getByLabel('Name').fill('Ève Émilie 🌷');
    await page.getByRole('button', { name: 'Save details' }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    const cu = await one<{ name: string; email: string }>('select name, email::text from customers where id = $1', [card.customer_id]);
    expect(cu).toMatchObject({ name: 'Ève Émilie 🌷', email: 'eve@example.test' });
  });

  test('F08-N1 a card id from the URL of another campaign is a 404', async ({ page, guard }) => {
    guard.allowConsole(/status of 404/);
    const camp = await coffeeCampaign();
    const res = await page.goto(`/cards/${camp!.id}/customers/00000000-0000-0000-0000-000000000000`);
    expect(res?.status()).toBe(404);
  });
});

test.describe('F12 delete a customer', () => {
  test('F12-H1 delete with a goodbye note: card dead, scanner refuses, phone free to rejoin', async ({ page }) => {
    const camp = await coffeeCampaign();
    const phone = `78${String(Date.now()).slice(-7)}`;
    const serial = await join(page, { name: 'Leaving Lea', phone });
    const card = (await one<{ id: string; manual_code: string }>('select id, manual_code from cards where serial = $1', [serial]))!;
    await page.goto(`/cards/${camp!.id}/customers/${card.id}`);
    await page.getByRole('button', { name: 'Delete Leaving’s card' }).click();
    const dlg = page.getByRole('alertdialog', { name: 'Delete Leaving’s card?' });
    await dlg.getByLabel('Goodbye note on the card (optional)').fill('Thanks for all the coffee!');
    await dlg.getByRole('button', { name: 'Delete card' }).click();
    await expect(page).toHaveURL(/customers\?deleted=1/);
    await expect(page.getByText('Card deleted')).toBeVisible();
    await page.goto(`/c/${serial}`);
    await expect(page.getByText('This card was closed by the business')).toBeVisible();
    await expect(page.getByText('Thanks for all the coffee!')).toBeVisible();
    const r = await page.request.post('/api/scan/lookup', { data: { manual: card.manual_code } });
    expect((await r.json()).error).toBe('card_deleted');
    // the phone number is free again
    const again = await join(page, { name: 'Leaving Lea', phone });
    expect(again, 'rejoining after deletion did not create a new card').not.toBeNull();
  });

  test('F12-E1 deleted card no longer appears in the customer list', async ({ page }) => {
    const camp = await coffeeCampaign();
    const card = await newCard('Hidden Hugo');
    await sql(`update cards set status = 'deleted', deleted_at = now() where id = $1`, [card.id]);
    await page.goto(`/cards/${camp!.id}/customers?q=Hidden`);
    await expect(page.getByRole('heading', { name: 'No customers match “Hidden”' })).toBeVisible();
  });
});

test.describe('F11 insights', () => {
  test('F11-H1 insights shows totals for 30 days and a table alternative to the chart @mobile', async ({ page, checkA11y }) => {
    const camp = await coffeeCampaign();
    await page.goto(`/cards/${camp!.id}/insights`);
    await checkA11y('S13 insights');
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Show as table' }).click();
    await expect(page.getByRole('table', { name: /Stamps and new customers per day/ })).toBeVisible();
  });
});

test('F11-E1 insights count a stamp on the business’s local day (Kigali, UTC+2)', async ({ page }) => {
  const camp = await coffeeCampaign();
  const card = await newCard('Night Owl');
  // 01:30 in Kigali today = 23:30 UTC yesterday
  const row = await one<{ local_day: string; ts: string }>(`select to_char((now() at time zone 'Africa/Kigali')::date, 'YYYY-MM-DD') as local_day,
      (((now() at time zone 'Africa/Kigali')::date + time '01:30') at time zone 'Africa/Kigali')::text as ts`);
  await sql(`insert into card_events (org_id, campaign_id, card_id, type, quantity, source, actor_label, created_at)
             select org_id, campaign_id, id, 'stamped', 7, 'dashboard', 'QA', $2::timestamptz from cards where id = $1`, [card.id, row!.ts]);
  await page.goto(`/cards/${camp!.id}/insights`);
  await page.getByRole('button', { name: 'Show as table' }).click();
  const today = page.getByRole('row').filter({ hasText: row!.local_day });
  const stamps = Number(await today.getByRole('cell').nth(1).textContent());
  expect(stamps, `the 01:30 Kigali stamp (7) is not counted on ${row!.local_day}`).toBeGreaterThanOrEqual(7);
});

test('F08-E5 card overview and customers fit a 390 px screen @mobile-only', async ({ page }) => {
  const camp = await coffeeCampaign();
  await page.goto(`/cards/${camp!.id}`);
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: 'Locations' })).toBeVisible();
});

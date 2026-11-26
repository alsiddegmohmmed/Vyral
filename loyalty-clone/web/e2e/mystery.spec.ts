// Mystery box rewards (migration 0008): a full card draws one prize, server-side.
import { test, expect } from './support/fixtures';
import { newCard, one, seedOrg, sql } from './support/db';

const PRIZES = ['Free coffee', 'Free pastry', 'Free lunch'];

test.beforeEach(async ({ loginAsOwner }) => {
  await loginAsOwner();
  // keep the café at 2 designs so a third fits the Growth plan
  const org = await seedOrg();
  await sql(`delete from campaigns where org_id = $1 and short_code not in ('neza1cup','neza2pas')`, [org!.id]);
});

test('M-H1 set up a mystery box, a full card draws a prize, the customer opens it, staff hand it over', async ({ page, checkA11y }) => {
  // 1. owner: the wizard's reward step switches to a mystery box with three prizes
  await page.goto('/cards/new');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Café' }).click();
  await page.getByLabel('Card name').fill('Box card');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.locator('label', { has: page.getByRole('radio', { name: 'Mystery box' }) }).click();
  await expect(page.getByLabel('Prize 1', { exact: true })).toHaveValue('Free coffee');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled(); // prizes 2 and 3 still need names
  await page.getByLabel('Prize 2', { exact: true }).fill('Free pastry');
  await page.getByLabel('Prize 3', { exact: true }).fill('Free lunch');
  await page.getByRole('button', { name: 'Try a box' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'This box gave:' })).toBeVisible();
  await checkA11y('wizard: mystery box');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  const where = page.getByRole('heading', { name: 'Where can customers use it?' });
  const review = page.getByRole('heading', { name: 'Ready to go?' });
  await expect(where.or(review)).toBeVisible();
  if (await where.isVisible()) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText(/Mystery box of 3 prizes after 10 stamps/)).toBeVisible();
  await page.getByRole('button', { name: 'Create and go live' }).click();
  await expect(page.getByText('Your card is live')).toBeVisible();

  const camp = await one<{ id: string; org_id: string; short_code: string; reward_mode: string; n: number }>(
    `select c.id, c.org_id, c.short_code, c.reward_mode, (select count(*)::int from reward_prizes p where p.campaign_id = c.id) as n from campaigns c where c.name = 'Box card'`);
  expect(camp).toMatchObject({ reward_mode: 'mystery', n: 3 });
  await page.goto(`/j/${camp!.short_code}`);
  await expect(page.getByRole('heading', { name: '10 stamps, then a mystery box on us' })).toBeVisible();

  // 2. a customer fills the card: the box is drawn inside the stamp transaction
  const card = await newCard('Box Tester', camp!.short_code);
  await sql(`select apply_card_transaction($1, $2, 10, 0, 'dashboard', null, 'QA', $3)`, [camp!.org_id, card.id, `mystery-${card.id}`]);
  const won = await one<{ prize_name: string; tier: string }>('select prize_name, tier from card_prizes where card_id = $1', [card.id]);
  expect(PRIZES).toContain(won!.prize_name);
  // replaying the same scan never draws again
  await sql(`select apply_card_transaction($1, $2, 10, 0, 'dashboard', null, 'QA', $3)`, [camp!.org_id, card.id, `mystery-${card.id}`]);
  expect((await one<{ n: number }>('select count(*)::int as n from card_prizes where card_id = $1', [card.id]))!.n).toBe(1);

  // 2b. staff can't hand it over before the customer has opened it (the surprise stays theirs)
  await page.goto('/scan');
  await page.getByRole('button', { name: 'Type the code instead' }).click();
  await page.getByLabel('Card code').fill(card.manual_code);
  await page.getByRole('button', { name: 'Find card' }).click();
  await expect(page.getByText(/has a mystery box to open/)).toBeVisible();
  await expect(page.getByRole('button', { name: `Give ${won!.prize_name}` })).toHaveCount(0);
  await expect(page.getByText(won!.prize_name)).toHaveCount(0);
  await checkA11y('scanner: mystery box not opened yet');

  // 3. the customer opens it on the web card
  await page.goto(`/c/${card.serial}`);
  await expect(page.getByRole('heading', { name: 'You have a mystery box' })).toBeVisible();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /^Open your mystery box/ }).click(); // three taps open it
  await expect(page.getByRole('status').filter({ hasText: won!.prize_name })).toBeVisible();
  await checkA11y('web card: mystery box opened');

  // 4. staff see exactly which prize to give, and hand it over
  await page.goto('/scan');
  await page.getByRole('button', { name: 'Type the code instead' }).click();
  await page.getByLabel('Card code').fill(card.manual_code);
  await page.getByRole('button', { name: 'Find card' }).click();
  await page.getByRole('button', { name: `Give ${won!.prize_name}` }).click();
  await page.getByRole('button', { name: 'Give reward' }).click();
  await expect(page.getByRole('heading', { name: 'Reward given' })).toBeVisible();
  await expect(page.getByText(`Hand over: ${won!.prize_name}.`)).toBeVisible();
  const done = await one<{ redeemed: boolean }>('select redeemed_at is not null as redeemed from card_prizes where card_id = $1', [card.id]);
  expect(done!.redeemed).toBe(true);
});

test('M-N1 the draw follows the chances (database)', async () => {
  const org = await seedOrg();
  const camp = await one<{ id: string }>(`select id from campaigns where org_id = $1 and short_code = 'neza2pas'`, [org!.id]);
  // inside a rolled-back transaction-like scope: set prizes, draw 3000 times, restore
  const before = await sql<{ name: string; weight: number; tier: string }>('select name, weight, tier from reward_prizes where campaign_id = $1 order by position', [camp!.id]);
  await sql('select replace_reward_prizes($1, $2)', [camp!.id, JSON.stringify([{ name: 'A', weight: 70, tier: 'common' }, { name: 'B', weight: 25, tier: 'rare' }, { name: 'C', weight: 5, tier: 'legendary' }])]);
  try {
    const rows = await sql<{ n: string; c: number }>(`select p->>'name' as n, count(*)::int as c from (select draw_prize($1) p from generate_series(1, 3000)) x group by 1`, [camp!.id]);
    const share = Object.fromEntries(rows.map((r) => [r.n, r.c / 3000]));
    expect(share.A).toBeGreaterThan(0.64); expect(share.A).toBeLessThan(0.76);
    expect(share.B).toBeGreaterThan(0.2); expect(share.B).toBeLessThan(0.3);
    expect(share.C).toBeGreaterThan(0.02); expect(share.C).toBeLessThan(0.08);
  } finally {
    await sql('select replace_reward_prizes($1, $2)', [camp!.id, JSON.stringify(before)]);
  }
});

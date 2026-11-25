// New-card wizard (/cards/new): one question per screen, a live card beside it.
import { test, expect } from './support/fixtures';
import { one, seedOrg, sql } from './support/db';
import { expectNoHorizontalScroll } from './support/flows';

test.beforeEach(async ({ loginAsOwner }) => {
  await loginAsOwner();
  // keep the café at 2 designs so a third fits the Growth plan
  const org = await seedOrg();
  await sql(`delete from campaigns where org_id = $1 and short_code not in ('neza1cup','neza2pas')`, [org!.id]);
});

test('W-H1 a barber card: the type fills in sensible defaults, every answer shows on the card, go live in one go @mobile', async ({ page, checkA11y }) => {
  await page.goto('/cards');
  await page.getByRole('link', { name: 'New card' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'What kind of business is it?' })).toBeVisible();
  await expect(page.getByText('step 1 of 5')).toBeVisible();
  await checkA11y('wizard: type');
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Barber' }).click();

  // the type pre-filled the name, and the preview follows
  await expect(page.getByLabel('Card name')).toHaveValue('Barber card');
  await page.getByLabel('Card name').fill('Fade club');
  // radios are visually hidden inside their swatch, so pick the swatch like a person would
  const pick = (name: string) => page.locator('label', { has: page.getByRole('radio', { name, exact: true }) }).click();
  await pick('Ocean');
  await expect(page.getByRole('radio', { name: 'Ocean' })).toBeChecked();
  await checkA11y('wizard: look');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  await expect(page.getByRole('radio', { name: '6', exact: true })).toBeChecked();
  await expect(page.getByLabel(/^Reward/)).toHaveValue('Free cut');
  await pick('8');
  await page.getByLabel(/^Reward/).fill('Free haircut');
  await expect(page.getByRole('complementary', { name: 'Card preview' })).toContainText('Free haircut');
  await expect(page.getByRole('complementary', { name: 'Card preview' })).toContainText(/\/8/);
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Where can customers use it?' })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ready to go?' })).toBeVisible();
  await expect(page.getByText('Free haircut after 8 stamps')).toBeVisible();
  await checkA11y('wizard: review');
  await page.getByRole('button', { name: 'Create and go live' }).click();

  await expect(page).toHaveURL(/\/cards\/[0-9a-f-]{36}\?live=1$/);
  await expect(page.getByText('Your card is live')).toBeVisible();
  const c = await one<{ status: string; total_stamps: number; stamp_icon: string; background_color: string; reward: string; locs: number }>(
    `select c.status, c.total_stamps, c.stamp_icon, c.background_color, r.name as reward,
            (select count(*)::int from campaign_locations cl where cl.campaign_id = c.id) as locs
       from campaigns c join rewards r on r.campaign_id = c.id and r.position = 1 where c.name = 'Fade club'`);
  // every location was ticked by default; other specs add and remove locations, so count them now
  const org = await seedOrg();
  const all = await one<{ n: number }>('select count(*)::int as n from locations where org_id = $1', [org!.id]);
  expect(c).toMatchObject({ status: 'live', total_stamps: 8, stamp_icon: 'scissors', background_color: '#0E4F68', reward: 'Free haircut', locs: all!.n });
});

test('W-H2 tap the preview card to add a stamp; it stops filling by itself', async ({ page }) => {
  await page.goto('/cards/new');
  await page.getByRole('button', { name: 'Café' }).click();
  const tap = page.getByRole('button', { name: 'Add a stamp', exact: true });
  await tap.click();
  await expect(page.getByRole('button', { name: 'Play filling' })).toBeVisible();
  const count = page.getByRole('complementary', { name: 'Card preview' }).getByText(/^\d+\/10$/).first();
  const before = Number((await count.textContent())!.split('/')[0]);
  await tap.click();
  await expect(count).toHaveText(`${(before + 1) % 11}/10`);
});

test('W-E1 answers survive a reload, and an empty reward blocks Next', async ({ page }) => {
  await page.goto('/cards/new');
  await page.getByRole('button', { name: 'Bakery' }).click();
  await page.getByLabel('Card name').fill('Croissant club');
  await page.reload();
  await expect(page.getByLabel('Card name')).toHaveValue('Croissant club');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByLabel(/^Reward/).fill('');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'How should the card look?' })).toBeFocused();
});

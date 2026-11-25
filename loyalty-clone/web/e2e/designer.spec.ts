// F02 design and publish a card, F03 edit a live card and push the update.
import { test, expect } from './support/fixtures';
import { coffeeCampaign, one, seedOrg, sql } from './support/db';
import type { Page } from '@playwright/test';

async function createCard(page: Page, name: string) {
  await page.goto('/cards');
  await page.getByRole('button', { name: 'New card' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New card' });
  await dialog.getByLabel('Card name').fill(name);
  await dialog.getByRole('button', { name: 'Create and design' }).click();
  await expect(page).toHaveURL(/\/cards\/[0-9a-f-]{36}\/design$/);
  return /\/cards\/([0-9a-f-]{36})\//.exec(page.url())![1];
}

test.describe('F02 design and publish a card', () => {
  test.beforeEach(async ({ loginAsOwner }) => {
    await loginAsOwner();
    // keep the café at 2 designs so a third one fits the Growth plan
    const org = await seedOrg();
    await sql(`delete from campaigns where org_id = $1 and short_code not in ('neza1cup','neza2pas')`, [org!.id]);
  });

  test('F02-H1 new card → design → save → go live → overview with QR', async ({ page, checkA11y }) => {
    const id = await createCard(page, 'Smoothie card');
    await checkA11y('S04 designer: design tab');
    await page.getByLabel('Name on the card').fill('Neza Smoothies');
    await page.getByRole('radio', { name: 'flower' }).click();
    await page.getByRole('button', { name: 'More (Stamps for a reward)' }).click();
    await page.getByRole('tab', { name: 'Details' }).click();
    await checkA11y('S05 designer: details tab');
    await page.getByLabel(/^Reward/).first().fill('Free smoothie');
    await page.getByRole('tab', { name: /Signup form/ }).click();
    await checkA11y('S08 designer: signup form tab');
    await page.getByRole('tab', { name: 'Locations' }).click();
    await checkA11y('S06 designer: locations tab');
    await page.getByRole('tab', { name: 'Terms & limits' }).click();
    await checkA11y('S07 designer: terms tab');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved.', { exact: true })).toBeVisible();
    // after a successful save the card can go live without another edit
    await expect(page.getByRole('button', { name: 'Go live' }), 'Go live stays disabled after saving').toBeEnabled();
    await page.getByRole('button', { name: 'Go live' }).click();
    const confirm = page.getByRole('alertdialog', { name: /Make “Smoothie card” live\?/ });
    await expect(confirm).toContainText('the number of stamps (11)');
    await checkA11y('S11 activate dialog');
    await confirm.getByRole('button', { name: 'Go live' }).click();
    await expect(page).toHaveURL(new RegExp(`/cards/${id}\\?live=1`));
    await expect(page.getByText('Your card is live')).toBeVisible();
    await expect(page.getByRole('img', { name: 'QR code to join Smoothie card' })).toBeVisible();
    await checkA11y('S12 overview');
    const c = await one<{ status: string; total_stamps: number; program_name: string; short_code: string }>('select status, total_stamps, program_name, short_code from campaigns where id = $1', [id]);
    expect(c).toMatchObject({ status: 'live', total_stamps: 11, program_name: 'Neza Smoothies' });
    await page.goto(`/j/${c!.short_code}`);
    await expect(page.getByRole('heading', { name: '11 stamps, then free smoothie on us' })).toBeVisible();
  });

  test('F02-H2 a new card with the default settings goes live without editing', async ({ page }) => {
    const id = await createCard(page, 'Default card');
    await page.getByRole('button', { name: 'Go live' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Go live' }).click();
    await expect(page).toHaveURL(new RegExp(`/cards/${id}\\?live=1`));
    await expect(page.getByText('Your card is live')).toBeVisible();
  });

  test('F02-E1 a card name already used (any case) is refused', async ({ page }) => {
    await page.goto('/cards');
    await page.getByRole('button', { name: 'New card' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'New card' });
    await dialog.getByLabel('Card name').fill('COFFEE CARD');
    await dialog.getByRole('button', { name: 'Create and design' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('You already have a card with this name.');
  });

  test('F02-E2 plan limit: at 3 of 3 designs, New card becomes Upgrade', async ({ page }) => {
    await createCard(page, 'Third card');
    await page.goto('/cards');
    await expect(page.getByText('3 of 3 card designs on your plan')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New card' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Upgrade for more cards' })).toBeVisible();
  });

  test('F02-E3 removing every required contact field blocks going live and warns', async ({ page }) => {
    await createCard(page, 'No contact card');
    await page.getByRole('tab', { name: /Signup form/ }).click();
    await page.getByRole('button', { name: 'Remove Phone' }).click();
    await expect(page.getByText('Keep email or phone required')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Signup form.*has errors/ })).toBeVisible();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toHaveText(/Keep email or phone as a required field/);
  });

  test('F02-E4 very long texts are capped by the inputs (60-character card name)', async ({ page }) => {
    await createCard(page, 'Long name card');
    const long = 'Ñ'.repeat(80);
    await page.getByLabel('Card name').fill(long);
    await expect(page.getByLabel('Card name')).toHaveValue('Ñ'.repeat(60));
  });

  test('F02-E5 link label over 40 characters gives a specific error, not a generic one', async ({ page }) => {
    await createCard(page, 'Link card');
    await page.getByRole('tab', { name: 'Details' }).click();
    await page.getByRole('button', { name: 'Add a link' }).click();
    await page.getByLabel('Label').fill('Order your favourite drinks on WhatsApp today please');
    await page.getByLabel('Link or number').fill('https://example.test');
    await page.getByRole('button', { name: 'Save changes' }).click();
    const err = page.getByRole('main').getByRole('alert');
    await expect(err).toBeVisible();
    await expect(err, 'the error does not say which value is wrong').toHaveText(/label|link|40/i);
  });

  test('F02-N1 draft card has no customers, messages or insights tabs', async ({ page }) => {
    await createCard(page, 'Draft tabs');
    const nav = page.getByRole('navigation', { name: 'Card sections' });
    await expect(nav.getByRole('link', { name: 'Design' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Customers' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Overview' })).toHaveCount(0);
  });
});

test.describe('F03 edit a live card', () => {
  test.beforeEach(async ({ loginAsOwner }) => {
    await loginAsOwner();
    const camp = await coffeeCampaign();
    await sql(`update campaigns set last_pushed_at = null, status = 'live' where id = $1`, [camp!.id]);
  });

  test('F03-H1 stamp count and expiry are locked on a live card', async ({ page }) => {
    const camp = await coffeeCampaign();
    await page.goto(`/cards/${camp!.id}/design`);
    await expect(page.getByText('This card is live')).toBeVisible();
    await expect(page.getByRole('button', { name: 'More (Stamps for a reward)' })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Details' }).click();
    await page.getByRole('radio', { name: 'After N days' }).click();
    await expect(page.getByRole('radio', { name: 'Never' })).toBeChecked();
    await expect(page.getByRole('button', { name: 'Saved' })).toBeDisabled();
  });

  test('F03-H2 text change on a live card saves with a success message', async ({ page }) => {
    const camp = await coffeeCampaign();
    await page.goto(`/cards/${camp!.id}/design`);
    await page.getByLabel('Name on the card').fill('Café Neza ☕');
    await page.getByRole('button', { name: 'Save changes' }).click();
    const outcome = page.getByText(/Saved\. Use “Update all cards”/).or(page.getByRole('main').getByRole('alert'));
    await expect(outcome).toBeVisible();
    const c = await one<{ program_name: string; total_stamps: number; expiry_mode: string }>('select program_name, total_stamps, expiry_mode from campaigns where id = $1', [camp!.id]);
    await sql(`update campaigns set program_name = 'Café Neza' where id = $1`, [camp!.id]);
    expect(c).toMatchObject({ program_name: 'Café Neza ☕', total_stamps: 10, expiry_mode: 'never' });
    await expect(page.getByRole('main').getByRole('alert'), 'save showed an error').toHaveCount(0);
  });

  test('F03-H3 signup form change (add an Email field) is saved', async ({ page }) => {
    const camp = await coffeeCampaign();
    try {
      await page.goto(`/cards/${camp!.id}/design`);
      await page.getByRole('tab', { name: /Signup form/ }).click();
      await page.getByLabel('Add a field').selectOption('email');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByText(/Saved\./).or(page.getByRole('main').getByRole('alert'))).toBeVisible();
      const f = await one<{ n: number }>(`select count(*)::int as n from campaign_fields where campaign_id = $1 and type = 'email'`, [camp!.id]);
      expect(f!.n, 'email field was not stored').toBe(1);
    } finally {
      // restore the shared seed: an extra field on the live Coffee card changes the join
      // form for every later test (it broke F04-E10's tab order in full runs)
      await sql(`delete from campaign_fields where campaign_id = $1 and type = 'email'`, [camp!.id]);
    }
  });

  test('F03-H4 Update all cards works once, then the 10-minute cooldown applies', async ({ page }) => {
    const camp = await coffeeCampaign();
    await page.goto(`/cards/${camp!.id}`);
    await page.getByRole('button', { name: 'Update all cards' }).click();
    await expect(page.getByText(/Updating \d+ cards\./)).toBeVisible();
    await page.getByRole('button', { name: 'Update all cards' }).click();
    await expect(page.getByText('You can update all cards once every 10 minutes.')).toBeVisible();
  });

  test('F03-E1 pause and resume from the overview', async ({ page }) => {
    const camp = await coffeeCampaign();
    await page.goto(`/cards/${camp!.id}`);
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.getByRole('alertdialog', { name: 'Pause this card?' }).getByRole('button', { name: 'Pause card' }).click();
    await expect(page.getByText('This card is paused')).toBeVisible();
    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(page.getByText('Live again.')).toBeVisible();
    expect((await coffeeCampaign())!.status).toBe('live');
  });

  test('F03-E2 two tabs: a stale designer tab does not silently undo a newer save', async ({ page, context }) => {
    const camp = await coffeeCampaign();
    const other = await context.newPage();
    await page.goto(`/cards/${camp!.id}/design`);
    await other.goto(`/cards/${camp!.id}/design`);
    await other.getByLabel('Name on the card').fill('Name from tab B');
    await other.getByRole('button', { name: 'Save changes' }).click();
    await expect(other.getByText(/Saved\./)).toBeVisible();
    // tab A, opened before B saved, changes only the logo text
    await page.getByLabel('Logo text').fill('neza');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText(/Saved\./)).toBeVisible();
    const c = await one<{ program_name: string }>('select program_name from campaigns where id = $1', [camp!.id]);
    await sql(`update campaigns set program_name = 'Café Neza', logo_text = 'café neza' where id = $1`, [camp!.id]);
    expect(c!.program_name, 'tab A overwrote tab B’s newer name without warning').toBe('Name from tab B');
  });
});

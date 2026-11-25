// F09 message everyone; F15 birthday and F16 win-back automations (S17, S35).
import { test, expect } from './support/fixtures';
import { coffeeCampaign, newCard, one, sql } from './support/db';
import { expectNoHorizontalScroll } from './support/flows';

test.beforeEach(async ({ loginAsOwner }) => { await loginAsOwner(); });

test.describe('F09 message everyone', () => {
  test('F09-H1 send a message: confirm, history, web card news @mobile', async ({ page, checkA11y }) => {
    const camp = await coffeeCampaign();
    const card = await newCard('News Reader');
    const reach = await one<{ wallet: number }>(`select count(*) filter (where apple_installed or google_saved)::int as wallet from cards where campaign_id = $1 and status = 'active'`, [camp!.id]);
    await page.goto(`/cards/${camp!.id}/messages`);
    await checkA11y('S17 messages');
    await expectNoHorizontalScroll(page);
    const text = `Fresh mandazi today ${Date.now() % 10000} 🍩`;
    await page.getByRole('textbox', { name: 'Message' }).fill(text);
    await page.getByRole('button', { name: 'Send' }).click();
    const dlg = page.getByRole('alertdialog', { name: 'Send this message?' });
    await expect(dlg).toContainText(text);
    await checkA11y('S17 send confirm');
    await dlg.getByRole('button', { name: 'Send now' }).click();
    await expect(page.getByText(/Also showing on \d+ web cards/)).toBeVisible();
    // the success line must report the reach the page promised, not 0
    await expect(page.getByText(new RegExp(`Sending to ${reach!.wallet} wallet passes`)), 'success banner must report the promised reach, not 0').toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: text })).toBeVisible();
    await page.goto(`/c/${card.serial}`);
    await expect(page.getByText(text)).toBeVisible();
  });

  test('F09-E1 empty or whitespace-only message cannot be sent', async ({ page }) => {
    const camp = await coffeeCampaign();
    await page.goto(`/cards/${camp!.id}/messages`);
    await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();
    await page.getByRole('textbox', { name: 'Message' }).fill('    ');
    await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  test('F09-E2 over 300 characters: counter turns red and Send is disabled', async ({ page }) => {
    const camp = await coffeeCampaign();
    await page.goto(`/cards/${camp!.id}/messages`);
    await page.getByRole('textbox', { name: 'Message' }).fill('é'.repeat(301));
    await expect(page.getByText('301 / 300')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();
    await page.getByRole('textbox', { name: 'Message' }).fill('é'.repeat(300));
    await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  test('F09-E3 card paused in another tab: send fails and the typed message is kept', async ({ page }) => {
    const camp = await coffeeCampaign();
    await page.goto(`/cards/${camp!.id}/messages`);
    const text = 'Typed carefully, do not lose me';
    await page.getByRole('textbox', { name: 'Message' }).fill(text);
    await sql(`update campaigns set status = 'paused' where id = $1`, [camp!.id]);
    try {
      await page.getByRole('button', { name: 'Send' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Send now' }).click();
      await expect(page.getByRole('main').getByRole('alert')).toHaveText(/Activate the card/);
      await expect(page.getByRole('textbox', { name: 'Message' }), 'message text was cleared although nothing was sent').toHaveValue(text);
    } finally {
      await sql(`update campaigns set status = 'live' where id = $1`, [camp!.id]);
    }
  });

  test('F09-E4 emoji and accents arrive intact on the web card', async ({ page }) => {
    const camp = await coffeeCampaign();
    const card = await newCard('Emoji Eli');
    await page.goto(`/cards/${camp!.id}/messages`);
    const text = 'Amakuru! Café au lait ☕️ 🇷🇼 — très bon';
    await page.getByRole('textbox', { name: 'Message' }).fill(text);
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Send now' }).click();
    await expect(page.getByText(/Also showing on \d+ web cards/)).toBeVisible();
    const m = await one<{ body: string }>(`select body from messages where campaign_id = $1 order by created_at desc limit 1`, [camp!.id]);
    expect(m!.body).toBe(text);
    await page.goto(`/c/${card.serial}`);
    await expect(page.getByText(text)).toBeVisible();
  });
});

test.describe('F15/F16 automations', () => {
  test('F15-H1 birthday automation: turn off and on, message saved @mobile', async ({ page, checkA11y }) => {
    const camp = await coffeeCampaign();
    await page.goto(`/cards/${camp!.id}/automations`);
    await checkA11y('S35 automations');
    await expectNoHorizontalScroll(page);
    const bday = page.getByRole('region', { name: 'Birthday message' });
    await bday.getByRole('switch').click();
    await expect(bday.getByText('Saved. It’s off.')).toBeVisible();
    await bday.getByRole('switch').click();
    await expect(bday.getByText('Saved. It’s on.')).toBeVisible();
    await bday.getByRole('textbox', { name: 'Message' }).fill('Isabukuru nziza {name}! 🎂');
    await bday.getByRole('button', { name: 'Save message' }).click();
    await expect.poll(async () => (await one<{ body: string; enabled: boolean }>(`select body, enabled from automations where campaign_id = $1 and kind = 'birthday'`, [camp!.id])))
      .toMatchObject({ body: 'Isabukuru nziza {name}! 🎂', enabled: true });
    await expect(bday.getByText('Saved. It’s on.')).toBeVisible();
  });

  test('F15-E1 no birthday field on the form: switch is blocked with a prompt', async ({ page }) => {
    const camp = await coffeeCampaign();
    await sql(`update automations set enabled = false where campaign_id = $1 and kind = 'birthday'`, [camp!.id]);
    await sql(`delete from campaign_fields where campaign_id = $1 and type = 'birthday'`, [camp!.id]);
    try {
      await page.goto(`/cards/${camp!.id}/automations`);
      const bday = page.getByRole('region', { name: 'Birthday message' });
      await expect(bday.getByText(/Add a Birthday field to the signup form/)).toBeVisible();
      await expect(bday.getByRole('switch')).toBeDisabled();
    } finally {
      await sql(`insert into campaign_fields (campaign_id,key,label,type,required,position) values ($1,'birthday','Birthday','birthday',false,2) on conflict do nothing`, [camp!.id]);
      await sql(`update automations set enabled = true where campaign_id = $1 and kind = 'birthday'`, [camp!.id]);
    }
  });

  test('F15-E2 birthday field removed while the automation is ON: owner can still switch it off', async ({ page }) => {
    const camp = await coffeeCampaign();
    await sql(`delete from campaign_fields where campaign_id = $1 and type = 'birthday'`, [camp!.id]);
    try {
      await page.goto(`/cards/${camp!.id}/automations`);
      const bday = page.getByRole('region', { name: 'Birthday message' });
      await expect(bday.getByRole('switch')).toBeChecked();
      await bday.getByRole('switch').click();
      await expect(bday.getByText('Saved. It’s off.')).toBeVisible();
    } finally {
      await sql(`insert into campaign_fields (campaign_id,key,label,type,required,position) values ($1,'birthday','Birthday','birthday',false,2) on conflict do nothing`, [camp!.id]);
      await sql(`update automations set enabled = true where campaign_id = $1 and kind = 'birthday'`, [camp!.id]);
    }
  });

  test('F15-E3 empty message is refused', async ({ page }) => {
    const camp = await coffeeCampaign();
    await page.goto(`/cards/${camp!.id}/automations`);
    const bday = page.getByRole('region', { name: 'Birthday message' });
    await bday.getByRole('textbox', { name: 'Message' }).fill('');
    await bday.getByRole('button', { name: 'Save message' }).click();
    await expect(bday.getByRole('alert')).toHaveText('Write the message.');
  });

  test('F16-H1 win-back on with 45 days, saved and forecast shown', async ({ page }) => {
    const camp = await coffeeCampaign();
    await page.goto(`/cards/${camp!.id}/automations`);
    const wb = page.getByRole('region', { name: 'We miss you' });
    await wb.getByLabel('After how many days').fill('45');
    await wb.getByRole('switch').click();
    await expect(wb.getByText('Saved. It’s on.')).toBeVisible();
    await expect(wb.getByText(/About \d+ customers? in the next 7 days/)).toBeVisible();
    const a = await one<{ days_inactive: number; enabled: boolean }>(`select days_inactive, enabled from automations where campaign_id = $1 and kind = 'winback'`, [camp!.id]);
    expect(a).toMatchObject({ days_inactive: 45, enabled: true });
    await sql(`update automations set enabled = false, days_inactive = 30 where campaign_id = $1 and kind = 'winback'`, [camp!.id]);
  });

  test('F16-E1 days outside 7–365 are refused and the switch stays off', async ({ page }) => {
    const camp = await coffeeCampaign();
    await page.goto(`/cards/${camp!.id}/automations`);
    const wb = page.getByRole('region', { name: 'We miss you' });
    await wb.getByLabel('After how many days').fill('3');
    await wb.getByRole('switch').click();
    await expect(wb.getByRole('alert')).toHaveText('Choose between 7 and 365 days.');
    await expect(wb.getByRole('switch')).not.toBeChecked();
  });
});

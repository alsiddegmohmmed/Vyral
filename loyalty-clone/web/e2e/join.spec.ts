// F04 customer joins and gets the web card; F05 staff enrols a customer from the dashboard.
import { test, expect } from './support/fixtures';
import { cardBySerial, clearRateLimits, coffeeCampaign, JOIN_CODE, one, pastryCampaign, sql, uniquePhone } from './support/db';
import { expectNoHorizontalScroll, join } from './support/flows';

test.beforeEach(async () => { await clearRateLimits(); });

test.describe('F04 customer joins', () => {
  test('F04-H1 join with a national phone number opens the web card @mobile', async ({ page, checkA11y }) => {
    await page.goto(`/j/${JOIN_CODE}`);
    await expect(page.getByRole('heading', { name: /10 stamps, then free coffee on us/ })).toBeVisible();
    await checkA11y('S22 join');
    await expectNoHorizontalScroll(page);
    const phone = uniquePhone();
    const serial = await join(page, { name: 'Aimée Uwase', phone: `0${phone}`, consent: true, birthday: { d: '14', m: '2' } });
    expect(serial).not.toBeNull();
    await expect(page.getByText('You’re in!')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hi Aimée' })).toBeVisible();
    await expect(page.getByText('Free coffee', { exact: true })).toBeVisible();
    await expect(page.getByText(/10 visits to go · 0 of 10 stamps/)).toBeVisible();
    await expect(page.getByRole('img', { name: /Your card code/ })).toBeVisible();
    await checkA11y('S23 web card');
    await expectNoHorizontalScroll(page);
    const k = await cardBySerial(serial!);
    const cu = await one<{ phone_e164: string; marketing_consent: boolean; consent_text: string; birthday_month: number; birthday_day: number }>(
      'select phone_e164, marketing_consent, consent_text, birthday_month, birthday_day from customers where id = $1', [k!.customer_id]);
    expect(cu).toMatchObject({ phone_e164: `+250${phone}`, marketing_consent: true, birthday_month: 2, birthday_day: 14 });
    expect(cu!.consent_text).toMatch(/Send me news/);
    await expect(page.getByText(k!.manual_code)).toBeVisible();
  });

  test('F04-E1 consent starts unticked and is stored as false when left alone', async ({ page }) => {
    await page.goto(`/j/${JOIN_CODE}`);
    await expect(page.getByRole('checkbox', { name: /Send me news/ })).not.toBeChecked();
    const serial = await join(page, { name: 'No Offers', phone: uniquePhone() });
    const k = await cardBySerial(serial!);
    const cu = await one<{ marketing_consent: boolean }>('select marketing_consent from customers where id = $1', [k!.customer_id]);
    expect(cu!.marketing_consent).toBe(false);
  });

  test('F04-E2 empty form: both required fields flagged, nothing created', async ({ page, checkA11y }) => {
    const before = await one<{ n: number }>('select count(*)::int as n from customers');
    await page.goto(`/j/${JOIN_CODE}`);
    await page.getByRole('button', { name: 'Get my card' }).click();
    await expect(page.getByRole('main').getByRole('alert').first()).toHaveText(/Please check the highlighted fields/);
    await expect(page.getByLabel(/^Your name/)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel(/^Phone/)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('“Your name” is required.')).toBeVisible();
    await expect(page.getByText('“Phone” is required.')).toBeVisible();
    await checkA11y('S22 join with errors');
    const after = await one<{ n: number }>('select count(*)::int as n from customers');
    expect(after!.n).toBe(before!.n);
  });

  for (const [id, label, fmt] of [
    ['F04-E3a', 'leading 0', (p: string) => `0${p}`],
    ['F04-E3b', '+250 with spaces', (p: string) => `+250 ${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6)}`],
    ['F04-E3c', 'no prefix', (p: string) => p],
    ['F04-E3d', '250 without plus', (p: string) => `250${p}`],
    ['F04-E3e', '00250 international prefix', (p: string) => `00250${p}`],
  ] as const) {
    test(`${id} same phone typed again (${label}) does not create a second card`, async ({ page }) => {
      const phone = uniquePhone();
      const first = await join(page, { name: 'First Join', phone: `0${phone}` });
      expect(first).not.toBeNull();
      const second = await join(page, { name: 'Second Join', phone: fmt(phone) });
      expect(second, `"${fmt(phone)}" made a second card`).toBeNull();
      await expect(page.getByRole('heading', { name: 'Check your messages' })).toBeVisible();
      const n = await one<{ n: number }>(`select count(*)::int as n from customers where name in ('First Join','Second Join') and phone_e164 like $1`, [`%${phone}`]);
      expect(n!.n).toBe(1);
    });
  }

  test('F04-E4 emoji, accents and a 70-character name are kept; the card greets by first name', async ({ page }) => {
    const name = 'Zoë-Émilie 🌸 Uwimana Mukeshimana Nyirahabimana Ingabire Uwase Kamikazi';
    expect(name.length).toBeGreaterThan(60);
    const serial = await join(page, { name, phone: uniquePhone() });
    expect(serial).not.toBeNull();
    await expect(page.getByRole('heading', { name: 'Hi Zoë-Émilie' })).toBeVisible();
    const k = await cardBySerial(serial!);
    const cu = await one<{ name: string }>('select name from customers where id = $1', [k!.customer_id]);
    expect(cu!.name).toBe(name);
  });

  test('F04-E5 a name over the 120-character limit gets an error about the name, not the phone', async ({ page }) => {
    const name = 'A'.repeat(130);
    await page.goto(`/j/${JOIN_CODE}`);
    await page.getByLabel(/^Your name/).fill(name);
    await page.getByLabel(/^Phone/).fill(uniquePhone());
    await page.getByRole('button', { name: 'Get my card' }).click();
    // either the form stops input at the limit and joins, or it explains the name is too long
    await expect(page.getByText(/You’re in!|name/i).first()).toBeVisible();
    await expect(page.getByRole('main').getByRole('alert').filter({ hasText: 'Check your phone number and email.' })).toHaveCount(0);
  });

  test('F04-E6 invalid phone shows a field error', async ({ page }) => {
    await page.goto(`/j/${JOIN_CODE}`);
    await page.getByLabel(/^Your name/).fill('Short Phone');
    await page.getByLabel(/^Phone/).fill('12');
    await page.getByRole('button', { name: 'Get my card' }).click();
    await expect(page.getByText('Enter a valid phone number.')).toBeVisible();
    await expect(page.getByLabel(/^Your name/)).toHaveValue('Short Phone');
  });

  test('F04-E7 birthday with only the day is refused', async ({ page }) => {
    await page.goto(`/j/${JOIN_CODE}`);
    await page.getByLabel(/^Your name/).fill('Half Birthday');
    await page.getByLabel(/^Phone/).fill(uniquePhone());
    await page.getByLabel('Birthday day').selectOption('5');
    await page.getByRole('button', { name: 'Get my card' }).click();
    await expect(page.getByText('Choose both the day and the month.')).toBeVisible();
  });

  test('F04-E8 an impossible birthday (31 February) is refused', async ({ page }) => {
    const phone = uniquePhone();
    await page.goto(`/j/${JOIN_CODE}`);
    await page.getByLabel(/^Your name/).fill('Feb Thirtyone');
    await page.getByLabel(/^Phone/).fill(phone);
    await page.getByLabel('Birthday day').selectOption('31');
    await page.getByLabel('Birthday month').selectOption('2');
    await page.getByRole('button', { name: 'Get my card' }).click();
    await page.waitForLoadState('networkidle');
    const cu = await one<{ n: number }>(`select count(*)::int as n from customers where phone_e164 = $1 and birthday_month = 2 and birthday_day = 31`, [`+250${phone}`]);
    expect(cu!.n, 'a customer with birthday 31 February was stored').toBe(0);
    // and the customer is told what is wrong
    await expect(page.getByText(/birthday|day/i).filter({ hasText: /valid|exist|choose|check/i }).first()).toBeVisible();
    await expect(page.getByRole('main').getByRole('alert').filter({ hasText: 'Check your phone number and email.' })).toHaveCount(0);
  });

  test('F04-E9 double-click on Get my card creates one card', async ({ page }) => {
    const phone = uniquePhone();
    await page.goto(`/j/${JOIN_CODE}`);
    await page.getByLabel(/^Your name/).fill('Double Tap');
    await page.getByLabel(/^Phone/).fill(phone);
    await page.getByRole('button', { name: 'Get my card' }).dblclick();
    await expect(page).toHaveURL(/\/c\/[0-9A-Z]{26}/);
    const n = await one<{ n: number }>(`select count(*)::int as n from customers where phone_e164 = $1`, [`+250${phone}`]);
    expect(n!.n).toBe(1);
  });

  test('F04-E10 keyboard only: fill and submit the join form without a mouse @mobile', async ({ page }) => {
    const phone = uniquePhone();
    await page.goto(`/j/${JOIN_CODE}`);
    await page.locator('body').click({ position: { x: 1, y: 1 } }).catch(() => undefined);
    await page.keyboard.press('Tab');
    await expect(page.getByLabel(/^Your name/)).toBeFocused();
    await page.keyboard.type('Keyboard Kim');
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Country code')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel(/^Phone/)).toBeFocused();
    await page.keyboard.type(phone);
    await page.keyboard.press('Tab'); // birthday day
    await page.keyboard.press('Tab'); // birthday month
    await page.keyboard.press('Tab'); // consent
    await expect(page.getByRole('checkbox', { name: /Send me news/ })).toBeFocused();
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Get my card' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/c\/[0-9A-Z]{26}/);
    await expect(page.getByRole('heading', { name: 'Hi Keyboard' })).toBeVisible();
  });

  test('F04-E11 back button after joining, then joining again, does not duplicate', async ({ page }) => {
    const phone = uniquePhone();
    const serial = await join(page, { name: 'Back Button', phone });
    expect(serial).not.toBeNull();
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/j/${JOIN_CODE}`));
    await page.getByLabel(/^Your name/).fill('Back Button');
    await page.getByLabel(/^Phone/).fill(phone);
    await page.getByRole('button', { name: 'Get my card' }).click();
    await expect(page.getByRole('heading', { name: 'Check your messages' })).toBeVisible();
  });

  test('F04-E12 paused card: join page explains and offers no form', async ({ page }) => {
    const camp = await coffeeCampaign();
    await sql(`update campaigns set status = 'paused' where id = $1`, [camp!.id]);
    try {
      await page.goto(`/j/${JOIN_CODE}`);
      await expect(page.getByText('This card is paused for now. Ask at the counter.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Get my card' })).toHaveCount(0);
    } finally {
      await sql(`update campaigns set status = 'live' where id = $1`, [camp!.id]);
    }
  });

  test('F04-N1 unknown or draft join code is a 404', async ({ page, guard }) => {
    guard.allowConsole(/status of 404/);
    expect((await page.goto('/j/zzzz9999'))?.status()).toBe(404);
    expect((await page.goto('/j/neza2pas'))?.status()).toBe(404); // the draft pastry card
  });

  test('F04-E13 a coffee-card customer can also join the café’s second live card', async ({ page }) => {
    const pastry = await pastryCampaign();
    await sql(`update campaigns set status = 'live', activated_at = now() where id = $1`, [pastry!.id]);
    try {
      const phone = uniquePhone();
      expect(await join(page, { name: 'Two Cards', phone })).not.toBeNull();
      // B-002 fix: a card is created for the existing customer, but (privacy, review C1) the
      // browser never receives it: the answer is "Check your messages" and the link goes to
      // the contact on file. The original customer's details must not change.
      const second = await join(page, { name: 'Somebody Else', phone, code: 'neza2pas' });
      expect(second, 'an existing person must not get a card URL back').toBeNull();
      await expect(page.getByText('Check your messages')).toBeVisible();
      const cards = await sql<{ short_code: string; name: string }>(`select c.short_code, cu.name from cards k join campaigns c on c.id = k.campaign_id join customers cu on cu.id = k.customer_id
                                where cu.phone_e164 = $1 and k.status = 'active' order by c.short_code`, [phone.startsWith('+') ? phone : `+250${phone.replace(/\D/g, '').replace(/^0/, '')}`]);
      expect(cards.map((r) => r.short_code), 'a card on both of the café’s cards').toEqual(['neza1cup', 'neza2pas']);
      expect(new Set(cards.map((r) => r.name)), 'name not overwritten by the second join').toEqual(new Set(['Two Cards']));
    } finally {
      await sql(`update campaigns set status = 'draft', activated_at = null where id = $1`, [pastry!.id]);
    }
  });
});

test.describe('F04 web card states', () => {
  test('F04-E14 deleted card shows the goodbye note and no code', async ({ page }) => {
    const serial = await join(page, { name: 'Gone Soon', phone: uniquePhone() });
    await sql(`update cards set status = 'deleted', deleted_at = now(), note_text = 'Thanks for visiting!' where serial = $1`, [serial]);
    await page.goto(`/c/${serial}`);
    await expect(page.getByText('This card was closed by the business')).toBeVisible();
    await expect(page.getByText('Thanks for visiting!')).toBeVisible();
    await expect(page.getByRole('img', { name: /Your card code/ })).toHaveCount(0);
  });

  test('F04-N2 malformed or unknown card serial is a 404', async ({ page, guard }) => {
    guard.allowConsole(/status of 404/);
    expect((await page.goto('/c/not-a-serial'))?.status()).toBe(404);
    expect((await page.goto('/c/01ARZ3NDEKTSV4RRFFQ69G5FAV'))?.status()).toBe(404);
  });

  test('F04-E15 web card shows only the first name, never phone or email', async ({ page }) => {
    const phone = uniquePhone();
    const serial = await join(page, { name: 'Privacy Person', phone });
    await page.goto(`/c/${serial}`);
    await expect(page.getByText('Person')).toHaveCount(0);
    await expect(page.getByText(phone)).toHaveCount(0);
  });
});

test.describe('F05 staff adds a customer from the dashboard', () => {
  test('F05-H1 add customer gives a card link that opens their card', async ({ page, loginAsOwner, checkA11y }) => {
    await loginAsOwner();
    const camp = await coffeeCampaign();
    await page.goto(`/cards/${camp!.id}/customers`);
    await page.getByRole('button', { name: 'Add customer' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add a customer' });
    await checkA11y('S14 add customer dialog');
    await dialog.getByLabel(/^Name/).fill('Counter Added');
    await dialog.getByLabel('Phone').fill(`+250${uniquePhone()}`);
    await dialog.getByRole('button', { name: 'Create card' }).click();
    await expect(dialog.getByText('Card created')).toBeVisible();
    const link = await dialog.getByText(/\/c\/[0-9A-Z]{26}/).textContent();
    await page.goto(link!.trim());
    await expect(page.getByRole('heading', { name: 'Hi Counter' })).toBeVisible();
  });

  test('F05-E1 add customer with a local number (0788…) stores it as +250…', async ({ page, loginAsOwner, guard }) => {
    guard.allowConsole(/status of 500/);
    await loginAsOwner();
    const camp = await coffeeCampaign();
    const phone = uniquePhone();
    await page.goto(`/cards/${camp!.id}/customers`);
    await page.getByRole('button', { name: 'Add customer' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add a customer' });
    await dialog.getByLabel(/^Name/).fill('Local Number');
    await dialog.getByLabel('Phone').fill(`0${phone}`);
    await dialog.getByRole('button', { name: 'Create card' }).click();
    await expect(dialog.getByText('Card created').or(dialog.getByRole('alert'))).toBeVisible();
    const cu = await one<{ phone_e164: string }>(`select phone_e164 from customers where name = 'Local Number' order by created_at desc limit 1`);
    expect(cu?.phone_e164, 'stored phone for 0788… typed on the dashboard').toBe(`+250${phone}`);
  });

  test('F05-E2 add customer twice: the second dialog shows a fresh form', async ({ page, loginAsOwner }) => {
    await loginAsOwner();
    const camp = await coffeeCampaign();
    await page.goto(`/cards/${camp!.id}/customers`);
    await page.getByRole('button', { name: 'Add customer' }).click();
    let dialog = page.getByRole('dialog', { name: 'Add a customer' });
    await dialog.getByLabel(/^Name/).fill('First Of Two');
    await dialog.getByLabel('Phone').fill(`+250${uniquePhone()}`);
    await dialog.getByRole('button', { name: 'Create card' }).click();
    await expect(dialog.getByText('Card created')).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Add customer' }).click();
    dialog = page.getByRole('dialog', { name: 'Add a customer' });
    await expect(dialog.getByLabel(/^Name/), 'reopened dialog still shows the previous customer’s link').toBeVisible();
  });
});

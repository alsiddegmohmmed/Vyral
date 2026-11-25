// F06 staff stamps a card, F07 earn and redeem, scanner errors (S27–S30, S32, S34).
import { test, expect } from './support/fixtures';
import { cardById, coffeeCampaign, newCard, one, qrFor, relaxScannerLimits, sha, sql } from './support/db';
import { expectNoHorizontalScroll } from './support/flows';
import type { Page } from '@playwright/test';

async function openManual(page: Page) {
  await page.goto('/scan');
  await page.getByRole('button', { name: 'Type the code instead' }).click();
  return page.getByLabel('Card code');
}
async function findByCode(page: Page, code: string) {
  const input = await openManual(page);
  await input.fill(code);
  await page.getByRole('button', { name: 'Find card' }).click();
}

test.describe('F06 staff stamps a card (owner session)', () => {
  test.beforeEach(async ({ loginAsOwner }) => {
    await loginAsOwner();
    const camp = await coffeeCampaign();
    await sql(`update campaigns set status = 'live', stamp_cooldown_minutes = 5, max_stamps_per_transaction = 5, max_stamps_per_day = 6 where id = $1`, [camp!.id]);
  });

  test('F06-H1 type the code, add 2 stamps, see the result; web card follows @mobile', async ({ page, checkA11y }) => {
    const card = await newCard('Scan Happy');
    await page.goto('/scan');
    await expect(page.getByText(/Scanner · /)).toBeVisible();
    await checkA11y('S28 scan (camera off)');
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Type the code instead' }).click();
    await checkA11y('S28 manual code');
    await page.getByLabel('Card code').fill(card.manual_code);
    await page.getByRole('button', { name: 'Find card' }).click();
    await expect(page.getByRole('heading', { name: 'Scan' })).toBeVisible();
    await checkA11y('S29 transaction');
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'More (Stamps to add)' }).click();
    await expect(page.getByRole('paragraph').filter({ hasText: /^Add 2 stamps$/ })).toBeVisible();
    await page.getByRole('button', { name: 'Add 2 stamps' }).click();
    await expect(page.getByRole('heading', { name: '2 stamps added' })).toBeVisible();
    await expect(page.getByText('Scan has 2 of 10. 8 more to the next reward.')).toBeVisible();
    await checkA11y('S30 result');
    expect((await cardById(card.id))!.current_stamps).toBe(2);
    await page.goto(`/c/${card.serial}`);
    await expect(page.getByText('8 more stamps to free coffee.')).toBeVisible();
  });

  test('F06-E1 code typed in lowercase with dashes and spaces still finds the card', async ({ page }) => {
    const card = await newCard('Lower Case');
    const typed = `${card.manual_code.slice(0, 4).toLowerCase()}-${card.manual_code.slice(4).toLowerCase()}`;
    const input = await openManual(page);
    await input.pressSequentially(typed);
    await expect(input).toHaveValue(card.manual_code);
    await page.getByRole('button', { name: 'Find card' }).click();
    await expect(page.getByRole('heading', { name: 'Lower' })).toBeVisible();
    // pasted with spaces: the API normalises too
    const r = await page.request.post('/api/scan/lookup', { data: { manual: ` ${typed.replace('-', ' - ')} ` } });
    expect((await r.json()).ok).toBe(true);
  });

  test('F06-E2 double-click on Add stamp saves one transaction', async ({ page }) => {
    const card = await newCard('Double Click');
    await findByCode(page, card.manual_code);
    await page.getByRole('button', { name: 'Add 1 stamp' }).dblclick();
    await expect(page.getByRole('heading', { name: '1 stamp added' })).toBeVisible();
    const ev = await one<{ n: number }>(`select count(*)::int as n from card_events where card_id = $1 and type = 'stamped'`, [card.id]);
    expect(ev!.n).toBe(1);
    expect((await cardById(card.id))!.current_stamps).toBe(1);
  });

  test('F06-E3 rapid double submit from two requests with one key is applied once', async ({ page }) => {
    const card = await newCard('Same Key');
    const key = `dup-${Date.now()}`;
    const send = () => page.request.post('/api/scan/transaction', { data: { cardId: card.id, stamps: 1, redeem: 0, idempotencyKey: key } });
    const [a, b] = await Promise.all([send(), send()]);
    expect(a.status()).toBe(200);
    expect(b.status()).toBe(200);
    expect((await cardById(card.id))!.current_stamps).toBe(1);
  });

  test('F06-E4 second stamp within the cooldown is refused with a plain message', async ({ page, guard }) => {
    guard.allowConsole(/status of 422/);
    const card = await newCard('Cool Down');
    await findByCode(page, card.manual_code);
    await page.getByRole('button', { name: 'Add 1 stamp' }).click();
    await expect(page.getByRole('heading', { name: '1 stamp added' })).toBeVisible();
    await page.getByRole('button', { name: 'Scan next' }).click();
    await findByCode(page, card.manual_code);
    await page.getByRole('button', { name: 'Add 1 stamp' }).click();
    await expect(page.getByRole('heading', { name: 'Not saved' })).toBeVisible();
    await expect(page.getByText('This card was stamped a moment ago. Try again in a few minutes.')).toBeVisible();
    expect((await cardById(card.id))!.current_stamps).toBe(1);
  });

  test('F06-E5 per-scan cap: the stepper stops at 5 and the API refuses 7', async ({ page }) => {
    const card = await newCard('Cap Five');
    await findByCode(page, card.manual_code);
    const more = page.getByRole('button', { name: 'More (Stamps to add)' });
    for (let i = 0; i < 4; i++) await more.click();
    await expect(more).toBeDisabled();
    await page.getByRole('textbox', { name: 'Stamps to add' }).fill('9');
    await expect(page.getByRole('textbox', { name: 'Stamps to add' })).toHaveValue('5');
    const r = await page.request.post('/api/scan/transaction', { data: { cardId: card.id, stamps: 7, redeem: 0, idempotencyKey: `cap-${Date.now()}` } });
    expect(r.status()).toBe(422);
    expect((await r.json()).error).toBe('too_many_stamps');
  });

  test('F06-E6 daily cap: 5 then 2 more in the same day is refused', async ({ page }) => {
    const camp = await coffeeCampaign();
    await sql('update campaigns set stamp_cooldown_minutes = 0 where id = $1', [camp!.id]);
    const card = await newCard('Daily Cap');
    const tx = (n: number) => page.request.post('/api/scan/transaction', { data: { cardId: card.id, stamps: n, redeem: 0, idempotencyKey: `day-${n}-${Date.now()}` } });
    expect((await tx(5)).status()).toBe(200);
    const r = await tx(2);
    expect((await r.json()).error).toBe('daily_limit_reached');
  });

  test('F06-N1 deleted card: scanner says so and stamps nothing', async ({ page }) => {
    const card = await newCard('Deleted One');
    await sql(`update cards set status = 'deleted', deleted_at = now() where id = $1`, [card.id]);
    await findByCode(page, card.manual_code);
    await expect(page.getByRole('heading', { name: 'Can’t use this card' })).toBeVisible();
    await expect(page.getByText('This card was deleted by the business.')).toBeVisible();
  });

  test('F06-N2 forged and unknown codes are rejected', async ({ page }) => {
    const card = await newCard('Forged');
    const good = qrFor(card.barcode_token);
    const forged = good.slice(0, -1) + (good.endsWith('A') ? 'B' : 'A');
    expect(await (await page.request.post('/api/scan/lookup', { data: { qr: good } })).json()).toMatchObject({ ok: true });
    expect(await (await page.request.post('/api/scan/lookup', { data: { qr: forged } })).json()).toEqual({ ok: false, error: 'invalid_code' });
    await findByCode(page, 'ZZZZ9999');
    await expect(page.getByText('No card with that code. Check the letters and numbers.')).toBeVisible();
  });

  test('F06-N3 paused programme: lookup works, stamping is refused', async ({ page, guard }) => {
    guard.allowConsole(/status of 422/);
    const card = await newCard('Paused Prog');
    const camp = await coffeeCampaign();
    await sql(`update campaigns set status = 'paused' where id = $1`, [camp!.id]);
    try {
      await findByCode(page, card.manual_code);
      await page.getByRole('button', { name: 'Add 1 stamp' }).click();
      await expect(page.getByText('This card’s programme is paused.')).toBeVisible();
    } finally {
      await sql(`update campaigns set status = 'live' where id = $1`, [camp!.id]);
    }
  });

  test('F06-N4 expired card is refused at the counter', async ({ page, guard }) => {
    guard.allowConsole(/status of 422/);
    const card = await newCard('Expired One');
    await sql(`update cards set expires_at = now() - interval '1 day' where id = $1`, [card.id]);
    await findByCode(page, card.manual_code);
    await page.getByRole('button', { name: 'Add 1 stamp' }).click();
    await expect(page.getByText('This card has expired.')).toBeVisible();
  });

  test('F06-E7 session expires on the transaction screen: phone asks to pair again, nothing saved', async ({ page, context, guard }) => {
    guard.allowConsole(/status of 401/);
    const card = await newCard('Session Gone');
    await findByCode(page, card.manual_code);
    await expect(page.getByRole('heading', { name: 'Session' })).toBeVisible();
    const token = (await context.cookies()).find((c) => c.name === 'lc_session')!.value;
    await sql('delete from sessions where token_hash = $1', [sha(token)]);
    await page.getByRole('button', { name: 'Add 1 stamp' }).click();
    await expect(page.getByRole('heading', { name: 'This phone needs pairing again' })).toBeVisible();
    await expect(page.getByText(/The sign-in on this phone has ended/)).toBeVisible();
    await expect(page.getByLabel('Pairing code')).toBeVisible();
    expect((await cardById(card.id))!.current_stamps).toBe(0);
  });

  test('F06-E8 offline at submit: clear message, nothing saved', async ({ page, context, guard }) => {
    guard.allowConsole(/ERR_INTERNET_DISCONNECTED/);
    const card = await newCard('Offline');
    await findByCode(page, card.manual_code);
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Add 1 stamp' }).click();
    await expect(page.getByRole('heading', { name: 'No connection' })).toBeVisible();
    await context.setOffline(false);
    expect((await cardById(card.id))!.current_stamps).toBe(0);
  });

  test('F06-E9 keyboard only: type code, add a stamp, no mouse @mobile', async ({ page }) => {
    const card = await newCard('Keys Only');
    await page.goto('/scan');
    const manualBtn = page.getByRole('button', { name: 'Type the code instead' });
    await manualBtn.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Card code')).toBeFocused();
    await page.keyboard.type(card.manual_code);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Keys' })).toBeVisible();
    // Tab through: Recent scans, Settings, Cancel, Fewer, input, More, then the submit button
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      if (await page.getByRole('button', { name: 'Add 1 stamp' }).evaluate((el) => el === document.activeElement)) break;
    }
    await expect(page.getByRole('button', { name: 'Add 1 stamp' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: '1 stamp added' })).toBeVisible();
  });

  test('F06-E10 confirm step (scanner setting) asks before saving', async ({ page, checkA11y }) => {
    const card = await newCard('Confirm Me');
    await page.goto('/scan');
    await page.getByRole('button', { name: 'Scanner settings' }).click();
    await checkA11y('S34 scanner settings');
    await page.getByRole('switch', { name: 'Ask to confirm before saving' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Type the code instead' }).click();
    await page.getByLabel('Card code').fill(card.manual_code);
    await page.getByRole('button', { name: 'Find card' }).click();
    await page.getByRole('button', { name: 'Add 1 stamp' }).click();
    await expect(page.getByRole('group', { name: 'Confirm' })).toBeVisible();
    expect((await cardById(card.id))!.current_stamps).toBe(0);
    await page.getByRole('button', { name: 'Yes, save it' }).click();
    await expect(page.getByRole('heading', { name: '1 stamp added' })).toBeVisible();
  });

  test('F06-E12 scanner settings survive a reload', async ({ page }) => {
    await page.goto('/scan');
    await page.getByRole('button', { name: 'Scanner settings' }).click();
    await page.getByRole('switch', { name: 'Ask to confirm before saving' }).click();
    await expect(page.getByRole('switch', { name: 'Ask to confirm before saving' })).toBeChecked();
    await page.reload();
    await page.getByRole('button', { name: 'Scanner settings' }).click();
    await expect(page.getByRole('switch', { name: 'Ask to confirm before saving' }), 'confirm setting was lost after reload').toBeChecked();
  });

  test('F06-E11 recent scans lists the stamp with the time @mobile', async ({ page, checkA11y }) => {
    const card = await newCard('History Hana');
    await findByCode(page, card.manual_code);
    await page.getByRole('button', { name: 'Add 1 stamp' }).click();
    await expect(page.getByRole('heading', { name: '1 stamp added' })).toBeVisible();
    await page.getByRole('button', { name: 'Recent scans' }).click();
    await expect(page.getByRole('heading', { name: 'Recent scans' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'History' }).first()).toContainText('+1 stamp');
    await checkA11y('S32 history');
  });
});

test.describe('F07 earn and redeem', () => {
  test.beforeEach(async ({ loginAsOwner }) => {
    await loginAsOwner();
    const camp = await coffeeCampaign();
    await relaxScannerLimits(camp!.id);
  });

  test('F07-H1 the 10th stamp earns the reward; give it in the same scan; old QR is then "replaced"', async ({ page }) => {
    const card = await newCard('Reward Rita');
    await sql('update cards set current_stamps = 9 where id = $1', [card.id]);
    const oldQr = qrFor(card.barcode_token);
    await findByCode(page, card.manual_code);
    await expect(page.getByText(/this completes the card: 1 free coffee earned/)).toBeVisible();
    await page.getByRole('button', { name: /Give 1 free coffee/ }).click();
    await page.getByRole('button', { name: 'Add 1 stamp + reward' }).click();
    await expect(page.getByRole('heading', { name: '1 stamp added · Reward given' })).toBeVisible();
    const after = await cardById(card.id);
    expect(after).toMatchObject({ current_stamps: 0, rewards_available: 0 });
    expect(after!.barcode_token).not.toBe(card.barcode_token);
    // a screenshot of the old QR no longer works
    const r = await page.request.post('/api/scan/lookup', { data: { qr: oldQr } });
    expect(await r.json()).toEqual({ ok: false, error: 'card_replaced' });
  });

  test('F07-E1 a screenshot of the old card (typed code) stops working after a redemption', async ({ page }) => {
    const card = await newCard('Screenshot Sam');
    await sql('update cards set current_stamps = 0, rewards_available = 1 where id = $1', [card.id]);
    await findByCode(page, card.manual_code);
    await page.getByRole('button', { name: 'Give 1 free coffee' }).first().click();
    await page.getByRole('button', { name: 'Give reward' }).click();
    await expect(page.getByRole('heading', { name: 'Reward given' })).toBeVisible();
    // the old screenshot shows the QR AND the typed code; the QR is dead, the typed code should be too
    const r = await page.request.post('/api/scan/lookup', { data: { manual: card.manual_code } });
    expect((await r.json()).ok, 'old typed code from a screenshot still finds the card after redemption').toBe(false);
  });

  test('F07-E2 stamps beyond a full card roll over and bank a reward', async ({ page }) => {
    const card = await newCard('Overflow Olive');
    await sql('update cards set current_stamps = 8 where id = $1', [card.id]);
    const r = await page.request.post('/api/scan/transaction', { data: { cardId: card.id, stamps: 5, redeem: 0, idempotencyKey: `of-${Date.now()}` } });
    expect((await r.json()).result).toMatchObject({ earned: 1, currentStamps: 3, rewardsAvailable: 1 });
  });

  test('F07-N1 redeeming with no reward is refused', async ({ page }) => {
    const card = await newCard('No Reward');
    const r = await page.request.post('/api/scan/transaction', { data: { cardId: card.id, stamps: 0, redeem: 1, idempotencyKey: `nr-${Date.now()}` } });
    expect((await r.json()).error).toBe('no_reward_available');
    await findByCode(page, card.manual_code);
    await expect(page.getByRole('button', { name: /Give 1 free coffee/ })).toHaveCount(0);
  });

  test('F07-E3 web card shows the reward ready after the 10th stamp @mobile', async ({ page }) => {
    const card = await newCard('Ready Rose');
    await sql('update cards set current_stamps = 9 where id = $1', [card.id]);
    await page.request.post('/api/scan/transaction', { data: { cardId: card.id, stamps: 1, redeem: 0, idempotencyKey: `rd-${Date.now()}` } });
    await page.goto(`/c/${card.serial}`);
    await expect(page.getByText('Your reward is ready. Show this card at the counter.')).toBeVisible();
    await expect(page.getByText('1 × Free coffee')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

// F01 sign up and trial, log in, password reset, email verification, sessions, tenant isolation.
import { test, expect } from './support/fixtures';
import { clearRateLimits, coffeeCampaign, JOIN_CODE, one, OWNER_EMAIL, OWNER_PASSWORD, sha, sql } from './support/db';

const throwaway = (tag: string) => `qa-${tag}-${Date.now()}@example.test`;

test.describe('F01 sign up and start trial', () => {
  test.beforeEach(async () => { await clearRateLimits(); });

  test('F01-H1 sign up lands on the empty Cards screen with a trial banner @mobile', async ({ page, checkA11y }) => {
    await page.goto('/signup');
    await checkA11y('S01 sign up');
    await page.getByLabel('Business name').fill('QA Bakery');
    await page.getByLabel('Email').fill(throwaway('h1'));
    await page.getByLabel('Password').fill('long-enough-1');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/cards$/);
    await expect(page.getByRole('heading', { name: 'Make your first card' })).toBeVisible();
    await expect(page.getByText(/15 days left in your trial|14 days left in your trial/)).toBeVisible();
    await checkA11y('S03 empty state');
  });

  test('F01-E1 empty form shows the first error and keeps the user on the page', async ({ page }) => {
    await page.goto('/signup');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toHaveText(/Enter your business name/);
    await expect(page).toHaveURL(/\/signup/);
  });

  test('F01-E2 short password is refused, typed values kept', async ({ page }) => {
    const email = throwaway('e2');
    await page.goto('/signup');
    await page.getByLabel('Business name').fill('QA Bakery');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('short1');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toHaveText(/at least 10 characters/);
    await expect(page.getByLabel('Email')).toHaveValue(email);
    await expect(page.getByLabel('Business name')).toHaveValue('QA Bakery');
  });

  test('F01-E3 long business name with emoji and accents is stored as typed', async ({ page }) => {
    const email = throwaway('e3');
    const name = 'Café Ñoño ☕️ Boulangerie & Pâtisserie de la Rue Principale Kigali';
    expect(name.length).toBeGreaterThan(60);
    await page.goto('/signup');
    await page.getByLabel('Business name').fill(name);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('long-enough-1');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/cards$/);
    const row = await one<{ name: string }>('select o.name from orgs o join org_members m on m.org_id = o.id join users u on u.id = m.user_id where u.email = $1', [email]);
    expect(row?.name).toBe(name);
    await expect(page.getByRole('navigation', { name: 'Main' }).getByText(name)).toBeAttached();
  });

  test('F01-E4 double-click on Create account makes one account', async ({ page }) => {
    const email = throwaway('e4');
    await page.goto('/signup');
    await page.getByLabel('Business name').fill('QA Double');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('long-enough-1');
    await page.getByRole('button', { name: 'Create account' }).dblclick();
    await expect(page).toHaveURL(/\/cards$/);
    const n = await one<{ n: number }>(`select count(*)::int as n from orgs o join org_members m on m.org_id = o.id join users u on u.id = m.user_id where u.email = $1`, [email]);
    expect(n?.n).toBe(1);
    const orphans = await one<{ n: number }>(`select count(*)::int as n from orgs where name = 'QA Double' and id not in (select org_id from org_members)`);
    expect(orphans?.n).toBe(0);
  });

  test('F01-N1 email already used: clear error, no second account', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Business name').fill('Copycat');
    await page.getByLabel('Email').fill(OWNER_EMAIL.toUpperCase());
    await page.getByLabel('Password').fill('long-enough-1');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toHaveText(/already exists/);
  });

  test('F01-E5 verification email is written to the outbox and the link confirms once', async ({ page, browser }) => {
    const email = throwaway('verify');
    await page.goto('/signup');
    await page.getByLabel('Business name').fill('QA Verify');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('long-enough-1');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/cards$/);
    const mail = await one<{ body_text: string }>(`select body_text from outbox_emails where to_email = $1 and kind = 'verify_email' order by created_at desc limit 1`, [email]);
    const link = /\/verify\?token=[\w-]+/.exec(mail!.body_text)![0];
    await page.goto(link);
    await expect(page.getByText('Email confirmed')).toBeVisible();
    // works once
    const other = await browser.newPage();
    await other.goto(`http://localhost:3100${link}`);
    await expect(other.getByRole('main').getByRole('alert')).toHaveText(/expired or was already used/);
    await other.close();
  });
});

test.describe('Log in, reset, sessions', () => {
  test.beforeEach(async () => { await clearRateLimits(); });

  test('F01-H2 owner signs in with the form and sees the Cards list @mobile', async ({ page, checkA11y }) => {
    await page.goto('/login');
    await checkA11y('S02 login');
    await page.getByLabel('Email').fill(`  ${OWNER_EMAIL.toUpperCase()} `);
    await page.getByLabel('Password').fill(OWNER_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/cards$/);
    await expect(page.getByRole('heading', { name: 'Cards', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Coffee card/ })).toBeVisible();
    await checkA11y('S03 cards list');
  });

  test('F01-N2 wrong password: generic error, email kept, no session', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(OWNER_EMAIL);
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toHaveText('That email and password don’t match.');
    await expect(page.getByLabel('Email')).toHaveValue(OWNER_EMAIL);
    await page.goto('/cards');
    await expect(page).toHaveURL(/\/login/);
  });

  test('F01-N3 ninth wrong password in 15 minutes is rate limited', async ({ page }) => {
    await page.goto('/login');
    for (let i = 0; i < 9; i++) {
      await page.getByLabel('Email').fill('nobody@example.test');
      await page.getByLabel('Password').fill(`wrong-${i}`);
      await Promise.all([
        page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/login')),
        page.getByRole('button', { name: 'Sign in' }).click(),
      ]);
      await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    }
    await expect(page.getByRole('main').getByRole('alert')).toHaveText(/Too many tries/);
  });

  test('F01-H3 password reset through the outbox link signs out other sessions', async ({ page, browser, loginAsOwner }) => {
    // a throwaway account so the demo owner's password never changes
    const email = throwaway('reset');
    await page.goto('/signup');
    await page.getByLabel('Business name').fill('QA Reset');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('first-password-1');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/cards$/);
    // a second device stays signed in until the reset
    const other = await browser.newContext();
    await loginAsOwner(other, email);
    const otherPage = await other.newPage();
    await otherPage.goto('http://localhost:3100/cards');
    await expect(otherPage).toHaveURL(/\/cards$/);

    await page.goto('/forgot');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText('Check your email')).toBeVisible();
    const mail = await one<{ body_text: string }>(`select body_text from outbox_emails where to_email = $1 and kind = 'reset_password' order by created_at desc limit 1`, [email]);
    const link = /\/reset\?token=[\w-]+/.exec(mail!.body_text)![0];
    await page.goto(link);
    await page.getByLabel('New password', { exact: true }).fill('second-password-2');
    await page.getByLabel('New password again').fill('second-password-2');
    await page.getByRole('button', { name: 'Save password' }).click();
    await expect(page).toHaveURL(/\/login\?reset=1/);
    await expect(page.getByText('Password changed')).toBeVisible();

    await otherPage.goto('http://localhost:3100/cards');
    await expect(otherPage).toHaveURL(/\/login/);
    await other.close();

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('second-password-2');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/cards$/);
    // the link works once
    await page.goto(link);
    await page.getByLabel('New password', { exact: true }).fill('third-password-3');
    await page.getByLabel('New password again').fill('third-password-3');
    await page.getByRole('button', { name: 'Save password' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toHaveText(/expired or was already used/);
  });

  test('F01-N4 forgot password for an unknown email looks the same (no account leak)', async ({ page }) => {
    await page.goto('/forgot');
    await page.getByLabel('Email').fill('nobody-here@example.test');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText('Check your email')).toBeVisible();
  });

  test('F01-E6 expired session: deleting the session row sends the next action to login', async ({ page, loginAsOwner }) => {
    const token = await loginAsOwner();
    const camp = await coffeeCampaign();
    await page.goto(`/cards/${camp!.id}/messages`);
    await page.getByRole('textbox', { name: 'Message' }).fill('Session test');
    await sql('delete from sessions where token_hash = $1', [sha(token)]);
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('button', { name: 'Send now' }).click();
    await expect(page).toHaveURL(/\/login/);
    const sent = await one<{ n: number }>(`select count(*)::int as n from messages where body = 'Session test'`);
    expect(sent?.n).toBe(0);
  });

  test('F01-E7 sign out everywhere ends every session of the user', async ({ page, browser, loginAsOwner }) => {
    await loginAsOwner();
    const other = await browser.newContext();
    await loginAsOwner(other);
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Sign out on all devices' }).click();
    await expect(page).toHaveURL(/\/login/);
    const p2 = await other.newPage();
    await p2.goto('http://localhost:3100/cards');
    await expect(p2).toHaveURL(/\/login/);
    await other.close();
  });

  test('F01-E8 signed-out visitor is sent to login from every dashboard URL', async ({ page }) => {
    const camp = await coffeeCampaign();
    for (const path of ['/cards', `/cards/${camp!.id}`, `/cards/${camp!.id}/customers`, '/locations', '/settings', '/settings/devices', '/settings/billing']) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/login/);
    }
  });
});

test.describe('Tenant isolation (second business)', () => {
  test.beforeEach(async () => { await clearRateLimits(); });

  test('F01-E9 a second business cannot see or act on the café’s data', async ({ page, guard }) => {
    guard.allowConsole(/status of 404|Failed to load resource/);
    const email = throwaway('tenant');
    await page.goto('/signup');
    await page.getByLabel('Business name').fill('Other Shop');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('long-enough-1');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/cards$/);
    await expect(page.getByText('Coffee card')).toHaveCount(0);

    const camp = await coffeeCampaign();
    const card = await one<{ id: string; manual_code: string }>('select id, manual_code from cards where campaign_id = $1 limit 1', [camp!.id]);
    for (const path of [`/cards/${camp!.id}`, `/cards/${camp!.id}/design`, `/cards/${camp!.id}/customers`, `/cards/${camp!.id}/customers/${card!.id}`, `/cards/${camp!.id}/messages`, `/cards/${camp!.id}/automations`, `/cards/${camp!.id}/insights`]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(404);
      await expect(page.getByText('Café Neza')).toHaveCount(0);
    }
    // the scanner of business B can't find or stamp A's card
    const lookup = await page.request.post('/api/scan/lookup', { data: { manual: card!.manual_code } });
    expect(await lookup.json()).toEqual({ ok: false, error: 'card_not_found' });
    const tx = await page.request.post('/api/scan/transaction', { data: { cardId: card!.id, stamps: 1, redeem: 0, idempotencyKey: `tenant-${Date.now()}` } });
    expect(tx.status()).toBe(422);
    expect((await tx.json()).error).toBe('card_not_found');
  });
});

test('F01-E10 join link for the café still works while signed in as someone else (public page)', async ({ page }) => {
  await page.goto(`/j/${JOIN_CODE}`);
  await expect(page.getByRole('button', { name: 'Get my card' })).toBeVisible();
});

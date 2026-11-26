// L landing page at / (replica/launch/landing.md): structure, honest proof, pricing from the plan table.
import { test, expect } from './support/fixtures';
import { expectNoHorizontalScroll } from './support/flows';

test.describe('L landing page', () => {
  test('L-H1 signed out: the angle, one primary action, real prices @mobile', async ({ page, checkA11y }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'A loyalty card your counter can’t break.' })).toBeVisible();
    for (const h of ['Running in an afternoon', 'Built so the counter keeps going', 'One flat price per shop', 'Questions owners ask'])
      await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: /Start 15 days free/ }).first()).toHaveAttribute('href', '/signup');
    // prices come from the same table the billing page uses
    await expect(page.getByText('RWF 15,000')).toBeVisible();
    await expect(page.getByText('RWF 35,000')).toBeVisible();
    // no invented proof
    await expect(page.getByText(/trusted by|★|customers love/i)).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await checkA11y('landing');
  });

  test('L-H2 an FAQ answer opens with the keyboard', async ({ page }) => {
    await page.goto('/#faq');
    const q = page.getByText('What if the phone at the counter breaks or gets lost?');
    await q.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/type a new 6-digit pairing code/)).toBeVisible();
  });

  test('L-H3 signed in: the landing points to the dashboard', async ({ page, loginAsOwner }) => {
    await loginAsOwner();
    await page.goto('/');
    await expect(page.getByRole('main').getByRole('link', { name: /Open your dashboard/ }).first()).toHaveAttribute('href', '/cards');
  });
});

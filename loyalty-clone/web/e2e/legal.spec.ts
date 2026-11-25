// Legal pages: privacy notice and terms (drafts for legal review; replica/deploy.md preflight).
import { test, expect } from './support/fixtures';
import { JOIN_CODE } from './support/db';
import { expectNoHorizontalScroll } from './support/flows';

test.describe('Legal pages', () => {
  test('LG-H1 privacy notice names every processor and the retention rules @mobile', async ({ page, checkA11y }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy notice' })).toBeVisible();
    await expect(page.getByRole('note')).toContainText('Draft for legal review');
    for (const p of ['Vercel', 'Resend', 'Paddle', 'Flutterwave', 'Apple', 'Google'])
      await expect(page.getByRole('listitem').filter({ hasText: p }).first()).toBeVisible();
    await expect(page.getByText(/erased 30 days later/)).toBeVisible();
    await expect(page.getByText('lc_session', { exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await checkA11y('privacy');
  });

  test('LG-H2 terms show the same prices and limits as billing @mobile', async ({ page, checkA11y }) => {
    await page.goto('/terms');
    await expect(page.getByRole('heading', { level: 1, name: 'Terms of service' })).toBeVisible();
    await expect(page.getByText(/Starter: RWF 15,000 or US\$12 a month, 2 card designs/)).toBeVisible();
    await expect(page.getByText(/Cancel any time from Plan & billing in one click/)).toBeVisible();
    await checkA11y('terms');
  });

  test('LG-H3 sign-up and the join page link to the legal pages', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('link', { name: 'terms of service' })).toHaveAttribute('href', '/terms');
    await expect(page.getByRole('link', { name: 'privacy notice' })).toHaveAttribute('href', '/privacy');
    await page.goto(`/j/${JOIN_CODE}`);
    await expect(page.getByRole('link', { name: 'How your details are used' })).toHaveAttribute('href', '/privacy');
  });
});

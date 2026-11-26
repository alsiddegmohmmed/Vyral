// Small UI helpers shared by specs (role/label selectors only).
import { expect, type Page } from '@playwright/test';
import { JOIN_CODE } from './db';

/** Fill and submit the public join form. Returns the card serial when a card was created, else null. */
export async function join(page: Page, opts: { name: string; phone: string; cc?: string; consent?: boolean; birthday?: { d?: string; m?: string }; code?: string }) {
  await page.goto(`/j/${opts.code ?? JOIN_CODE}`);
  await page.getByLabel(/^Your name/).fill(opts.name);
  if (opts.cc) await page.getByLabel('Country code').selectOption(opts.cc);
  await page.getByLabel(/^Phone/).fill(opts.phone);
  if (opts.birthday?.d) await page.getByLabel('Birthday day').selectOption(opts.birthday.d);
  if (opts.birthday?.m) await page.getByLabel('Birthday month').selectOption(opts.birthday.m);
  if (opts.consent) await page.getByRole('checkbox', { name: /Send me news/ }).check();
  await page.getByRole('button', { name: 'Get my card' }).click();
  await expect(page.getByText(/You’re in!/).or(page.getByRole('heading', { name: 'Check your messages' })).or(page.getByRole('main').getByRole('alert')).first()).toBeVisible();
  const m = /\/c\/([0-9A-Z]{26})/.exec(page.url());
  return m ? m[1] : null;
}

export async function expectNoHorizontalScroll(page: Page) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  expect(r.sw, `page is ${r.sw}px wide in a ${r.w}px viewport`).toBeLessThanOrEqual(r.w);
}

/**
 * Create a card through the new-card wizard (/cards/new), which replaced the
 * one-field "New card" dialog. Picks a business type, names the card, keeps the
 * suggested stamps and reward, then opens the designer or goes live.
 */
export async function wizardCreate(page: Page, name: string, opts: { type?: string; goLive?: boolean } = {}) {
  await page.getByRole('link', { name: 'New card' }).first().click();
  await expect(page).toHaveURL(/\/cards\/new$/);
  // an intro screen comes first (layout modelled on StampMate's /start)
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: opts.type ?? 'Café' }).click();
  await page.getByLabel('Card name').fill(name);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What does a full card get?' })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  // the locations step only appears when the business has locations
  const where = page.getByRole('heading', { name: 'Where can customers use it?' });
  const review = page.getByRole('heading', { name: 'Ready to go?' });
  await expect(where.or(review)).toBeVisible();
  if (await where.isVisible()) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(review).toBeVisible();
  await page.getByRole('button', { name: opts.goLive ? 'Create and go live' : 'Fine-tune in the designer first' }).click();
}

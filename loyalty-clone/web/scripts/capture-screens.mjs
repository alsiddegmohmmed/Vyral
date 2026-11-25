// Captures the redesign screens (shell, cards, card overview, sign-up, sign-in)
// at 1440 px and 390 px into replica/clone-screens/.
// Needs the dev server on :3100 and the seeded dev database.
//   node scripts/capture-screens.mjs v1   (before)   |   node scripts/capture-screens.mjs v2   (after)
import { chromium } from '@playwright/test';
import pg from 'pg';

const suffix = process.argv[2] ?? 'v2';
const base = 'http://localhost:3100';
const out = new URL('../../replica/clone-screens/', import.meta.url).pathname;
const db = new pg.Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54321/postgres' });
await db.connect();
const { rows } = await db.query(`select c.id from campaigns c join orgs o on o.id = c.org_id where o.name like 'Café Neza%' and c.status = 'live' order by c.created_at limit 1`);
await db.end();
const cardId = rows[0]?.id;

const browser = await chromium.launch();
for (const [w, h, tag] of [[1440, 900, 'desktop'], [390, 844, 'mobile']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: tag === 'mobile' ? 2 : 1, locale: 'en-GB', timezoneId: 'Africa/Kigali' });
  const page = await ctx.newPage();
  const shot = async (name, full = true) => { await page.waitForLoadState('networkidle').catch(() => {}); await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }); await page.screenshot({ path: `${out}redesign-${name}-${tag}-${suffix}.png`, fullPage: full }); };
  await page.goto(`${base}/signup`); await shot('signup');
  await page.goto(`${base}/login`); await shot('login');
  await page.getByLabel('Email').fill('owner@cafe-neza.test');
  await page.getByLabel('Password').fill('neza-demo-2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/cards/);
  await shot('cards');
  if (cardId) { await page.goto(`${base}/cards/${cardId}`); await shot('card-overview'); }
  // first run: a brand-new test account shows the setup checklist on /cards
  await ctx.clearCookies();
  await page.goto(`${base}/signup`);
  await page.getByLabel('Business name').fill('First Run Café');
  await page.getByLabel('Email').fill(`redesign-${tag}-${Date.now()}@example.test`);
  await page.getByLabel('Password').fill('first-run-2026');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/\/cards/);
  await shot('cards-first-run');
  await ctx.close();
}
await browser.close();
console.log('saved to', out);

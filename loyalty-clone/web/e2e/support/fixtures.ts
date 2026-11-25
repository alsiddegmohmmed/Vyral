// Shared fixtures: every test fails on console errors and 5xx responses, and
// gets helpers for owner login (session row, no rate limit) and axe scans.
import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { closeDb, createSessionToken } from './db';

/**
 * axe exclusions (rule ids skipped everywhere), each with its reason. Keep this list short.
 * - none at the moment: every serious/critical violation fails the test.
 */
export const AXE_DISABLED_RULES: { id: string; reason: string }[] = [];

/**
 * Elements excluded from axe, with the reason.
 * - `nextjs-portal`: the Next.js dev-mode overlay/indicator, not part of the app.
 */
export const AXE_EXCLUDED_SELECTORS: { selector: string; reason: string }[] = [
  { selector: 'nextjs-portal', reason: 'Next.js dev-tools indicator (dev only, not app UI)' },
];

type Guard = {
  /** Allow console errors matching this pattern for the rest of the test (e.g. an expected 4xx). */
  allowConsole: (re: RegExp) => void;
  /** Allow 5xx on URLs matching this pattern (never used for app routes unless documented). */
  allow5xx: (re: RegExp) => void;
  errors: string[];
};

type Fixtures = {
  guard: Guard;
  /** Sign the page's context in as the seeded owner (fresh session row). */
  loginAsOwner: (ctx?: BrowserContext, email?: string) => Promise<string>;
  /** axe scan of the current screen: fails on serious/critical violations. */
  checkA11y: (label?: string, page?: Page) => Promise<void>;
};

/**
 * Console/page errors ignored in every test, with the reason. Keep this list short.
 * - React 19 dev-only instrumentation: when a server component calls notFound(), React's
 *   performance track sometimes calls performance.measure() with a negative start and the
 *   browser throws. Dev build only, not app code; it appears at random on 404 pages.
 */
export const IGNORED_ERRORS: { re: RegExp; reason: string }[] = [
  { re: /Failed to execute 'measure' on 'Performance': .* cannot have a negative time stamp/, reason: 'React dev-mode performance track on notFound() pages' },
];

export function watch(page: Page, guard: Guard) {
  const allowedConsole: RegExp[] = (guard as unknown as { _c: RegExp[] })._c;
  const allowed5xx: RegExp[] = (guard as unknown as { _s: RegExp[] })._s;
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = `${msg.text()} @ ${msg.location()?.url ?? ''}`;
    if (allowedConsole.some((re) => re.test(text)) || IGNORED_ERRORS.some(({ re }) => re.test(text))) return;
    guard.errors.push(`console error on ${page.url()}: ${text}`);
  });
  page.on('pageerror', (err) => { if (!IGNORED_ERRORS.some(({ re }) => re.test(err.message))) guard.errors.push(`page error on ${page.url()}: ${err.message}`); });
  page.on('response', (res) => {
    if (res.status() >= 500 && !allowed5xx.some((re) => re.test(res.url()))) guard.errors.push(`${res.status()} on ${res.request().method()} ${res.url()}`);
  });
}

export const test = base.extend<Fixtures, { dbCleanup: void }>({
  dbCleanup: [async ({}, use) => { await use(); await closeDb(); }, { scope: 'worker', auto: true }],
  guard: async ({}, use) => {
    const g = { errors: [] as string[], _c: [] as RegExp[], _s: [] as RegExp[] } as Guard & { _c: RegExp[]; _s: RegExp[] };
    g.allowConsole = (re) => g._c.push(re);
    g.allow5xx = (re) => g._s.push(re);
    await use(g);
    expect(g.errors, 'console errors / 5xx responses during the test').toEqual([]);
  },
  page: async ({ page, guard }, use) => {
    watch(page, guard);
    await use(page);
  },
  loginAsOwner: async ({ context }, use) => {
    await use(async (ctx = context, email) => {
      const token = await createSessionToken(email);
      await ctx.addCookies([{ name: 'lc_session', value: token, url: 'http://localhost:3100', httpOnly: true, sameSite: 'Lax' }]);
      return token;
    });
  },
  checkA11y: async ({ page }, use) => {
    await use(async (label, p = page) => {
      // let open/close animations (dialogs fade and pop in) finish: axe reads mid-fade colours as low contrast
      await p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || (a.effect?.getTiming().iterations ?? 1) === Infinity));
      let b = new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']);
      for (const { selector } of AXE_EXCLUDED_SELECTORS) b = b.exclude(selector);
      if (AXE_DISABLED_RULES.length) b = b.disableRules(AXE_DISABLED_RULES.map((r) => r.id));
      const r = await b.analyze();
      const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.impact} ${v.id}: ${v.help} -> ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
      expect(bad, `axe serious/critical on ${label ?? p.url()}`).toEqual([]);
    });
  },
});

export { expect };

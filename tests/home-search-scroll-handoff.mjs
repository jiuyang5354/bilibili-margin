import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { installMocks } from './mocks.mjs';

const out = resolve(process.env.SMOKE_OUT || 'tests/artifacts/home-search-scroll-handoff');
mkdirSync(out, { recursive: true });
const ext = resolve(process.env.SMOKE_EXT || 'dist');
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'margin-home-search-handoff-')), {
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  headless: true, viewport: { width: 1440, height: 900 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
const errors = [], results = [];
const shown = ({ opacity, visibility }) => opacity > 0.1 && visibility !== 'hidden';
const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const assertHero = ({ hero, topbar }) => {
  assert(hero.opacity > 0.9 && hero.visibility === 'visible', 'hero search must be visible');
  assert(topbar.visibility === 'hidden' || topbar.opacity < 0.05, 'topbar search must be hidden');
};
const assertTopbar = ({ hero, topbar }) => {
  assert(topbar.opacity > 0.9 && topbar.visibility === 'visible' && topbar.pointerEvents === 'auto', 'topbar search must be visible and clickable');
  assert(hero.opacity < 0.05 && hero.visibility === 'hidden', 'hero search must be hidden');
};

try {
  await installMocks(ctx);
  const worker = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  await worker.evaluate(() => chrome.storage.local.set({ 'margin:settings': { intro: false } }));
  const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('https://www.bilibili.com/');
  const app = page.locator('#margin-root .app.home');
  await app.locator('.home-grid .card:not(.sk)').first().waitFor();
  await page.waitForFunction(() => {
    const app = document.querySelector('#margin-root')?.shadowRoot?.querySelector('.app.home');
    return app && app.scrollHeight - app.clientHeight >= 360;
  });

  const readSearches = () => app.evaluate((el) => {
    const read = (selector) => {
      const search = el.querySelector(selector);
      const { opacity, visibility, pointerEvents } = getComputedStyle(search);
      return { opacity: Number(opacity), visibility, pointerEvents, rect: search.getBoundingClientRect().toJSON() };
    };
    return { scrollTop: el.scrollTop, hero: read('.hero-search'), topbar: read('.top .search') };
  });
  const scrollTo = async (top) => {
    await app.evaluate((el, value) => { el.scrollTop = value; }, top);
    await page.waitForTimeout(220);
    const state = await readSearches();
    assert.equal(state.scrollTop, top, 'homepage reached the requested scroll position');
    return state;
  };

  assertHero(await scrollTo(0));
  await page.screenshot({ path: join(out, 'top.png') });
  for (let top = 12; top <= 360; top += 12) {
    const state = await scrollTo(top);
    const { hero, topbar } = state;
    const bothShown = shown(hero) && shown(topbar);
    assert(!(bothShown && overlaps(hero.rect, topbar.rect)), `visible search bars overlap at scrollTop ${top}`);
    assert(!bothShown, `both search bars are visible at scrollTop ${top}`);
    if (top === 96) {
      assertTopbar(state);
      await page.screenshot({ path: join(out, 'handoff-scrolled.png') });
    }
  }
  results.push('search bars hand off without overlap in 12px scroll steps through 360px');

  assertHero(await scrollTo(0));
  const input = app.locator('.hero-search .hs-input');
  await input.click();
  assert.equal(await input.getAttribute('aria-expanded'), 'true');
  assertHero(await readSearches());
  assertHero(await scrollTo(96));
  await page.keyboard.press('Escape');
  assert.equal(await input.getAttribute('aria-expanded'), 'false');
  await page.waitForTimeout(220);
  assertTopbar(await readSearches());
  assertTopbar(await scrollTo(160));
  results.push('open hero dropdown keeps the topbar search hidden and Escape resumes the handoff');

  assertHero(await scrollTo(0));
  await page.screenshot({ path: join(out, 'returned-top.png') });
  results.push('hero search returns at the top of the homepage');
  assert.deepEqual(errors, []);
  results.forEach((result) => console.log('PASS ' + result));
} finally {
  writeFileSync(join(out, 'results.json'), JSON.stringify({ results, errors }, null, 2));
  await ctx.close();
}

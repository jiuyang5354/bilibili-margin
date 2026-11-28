import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { installMocks } from './mocks.mjs';

const ext = resolve(process.env.SMOKE_EXT || 'dist');
const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'margin-recovery-search-')), {
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  headless: true, viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce',
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
const errors = [];
let hotRequests = 0, historyRequests = 0;
const staticPlaceholder = '搜索视频、UP 主';
const legacyKey = 'margin:search-history';
const privateKey = 'margin:private-search-history';
const legacy = JSON.stringify(['本机旧搜索']);
const home = 'https://www.bilibili.com/';

try {
  await installMocks(context, url => {
    const path = new URL(url).pathname;
    if (path.endsWith('/search/square')) hotRequests++;
    if (path.endsWith('/history/cursor')) {
      historyRequests++;
      return { code: 0, data: { list: [] } };
    }
  });
  await context.route('**/favicon.ico', route => route.fulfill({ status: 204 }));
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const patch = values => worker.evaluate(async values => {
    const key = 'margin:settings';
    await chrome.storage.local.set({ [key]: { ...(await chrome.storage.local.get(key))[key], ...values } });
  }, values);
  const local = key => worker.evaluate(async key => (await chrome.storage.local.get(key))[key], key);
  await patch({ intro: false, bg: { mode: 'off' }, footprint: true, searchStyle: 'new', hideHotSearch: true,
    dynamicSize: 18, playerCorners: false, rtxCompat: true });
  await worker.evaluate(async () => {
    await chrome.storage.local.set({ 'margin:activity': null });
    const get = chrome.storage.local.get.bind(chrome.storage.local);
    chrome.storage.local.get = keys => {
      if (globalThis.failFootprintRead && Array.isArray(keys) && keys.includes('margin:activity')) {
        return Promise.reject(new Error('Temporary footprint storage failure'));
      }
      return get(keys);
    };
    globalThis.failFootprintRead = true;
  });

  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(home);

  const card = page.locator('#margin-root .fp-card');
  const errorCard = page.locator('#margin-root .fp-card[data-sync-state="read-error"]');
  const empty = errorCard.locator('.fp-empty-state');
  const retry = empty.locator('.fp-sync-btn');
  await retry.waitFor();
  const bounds = await empty.boundingBox();
  const button = await retry.boundingBox();
  assert(button && bounds && button.width < 200 && button.width < bounds.width / 2, JSON.stringify({ bounds, button }));
  assert(button.x >= bounds.x && button.x + button.width <= bounds.x + bounds.width);
  assert.match(await errorCard.getByRole('status').textContent(), /无法读取本机足迹/);
  assert.equal(historyRequests, 0);

  await retry.click();
  await retry.filter({ hasText: '重试同步' }).waitFor();
  assert.equal(historyRequests, 0, 'a failed local reread must not start Bilibili history sync');
  assert.equal(await local('margin:activity'), null);
  await worker.evaluate(() => { globalThis.failFootprintRead = false; });
  await retry.click();
  await empty.waitFor({ state: 'detached' });
  await card.locator('.fp-brief-title').waitFor();
  await page.locator('#margin-root .fp-card[data-sync-state="empty"]').waitFor();
  assert.equal(historyRequests, 1);
  console.log('PASS compact footprint retry and null storage recovery');

  const header = page.locator('#margin-root .top .search');
  const headerInput = header.locator('input');
  const hero = page.locator('#margin-root .hero-search');
  const heroInput = hero.locator('.hs-input');
  const palette = page.getByRole('dialog', { name: '搜索与命令' });
  const paletteInput = palette.getByRole('combobox');
  const heroOptIn = hero.locator('.hs-hist-hint');
  const paletteOptIn = palette.locator('.cp-hist-hint');
  await headerInput.waitFor({ state: 'attached' });
  assert.equal(await header.locator('.search-ph').count(), 0);
  assert.doesNotMatch(await header.getAttribute('class'), /\bhas-hot\b/);
  assert.equal(await headerInput.getAttribute('placeholder'), staticPlaceholder);
  assert.notEqual(await headerInput.evaluate(el => getComputedStyle(el, '::placeholder').color), 'rgba(0, 0, 0, 0)');
  assert.equal(await hero.locator('.hs-ph').textContent(), staticPlaceholder);

  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: legacyKey, value: legacy });
  const settingsBefore = await local('margin:settings');
  assert.equal(settingsBefore.searchHistory ?? false, false);
  await heroInput.focus();
  await heroOptIn.getByRole('button', { name: '开启记录' }).waitFor();
  assert.equal(await hero.locator('.hs-ph.has-hot').count(), 0);
  assert.equal(await hero.getByText('bilibili 热搜', { exact: true }).count(), 0);
  assert.match(await hero.getAttribute('class'), /\bhas-list\b/);
  assert.equal(await hero.locator('.hs-opt').count(), 0);
  await heroInput.press('ArrowDown');
  assert.equal(await heroInput.getAttribute('aria-activedescendant'), null);
  const pageCount = context.pages().length;
  await heroInput.press('Enter');
  assert.equal(context.pages().length, pageCount);
  assert.equal(page.url(), home);
  await heroInput.press('Escape');
  await page.keyboard.press('/');
  await paletteOptIn.getByRole('button', { name: '开启记录' }).waitFor();
  assert.equal(await paletteInput.getAttribute('placeholder'), staticPlaceholder);
  assert.equal(await palette.getByText('bilibili 热搜', { exact: true }).count(), 0);
  assert.equal(await local(privateKey), undefined);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), legacyKey), legacy);
  assert.deepEqual(await local('margin:settings'), settingsBefore);
  assert.equal(hotRequests, 0);

  await paletteInput.press('Escape');
  await palette.waitFor({ state: 'hidden' });
  await heroInput.focus();
  await heroOptIn.getByRole('button', { name: '开启记录' }).click();
  await heroOptIn.waitFor({ state: 'detached' });
  await hero.locator('.hs-chip').getByText('本机旧搜索').waitFor();
  assert.equal((await local('margin:settings')).searchHistory, true);
  assert.equal(await heroInput.evaluate(el => el.getRootNode().activeElement === el), true);
  await page.waitForFunction(key => localStorage.getItem(key) === null, legacyKey);

  await heroInput.press('Escape');
  await patch({ searchHistory: false });
  await page.keyboard.press('/');
  await paletteOptIn.getByRole('button', { name: '开启记录' }).click();
  await paletteOptIn.waitFor({ state: 'detached' });
  assert.equal((await local('margin:settings')).searchHistory, true);
  assert.equal(await paletteInput.evaluate(el => el.getRootNode().activeElement === el), true);
  console.log('PASS both search-history opt-in buttons preserve focus and default privacy');

  await patch({ hideHotSearch: false });
  await header.locator('.search-ph-w').waitFor({ state: 'attached' });
  await palette.getByText('bilibili 热搜', { exact: true }).waitFor();
  assert(hotRequests > 0);
  await paletteInput.press('Escape');
  await palette.waitFor({ state: 'hidden' });
  await heroInput.focus();
  await hero.getByText('bilibili 热搜', { exact: true }).waitFor();
  await heroInput.press('Escape');
  await patch({ homeHide: ['search'] });
  await header.click();
  await palette.getByText('bilibili 热搜', { exact: true }).waitFor();
  assert.notEqual(await paletteInput.getAttribute('placeholder'), staticPlaceholder);
  await patch({ hideHotSearch: true });
  await palette.getByText('bilibili 热搜', { exact: true }).waitFor({ state: 'detached' });
  await header.locator('.search-ph').waitFor({ state: 'detached' });
  assert.equal(await paletteInput.getAttribute('placeholder'), staticPlaceholder);
  console.log('PASS hot search updates across all three surfaces');

  const appearance = () => page.locator('html').evaluate(el => ({
    size: el.style.getPropertyValue('--margin-dfs'),
    square: el.classList.contains('margin-player-square'),
    rtx: el.classList.contains('margin-rtx-compat'),
  }));
  assert.deepEqual(await appearance(), { size: '18px', square: true, rtx: true });
  await patch({ dynamicSize: 16, playerCorners: true, rtxCompat: false });
  await page.locator('html:not(.margin-player-square):not(.margin-rtx-compat)').waitFor({ state: 'attached' });
  assert.deepEqual(await appearance(), { size: '', square: false, rtx: false });
  assert.deepEqual(errors, []);
  console.log('PASS reactive CSS settings and zero console or page errors');
} finally {
  await context.close();
}

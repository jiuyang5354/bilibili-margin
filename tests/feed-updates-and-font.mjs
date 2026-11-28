import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { installMocks } from './mocks.mjs';

const ext = resolve(process.env.SMOKE_EXT || 'dist');
const context = await chromium.launchPersistentContext('', {
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  headless: true, args: ['--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});

try {
  const feedPath = '/x/polymer/web-dynamic/v1/feed/all';
  const polls = [];
  let loads = 0;
  let hotRequests = 0;
  await installMocks(context, url => {
    const { pathname, searchParams } = new URL(url);
    if (pathname.endsWith('/search/square')) hotRequests++;
    if (pathname === `${feedPath}/update`) {
      polls.push([searchParams.get('type'), searchParams.get('update_baseline')]);
      return { code: 0, data: { update_num: 3 } };
    }
    if (pathname !== feedPath) return;
    loads++;
    return { code: 0, data: {
      has_more: false, offset: '', update_baseline: `baseline-${loads}`,
      items: [{
        id_str: String(loads), type: 'DYNAMIC_TYPE_WORD',
        modules: { module_author: { mid: 1, name: '测试 UP' }, module_dynamic: { desc: { text: `动态版本 ${loads}` } } },
      }],
    } };
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const setSettings = patch => worker.evaluate(async patch => {
    const key = 'margin:settings';
    const stored = await chrome.storage.local.get(key);
    await chrome.storage.local.set({ [key]: { ...stored[key], ...patch } });
  }, patch);
  await setSettings({ intro: false, weather: false, footprint: false, msgRemind: false, hideHotSearch: true, bg: { mode: 'off' } });
  const page = await context.newPage();
  page.setDefaultTimeout(6500);
  await page.goto('https://t.bilibili.com/');
  const body = page.locator('#margin-root .fd-list .dy-text');
  const hot = page.locator('#margin-root .fd-hot');
  await body.waitFor();
  assert.equal(await body.evaluate(el => getComputedStyle(el).fontSize), '16px');
  await setSettings({ dynamicSize: 20 });
  await page.waitForFunction(() => {
    const text = document.querySelector('#margin-root')?.shadowRoot.querySelector('.fd-list .dy-text');
    return text && getComputedStyle(text).fontSize === '20px';
  });
  assert.equal(await hot.count(), 0);
  assert.equal(hotRequests, 0);

  const firstRead = loads;
  const pill = page.getByRole('button', { name: '有 3 条新动态 · 点击刷新', exact: true });
  await pill.waitFor({ timeout: 70_000 });
  assert.deepEqual(polls, [['all', `baseline-${firstRead}`]]);
  assert.equal(loads, firstRead);
  await pill.click();
  await page.locator('.fd-new-pill').waitFor({ state: 'hidden' });
  await body.filter({ hasText: `动态版本 ${firstRead + 1}` }).waitFor();

  const auto = page.getByRole('switch', { name: '自动刷新' });
  assert.equal(await auto.getAttribute('aria-checked'), 'false');
  await auto.click();
  await page.getByRole('switch', { name: '自动刷新', checked: true }).waitFor();
  assert.equal(await worker.evaluate(async () => (await chrome.storage.local.get('margin:settings'))['margin:settings'].feedAutoRefresh), true);
  const app = page.locator('#margin-root .app');
  await app.evaluate(el => el.scrollTo({ top: 0, behavior: 'instant' }));
  const manualRead = loads;
  await page.getByText('已自动更新 3 条新动态', { exact: true }).waitFor({ timeout: 70_000 });
  await body.filter({ hasText: `动态版本 ${manualRead + 1}` }).waitFor();
  assert.deepEqual(polls.at(-1), ['all', `baseline-${manualRead}`]);
  assert.equal(await pill.isVisible(), false);
  assert.equal(hotRequests, 0);
  await setSettings({ hideHotSearch: false });
  await hot.locator('ol').waitFor();
  assert(hotRequests > 0);
  await setSettings({ hideHotSearch: true });
  await hot.waitFor({ state: 'detached' });
  console.log('PASS feed font size, hot-search visibility, new-items pill and persisted auto-refresh');
} finally {
  await context.close();
}

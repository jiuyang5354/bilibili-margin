// #258 播放页固定顶栏下滚自动隐藏：默认关闭保持现状；开启后下滚收起并放行点击，上滚 / 回到顶部 / 移到顶缘 / 打开抽屉恢复；减少动画时无过渡。
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { installMocks } from './mocks.mjs';

const out = resolve(process.env.SMOKE_OUT || 'tests/artifacts/watch-header-autohide');
mkdirSync(out, { recursive: true });
const ext = resolve(process.env.SMOKE_EXT || 'dist');
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'margin-watch-autohide-')), {
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  headless: true, viewport: { width: 1600, height: 900 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
const results = [], errors = [];
const headerState = (page) => page.evaluate(() => {
  const root = document.getElementById('margin-watch-top').shadowRoot;
  const app = root.querySelector('.app.wt');
  const top = root.querySelector('.top');
  const search = root.querySelector('.search');
  const sr = search.getBoundingClientRect();
  const hitSearch = root.elementFromPoint(sr.left + sr.width / 2, 35);
  return {
    hiddenAttr: app.hasAttribute('data-header-hidden'),
    htmlClass: document.documentElement.classList.contains('margin-watch-header-hidden'),
    scrollPadding: getComputedStyle(document.documentElement).scrollPaddingTop,
    topBottom: Math.round(top.getBoundingClientRect().bottom),
    opacity: Number(getComputedStyle(top).opacity),
    transition: getComputedStyle(top).transitionDuration,
    searchClickable: !!hitSearch && (search === hitSearch || search.contains(hitSearch)),
  };
});
try {
  await installMocks(ctx);
  const worker = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  await worker.evaluate(() => chrome.storage.local.set({
    'margin:settings': { intro: false, weather: false, footprint: false, bg: { mode: 'off' }, theme: 'dark', autoWeb: false, wide: false, watchHeaderHide: false },
  }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('https://www.bilibili.com/video/BV1mdxN68E7F/');
  await page.locator('#margin-watch-top .top').waitFor({ state: 'attached' });
  await page.evaluate(() => { document.querySelector('#commentapp').style.minHeight = '3200px'; });

  // 默认关闭：下滚保持显示
  await page.evaluate(() => scrollTo({ top: 900, behavior: 'instant' }));
  await page.waitForTimeout(260);
  const offState = await headerState(page);
  assert.equal(offState.hiddenAttr, false);
  assert.equal(offState.searchClickable, true);
  assert.equal(offState.scrollPadding, '96px');
  results.push('default off keeps the watch header visible while scrolling');

  // 通过设置开关打开
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.locator('#margin-watch-top .hd-settings').click();
  const dialog = page.getByRole('dialog', { name: '设置', exact: true });
  await dialog.getByRole('tab', { name: '播放页', exact: true }).click();
  const sw = dialog.getByRole('switch', { name: '顶栏下滚自动隐藏', exact: true });
  assert.equal(await sw.getAttribute('aria-checked'), 'false');
  await sw.click();
  await page.waitForFunction(() => document.getElementById('margin-watch-top').shadowRoot.querySelector('[aria-label="顶栏下滚自动隐藏"]')?.getAttribute('aria-checked') === 'true');
  assert.equal(await worker.evaluate(async () => (await chrome.storage.local.get('margin:settings'))['margin:settings'].watchHeaderHide), true);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  await page.mouse.move(800, 400);
  await page.screenshot({ path: join(out, 'visible.png'), clip: { x: 0, y: 0, width: 1600, height: 140 } });

  // 下滚超过阈值后自动隐藏且不拦截点击
  await page.evaluate(() => scrollTo({ top: 900, behavior: 'instant' }));
  await page.waitForTimeout(300);
  const hidden = await headerState(page);
  assert.equal(hidden.hiddenAttr, true);
  assert.equal(hidden.htmlClass, true);
  assert.equal(hidden.scrollPadding, 'auto');
  assert(hidden.topBottom <= 0 && hidden.opacity === 0, JSON.stringify(hidden));
  assert.equal(hidden.searchClickable, false, 'hidden header must pass clicks through');
  await page.screenshot({ path: join(out, 'hidden.png'), clip: { x: 0, y: 0, width: 1600, height: 140 } });
  results.push('scrolling down hides the watch header and passes clicks through');

  // 鼠标移到顶部边缘恢复显示
  await page.mouse.move(800, 6);
  await page.waitForTimeout(300);
  const edge = await headerState(page);
  assert.equal(edge.hiddenAttr, false);
  assert.equal(edge.searchClickable, true);
  results.push('moving pointer to the top edge reveals the header');

  // 移开指针继续下滚再次隐藏，上滚恢复显示
  await page.mouse.move(800, 400);
  await page.evaluate(() => scrollTo({ top: 1300, behavior: 'instant' }));
  await page.waitForTimeout(300);
  assert.equal((await headerState(page)).hiddenAttr, true);
  await page.evaluate(() => scrollTo({ top: 1120, behavior: 'instant' }));
  await page.waitForTimeout(300);
  assert.equal((await headerState(page)).hiddenAttr, false);
  results.push('scrolling up reveals the hidden watch header');

  // 抽屉打开期间即使下滚也保持顶栏不被隐藏
  await page.locator('#margin-watch-top .hd-settings').click();
  await dialog.waitFor();
  await page.evaluate(() => scrollTo({ top: 1600, behavior: 'instant' }));
  await page.waitForTimeout(260);
  assert.equal((await headerState(page)).hiddenAttr, false, 'header stays pinned while a drawer is open');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  results.push('open drawers pin the watch header visible');

  // 减少动画时直接切换，不做过渡
  await worker.evaluate(async () => {
    const cur = (await chrome.storage.local.get('margin:settings'))['margin:settings'];
    await chrome.storage.local.set({ 'margin:settings': { ...cur, reduceMotion: true } });
  });
  await page.locator('#margin-watch-top .app.margin-reduce').waitFor();
  const reduced = await headerState(page);
  assert(parseFloat(reduced.transition) <= 0.001, `reduced motion should disable header slide transition: ${reduced.transition}`);
  results.push('reduced motion toggles the watch header without transition');

  // 关闭开关后在已下滚状态下立刻恢复显示
  await page.mouse.move(800, 400);
  await page.evaluate(() => scrollTo({ top: 2000, behavior: 'instant' }));
  await page.waitForTimeout(100);
  assert.equal((await headerState(page)).hiddenAttr, true);
  await worker.evaluate(async () => {
    const cur = (await chrome.storage.local.get('margin:settings'))['margin:settings'];
    await chrome.storage.local.set({ 'margin:settings': { ...cur, watchHeaderHide: false, reduceMotion: false } });
  });
  await page.waitForFunction(() => {
    const root = document.getElementById('margin-watch-top').shadowRoot;
    return !root.querySelector('.app.wt').hasAttribute('data-header-hidden')
      && root.querySelector('.top').getBoundingClientRect().top >= -0.5;
  });
  assert.equal((await headerState(page)).searchClickable, true);
  results.push('turning the toggle off restores the header immediately');

  assert.deepEqual(errors, []);
  results.forEach((r) => console.log('PASS ' + r));
} finally {
  writeFileSync(join(out, 'results.json'), JSON.stringify({ results, errors }, null, 2));
  await ctx.close();
}

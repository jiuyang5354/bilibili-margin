import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { installMocks } from './mocks.mjs';

const ext = resolve(process.env.SMOKE_EXT || 'dist');
const out = resolve(process.env.SMOKE_OUT || 'tests/artifacts/classic-throwback-sources');
mkdirSync(out, { recursive: true });
const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'margin-classic-')), {
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  headless: true, viewport: { width: 1440, height: 960 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});

const reasons = { follow: '关注老片', like: '赞过', coin: '投币过', fav: '收藏过' };
const now = Math.floor(Date.now() / 1000);
const video = (source, id) => ({
  bvid: `BVclassic_${source}_${id}`, title: `${reasons[source]}的视频 ${id}`,
  pic: `https://i0.hdslb.com/bfs/archive/classic-${source}-${id}.jpg`, duration: 180, pubdate: now - 3600,
  owner: { mid: 500, name: '回顾测试 UP' }, stat: { view: 36000, danmaku: 90 },
});
const ok = data => ({ code: 0, data });
const errors = [];

try {
  await installMocks(context, url => {
    const { pathname, searchParams } = new URL(url);
    switch (pathname) {
      case '/x/relation/followings':
        return ok({ list: [{ mid: 101 }, { mid: 102 }] });
      case '/x/space/wbi/arc/search': {
        const mid = Number(searchParams.get('mid'));
        return ok({ list: { vlist: Array.from({ length: 4 }, (_, i) => ({
          ...video('follow', `${mid}-${i}`), mid, author: '关注的 UP 主', length: '03:00', play: 36000,
          created: i === 3 ? now : now - 180 * 86400,
        })) } });
      }
      case '/x/space/like/video':
      case '/x/space/coin/video': {
        const source = pathname.split('/')[3];
        return ok(Array.from({ length: 12 }, (_, i) => video(source, i + 1)));
      }
      case '/x/v3/fav/folder/created/list':
        return ok({ list: [{ id: 701, title: '回顾测试收藏夹', media_count: 8, attr: 0 }] });
      case '/x/v3/fav/resource/list':
        return ok({ medias: Array.from({ length: 8 }, (_, i) => {
          const item = video('fav', i + 1);
          return { ...item, type: 2, attr: 0, cover: item.pic, upper: item.owner, cnt_info: { play: 36000 }, pubtime: now - 350 * 86400 };
        }) });
    }
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const save = patch => worker.evaluate(async patch => {
    const key = 'margin:settings';
    const stored = (await chrome.storage.local.get(key))[key];
    await chrome.storage.local.set({ [key]: { ...stored, ...patch } });
  }, patch);
  await save({ intro: false, weather: false, footprint: false, theme: 'light', glass: 'soft', bg: { mode: 'off' } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('https://www.bilibili.com/');

  const bar = page.locator('#margin-root .bar');
  const group = bar.getByRole('group', { name: '老片回顾来源', exact: true });
  const selector = bar.locator('.classic-sources');
  const tab = id => bar.locator(`.tab[data-tab="${id}"]`);
  const pill = source => group.locator(`button[data-src="${source}"]`);
  const cards = page.locator('#margin-root .home-grid > .card:not(.sk)');
  const checkCards = async sources => {
    for (const source of sources) await cards.locator(`.reason[title="${reasons[source]}"]`).first().waitFor();
    const actual = await cards.evaluateAll(els => els.map(card => ({
      id: card.querySelector('a.title').href.split('/').at(-1),
      reason: card.querySelector('.reason')?.textContent,
    })));
    const used = actual.map(card => card.id.split('_')[1]);
    assert.deepEqual(new Set(used), new Set(sources));
    assert.equal(new Set(actual.map(card => card.id)).size, actual.length);
    actual.forEach(({ reason }, i) => assert.equal(reason, reasons[used[i]]));
    assert(actual.every(({ id }) => !/^BVclassic_follow_\d+-3$/.test(id)), 'recent followed uploads must be excluded');
  };
  for (const id of ['rcmd', 'popular', 'following']) {
    await tab(id).click();
    await bar.locator(`.tab[data-tab="${id}"][aria-selected="true"]`).waitFor();
    assert.equal(await selector.evaluate(el => getComputedStyle(el).display), 'none', `${id} must have no source selector footprint`);
  }
  await tab('classic').click();
  await group.waitFor();
  assert.equal(await tab('classic').textContent(), '老片回顾');
  assert.deepEqual(await group.getByRole('button').allTextContents(), ['关注', '点赞', '投币', '收藏']);
  assert.equal(await group.locator('[aria-pressed="true"]').count(), 4);
  await checkCards(['follow', 'like', 'coin', 'fav']);
  await page.screenshot({ path: join(out, 'classic-mixed.png') });

  for (const source of ['follow', 'fav']) {
    await pill(source).click();
    await group.locator(`[data-src="${source}"][aria-pressed="false"]`).waitFor();
  }
  await checkCards(['like', 'coin']);
  await page.screenshot({ path: join(out, 'classic-filtered.png') });

  await page.locator('#margin-root .top [aria-label="设置"]').click();
  const settings = page.getByRole('dialog', { name: '设置', exact: true });
  await settings.getByRole('tab', { name: '首页', exact: true }).click();
  const block = settings.locator('.block').filter({ hasText: '老片回顾来源' });
  assert.deepEqual(await block.locator('[aria-pressed="true"]').allTextContents(), ['点赞过', '投币过']);
  await block.getByRole('button', { name: '投币过', exact: true }).click();
  await selector.locator('[data-src="coin"][aria-pressed="false"]').waitFor({ state: 'attached' });
  await block.getByRole('button', { name: '点赞过', exact: true }).click();
  assert.equal(await block.getByRole('button', { name: '点赞过', exact: true }).getAttribute('aria-pressed'), 'true');
  await settings.getByRole('searchbox', { name: '搜索设置' }).focus();
  await page.keyboard.press('Escape');
  await settings.waitFor({ state: 'hidden' });
  await checkCards(['like']);
  await pill('like').click();
  assert.equal(await pill('like').getAttribute('aria-pressed'), 'true');
  await page.getByText('至少保留一种回顾来源', { exact: true }).waitFor();

  await tab('rcmd').click();
  await save({ classicSources: ['fav'] });
  await bar.locator('.classic-sources [data-src="fav"][aria-pressed="true"]').waitFor({ state: 'attached' });
  await tab('classic').click();
  await checkCards(['fav']);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator('#margin-root .app').evaluate(app => { app.scrollTop = 600; });
  await page.locator('#margin-root .bar.stuck').waitFor();
  const glass = () => selector.evaluate(el => {
    const bar = el.closest('.bar');
    const main = el.closest('.main');
    const { left, right, height } = el.getBoundingClientRect();
    const overflow = Math.max(bar.scrollWidth - bar.clientWidth, main.scrollWidth - main.clientWidth);
    return { left, right, height, overflow, filter: getComputedStyle(el).backdropFilter };
  });
  const mobile = await glass();
  assert.equal(mobile.height, 40);
  assert(mobile.left >= 0 && mobile.right <= 375 && mobile.overflow === 0, JSON.stringify(mobile));
  assert.notEqual(mobile.filter, 'none', 'sticky source selector uses the glass surface');
  await save({ glass: 'flat' });
  await page.locator('#margin-root .app[data-glass="flat"]').waitFor();
  assert.equal((await glass()).filter, 'none');
  assert.deepEqual(errors, []);
  console.log('PASS classic source mix, two-way settings sync, last source, and 375px sticky glass');
} finally {
  await context.close();
}

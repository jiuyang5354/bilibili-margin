// 历史记录删空某个日期分组后，继续翻页加载同一天的更早记录仍能正常插入列表，且计数同步更新。
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { installMocks } from './mocks.mjs';

const out = resolve(process.env.SMOKE_OUT || 'tests/artifacts/history-delete-pagination');
mkdirSync(out, { recursive: true });
const ext = resolve(process.env.SMOKE_EXT || 'dist');
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'margin-hist-del-')), {
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  headless: true, viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
const results = [], errors = [];
const json = (route, body) => route.fulfill({
  status: 200,
  contentType: 'application/json',
  headers: {
    'access-control-allow-origin': route.request().headers().origin || 'https://www.bilibili.com',
    'access-control-allow-credentials': 'true',
  },
  body: JSON.stringify(body),
});

// 使用今天与昨天正午附近的时间戳，避免跨午夜导致 dayBucket 变化。
const noon = new Date();
noon.setHours(12, 0, 0, 0);
const todayNoon = Math.floor(noon.getTime() / 1000);
const yesterdayNoon = todayNoon - 86400;
const item = (oid, bvid, title, viewAt) => ({
  title,
  cover: 'https://i0.hdslb.com/bfs/archive/test.jpg',
  author_name: '映间测试',
  author_mid: 1001,
  author_face: 'https://i0.hdslb.com/bfs/face/test.jpg',
  view_at: viewAt,
  progress: 60,
  duration: 300,
  badge: '',
  live_status: 0,
  history: { business: 'archive', oid, bvid, dt: 2 },
});

// 第一页：16 条今天（把哨兵推到 900px 预加载区之外）+ 1 条昨天（末组）。
const page1Items = [
  ...Array.from({ length: 16 }, (_, i) => item(100 + i, `BV10000001${String(i).padStart(2, '0')}`, `今天记录 ${i + 1}`, todayNoon - i * 60)),
  item(201, 'BV1000000201', '昨天第一页唯一记录', yesterdayNoon),
];

let releasePage2;
let page2Started;
const page2Requested = new Promise((r) => { page2Started = r; });

try {
  await installMocks(ctx);
  await ctx.route('**/x/web-interface/history/cursor?*', async (route) => {
    const url = new URL(route.request().url());
    const max = Number(url.searchParams.get('max') || 0);
    if (!max) {
      await json(route, {
        code: 0,
        data: {
          cursor: { max: 201, view_at: yesterdayNoon - 60, business: 'archive' },
          list: page1Items,
        },
      });
      return;
    }
    page2Started();
    await new Promise((r) => { releasePage2 = r; });
    await json(route, {
      code: 0,
      data: {
        cursor: { max: 0, view_at: 0, business: '' },
        list: [
          item(202, 'BV1000000202', '昨天第二页同天记录', yesterdayNoon - 120),
        ],
      },
    }).catch(() => {});
  });

  const worker = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  await worker.evaluate(() => chrome.storage.local.set({
    'margin:settings': { intro: false, weather: false, footprint: false, bg: { mode: 'off' }, theme: 'dark' },
  }));

  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('https://www.bilibili.com/history', { waitUntil: 'domcontentloaded' });

  const root = page.locator('#margin-root');
  await root.locator('.hi-title', { hasText: '昨天第一页唯一记录' }).waitFor();
  assert.equal(await root.locator('.hi-group').count(), 2);
  assert.equal(await root.locator('.hi-head .eyebrow span').last().textContent(), '17+ 条');

  // 滚到底部触发第二页请求（先挂起），同时删空「昨天」分组。
  const yesterdayRow = root.locator('.hi-row', { hasText: '昨天第一页唯一记录' });
  await yesterdayRow.scrollIntoViewIfNeeded();
  await page2Requested;
  await yesterdayRow.locator('.hi-del').click();
  await page.waitForFunction(() => document.getElementById('margin-root')?.shadowRoot?.querySelectorAll('.hi-group').length === 1);
  assert.equal(await root.locator('.hi-head .eyebrow span').last().textContent(), '16+ 条');
  results.push('deleting the last entry removes its empty day group and decrements the counter');

  // 放行第二页（返回同属「昨天」的记录），验证会新建已挂载的日期分组而不是插进已脱离 DOM 的旧 <ol>。
  releasePage2();
  await root.locator('.hi-title', { hasText: '昨天第二页同天记录' }).waitFor();
  assert.equal(await root.locator('.hi-group').count(), 2);
  assert.equal(await root.locator('.hi-day').count(), 2);
  assert.equal(await root.locator('.hi-head .eyebrow span').last().textContent(), '17 条');
  results.push('paginated entries from the same day recreate a connected day group instead of vanishing');

  // 验证只剩 1 条记录时删空能清空计数并展示空态。
  await ctx.unroute('**/x/web-interface/history/cursor?*');
  await ctx.route('**/x/web-interface/history/cursor?*', (route) => json(route, {
    code: 0,
    data: {
      cursor: { max: 0, view_at: 0, business: '' },
      list: [item(301, 'BV1000000301', '最后一条记录', todayNoon)],
    },
  }));
  await page.goto('https://www.bilibili.com/history', { waitUntil: 'domcontentloaded' });
  await root.locator('.hi-title', { hasText: '最后一条记录' }).waitFor();
  await root.locator('.hi-row .hi-del').first().click();
  await root.locator('.ms-empty').waitFor();
  assert.equal(await root.locator('.hi-head .eyebrow span').last().textContent(), '');
  results.push('deleting the final entry clears the counter and renders the empty state');

  assert.deepEqual(errors, []);
  results.forEach((r) => console.log('PASS ' + r));
} finally {
  releasePage2?.();
  writeFileSync(join(out, 'results.json'), JSON.stringify({ results, errors }, null, 2));
  await ctx.close();
}

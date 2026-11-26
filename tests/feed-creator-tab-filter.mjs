// 动态页选中单个 UP 后，切换「视频投稿 / 追番追剧 / 专栏」标签应只保留对应类型，首屏无匹配时提供「继续查找…」翻页。
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { installMocks } from './mocks.mjs';

const out = resolve(process.env.SMOKE_OUT || 'tests/artifacts/feed-creator-tab-filter');
mkdirSync(out, { recursive: true });
const ext = resolve(process.env.SMOKE_EXT || 'dist');
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'margin-feed-tab-')), {
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  headless: true, viewport: { width: 1440, height: 900 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});

const results = [], errors = [];
const post = (id, type, text) => ({
  id_str: id,
  type: `DYNAMIC_TYPE_${type}`,
  modules: {
    module_author: { mid: 5001, name: '测试UP', face: 'https://i0.hdslb.com/bfs/face/test.jpg', pub_ts: Math.floor(Date.now() / 1000) - 60 },
    module_dynamic: {
      desc: { text },
      ...(type === 'AV' ? { major: { archive: { bvid: 'BV1000000501', title: '测试投稿标题', cover: 'https://i0.hdslb.com/bfs/archive/test.jpg', duration_text: '03:20', stat: { play: '1.2万' }, desc: '' } } } : {}),
    },
  },
});

try {
  await installMocks(ctx, (raw) => {
    const u = new URL(raw);
    if (u.pathname.includes('/web-dynamic/v1/portal')) {
      return { code: 0, data: { up_list: [{ mid: 5001, uname: '测试UP', face: 'https://i0.hdslb.com/bfs/face/test.jpg', has_update: false }], live_users: { count: 0, items: [] } } };
    }
    if (u.pathname.includes('/web-dynamic/v1/feed/all')) {
      const hostMid = Number(u.searchParams.get('host_mid') || 0);
      const offset = u.searchParams.get('offset') || '';
      if (hostMid === 5001) {
        // 第 1 页不含专栏，测试「专栏」标签的「继续查找专栏」续翻；第 2 页包含专栏与番剧。
        if (!offset) {
          return {
            code: 0,
            data: {
              items: [
                post('1', 'WORD', '纯文字动态正文'),
                post('2', 'AV', '视频投稿附言'),
                post('3', 'PGC_UNION', '番剧更新动态'),
              ],
              has_more: true,
              offset: 'p2',
            },
          };
        }
        return {
          code: 0,
          data: {
            items: [post('4', 'ARTICLE', '第二页专栏动态')],
            has_more: false,
            offset: '',
          },
        };
      }
      return { code: 0, data: { items: [post('0', 'WORD', '全部流首页动态')], has_more: false, offset: '' } };
    }
  });

  const worker = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  await worker.evaluate(() => chrome.storage.local.set({
    'margin:settings': { intro: false, weather: false, footprint: false, bg: { mode: 'off' }, theme: 'dark', feedFollowList: false },
  }));

  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('https://t.bilibili.com/', { waitUntil: 'domcontentloaded' });

  const root = page.locator('#margin-root');
  const list = root.locator('.fd-list');
  await list.getByText('全部流首页动态', { exact: true }).waitFor();

  // 选中测试 UP
  await root.locator('.fd-ups .fd-up[data-mid="5001"]').click();
  await list.getByText('纯文字动态正文', { exact: true }).waitFor();
  assert.equal(await list.getByText('视频投稿附言', { exact: true }).count(), 1);
  assert.equal(await list.getByText('番剧更新动态', { exact: true }).count(), 1);

  // 切到「视频投稿」：仅显示 AV，不显示纯文字或番剧
  await root.getByRole('tab', { name: '视频投稿' }).click();
  await list.getByText('视频投稿附言', { exact: true }).waitFor();
  assert.equal(await list.getByText('纯文字动态正文', { exact: true }).count(), 0);
  assert.equal(await list.getByText('番剧更新动态', { exact: true }).count(), 0);
  results.push('video tab filters a selected creator to DYNAMIC_TYPE_AV');

  // 切到「追番追剧」：仅显示 PGC_UNION
  await root.getByRole('tab', { name: '追番追剧' }).click();
  await list.getByText('番剧更新动态', { exact: true }).waitFor();
  assert.equal(await list.getByText('纯文字动态正文', { exact: true }).count(), 0);
  assert.equal(await list.getByText('视频投稿附言', { exact: true }).count(), 0);
  results.push('pgc tab filters a selected creator to PGC entries');

  // 切到「专栏」：第 1 页无专栏 -> 出现「继续查找专栏」，点击后加载第 2 页的专栏条目
  await root.getByRole('tab', { name: '专栏' }).click();
  await root.getByRole('button', { name: '继续查找专栏' }).click();
  await list.getByText('第二页专栏动态', { exact: true }).waitFor();
  assert.equal(await list.getByText('纯文字动态正文', { exact: true }).count(), 0);
  assert.equal(await list.getByText('视频投稿附言', { exact: true }).count(), 0);
  results.push('article tab offers continue-searching button on empty first page and loads matching page 2');

  assert.deepEqual(errors, []);
  results.forEach((r) => console.log('PASS ' + r));
} finally {
  writeFileSync(join(out, 'results.json'), JSON.stringify({ results, errors }, null, 2));
  await ctx.close();
}

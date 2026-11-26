// 消息中心被动轮询 / 窗口聚焦在已翻页或已往下滚时只更新未读角标，不清空列表、不跳回顶部；在第 1 页顶部有新未读时自动刷新并保留滚动位置。
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { installMocks } from './mocks.mjs';

const out = resolve(process.env.SMOKE_OUT || 'tests/artifacts/message-refresh');
mkdirSync(out, { recursive: true });
const ext = resolve(process.env.SMOKE_EXT || 'dist');
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'margin-msg-refresh-')), {
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  headless: true, viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});

const results = [], errors = [];
const now = Math.floor(Date.now() / 1000);
const replyItem = (id, text, offset) => ({
  id,
  reply_time: now - offset,
  user: { mid: 2000 + id, nickname: `读者${id}`, avatar: 'https://i0.hdslb.com/bfs/face/test.jpg' },
  item: { type: 'video', title: `测试视频 ${id}`, source_content: text, target_reply_content: '原评论内容', uri: 'https://www.bilibili.com/video/BV1mdxN68E7F' },
});

let unreadReply = 0;
let latestReply = '';
let replyCalls = 0;

try {
  await installMocks(ctx, (raw) => {
    const u = new URL(raw);
    if (u.pathname.endsWith('msgfeed/unread')) {
      return { code: 0, data: { reply: unreadReply, at: 0, like: 0, sys_msg: 0 } };
    }
    if (u.pathname.endsWith('single_unread')) {
      return { code: 0, data: { follow_unread: 0, unfollow_unread: 0 } };
    }
    if (u.pathname.endsWith('/x/msgfeed/reply')) {
      replyCalls++;
      const cursorId = Number(u.searchParams.get('id') || 0);
      if (!cursorId) {
        const items = [
          ...(latestReply ? [replyItem(99, latestReply, 10)] : []),
          ...Array.from({ length: 12 }, (_, i) => replyItem(1 + i, `第一页回复 ${i + 1}`, 60 + i * 60)),
        ];
        return { code: 0, data: { items, cursor: { id: 12, time: now - 800, is_end: false } } };
      }
      return {
        code: 0,
        data: {
          items: Array.from({ length: 4 }, (_, i) => replyItem(20 + i, `第二页旧回复 ${i + 1}`, 1200 + i * 60)),
          cursor: { id: 24, time: now - 1500, is_end: true },
        },
      };
    }
  });

  const worker = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  await worker.evaluate(() => chrome.storage.local.set({
    'margin:settings': { intro: false, weather: false, footprint: false, bg: { mode: 'off' }, theme: 'dark', msgRemind: true },
  }));

  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('https://message.bilibili.com/#/reply', { waitUntil: 'domcontentloaded' });
  const root = page.locator('#margin-root');
  const app = root.locator('.app');
  await root.locator('.ms-text', { hasText: '第一页回复 1' }).first().waitFor();

  // 1) 点击「加载更多」翻到第 2 页并往下滚，等待超过 10s 去抖窗口后触发被动聚焦刷新：
  //    不能清空已翻页列表或弹回顶部，同时仍应更新左侧未读红点。
  await root.locator('.ms-more').click();
  await root.locator('.ms-text', { hasText: '第二页旧回复 1' }).waitFor();
  await app.evaluate((el) => { el.scrollTop = 600; });
  const beforeScroll = await app.evaluate((el) => el.scrollTop);
  assert.ok(beforeScroll >= 500, `expected .app scrollTop >= 500, got ${beforeScroll}`);

  await page.waitForTimeout(10_300);
  const callsBeforePaginatedPoll = replyCalls;
  unreadReply = 2;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await root.locator('.ms-item[data-view="reply"] .ms-n').getByText('2', { exact: true }).waitFor();
  await page.waitForTimeout(200);
  assert.equal(replyCalls, callsBeforePaginatedPoll, 'passive refresh must not wipe paginated list');
  assert.equal(await root.locator('.ms-text', { hasText: '第二页旧回复 1' }).count(), 1);
  assert.equal(await app.evaluate((el) => el.scrollTop), beforeScroll);
  results.push('passive refresh updates unread badge without wiping paginated items or resetting scrollTop');

  // 2) 重选当前分类属于主动刷新，不受 10s 去抖限制，立即重拉第 1 页。
  unreadReply = 0;
  await root.locator('.ms-item[data-view="reply"]').click();
  await page.waitForFunction(() => !document.getElementById('margin-root')?.shadowRoot?.textContent?.includes('第二页旧回复 1'));
  await root.locator('.ms-text', { hasText: '第一页回复 1' }).first().waitFor();
  results.push('re-selecting the current category triggers immediate manual refresh');

  // 3) 停在第 1 页顶部附近（scrollTop = 20）时：无新未读不无谓重拉；有新未读则自动刷新并在渲染后恢复 .app.scrollTop。
  await app.evaluate((el) => { el.scrollTop = 20; });
  await page.waitForTimeout(10_300);
  const callsBeforeIdlePoll = replyCalls;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(200);
  assert.equal(replyCalls, callsBeforeIdlePoll, 'passive poll without new unread should not re-fetch list');

  unreadReply = 1;
  latestReply = '刚刚到达的新回复';
  await page.waitForTimeout(10_300);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await root.locator('.ms-text', { hasText: '刚刚到达的新回复' }).waitFor();
  assert.equal(await app.evaluate((el) => el.scrollTop), 20);
  results.push('passive refresh reloads page 1 near top only when unread arrives and restores .app scrollTop');

  assert.deepEqual(errors, []);
  results.forEach((r) => console.log('PASS ' + r));
} finally {
  writeFileSync(join(out, 'results.json'), JSON.stringify({ results, errors }, null, 2));
  await ctx.close();
}

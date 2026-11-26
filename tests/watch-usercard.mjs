// 播放页 UP 主悬停名片（#265）：底部按钮留白不再贴边，暗色/亮色下「+ 关注」加号随按钮文字色继承。
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { installMocks } from './mocks.mjs';

const out = resolve(process.env.SMOKE_OUT || 'tests/artifacts/watch-usercard');
mkdirSync(out, { recursive: true });
const ext = resolve(process.env.SMOKE_EXT || 'dist');
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'margin-watch-usercard-')), {
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  headless: true, viewport: { width: 1440, height: 900 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
const results = [], errors = [];

try {
  await installMocks(ctx);
  const worker = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));

  for (const theme of ['dark', 'light']) {
    await worker.evaluate((t) => chrome.storage.local.set({
      'margin:settings': { intro: false, weather: false, footprint: false, bg: { mode: 'off' }, theme: t, autoWeb: false, wide: false },
    }), theme);
    await page.goto('https://www.bilibili.com/video/BV1mdxN68E7F/', { waitUntil: 'domcontentloaded' });
    await page.locator(`html.margin-watch[data-margin-theme="${theme}"]`).waitFor({ state: 'attached' });

    const metrics = await page.evaluate(() => {
      const style = document.createElement('style');
      // 模拟 B 站原版把 .btn-box .like .plus 设为纯白色的样式。
      style.textContent = '.usercard-wrap .btn-box .like .plus { color: #ffffff; }';
      document.head.append(style);

      const wrap = document.createElement('div');
      wrap.className = 'usercard-wrap';
      wrap.style.cssText = 'position:fixed;z-index:12000;top:120px;right:90px;width:366px';
      wrap.innerHTML = '<div class="user-card-m-exp"><div class="bg" style="background:linear-gradient(130deg,#3c515d,#73968f)"></div>'
        + '<div class="user-info-wrapper"><div class="face" style="background:#56857e"></div><div class="info">'
        + '<div class="user"><a class="name">测试UP主</a></div>'
        + '<div class="social"><span><span>86</span><span class="tip_text">关注</span></span><span><span>5.7万</span><span class="tip_text">粉丝</span></span></div>'
        + '<div class="sign">全平台同名，有事请私信</div>'
        + '<div class="btn-box"><a class="like"><span class="plus"><i class="van-icon-general_addto_s">+</i></span>关注</a><a class="message">发消息</a></div>'
        + '</div></div></div>';
      document.body.append(wrap);

      const card = wrap.querySelector('.user-card-m-exp');
      const btnBox = wrap.querySelector('.btn-box');
      const like = wrap.querySelector('.btn-box .like');
      const plus = wrap.querySelector('.btn-box .like .plus');
      const icon = wrap.querySelector('.btn-box .like .plus i');
      const bottomGap = Math.round(card.getBoundingClientRect().bottom - btnBox.getBoundingClientRect().bottom);
      const likeStyle = getComputedStyle(like);
      const plusColor = getComputedStyle(plus).color;
      const iconColor = getComputedStyle(icon).color;

      // 带近期投稿区时，分隔线与按钮之间仍保持单倍 16px 间距，不叠成 32px。
      const archives = document.createElement('div');
      archives.className = 'latest-archives';
      archives.textContent = '近期投稿';
      card.append(archives);
      const archivesGap = Math.round(archives.getBoundingClientRect().top - btnBox.getBoundingClientRect().bottom);

      return {
        bottomGap,
        archivesGap,
        likeBg: likeStyle.backgroundColor,
        likeColor: likeStyle.color,
        plusColor,
        iconColor,
      };
    });

    assert.ok(metrics.bottomGap >= 14 && metrics.bottomGap <= 20, `${theme}: expected ~16px bottom padding, got ${metrics.bottomGap}`);
    assert.ok(metrics.archivesGap >= 14 && metrics.archivesGap <= 20, `${theme}: expected single ~16px gap above latest-archives, got ${metrics.archivesGap}`);
    assert.equal(metrics.plusColor, metrics.likeColor, `${theme}: .plus must inherit .like text color`);
    assert.equal(metrics.iconColor, metrics.likeColor, `${theme}: .plus i must inherit .like text color`);
    assert.notEqual(metrics.iconColor, metrics.likeBg, `${theme}: plus icon color must contrast with .like background`);
    results.push(`${theme}: usercard keeps ${metrics.bottomGap}px bottom padding and plus icon matches button text color (${metrics.iconColor} on ${metrics.likeBg})`);
  }

  assert.deepEqual(errors, []);
  results.forEach((r) => console.log('PASS ' + r));
} finally {
  writeFileSync(join(out, 'results.json'), JSON.stringify({ results, errors }, null, 2));
  await ctx.close();
}

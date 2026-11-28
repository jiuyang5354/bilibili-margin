import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { installMocks } from './mocks.mjs';

const ext = resolve(process.env.SMOKE_EXT || 'dist');
const out = resolve(process.env.SMOKE_OUT || 'tests/artifacts/space-native-header-layout');
mkdirSync(out, { recursive: true });
const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'margin-space-native-')), {
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  headless: true, viewport: { width: 1440, height: 960 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});

const relationPage = name => `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${name} - Bilibili</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; }
  #app { margin-top: -64px; min-height: 2400px; }
  .bili-header { position: fixed; inset: 0 0 auto; height: 64px; }
  .space-header { height: 200px; display: flex; align-items: end; padding-inline: 7vw; background: #bccedd; }
  .space-navbar { position: sticky; top: 0; height: 64px; z-index: 99; display: flex; align-items: center;
    gap: 32px; padding-inline: 7vw; background: white; border-bottom: 1px solid #dee4ea; box-sizing: border-box; }
  .relation-content { display: grid; grid-template-columns: 184px 1fr; gap: 28px; margin: 24px 7vw; }
  .follow-sidenav { position: sticky; top: 0; align-self: start; background: #eef2f6; padding: 18px; }
  .vui_sidebar { position: static; }
  .relation-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .relation-card { min-height: 78px; display: flex; align-items: center; gap: 14px; padding: 12px;
    border: 1px solid #dee4ea; border-radius: 12px; background: white; }
  .relation-card i { width: 52px; height: 52px; border-radius: 50%; }
</style>
<body><div class="bili-header">Bilibili 原生顶栏</div><div id="app">
  <header class="header space-header"><h1>UP 主的个人空间</h1></header>
  <nav class="nav-bar space-navbar"><span>主页</span><span>动态</span><span>投稿</span><span>收藏</span><strong>${name}</strong></nav>
  <div class="relation-content">
    <aside class="follow-sidenav"><div class="vui_sidebar"><p>全部关注</p><p>特别关注</p><p>粉丝</p></div></aside>
    <section class="relation-list">${Array.from({ length: 60 }, (_, i) =>
      `<article class="relation-card"><i style="background:hsl(${i * 43 % 360} 32% 72%)"></i><span>空间用户 ${i + 1}</span></article>`).join('')}</section>
  </div>
</div></body></html>`;

try {
  await installMocks(context);
  await context.route(/^https:\/\/space\.bilibili\.com\/2\/relation\/(fans|follow)$/, route => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: relationPage(route.request().url().endsWith('/fans') ? '粉丝' : '关注'),
  }));
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const save = glass => worker.evaluate(glass => chrome.storage.local.set({
    'margin:settings': { intro: false, weather: false, footprint: false, theme: 'light', glass, bg: { mode: 'off' } },
  }), glass);
  await save('soft');
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const shield = () => page.evaluate(() => {
    const { position, top, left, right, height, boxSizing, zIndex, pointerEvents, backdropFilter, backgroundColor } = getComputedStyle(document.body, '::before');
    return { position, top, left, right, height, boxSizing, zIndex, pointerEvents, backdropFilter, backgroundColor };
  });

  for (const relation of ['fans', 'follow']) {
    await page.goto(`https://space.bilibili.com/2/relation/${relation}`);
    await page.locator('html.margin-page.margin-space-native').waitFor();
    await page.locator('#margin-watch-top .top').waitFor();
    assert.equal(await page.evaluate(() => scrollY), 0);
    assert.equal((await page.locator('.space-header').boundingBox()).y, 72);
    assert.equal(await page.locator('.bili-header').evaluate(el => getComputedStyle(el).display), 'none');
    assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).scrollPaddingTop), '136px');
    assert.equal(await page.locator('.vui_sidebar').evaluate(el => getComputedStyle(el).position), 'static');
    if (relation === 'fans') await page.screenshot({ path: join(out, 'space-fans-top.png') });

    await page.evaluate(() => scrollTo({ top: 400, behavior: 'instant' }));
    await page.waitForFunction(() => scrollY === 400);
    assert.equal((await page.locator('#margin-watch-top').boundingBox()).y, 0);
    assert.equal((await page.locator('#margin-watch-top').boundingBox()).height, 72);
    assert.equal((await page.locator('.space-navbar').boundingBox()).y, 72);
    assert.equal((await page.locator('.follow-sidenav').boundingBox()).y, 136);
    const { backdropFilter, backgroundColor, ...geometry } = await shield();
    assert.deepEqual(geometry, {
      position: 'fixed', top: '0px', left: '0px', right: '0px', height: '72px', boxSizing: 'border-box',
      zIndex: '100', pointerEvents: 'none',
    });
    assert.equal(backdropFilter, 'blur(18px) saturate(1.35)');
    if (relation === 'fans') await page.screenshot({ path: join(out, 'space-fans-scrolled.png') });
    else {
      await save('flat');
      await page.locator('html[data-margin-glass="flat"]').waitFor();
      const flat = await shield();
      assert.equal(flat.backdropFilter, 'none');
      assert.notEqual(flat.backgroundColor, backgroundColor, 'flat shield must use the solid canvas color');
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS native Space fans/follow topbar, sticky navbar/sidebar, and glass backdrop');
} finally {
  await context.close();
}

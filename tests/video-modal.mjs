import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { installMocks } from './mocks.mjs';

const ext = resolve(process.env.SMOKE_EXT || 'dist');
const out = resolve(process.env.SMOKE_OUT || 'tests/artifacts/video-modal');
mkdirSync(out, { recursive: true });
const results = [], errors = [];

const watchModalFixture = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>测试分P视频</title></head><body>
<div id="app"><div class="video-container-v1"><div class="left-container">
  <div class="video-info-container"><h1 class="video-title">测试视频（含分P与评论）</h1></div>
  <div class="bpx-player-container" data-screen="normal" style="width:100%;aspect-ratio:16/9;background:#000">
    <div class="bpx-player-video-wrap"><video id="modal-video" muted loop playsinline></video></div>
  </div>
  <div id="commentapp"><div class="comment-item">第一条测试评论</div></div>
</div><div class="right-container">
  <div class="video-pod"><div class="video-pod__header"><span class="title">视频选集</span><span class="amt">（1/2）</span></div>
    <div class="video-pod__list list"><div class="simple-base-item active"><span class="title-txt">P1 开篇</span></div><div class="simple-base-item"><span class="title-txt">P2 进阶</span></div></div>
  </div>
</div></div></div>
<script>
  const v = document.getElementById('modal-video');
  v.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
  v.play().catch(() => {});
  window.__modalVideo = v;
</script></body></html>`;

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'margin-video-modal-')), {
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  headless: true,
  args: ['--headless=new', '--no-sandbox', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  viewport: { width: 1440, height: 900 },
  locale: 'zh-CN',
});

try {
  await installMocks(context);
  await context.route('https://www.bilibili.com/video/**', route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: watchModalFixture,
  }));

  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  await worker.evaluate(() => chrome.storage.local.set({
    'margin:settings': { intro: false, theme: 'dark', glass: 'liquid', bg: { mode: 'off' }, hoverPreview: false, weather: false, footprint: false },
  }));

  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', m => { if (m.type() === 'error' && m.text().includes('[MARGIN]')) errors.push(m.text()); });

  await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' });
  const card = page.locator('#margin-root .home-grid .card:not(.sk)').first();
  await card.waitFor();

  // 1. Hover action button exists & opens modal without navigating away
  await card.locator('.cover').hover();
  const playBtn = card.locator('.card-play');
  await playBtn.waitFor({ state: 'visible' });
  const pagesBefore = context.pages().length;
  await playBtn.click();
  assert.equal(page.url(), 'https://www.bilibili.com/');
  assert.equal(context.pages().length, pagesBefore, 'card-play should not open a new tab');

  const layer = page.locator('#margin-root .vm-layer');
  await layer.waitFor({ state: 'visible' });
  assert.equal(await layer.getAttribute('data-state'), 'open');
  const sandbox = await layer.locator('iframe.vm-frame').getAttribute('sandbox');
  assert(sandbox && !sandbox.includes('allow-top-navigation'), `iframe sandbox must block top navigation: ${sandbox}`);

  const frame = page.frameLocator('#margin-root iframe.vm-frame');
  await frame.locator('.video-title').waitFor();
  await frame.locator('#modal-video').evaluate(v => v.play());
  assert.equal(await frame.locator('#modal-video').evaluate(v => v.paused), false, 'video should start playing before minimize');
  assert.equal(await frame.locator('.video-title').textContent(), '测试视频（含分P与评论）');
  assert.equal(await frame.locator('#commentapp .comment-item').textContent(), '第一条测试评论');
  assert.equal(await frame.locator('.video-pod__list .simple-base-item').count(), 2);

  // Verify iframe hides redundant watch header
  assert.equal(await frame.locator('#margin-watch-top').count(), 1);
  assert.equal(await frame.locator('#margin-watch-top').isVisible(), false);
  await page.screenshot({ path: join(out, 'modal-open.png') });
  results.push({ name: 'open-modal-with-full-watch-experience', ok: true });
  console.log('PASS open-modal-with-full-watch-experience');

  // 2. Minimize: docks to bottom-right and pauses video
  await layer.locator('.vm-ctrl-min').click();
  assert.equal(await layer.getAttribute('data-state'), 'minimized');
  await page.waitForFunction(() => {
    const p = document.querySelector('#margin-root')?.shadowRoot?.querySelector('.vm-panel');
    if (!p) return false;
    const r = p.getBoundingClientRect();
    return r.width < 420 && r.height < 160 && r.right > window.innerWidth - 40 && r.bottom > window.innerHeight - 40;
  });
  const box = await layer.locator('.vm-panel').boundingBox();
  assert(box && box.x > 900 && box.y > 600 && box.width < 420 && box.height < 160, `unexpected minimized box: ${JSON.stringify(box)}`);
  const pausedAfterMin = await frame.locator('#modal-video').evaluate(v => v.paused);
  assert.equal(pausedAfterMin, true, 'video should be paused when minimized');
  await page.screenshot({ path: join(out, 'modal-minimized.png') });
  results.push({ name: 'minimize-docks-bottom-right-and-pauses', ok: true });
  console.log('PASS minimize-docks-bottom-right-and-pauses');

  // 3. Restore and then Maximize: closes modal & opens clean new tab
  await layer.locator('.vm-mini-restore').click();
  assert.equal(await layer.getAttribute('data-state'), 'open');
  const [newTab] = await Promise.all([
    context.waitForEvent('page', { timeout: 5000 }),
    layer.locator('.vm-ctrl-max').click(),
  ]);
  await newTab.waitForLoadState('domcontentloaded');
  assert(!newTab.url().includes('margin_modal=1'), `new tab url should strip margin_modal: ${newTab.url()}`);
  assert(newTab.url().includes('/video/BV'), `new tab should be video page: ${newTab.url()}`);
  assert.equal(await layer.getAttribute('data-state'), 'closed');
  await newTab.close();
  results.push({ name: 'maximize-closes-modal-and-opens-new-tab', ok: true });
  console.log('PASS maximize-closes-modal-and-opens-new-tab');

  // 4. Reopen and Close
  await card.locator('.cover').hover();
  await playBtn.click();
  assert.equal(await layer.getAttribute('data-state'), 'open');
  await layer.locator('.vm-ctrl-close').click();
  assert.equal(await layer.getAttribute('data-state'), 'closed');
  assert.equal(await layer.locator('iframe.vm-frame').count(), 0);
  results.push({ name: 'close-destroys-modal-and-frame', ok: true });
  console.log('PASS close-destroys-modal-and-frame');

  // 5. Favorites drawer card play button stays on page
  await page.locator('#margin-root .top [aria-label="收藏"]').click();
  const favCard = page.locator('#margin-root .fav-grid .card').first();
  await favCard.waitFor();
  await favCard.locator('.cover').hover();
  await favCard.locator('.card-play').click();
  await layer.waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  assert.equal(page.url(), 'https://www.bilibili.com/');
  await layer.locator('.vm-ctrl-close').click();
  results.push({ name: 'favorites-card-play-stays-on-page', ok: true });
  console.log('PASS favorites-card-play-stays-on-page');

  // 6. Space page (cross-subdomain space.bilibili.com) play button opens modal without top navigation
  await page.goto('https://space.bilibili.com/2/video', { waitUntil: 'domcontentloaded' });
  const spaceCard = page.locator('#margin-root .grid .card:not(.sk)').first();
  await spaceCard.waitFor();
  await spaceCard.locator('.cover').hover();
  const spacePlay = spaceCard.locator('.card-play');
  await spacePlay.waitFor({ state: 'visible' });
  await spacePlay.click();
  const spaceLayer = page.locator('#margin-root .vm-layer');
  await spaceLayer.waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
  assert(page.url().startsWith('https://space.bilibili.com/2/video'), `space page navigated away: ${page.url()}`);
  await spaceLayer.locator('.vm-ctrl-min').click();
  await page.waitForTimeout(450);
  assert.equal(await spaceLayer.getAttribute('data-state'), 'minimized');
  await spaceLayer.locator('.vm-mini-title').waitFor({ state: 'visible' });
  assert.ok((await spaceLayer.locator('.vm-mini-title').textContent())?.trim().length);
  const zMini = await spaceLayer.locator('.vm-mini-bar').evaluate(el => Number(getComputedStyle(el).zIndex) || 0);
  assert.ok(zMini >= 2, `mini bar should have positive z-index above frame wrap: ${zMini}`);
  await page.screenshot({ path: join(out, 'space-mini.png') });
  await spaceLayer.locator('.vm-ctrl-close').click();
  assert.equal(await spaceLayer.getAttribute('data-state'), 'closed');
  results.push({ name: 'space-card-play-stays-on-page', ok: true });
  console.log('PASS space-card-play-stays-on-page');

  // 7. Watch page: opening modal from favorites pauses host video, closing releases iframe media
  await page.goto('https://www.bilibili.com/video/BV1mdxN68E7F/', { waitUntil: 'domcontentloaded' });
  await page.locator('#margin-watch-top .top').waitFor();
  await page.locator('#modal-video').evaluate(v => v.play());
  assert.equal(await page.locator('#modal-video').evaluate(v => v.paused), false, 'host video should play before modal');
  await page.locator('#margin-watch-top .top [aria-label="收藏"]').click();
  const watchFavCard = page.locator('#margin-watch-top .fav-grid .card').first();
  await watchFavCard.waitFor();
  await watchFavCard.locator('.cover').hover();
  await watchFavCard.locator('.card-play').click();
  const watchLayer = page.locator('#margin-watch-top .vm-layer');
  await watchLayer.waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#modal-video').evaluate(v => v.paused), true, 'host video must pause when modal opens');
  await watchLayer.locator('.vm-ctrl-close').click();
  assert.equal(await watchLayer.getAttribute('data-state'), 'closed');
  assert.equal(await watchLayer.locator('iframe.vm-frame').count(), 0);
  results.push({ name: 'watch-page-pauses-host-and-cleans-iframe', ok: true });
  console.log('PASS watch-page-pauses-host-and-cleans-iframe');

  // 8. Search page: native video card & exact-first card have hover play button and open modal without navigating away
  const searchFixture = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
    .search-page-video{max-width:1240px;margin:24px auto;padding:0 32px}
    .video-list{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}
    .bili-video-card__image{position:relative;aspect-ratio:16/9;background:#222}
    .bili-video-card__image img{width:100%;height:100%;object-fit:cover;display:block}
  </style></head><body><div id="app"><div class="search-content"><div class="search-page-video"><div class="video-list">
    <div class="video-list-item"><div class="bili-video-card" data-k="s1"><a href="https://www.bilibili.com/video/BV1mdxN68E7F/"><div class="bili-video-card__image"><img src="https://i0.hdslb.com/bfs/archive/BV1mdxN68E7F.jpg"><div class="bili-watch-later" style="position:absolute;top:8px;right:8px;width:28px;height:28px"></div></div><h3 class="bili-video-card__info--tit">其他无关搜索视频</h3></a><span class="bili-video-card__info--author">测试UP</span></div></div>
    <div class="video-list-item"><div class="bili-video-card" data-k="s2"><a href="https://www.bilibili.com/video/BV1kuxM6bE2A/"><div class="bili-video-card__image"><img src="https://i0.hdslb.com/bfs/archive/BV1kuxM6bE2A.jpg"></div><h3 class="bili-video-card__info--tit">映间搜索测试目标</h3></a><span class="bili-video-card__info--author">测试UP</span></div></div>
  </div></div></div></div></body></html>`;
  await context.route('https://search.bilibili.com/**', route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: searchFixture,
  }));
  await page.goto('https://search.bilibili.com/video?keyword=%E6%98%A0%E9%97%B4%E6%90%9C%E7%B4%A2%E6%B5%8B%E8%AF%95%E7%9B%AE%E6%A0%87', { waitUntil: 'domcontentloaded' });
  const searchCard = page.locator('.bili-video-card[data-k="s1"]');
  await searchCard.waitFor();
  await searchCard.hover();
  const searchPlay = searchCard.locator('.margin-search-play');
  await searchPlay.waitFor({ state: 'visible' });
  const [playRect, laterRect] = await Promise.all([
    searchPlay.boundingBox(),
    searchCard.locator('.bili-watch-later').boundingBox(),
  ]);
  assert(playRect && laterRect && playRect.x + playRect.width <= laterRect.x - 4,
    `search play button overlaps native watch-later: play=${JSON.stringify(playRect)} later=${JSON.stringify(laterRect)}`);
  await searchPlay.click();
  const searchLayer = page.locator('#margin-watch-top .vm-layer');
  await searchLayer.waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  assert(page.url().startsWith('https://search.bilibili.com/video'), `search page navigated away: ${page.url()}`);
  await searchLayer.locator('.vm-ctrl-min').click();
  await page.waitForTimeout(450);
  assert.equal(await searchLayer.getAttribute('data-state'), 'minimized');
  await searchLayer.locator('.vm-mini-title').waitFor({ state: 'visible' });
  await page.screenshot({ path: join(out, 'search-mini.png') });
  await searchLayer.locator('.vm-ctrl-close').click();
  assert.equal(await searchLayer.getAttribute('data-state'), 'closed');

  // Verify exact-first projection view also gets hover play button
  await page.locator('#margin-search-exact input').check();
  const exactCard = page.locator('#margin-search-exact-results li').first();
  await exactCard.waitFor();
  await exactCard.hover();
  const exactPlay = exactCard.locator('.margin-search-play');
  await exactPlay.waitFor({ state: 'visible' });
  await exactPlay.click();
  await searchLayer.waitFor({ state: 'visible' });
  assert.equal(await searchLayer.getAttribute('data-state'), 'open');
  await searchLayer.locator('.vm-ctrl-close').click();
  await page.unroute('https://search.bilibili.com/**');
  results.push({ name: 'search-card-play-opens-and-minimizes', ok: true });
  console.log('PASS search-card-play-opens-and-minimizes');
} finally {
  writeFileSync(join(out, 'results.json'), JSON.stringify({ results, errors }, null, 2));
  await context.close();
}

if (results.some(r => !r.ok) || errors.length) {
  console.error('Errors:', errors);
  process.exitCode = 1;
}

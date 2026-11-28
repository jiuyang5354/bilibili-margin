import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { installMocks } from './mocks.mjs';

const out = resolve(process.env.SMOKE_OUT || 'tests/artifacts/watch-rtx-hdr');
mkdirSync(out, { recursive: true });
const ext = resolve(process.env.SMOKE_EXT || 'dist');
const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'margin-watch-rtx-hdr-')), {
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  headless: true, viewport: { width: 1440, height: 900 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
const checks = [], errors = [];

try {
  await installMocks(context);
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const patchSettings = (patch) => worker.evaluate(async (value) => {
    const key = 'margin:settings';
    const current = await chrome.storage.local.get(key);
    await chrome.storage.local.set({ [key]: { ...current[key], ...value } });
  }, patch);
  await patchSettings({ intro: false, weather: false, footprint: false, bg: { mode: 'off' }, wide: false, autoWeb: false,
    playerCorners: true, rtxCompat: false, hdrEnhance: false, webScroll: true });

  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
    const player = document.querySelector('.bpx-player-container');
    const host = document.createElement('div');
    host.id = 'playerWrap';
    host.className = 'player-wrap';
    host.style.position = 'relative';
    player.before(host);
    host.append(player);
    player.style.cssText = 'position:relative;width:932px;height:525px';
    player.innerHTML = '<div class="bpx-player-primary-area" style="width:100%;height:100%"><div class="bpx-player-video-area" style="position:relative;width:100%;height:100%">'
      + '<div class="bpx-player-video-perch" style="position:absolute;inset:0;pointer-events:none"></div><div class="bpx-player-video-wrap" style="width:100%;height:100%"></div>'
      + '<div class="bpx-player-shadow-progress-area" style="position:absolute;bottom:-2px;height:2px;width:100%"></div></div></div>'
      + '<div class="bpx-player-control-bottom-right"><button class="bpx-player-ctrl-wide">Wide</button></div>';
    const toolbar = document.createElement('div');
    toolbar.className = 'video-toolbar-container';
    host.after(toolbar);
  }, { once: true }));
  await page.goto('https://www.bilibili.com/video/BV1mdxN68E7F/', { waitUntil: 'domcontentloaded' });
  await page.locator('html.margin-watch.margin-wcard').waitFor({ state: 'attached' });
  const player = page.locator('.bpx-player-container');
  const area = player.locator('.bpx-player-video-area');
  const button = player.locator('.bpx-player-control-bottom-right .m-hdr-btn');
  const geometry = (target) => target.evaluate(el => {
    const { borderTopLeftRadius, overflow, maskImage, webkitMaskImage, isolation } = getComputedStyle(el);
    return { borderTopLeftRadius, overflow, maskImage, webkitMaskImage, isolation };
  });
  const defaults = await geometry(area);
  assert.deepEqual([defaults.maskImage, defaults.webkitMaskImage, defaults.isolation, defaults.overflow], ['none', 'none', 'auto', 'clip']);
  assert.ok(parseFloat(defaults.borderTopLeftRadius) > 0);
  checks.push('Default video clip has no mask or isolation');

  await patchSettings({ playerCorners: false });
  await page.locator('html.margin-wcard.margin-player-square').waitFor({ state: 'attached' });
  for (const target of [player, area]) assert.equal((await geometry(target)).borderTopLeftRadius, '0px');
  assert.ok(parseFloat((await geometry(page.locator('#commentapp'))).borderTopLeftRadius) > 0);
  checks.push('Square player setting overrides card radii and preserves comment corners');

  await patchSettings({ playerCorners: true, rtxCompat: true });
  await page.locator('html.margin-rtx-compat:not(.margin-player-square)').waitFor({ state: 'attached' });
  for (const target of [page.locator('#playerWrap'), player, area, player.locator('.bpx-player-primary-area'),
    player.locator('.bpx-player-video-perch'), player.locator('.bpx-player-video-wrap')]) {
    assert.deepEqual(await geometry(target), {
      borderTopLeftRadius: '0px', overflow: 'visible', maskImage: 'none', webkitMaskImage: 'none', isolation: 'auto',
    });
    assert.equal(await target.evaluate(el => getComputedStyle(el).clipPath), 'none');
  }
  checks.push('Live RTX compatibility clears clipping on each player layer');

  const media = ([width, height]) => page.evaluate(async ([width, height]) => {
    const wrap = document.querySelector('.bpx-player-video-wrap');
    for (const track of wrap.querySelector('video')?.srcObject?.getTracks() ?? []) track.stop();
    clearInterval(window.testVideoTimer);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const paint = canvas.getContext('2d');
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain';
    wrap.append(video);
    for (const previous of wrap.querySelectorAll('video')) if (previous !== video) previous.remove();
    video.srcObject = canvas.captureStream(10);
    const draw = () => { paint.fillStyle = '#ddd'; paint.fillRect(0, 0, width, height); };
    window.testVideoTimer = setInterval(draw, 100);
    draw();
    await video.play();
  }, [width, height]);
  const fitStyle = () => player.locator('video').evaluate(video => getComputedStyle(video).objectFit);
  const exactFit = player.locator('.bpx-player-video-area[data-margin-exact-fit]');
  await media([640, 360]);
  await exactFit.waitFor({ state: 'attached' });
  assert.equal(await exactFit.getAttribute('data-margin-exact-fit'), '1');
  assert.deepEqual(await area.evaluate(el => [el.clientWidth, el.clientHeight]), [932, 525]);
  assert.equal(await fitStyle(), 'cover');
  await player.evaluate(el => { el.dataset.screen = 'full'; });
  await exactFit.waitFor({ state: 'detached' });
  assert.equal(await fitStyle(), 'contain');
  await player.evaluate(el => { el.dataset.screen = 'normal'; });
  await exactFit.waitFor({ state: 'attached' });
  await media([640, 480]);
  await exactFit.waitFor({ state: 'detached' });
  assert.equal(await fitStyle(), 'contain');
  checks.push('Real 16:9 frames cover rounding gaps, while 4:3 and fullscreen stay contained');

  const hdrLayers = page.locator('.m-hdr-canvas, .m-hdr-fallback, [data-hdr-strength]');
  const expectOff = async () => {
    await page.locator('.m-hdr-btn[aria-pressed="false"]').waitFor({ state: 'attached' });
    assert.equal(await hdrLayers.count(), 0);
    assert.equal(await player.locator('video').evaluate(video => getComputedStyle(video).filter), 'none');
  };
  const expectOn = async () => {
    await page.locator('.m-hdr-btn[aria-pressed="true"]').waitFor({ state: 'attached' });
    await page.locator('.m-hdr-canvas:not([hidden]), .m-hdr-fallback').first().waitFor({ state: 'attached' });
    assert.match(await page.locator('.m-voltip').textContent(), /^HDR 增强 · 开启 \((WebGPU HDR|兼容画质增强)\)$/);
  };
  await expectOff();
  assert.equal(await button.count(), 1);
  assert.equal(await button.getAttribute('aria-label'), 'SDR 转 HDR 增强 (Alt+H)');
  await button.click();
  await expectOn();
  await page.keyboard.press('Alt+h');
  await expectOff();
  assert.equal(await page.locator('.m-voltip').textContent(), 'HDR 增强 · 关闭');
  await page.keyboard.press('Alt+h');
  await expectOn();
  await button.click();
  await expectOff();
  checks.push('HDR starts idle, toggles with the player button and Alt+H, and releases all rendering layers');

  await player.evaluate(el => { el.classList.add('mode-webscreen'); el.dataset.screen = 'web'; });
  await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--m-ws-vh'));
  const bar = player.locator('.bpx-player-shadow-progress-area');
  await page.waitForFunction(() => {
    const progress = document.querySelector('.bpx-player-shadow-progress-area');
    return Math.abs(progress.getBoundingClientRect().bottom - document.documentElement.clientHeight) < 1;
  });
  assert.equal(await bar.evaluate(el => getComputedStyle(el).zIndex), '65');
  assert.equal(await page.evaluate(() => scrollY), 0);
  await player.evaluate(el => { el.classList.remove('mode-webscreen'); el.dataset.screen = 'normal'; });
  await page.waitForFunction(() => !document.documentElement.style.getPropertyValue('--m-ws-vh'));
  checks.push('Webscreen progress stays at the viewport edge and the height override clears on exit');

  assert.deepEqual(errors, []);
  checks.forEach(check => console.log('PASS ' + check));
} finally {
  writeFileSync(join(out, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
  await context.close();
}

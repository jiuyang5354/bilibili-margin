// 设置里的自动更新（v0.61）：检查周期与隐私分类的联动。
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { installMocks } from './mocks.mjs';

const extension = resolve(process.env.SMOKE_EXT || 'dist');
const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'margin-update-ui-')), {
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  headless: true, viewport: { width: 1440, height: 1000 },
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
const results = [];
/** service worker 里读扩展存储，页面上下文读不到 chrome.storage */
async function until(fn, label) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('等待超时：' + label);
}
try {
  await installMocks(context);
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  await worker.evaluate(() => chrome.storage.local.set({ 'margin:settings': { intro: false, theme: 'light' } }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('https://www.bilibili.com/');
  await page.locator('#margin-root .top [aria-label="设置"]').click();
  const dialog = page.getByRole('dialog', { name: '设置', exact: true });
  await dialog.getByRole('tab', { name: '隐私与数据' }).click();

  const drawer = dialog.locator('.sd').filter({ hasText: '自动更新' });
  await drawer.locator('.sd-head').click();
  assert.equal(await drawer.locator('.sd-head').getAttribute('aria-expanded'), 'true');
  results.push('隐私分类里有自动更新抽屉');

  // 周期选 6 小时要写进设置
  await drawer.getByRole('radio', { name: '6 小时', exact: true }).click();
  await until(async () => worker.evaluate(async () => (await chrome.storage.local.get('margin:settings'))['margin:settings'].updateInterval === 6), '周期保存');
  results.push('检查周期可以保存');

  // 摘要要跟着变
  assert.ok((await drawer.locator('.sd-sum').textContent()).includes('6 小时'));
  assert.deepEqual(errors, []);
  results.push('抽屉摘要跟随设置变化');
} finally {
  await context.close();
}
results.forEach(result => console.log('PASS ' + result));

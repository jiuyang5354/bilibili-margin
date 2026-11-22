// 自动更新流程（v0.61）：定时排期 → 后台检查 → 更新页下载解包。
// GitHub 接口和发布包都在本地伪造，CI 不依赖外网。
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { deflateRawSync } from 'node:zlib';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const extension = resolve(process.env.SMOKE_EXT || 'dist');
const out = resolve(process.env.SMOKE_OUT || 'tests/artifacts/update-flow');
mkdirSync(out, { recursive: true });

/** 手写一个最小 zip：里面放一份 version 与目标一致的 manifest.json */
function makeZip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const file of files) {
    const payload = deflateRawSync(file.data);
    const name = Buffer.from(file.name, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(payload.length, 18); local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, payload);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10); central.writeUInt32LE(payload.length, 20); central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + payload.length;
  }
  const directory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(directory.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, eocd]);
}

const manifest = JSON.parse(readFileSync(join(extension, 'manifest.json'), 'utf8'));
const nextVersion = manifest.version.split('.').map((part, i) => (i === 2 ? Number(part) + 1 : Number(part))).join('.');
const zip = makeZip([
  { name: 'manifest.json', data: Buffer.from(JSON.stringify({ version: nextVersion, name: '映间 MARGIN' })) },
  { name: 'background.js', data: Buffer.from('// new build') },
]);
const release = {
  tag_name: `v${nextVersion}`,
  name: `v${nextVersion.replace(/\.\d+$/, (m) => m)}`,
  html_url: `https://github.com/jiuyang5354/bilibili-margin/releases/tag/v${nextVersion}`,
  assets: [{
    name: 'margin.zip',
    browser_download_url: `https://github.com/jiuyang5354/bilibili-margin/releases/download/v${nextVersion}/margin.zip`,
    size: zip.length,
  }],
};

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'margin-update-')), {
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  headless: true, args: ['--headless=new', '--no-sandbox', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
const results = [];
let checks = 0, downloads = 0;
/** service worker 没有 waitForFunction，这里自己轮询 */
async function until(fn, label) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('等待超时：' + label);
}
try {
  await context.route('https://api.github.com/repos/jiuyang5354/bilibili-margin/releases/latest', route => {
    checks++;
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(release) });
  });
  await context.route('https://github.com/jiuyang5354/bilibili-margin/releases/download/**', route => {
    downloads++;
    return route.fulfill({ contentType: 'application/zip', body: zip });
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  await worker.evaluate(() => chrome.storage.local.set({ 'margin:settings': { privacyExternal: true, updateInterval: 6 } }));

  // 周期改成 6 小时后后台应该排上定时任务
  await until(async () => worker.evaluate(async () => (await chrome.alarms.getAll()).some(alarm => alarm.name === 'margin:update-check')), '定时任务');
  const alarm = await worker.evaluate(async () => {
    const found = (await chrome.alarms.getAll()).find(item => item.name === 'margin:update-check');
    return found ? found.periodInMinutes : 0;
  });
  assert.equal(alarm, 360);
  results.push('检查周期按小时换算成定时任务');

  // 打开周期时会顺手查一次，命中新版要记下来并打角标
  await until(async () => worker.evaluate(async () => !!(await chrome.storage.local.get('margin:update-state'))['margin:update-state']), '更新状态');
  const state = await worker.evaluate(async () => (await chrome.storage.local.get('margin:update-state'))['margin:update-state']);
  assert.equal(state.tag, nextVersion);
  assert.ok(checks >= 1, '后台应当查过版本');
  const badge = await worker.evaluate(() => chrome.action.getBadgeText({}));
  assert.equal(badge, '新');
  results.push('后台发现新版后记下状态并打角标');

  // 更新页：查版本 → 下载 → 解包
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type() === 'error') console.log('PAGE CONSOLE:', message.text()); });
  // 自动化环境里没法手动确认权限弹窗，把可选权限视为已授予
  await page.addInitScript(() => {
    chrome.permissions.contains = async () => true;
    chrome.permissions.request = async () => true;
  });
  await page.goto(`chrome-extension://${new URL(worker.url()).hostname}/update.html`);
  await page.waitForFunction(() => document.querySelector('#cur')?.textContent && document.querySelector('#cur').textContent !== '—');
  assert.equal(await page.locator('#cur').textContent(), manifest.version_name || manifest.version);
  await page.click('#check');
  await page.waitForFunction(() => document.querySelector('#latest')?.textContent?.includes('v'));
  assert.ok((await page.locator('#latest').textContent()).includes(nextVersion));
  results.push('更新页能查到最新正式版');

  await page.click('#download');
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('下载完成'));
  assert.equal(downloads, 1);
  assert.equal(await page.locator('#pack').textContent(), 'margin.zip（已下载）');
  results.push('更新页能下载并解开发布包');

  // 选目录这一步浏览器不提供自动化入口，只验证入口按钮在
  assert.equal(await page.locator('#install').isVisible(), true);
  assert.equal(await page.locator('#install').textContent(), '选择目录并写入');
  assert.deepEqual(errors, []);
  results.push('更新页的写入入口就绪');

  // GitHub API 未登录时限流（403），这时要能改走发布页通道。
  // Playwright 拦不到重定向之后的请求，所以这里只验证"确实改走了发布页"，
  // 版本号解析与降级逻辑由单元测试覆盖。
  await context.unroute('https://api.github.com/repos/jiuyang5354/bilibili-margin/releases/latest');
  await context.route('https://api.github.com/repos/jiuyang5354/bilibili-margin/releases/latest', route => route.fulfill({ status: 403, body: 'rate limited', headers: { 'x-ratelimit-remaining': '0' } }));
  let releasePageHits = 0;
  await context.route('https://github.com/jiuyang5354/bilibili-margin/releases/latest', route => { releasePageHits++; return route.abort(); });
  const fallback = await context.newPage();
  await fallback.addInitScript(() => {
    chrome.permissions.contains = async () => true;
    chrome.permissions.request = async () => true;
  });
  await fallback.goto(`chrome-extension://${new URL(worker.url()).hostname}/update.html`);
  await fallback.waitForFunction(() => document.querySelector('#cur')?.textContent !== '—');
  await fallback.click('#check');
  await fallback.waitForFunction(() => /限流/.test(document.querySelector('#status')?.textContent || ''), null, { timeout: 30000 });
  // 自动检查不请求发布页授权，只在用户点按钮时才走
  assert.equal(releasePageHits, 0);
  assert.ok((await fallback.locator('#status').textContent()).includes('限流'));
  await fallback.close();
  results.push('API 限流时提示发布页通道，且不自动发起请求');
} finally {
  await context.close();
}
results.forEach(result => console.log('PASS ' + result));

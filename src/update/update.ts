/**
 * 更新页（v0.61）：检查 → 下载 → 选目录 → 写入。
 *
 * 浏览器不允许扩展自行改动安装位置，所以目录必须由用户亲手选一次；
 * 这一版不记住目录、不在后台写盘，也不自动重载扩展：写完提示用户自己去扩展管理页重新加载。
 *
 * 查版本先走 GitHub API；接口限流时按 #234 的做法，改由用户授权后读取官方发布页。
 */
import { checkRelease, checkViaReleasePage, downloadArchive, newerRelease, pickArchive, RELEASE_PERMISSION, DOWNLOAD_PERMISSION, type ReleaseAsset, type ReleaseInfo } from '../shared/releases';
import { loadSettings } from '../shared/settings';
import { installPackage, isExtensionFolder } from '../shared/installer';
import { clearUpdateState, readUpdateState } from '../shared/update-store';

const $ = <T extends HTMLElement>(id: string) => document.querySelector(id) as T;
const manifest = chrome.runtime.getManifest();

let latest: ReleaseInfo | null = null;
let asset: ReleaseAsset | null = null;
/** 下载好的发布包只留在内存里：用完即弃，本机不留副本 */
let zip: ArrayBuffer | null = null;
let busy = false;

function say(text: string, kind: '' | 'ok' | 'warn' = ''): void {
  const el = $<HTMLElement>('#status');
  el.textContent = text;
  el.className = `status${kind ? ` ${kind}` : ''}`;
}

function step(id: string, done: boolean): void {
  $(`#${id}`).classList.toggle('done', done);
}

function paint(): void {
  const ready = !!latest && !!asset;
  $<HTMLButtonElement>('#download').hidden = !ready;
  $<HTMLButtonElement>('#install').hidden = !ready;
  $<HTMLAnchorElement>('#release').hidden = !latest;
  if (latest) $<HTMLAnchorElement>('#release').href = latest.url;
}

/** 目录选择器只在桌面版 Chrome / Edge 上有；Firefox 走手动替换 */
function picker(): ((options?: { mode?: string; id?: string }) => Promise<FileSystemDirectoryHandle>) | undefined {
  return (window as unknown as { showDirectoryPicker?: (options?: { mode?: string; id?: string }) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
}

/** 拿到新版本信息后统一处理：填版本号、挑发布包 */
function applyRelease(info: ReleaseInfo): void {
  latest = info;
  $<HTMLElement>('#latest').textContent = info.name || `v${info.tag}`;
  asset = pickArchive(info);
  if (asset) $<HTMLElement>('#pack').textContent = asset.size > 0 ? `${asset.name}（${(asset.size / 1048576).toFixed(1)} MB）` : asset.name;
  paint();
}

/** 接口限流时：引导用户授权读取官方发布页（与 #234 一致，权限可选） */
function offerReleasePage(): void {
  const status = $<HTMLElement>('#status');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn';
  button.textContent = '授权并通过官方发布页检查';
  button.onclick = async () => {
    button.disabled = true;
    try {
      if (!await chrome.permissions.request(RELEASE_PERMISSION)) {
        status.textContent = '未授权，可直接到官方发布页查看。';
        return;
      }
      const info = await checkViaReleasePage();
      applyRelease(info);
      if (!newerRelease(info.tag, manifest.version)) {
        asset = null;
        paint();
        say('当前已是最新正式版。', 'ok');
        return;
      }
      if (!asset) {
        paint();
        say(`发现新版 v${info.tag}，但这次发布没有附可安装的压缩包，请到发布页手动下载。`, 'warn');
        return;
      }
      say(`发现新版 v${info.tag}，下载后写回扩展目录就能生效。`);
    } catch (error) {
      status.textContent = `${error instanceof Error ? error.message : '检查失败'}，请稍后重试。`;
    } finally {
      button.disabled = false;
    }
  };
  status.replaceChildren(document.createTextNode('GitHub 更新接口已限流。'), button);
}

async function check(): Promise<void> {
  if (busy) return;
  busy = true;
  $<HTMLButtonElement>('#check').disabled = true;
  say('正在查询最新正式版…');
  try {
    const info = await checkRelease(true);
    applyRelease(info);
    step('s1', true);
    if (!newerRelease(info.tag, manifest.version)) {
      asset = null;
      paint();
      say('当前已是最新正式版。', 'ok');
      return;
    }
    if (!asset) {
      paint();
      say(`发现新版 v${info.tag}，但这次发布没有附可安装的压缩包，请到发布页手动下载。`, 'warn');
      return;
    }
    say(`发现新版 v${info.tag}，下载后写回扩展目录就能生效。`);
  } catch (error) {
    const message = error instanceof Error ? error.message : '检查失败';
    if ((error as { name?: string }).name === 'ReleaseRateLimited') {
      offerReleasePage();
    } else {
      say(message === '可选外部服务已关闭' ? '还没开启「允许外部辅助服务」，开启后才能查询版本。' : `${message}，请稍后重试。`, 'warn');
    }
  } finally {
    busy = false;
    $<HTMLButtonElement>('#check').disabled = false;
  }
}

async function download(): Promise<void> {
  if (busy || !asset || !latest) return;
  busy = true;
  $<HTMLButtonElement>('#download').disabled = true;
  say(`正在下载 ${asset.name}…`);
  try {
    if (!await chrome.permissions.contains(DOWNLOAD_PERMISSION)) {
      if (!await chrome.permissions.request(DOWNLOAD_PERMISSION)) {
        say('未授权下载发布包，请到官方发布页手动下载。', 'warn');
        return;
      }
    }
    zip = await downloadArchive(asset);
    $<HTMLElement>('#pack').textContent = `${asset.name}（已下载）`;
    step('s2', true);
    say('下载完成，选好扩展目录就能写入。', 'ok');
    paint();
  } catch (error) {
    zip = null;
    say(`${error instanceof Error ? error.message : '下载失败'}，请稍后重试。`, 'warn');
  } finally {
    busy = false;
    $<HTMLButtonElement>('#download').disabled = false;
  }
}

/** 选目录并写入。写入失败会由安装器回滚，这里只负责把话说清楚。 */
async function install(): Promise<void> {
  if (busy) return;
  if (!zip || !latest) {
    say('还没有下载更新包。', 'warn');
    return;
  }
  const choose = picker();
  if (!choose) {
    say('这个浏览器不支持直接写入文件夹，请到发布页手动下载后覆盖扩展文件夹。', 'warn');
    return;
  }
  let dir: FileSystemDirectoryHandle;
  try {
    dir = await choose.call(window, { mode: 'readwrite', id: 'margin-extension' });
  } catch {
    say('没有选择文件夹，扩展目录没有改变。', 'warn');
    return;
  }
  if (!await isExtensionFolder(dir)) {
    say('这个文件夹里没有 manifest.json，可能不是映间的扩展目录。请选当初加载扩展时用的那个文件夹。', 'warn');
    return;
  }
  busy = true;
  $<HTMLButtonElement>('#install').disabled = true;
  say('正在写入扩展目录…');
  try {
    const result = await installPackage(dir, zip, latest.tag);
    step('s3', true);
    step('s4', true);
    await clearUpdateState();
    try { await chrome.action.setBadgeText({ text: '' }); } catch { /* 角标清不掉也不影响。 */ }
    say(`已写入 ${result.files} 个文件。请到浏览器扩展管理页点一次「重新加载」，之后打开的 B 站标签页刷新一下就会用上新版。`, 'ok');
  } catch (error) {
    say(`${error instanceof Error ? error.message : '写入失败'}，请重试。`, 'warn');
  } finally {
    busy = false;
    $<HTMLButtonElement>('#install').disabled = false;
  }
}

void (async () => {
  $<HTMLElement>('#cur').textContent = manifest.version_name || manifest.version;
  const settings = await loadSettings();
  const rk = settings.radius === 0 ? 0 : settings.radius === 50 ? 0.5 : settings.radius === 150 ? 1.5 : 1;
  document.documentElement.style.setProperty('--rk', String(rk));
  const state = await readUpdateState();
  if (state) {
    applyRelease({ tag: state.tag, name: state.name, url: state.url, at: state.at });
  }
  paint();
  say(settings.privacyExternal ? '可以点「检查更新」看看有没有新版。' : '还没开启「允许外部辅助服务」，开启后才能查询版本。', settings.privacyExternal ? '' : 'warn');
})();

$<HTMLButtonElement>('#check').addEventListener('click', () => { void check(); });
$<HTMLButtonElement>('#download').addEventListener('click', () => { void download(); });
$<HTMLButtonElement>('#install').addEventListener('click', () => { void install(); });

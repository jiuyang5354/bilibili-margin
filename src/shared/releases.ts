import { optionalFetch } from './privacy';

export interface ReleaseAsset { name: string; url: string; size: number }
export interface ReleaseInfo { at: number; tag: string; name?: string; url: string; assets?: ReleaseAsset[] }
export class ReleaseRateLimited extends Error {}
export const RELEASE_PERMISSION = { origins: ['https://github.com/*'] };
/** 下载发布包需要 GitHub 的站点与它的对象存储；与查发布页的授权一起问 */
export const DOWNLOAD_PERMISSION = { origins: ['https://github.com/*', 'https://objects.githubusercontent.com/*', 'https://release-assets.githubusercontent.com/*'] };
/** 只有本仓库发布的两个扩展包可以下载，且地址必须落在 releases/download 下面 */
const ARCHIVES = { chrome: 'margin.zip', firefox: 'margin-firefox.zip' } as const;
const ASSET_URL = /^https:\/\/github\.com\/jiuyang5354\/bilibili-margin\/releases\/download\/v\d+(?:\.\d+){1,3}\/margin(?:-firefox)?\.zip$/;
const KEY = 'margin:update-check';
function valid(value: unknown): value is ReleaseInfo {
  if (!value || typeof value !== 'object') return false;
  const r = value as ReleaseInfo;
  return Number.isFinite(r.at) && typeof r.tag === 'string' && typeof r.url === 'string' && /^\d+(?:\.\d+){1,3}$/.test(r.tag) &&
    /^https:\/\/github\.com\/jiuyang5354\/bilibili-margin\/releases\/tag\/v?\d+(?:\.\d+){1,3}$/.test(r.url);
}
export function newerRelease(tag: string, current: string): boolean {
  const a = tag.split('.').map(Number), b = current.split('.').map(Number);
  for (let i = 0; i < 4; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  return false;
}
/** 弹窗自动检查复用六小时缓存；设置中的明确检查绕过缓存，仍遵守外部服务选择。 */
export async function checkRelease(force = false): Promise<ReleaseInfo> {
  const cached: unknown = (await chrome.storage.local.get(KEY))[KEY];
  if (!force && valid(cached) && Date.now() >= cached.at && Date.now() - cached.at < 6 * 3600e3) return cached;
  const response = await optionalFetch('update', 'https://api.github.com/repos/jiuyang5354/bilibili-margin/releases/latest', { headers: { Accept: 'application/vnd.github+json' } });
  if (force && (response.status === 403 || response.status === 429)) {
    const limited = response.status === 429 || response.headers.get('x-ratelimit-remaining') === '0'
      || response.headers.has('retry-after') || /rate limit/i.test(await response.text());
    if (limited) throw new ReleaseRateLimited('GitHub 更新接口已限流');
  }
  if (!response.ok) throw new Error(`更新查询失败（HTTP ${response.status}）`);
  const data = await response.json();
  const info: ReleaseInfo = { at: Date.now(), tag: String(data.tag_name || '').replace(/^v/, ''), name: typeof data.name === 'string' ? data.name : undefined, url: data.html_url };
  if (!valid(info) || data.draft || data.prerelease) throw new Error('正式版信息暂不可用');
  info.assets = readAssets(data.assets);
  await chrome.storage.local.set({ [KEY]: info });
  return info;
}

/** 只留下名字和地址都合规的发布包，其余一律丢掉 */
function readAssets(raw: unknown): ReleaseAsset[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const a = item as { name?: unknown; browser_download_url?: unknown; size?: unknown };
    if (typeof a.name !== 'string' || typeof a.browser_download_url !== 'string') return [];
    if (!ASSET_URL.test(a.browser_download_url)) return [];
    return [{ name: a.name, url: a.browser_download_url, size: typeof a.size === 'number' && Number.isFinite(a.size) ? a.size : 0 }];
  });
}

/** Firefox 装的是单独的包，其余平台用 Chrome 包 */
export function isFirefox(): boolean {
  try { return new URL(chrome.runtime.getURL('')).protocol === 'moz-extension:'; } catch { return false; }
}

/** 取当前平台对应的发布包；没有附件列表时按 GitHub 的固定命名拼下载地址 */
export function pickArchive(info: ReleaseInfo): ReleaseAsset | null {
  const want = isFirefox() ? ARCHIVES.firefox : ARCHIVES.chrome;
  const asset = info.assets?.find(a => a.name === want);
  if (asset && ASSET_URL.test(asset.url)) return asset;
  const url = `https://github.com/jiuyang5354/bilibili-margin/releases/download/v${info.tag}/${want}`;
  return ASSET_URL.test(url) ? { name: want, url, size: 0 } : null;
}

/** 下载发布包；同样受可选权限与「允许外部辅助服务」开关约束 */
export async function downloadArchive(asset: ReleaseAsset): Promise<ArrayBuffer> {
  if (!await chrome.permissions.contains(DOWNLOAD_PERMISSION)) throw new Error('未授权下载发布包');
  const response = await optionalFetch('update-asset', asset.url);
  if (!response.ok) {
    if (response.status === 404) throw new Error('这个版本没有附发布包，请到发布页手动下载');
    throw new Error(`更新包下载失败（HTTP ${response.status}）`);
  }
  return response.arrayBuffer();
}

/** 走发布页跳转：不需要 API，版本号从最终地址里取 */
export async function checkViaReleasePage(): Promise<ReleaseInfo> {
  if (!await chrome.permissions.contains(RELEASE_PERMISSION)) throw new Error('未授权读取发布页');
  const response = await optionalFetch('release-page', 'https://github.com/jiuyang5354/bilibili-margin/releases/latest', { method: 'HEAD' });
  if (!response.ok) throw new Error('发布页暂时无法访问');
  const match = /^https:\/\/github\.com\/jiuyang5354\/bilibili-margin\/releases\/tag\/v(\d+(?:\.\d+){1,3})$/.exec(response.url);
  if (!match) throw new Error('正式版信息暂不可用');
  const tag = match[1];
  const info: ReleaseInfo = { at: Date.now(), tag, url: response.url };
  await chrome.storage.local.set({ [KEY]: info });
  return info;
}

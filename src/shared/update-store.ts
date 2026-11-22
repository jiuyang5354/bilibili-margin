/**
 * 自动更新的本地状态（v0.61）。
 *
 * 只记「后台发现了哪个新版本」，存在扩展存储里。
 * 这一版不做目录持久授权、不在后台写盘：发布包由用户在更新页里当场下载、当场写入，
 * 用完即弃，本机不留副本。
 */

export const UPDATE_STATE_KEY = 'margin:update-state';

export interface UpdateState {
  /** 发现的新版本号，例如 0.60.90 */
  tag: string;
  /** 发布标题 */
  name?: string;
  /** release 页面地址 */
  url: string;
  /** 发现时间 */
  at: number;
}

export async function readUpdateState(): Promise<UpdateState | null> {
  const raw = (await chrome.storage.local.get(UPDATE_STATE_KEY))[UPDATE_STATE_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const state = raw as UpdateState;
  return typeof state.tag === 'string' && /^\d+(?:\.\d+){1,3}$/.test(state.tag) && typeof state.url === 'string' ? state : null;
}

export async function writeUpdateState(state: UpdateState): Promise<void> {
  await chrome.storage.local.set({ [UPDATE_STATE_KEY]: state });
}

export async function clearUpdateState(): Promise<void> {
  await chrome.storage.local.remove(UPDATE_STATE_KEY);
}

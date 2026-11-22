/**
 * 自动检查更新（v0.61）。
 *
 * 节奏由设置里的「更新检查周期」决定（0 = 不自动检查）。后台只做两件事：
 * 到 GitHub 查一次最新正式版 → 有新版本就记下来并在图标上标「新」。
 *
 * 下载与安装交给用户在更新页里手动完成：这一版不在后台写盘，也不自动重载扩展。
 * 全部走可选外部服务网关，所以「允许外部辅助服务」没开时这里一步都不会走。
 */
import { checkRelease, newerRelease, type ReleaseInfo } from '../shared/releases';
import { loadSettings } from '../shared/settings';
import { clearUpdateState, readUpdateState, writeUpdateState } from '../shared/update-store';

const ALARM = 'margin:update-check';
/** 定时任务名字，后台与设置面板都要用到 */
export const UPDATE_ALARM = ALARM;

/** Chrome 117 之前的 alarms 是回调风格，这里统一成 Promise */
interface AlarmApi {
  get(name: string, cb: (alarm: chrome.alarms.Alarm | undefined) => void): void;
  create(name: string, info: chrome.alarms.AlarmCreateInfo): void;
  clear(name: string, cb: (done: boolean) => void): void;
}
/** 延到调用时再取 chrome.alarms：模块顶层不碰浏览器 API，方便在测试里替换 */
const alarmApi = () => chrome.alarms as unknown as AlarmApi;
const getAlarm = (name: string) => new Promise<chrome.alarms.Alarm | undefined>(resolve => alarmApi().get(name, resolve));
const clearAlarm = (name: string) => new Promise<boolean>(resolve => alarmApi().clear(name, resolve));

/** 商店版由浏览器自己更新，不用我们管 */
function storeManaged(): boolean {
  return Boolean((chrome.runtime.getManifest() as chrome.runtime.Manifest & { update_url?: string }).update_url);
}

/** 按当前设置重建定时任务；周期为 0 时把任务撤掉 */
export async function syncSchedule(): Promise<void> {
  const settings = await loadSettings();
  const hours = settings.updateInterval;
  const existing = await getAlarm(ALARM);
  if (!hours) {
    if (existing) await clearAlarm(ALARM);
    return;
  }
  const period = hours * 60;
  if (existing && Math.abs((existing.periodInMinutes ?? 0) - period) < 0.01) return;
  await clearAlarm(ALARM);
  alarmApi().create(ALARM, { periodInMinutes: period });
}

/** 提示用户有新版本：图标角标 */
async function markBadge(): Promise<void> {
  try {
    await chrome.action.setBadgeText({ text: '新' });
    await chrome.action.setBadgeBackgroundColor({ color: '#00aeec' });
  } catch { /* 角标只是提示，失败不影响更新本身。 */ }
}

async function clearBadge(): Promise<void> {
  try { await chrome.action.setBadgeText({ text: '' }); } catch { /* 同上。 */ }
}

/** 一次完整的检查：发现新版本 → 记下来 → 打角标 */
export async function runCheck(options: { quiet?: boolean } = {}): Promise<void> {
  const settings = await loadSettings();
  if (!settings.enabled || !settings.privacyExternal || storeManaged()) return;
  let info: ReleaseInfo;
  try { info = await checkRelease(true); } catch { return; }
  const current = chrome.runtime.getManifest().version;
  if (!newerRelease(info.tag, current)) {
    if (!options.quiet) await clearBadge();
    return;
  }
  const known = await readUpdateState();
  if (!known || known.tag !== info.tag) {
    await writeUpdateState({ tag: info.tag, name: info.name, url: info.url, at: Date.now() });
    await markBadge();
  }
}

/** 后台启动时对一遍账：版本已经追上就清掉提示 */
export async function initScheduler(): Promise<void> {
  await syncSchedule();
  const state = await readUpdateState();
  const current = chrome.runtime.getManifest().version;
  if (state && !newerRelease(state.tag, current)) {
    await clearUpdateState();
    await clearBadge();
  }
}

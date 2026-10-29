/**
 * B 站足迹：每天首次打开时间与停留时长。
 * 只存在本机 chrome.storage.local；计时由后台 service worker 统一累计（见 src/background/sw.ts），
 * 登录后可用 B 站观看历史补全过去的天数。
 */
import { ACTIVITY_KEY as KEY, dayKey, hhmm, type Activity, type DayRecord, type FpMessage } from '../../shared/activity';
export { dayKey, type Activity, type DayRecord };

const LEGACY = 'margin-activity-v1';

export async function loadActivity(): Promise<Activity> {
  const v = await chrome.storage.local.get([KEY, LEGACY]);
  const cur = (v[KEY] as Activity | undefined) ?? {};
  const old = v[LEGACY] as Activity | undefined;
  if (old && !v[KEY]) { await chrome.storage.local.set({ [KEY]: old }); return { ...old }; }
  return cur;
}

interface HistoryItem { view_at: number; duration?: number; progress?: number }

/** 用观看历史补全（最多 20 页 × 30 条）。返回 ok / nologin / fail */
export async function backfill(): Promise<'ok' | 'nologin' | 'fail'> {
  const sums: Record<string, number> = {};
  const firsts: Record<string, string> = {};
  let max = 0, viewAt = 0, business = '';
  for (let page = 0; page < 20; page++) {
    let j: { code: number; data?: { list?: HistoryItem[]; cursor?: { max: number; view_at: number; business?: string } } };
    try {
      j = await fetch(`https://api.bilibili.com/x/web-interface/history/cursor?ps=30&max=${max}&view_at=${viewAt}&business=${business}`, { credentials: 'include' }).then((r) => r.json());
    } catch { return page ? 'ok' : 'fail'; }
    if (j.code !== 0) return j.code === -101 ? 'nologin' : page ? 'ok' : 'fail';
    const list = j.data?.list ?? [];
    for (const it of list) {
      const d = new Date(it.view_at * 1000);
      const k = dayKey(d);
      const dur = Number(it.duration) || 0;
      const prog = Number(it.progress);
      sums[k] = (sums[k] || 0) + Math.min(dur || 600, prog < 0 ? dur : Math.max(prog || 0, 0));
      const t = hhmm(d);
      if (!firsts[k] || t < firsts[k]) firsts[k] = t;
    }
    const c = j.data?.cursor;
    if (!list.length || !c?.max) break;
    max = c.max; viewAt = c.view_at; business = c.business ?? '';
  }
  // 交给后台串行写入，避免和心跳计时互相覆盖
  const days: Record<string, { h: number; hf?: string }> = {};
  for (const k of Object.keys(sums)) days[k] = { h: Math.round(sums[k]), hf: firsts[k] };
  await chrome.runtime.sendMessage({ margin: 'fp', op: 'merge', days } satisfies FpMessage);
  return 'ok';
}

export const secondsOf = (d?: DayRecord) => Math.max(d?.s || 0, d?.h || 0);
export const firstOf = (d?: DayRecord) => {
  const a = d?.f, b = d?.hf;
  return a && b ? (a < b ? a : b) : a || b;
};

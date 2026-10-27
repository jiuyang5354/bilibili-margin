/**
 * B 站足迹：每天首次打开时间与停留时长。
 * 只存在本机 chrome.storage.local；登录后可用 B 站观看历史补全过去的天数。
 */
export interface DayRecord {
  /** 本地记录的停留秒数（页面可见且有操作或在播放） */
  s: number;
  /** 本地记录的首次打开 HH:MM */
  f?: string;
  /** 观看历史估算的秒数 */
  h?: number;
  /** 观看历史里最早的观看时间 HH:MM */
  hf?: string;
}
export type Activity = Record<string, DayRecord>;

const KEY = 'margin:activity';
const TICK_KEY = 'margin:activity-tick';
const LEGACY = 'margin-activity-v1';
const TICK = 15;

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export async function loadActivity(): Promise<Activity> {
  const v = await chrome.storage.local.get([KEY, LEGACY]);
  const cur = (v[KEY] as Activity | undefined) ?? {};
  const old = v[LEGACY] as Activity | undefined;
  if (old && !v[KEY]) { await chrome.storage.local.set({ [KEY]: old }); return { ...old }; }
  return cur;
}

/** 在每个 B 站页面上运行：记首次打开时间，按 15 秒一档累计停留时长；多标签页共用一个计时。 */
export function startTracking(): void {
  let lastInput = Date.now();
  for (const t of ['pointermove', 'keydown', 'wheel', 'pointerdown', 'scroll'])
    addEventListener(t, () => { lastInput = Date.now(); }, { passive: true, capture: true });
  const playing = () => [...document.querySelectorAll('video')].some((v) => !v.paused && !v.ended && v.readyState > 2);

  let busy = false;
  async function tick(first: boolean) {
    if (busy) return;
    busy = true;
    try {
      const now = new Date();
      const visible = document.visibilityState === 'visible';
      const active = visible && (Date.now() - lastInput < 90_000 || playing());
      const data = await loadActivity();
      const k = dayKey(now);
      const day = (data[k] ??= { s: 0 });
      let changed = false;
      if (!day.f && visible) { day.f = hhmm(now); changed = true; }
      if (!first && active) {
        const last = ((await chrome.storage.local.get(TICK_KEY))[TICK_KEY] as number | undefined) ?? 0;
        if (Date.now() - last >= (TICK - 2) * 1000) {
          day.s = (day.s || 0) + TICK;
          changed = true;
          await chrome.storage.local.set({ [TICK_KEY]: Date.now() });
        }
      }
      if (changed) await chrome.storage.local.set({ [KEY]: data });
    } catch { /* 扩展更新后旧页面的 chrome.* 会失效，忽略 */ }
    finally { busy = false; }
  }
  tick(true);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(true); });
  setInterval(() => tick(false), TICK * 1000);
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
  const data = await loadActivity();
  for (const k of Object.keys(sums)) {
    const day = (data[k] ??= { s: 0 });
    day.h = Math.round(sums[k]);
    day.hf = firsts[k];
  }
  await chrome.storage.local.set({ [KEY]: data });
  return 'ok';
}

export const secondsOf = (d?: DayRecord) => Math.max(d?.s || 0, d?.h || 0);
export const firstOf = (d?: DayRecord) => {
  const a = d?.f, b = d?.hf;
  return a && b ? (a < b ? a : b) : a || b;
};

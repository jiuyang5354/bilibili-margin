/**
 * B 站足迹的数据格式与合并规则（内容脚本与后台 service worker 共用）。
 * 存储键 margin:activity，格式 { 'YYYY-MM-DD': DayRecord }，与 v0.30 及更早版本兼容。
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

export const ACTIVITY_KEY = 'margin:activity';
/** 已计入的 15 秒时间片（按本地日期分组），用来让多个标签页的心跳取并集，不重复累计 */
export const SLOTS_KEY = 'margin:activity-slots';
export const SLOT = 15_000;

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** 内容脚本 → service worker 的足迹消息 */
export type FpMessage =
  | { margin: 'fp'; op: 'open'; at: number }
  | { margin: 'fp'; op: 'beat'; from: number; to: number }
  | { margin: 'fp'; op: 'merge'; days: Record<string, { h: number; hf?: string }> };

/**
 * 把一段「活跃」时间 [from, to]（毫秒时间戳）记进 activity：
 * 以 15 秒为一片，片的中点落在区间内就算这片活跃；已经记过的片（别的标签页报过）不重复累计。
 * 返回新增秒数。
 */
export function applyBeat(data: Activity, slots: Record<string, number[]>, from: number, to: number): number {
  let added = 0;
  const sets = new Map<string, Set<number>>();
  for (let i = Math.ceil((from - SLOT / 2) / SLOT); i * SLOT + SLOT / 2 <= to; i++) {
    const k = dayKey(new Date(i * SLOT + SLOT / 2));
    let set = sets.get(k);
    if (!set) { set = new Set(slots[k] ?? []); sets.set(k, set); }
    if (set.has(i)) continue;
    set.add(i);
    (data[k] ??= { s: 0 }).s = (data[k].s || 0) + SLOT / 1000;
    added += SLOT / 1000;
  }
  for (const [k, set] of sets) slots[k] = [...set];
  // 只留最近两天的时间片
  const keep = Object.keys(slots).sort().slice(-2);
  for (const k of Object.keys(slots)) if (!keep.includes(k)) delete slots[k];
  return added;
}

/**
 * 足迹心跳（入口脚本里运行，所有 B 站页面）：
 * 页面活跃时每 15 秒把「上次心跳 → 现在」这段时间报给后台 service worker，由它统一累计。
 * 活跃 = 页面可见且 90 秒内有操作或正在播放。
 */
import type { FpMessage } from '../../shared/activity';
import { every } from '../sched';

const BEAT = 15_000;

const send = (m: FpMessage) => {
  try { chrome.runtime.sendMessage(m).catch(() => {}); } catch { /* 扩展更新后旧页面的 chrome.* 会失效，忽略 */ }
};

export function startTracking(): void {
  let lastInput = Date.now();
  for (const t of ['pointermove', 'keydown', 'wheel', 'pointerdown', 'scroll'])
    addEventListener(t, () => { lastInput = Date.now(); }, { passive: true, capture: true });
  const playing = () => [...document.querySelectorAll('video')].some((v) => !v.paused && !v.ended && v.readyState > 2);
  const active = () => document.visibilityState === 'visible' && (Date.now() - lastInput < 90_000 || playing());

  let last = 0; // 上次心跳时是否活跃（时间戳），用来把连续的活跃时间接成一段
  const beat = () => {
    const now = Date.now();
    if (!active()) { last = 0; return; }
    const from = last && now - last <= 70_000 ? last : now - BEAT;
    last = now;
    send({ margin: 'fp', op: 'beat', from, to: now });
  };
  const open = () => { if (document.visibilityState === 'visible') send({ margin: 'fp', op: 'open', at: Date.now() }); };
  open();
  document.addEventListener('visibilitychange', open);
  every(BEAT, beat);
}

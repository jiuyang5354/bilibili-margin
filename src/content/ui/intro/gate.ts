/** 开场动画播放期间，首页底下被完全遮住的动画（背景、天气、小电视眼睛）先睡着，让出 GPU / 主线程 */
let active = false;
const subs = new Set<() => void>();
export const introActive = (): boolean => active;
export function setIntroActive(v: boolean): void {
  active = v;
  if (!v) { const fs = [...subs]; subs.clear(); fs.forEach((f) => { try { f(); } catch { /* ignore */ } }); }
}
/** 开场结束（开始淡出）时调用一次 */
export function onIntroEnd(f: () => void): void { if (!active) f(); else subs.add(f); }

import { svg } from './dom';

/**
 * 21st「Sun Moon Theme Toggle」的原生移植：太阳和月亮沿按钮下方的同一段弧线
 * 一个落下、一个升起（落下 easeInCubic，升起 easeOutBack 带回弹），按钮里的
 * 夜空/白天渐变交叉淡入，星星闪烁；动画中途再点会从当前位置倒放回去。
 */
type Theme = 'light' | 'dark';
type Body = { side: -1 | 1; spin: number };
const MOON: Body = { side: -1, spin: 25 };
const SUN: Body = { side: 1, spin: 120 };
const R = 115, QUARTER = Math.PI / 2, STEPS = 30;
const SKY_EASING = 'cubic-bezier(0.65, 0, 0.35, 1)';
const STARS = [
  { x: 24, y: 22, r: 1.6, t: 2100 }, { x: 66, y: 16, r: 1.2, t: 2600 }, { x: 80, y: 42, r: 1.8, t: 1900 },
  { x: 38, y: 58, r: 1.1, t: 2900 }, { x: 58, y: 74, r: 1.4, t: 2300 }, { x: 14, y: 72, r: 1.2, t: 2500 },
];
const arc = (side: number, a: number) => ({ x: side * R * Math.sin(a), y: R * (1 - Math.cos(a)) });
const easeInCubic = (t: number) => t * t * t;
const easeOutBack = (t: number) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const setting = ({ side, spin }: Body): Keyframe[] => Array.from({ length: STEPS + 1 }, (_, i) => {
  const t = i / STEPS, k = easeInCubic(t), { x, y } = arc(side, k * QUARTER);
  return { offset: t, transform: `translate(${x}%, ${y}%) rotate(${side * spin * k}deg)`, opacity: t < 0.55 ? 1 : (1 - t) / 0.45 };
});
const rising = ({ side, spin }: Body): Keyframe[] => Array.from({ length: STEPS + 1 }, (_, i) => {
  const t = i / STEPS, rem = 1 - easeOutBack(t), { x, y } = arc(side, rem * QUARTER);
  return { offset: t, transform: `translate(${x}%, ${y}%) rotate(${side * spin * rem}deg) scale(${1 - 0.28 * rem})`, opacity: Math.min(1, t / 0.3) };
});
const KF = { moonSets: setting(MOON), moonRises: rising(MOON), sunSets: setting(SUN), sunRises: rising(SUN) };

const MOON_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
const SUN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-14.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';

export interface SunMoon {
  el: HTMLButtonElement;
  /** 同步到某个主题；animate=false 时直接摆到静止位置 */
  set(theme: Theme, animate?: boolean): void;
  readonly duration: number;
}

export function createSunMoon(onToggle: () => void, duration = 1740): SunMoon {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'sm-toggle';
  const span = (cls: string) => { const s = document.createElement('span'); s.className = cls; s.setAttribute('aria-hidden', 'true'); return s; };
  const night = span('sm-sky'), day = span('sm-sky');
  night.dataset.sky = 'night'; day.dataset.sky = 'day';
  for (const st of STARS) {
    const s = span('sm-star');
    s.style.cssText = `left:${st.x}%;top:${st.y}%;width:${st.r * 2}px;height:${st.r * 2}px`;
    night.append(s);
  }
  const moon = span('sm-body sm-moon'), sun = span('sm-body sm-sun');
  moon.append(svg(MOON_SVG)); sun.append(svg(SUN_SVG));
  el.append(night, day, moon, sun);

  let theme: Theme | null = null;
  let flight: Animation[] = [];

  const rest = (b: HTMLElement, body: Body, visible: boolean) => {
    b.style.transform = visible ? 'none' : `translate(${body.side * R}%, ${R}%)`;
    b.style.opacity = visible ? '1' : '0';
  };
  const restAll = (t: Theme) => {
    rest(moon, MOON, t === 'dark'); rest(sun, SUN, t === 'light');
    night.style.opacity = t === 'dark' ? '1' : '0';
    day.style.opacity = t === 'light' ? '1' : '0';
    twinkle.forEach((a) => (t === 'dark' ? a.play() : a.pause()));  // 亮色时星星看不见，不必一直闪
  };

  const twinkle: Animation[] = [];
  if (!reduced()) {
    [...night.children].forEach((s, i) => twinkle.push((s as HTMLElement).animate([{ opacity: 0.35 }, { opacity: 1 }, { opacity: 0.35 }],
      { duration: STARS[i].t, delay: -i * 530, iterations: Infinity, easing: 'ease-in-out' })));
  }

  function swap(next: Theme) {
    if (flight.length) { flight.forEach((a) => a.reverse()); return; }
    restAll(next === 'light' ? 'dark' : 'light');
    if (reduced()) { restAll(next); return; }
    const toLight = next === 'light';
    const set = (toLight ? moon : sun).animate(toLight ? KF.moonSets : KF.sunSets, { duration: duration * 0.65, fill: 'both' });
    const rise = (toLight ? sun : moon).animate(toLight ? KF.sunRises : KF.moonRises, { duration: duration * 0.64, delay: duration * 0.36, fill: 'both' });
    const opt = { duration, easing: SKY_EASING, fill: 'both' as const };
    const pair = [set, rise,
      night.animate([{ opacity: toLight ? 1 : 0 }, { opacity: toLight ? 0 : 1 }], opt),
      day.animate([{ opacity: toLight ? 0 : 1 }, { opacity: toLight ? 1 : 0 }], opt)];
    flight = pair;
    Promise.all(pair.map((a) => a.finished)).then(() => {
      if (flight !== pair) return;
      flight = [];
      restAll(theme!);
      pair.forEach((a) => a.cancel());
    }, () => {});
  }

  el.addEventListener('click', onToggle);
  return {
    el, duration,
    set(t, animate = true) {
      const label = t === 'dark' ? '切换到亮色' : '切换到暗色';
      el.title = label; el.setAttribute('aria-label', label); el.dataset.state = t;
      if (t === theme) return;
      const prev = theme;
      theme = t;
      if (prev && animate) swap(t); else { flight.forEach((a) => a.cancel()); flight = []; restAll(t); }
    },
  };
}

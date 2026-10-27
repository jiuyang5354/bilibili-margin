import { h } from './dom';

/**
 * 玻璃卡片：21st「Glass Card」（educalvolpz）的原生移植。
 * 分层照搬原版：内缩的磨砂主体 → 只在边缘一圈的折射环（SVG 噪声位移 + 轻模糊，Chromium 才弯曲）
 * → 青/品红色散边 → 跟随指针的高光 + 顶边扫光 → 底部压暗 → 内描边；悬停轻微抬起。
 * 指针跟随用临界阻尼弹簧（stiffness 250 / damping 34 / mass 0.5），光只会落定、不会晃。
 */
const RIM = 12, BLUR = 11, REFRACTION = 24, SPEC = 260, RIM_SHIFT = 6;
let uid = 0;

export function createGlassCard(content: HTMLElement, cls = ''): HTMLElement {
  const id = `gc-refr-${++uid}`;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'gc-svg'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<filter id="${id}"><feTurbulence type="fractalNoise" baseFrequency="0.016 0.024" numOctaves="2" seed="7" result="noise"/><feGaussianBlur in="noise" stdDeviation="1.4" result="soft"/><feDisplacementMap in="SourceGraphic" in2="soft" scale="${REFRACTION}" xChannelSelector="R" yChannelSelector="G"/></filter>`;
  const rimBlur = Math.max(1, Math.round(BLUR * 0.12));
  const rim = h('div', { class: 'gc-rim gc-ring', 'aria-hidden': 'true' });
  const probe = `url(#${id}) blur(2px)`;
  const rimF = `blur(${rimBlur}px) saturate(172%) brightness(1.07)`;
  rim.style.backdropFilter = CSS.supports('backdrop-filter', probe) ? `url(#${id}) ${rimF}` : rimF;
  const chroma = h('div', { class: 'gc-chroma gc-ring' });
  const spec = h('div', { class: 'gc-spec' });
  const sweep = h('div', { class: 'gc-sweep' });
  const el = h('div', { class: `gc ${cls}`.trim() },
    svg,
    h('div', { class: 'gc-body', 'aria-hidden': 'true' }),
    rim,
    h('div', { class: 'gc-light', 'aria-hidden': 'true' }, chroma, spec, sweep, h('div', { class: 'gc-shade' })),
    h('div', { class: 'gc-ringline', 'aria-hidden': 'true' }),
    content,
  );
  content.classList.add('gc-content');

  // 弹簧：5 个量一起积分
  const cur = [0, 0, 0, 0, 0], vel = [0, 0, 0, 0, 0], tgt = [0, 0, 0, 0, 0];
  let raf = 0, last = 0;
  const apply = () => {
    spec.style.transform = `translate(${cur[0]}px, ${cur[1]}px)`;
    sweep.style.transform = `translateX(${cur[2]}px)`;
    chroma.style.transform = `translate(${cur[3]}px, ${cur[4]}px)`;
  };
  const tick = (t: number) => {
    let dt = Math.min(0.05, (t - last) / 1000); last = t;
    while (dt > 0) {
      const s = Math.min(dt, 1 / 120); dt -= s;
      for (let i = 0; i < 5; i++) { const a = (-250 * (cur[i] - tgt[i]) - 34 * vel[i]) / 0.5; vel[i] += a * s; cur[i] += vel[i] * s; }
    }
    apply();
    if (cur.every((c, i) => Math.abs(c - tgt[i]) < 0.1) && vel.every((v) => Math.abs(v) < 0.1)) { raf = 0; return; }
    raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
  const tracks = () => matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.addEventListener('pointermove', (e) => {
    if (!tracks()) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    tgt[0] = x - r.width * 0.3; tgt[1] = y - r.height * 0.28; tgt[2] = x - r.width / 2;
    tgt[3] = (x / r.width - 0.5) * RIM_SHIFT; tgt[4] = (y / r.height - 0.5) * RIM_SHIFT;
    kick();
  });
  el.addEventListener('pointerleave', () => { tgt.fill(0); kick(); });
  void SPEC;
  return el;
}

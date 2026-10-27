import { h, icon } from './dom';

export interface TabSpec {
  title: string;
  icon: string;
  /** 有 href 时渲染为新标签页打开的链接 */
  href?: string;
  run?: () => void;
}
export type TabItem = TabSpec | 'separator';

export interface ExpandableTabs {
  el: HTMLElement;
  thumb: HTMLElement;
  buttons: HTMLElement[];
  select(i: number | null): void;
}

/**
 * 21st「Expandable Tabs」的原生移植：平时只露图标，选中项弹性展开出文字；
 * 点组件外任意处收起。原版用 framer-motion 动 width:auto，这里用
 * grid-template-columns 0fr→1fr 做同样的弹簧展开（delay .1s / .6s / 无回弹）。
 */
export function createExpandableTabs(items: TabItem[], onChange?: (i: number | null) => void): ExpandableTabs {
  const el = h('nav', { class: 'et', 'aria-label': '快捷入口' });
  // 液态玻璃滑块（21st「Apple Liquid glass switcher」的 toggler）：跟随选中项移动，移动时弹一下
  const thumb = h('span', { class: 'et-thumb', 'aria-hidden': 'true' });
  el.append(thumb);
  const buttons: HTMLElement[] = [];
  let selected: number | null = null;
  let raf = 0, until = 0, x = 0, w = 0, shown = false;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  const target = () => {
    const b = selected === null ? null : buttons[selected];
    if (!b) return null;
    const r = b.getBoundingClientRect(), o = el.getBoundingClientRect();
    return { x: r.left - o.left - el.clientLeft, w: r.width };
  };
  const paint = () => { thumb.style.translate = `${x}px 0`; thumb.style.width = `${w}px`; };
  const follow = (t: number) => {
    const g = target();
    if (g) {
      const k = reduce.matches ? 1 : 0.2;
      x += (g.x - x) * k; w += (g.w - w) * k;
      paint();
    }
    if (t < until || (g && (Math.abs(g.x - x) > 0.3 || Math.abs(g.w - w) > 0.3))) raf = requestAnimationFrame(follow);
    else raf = 0;
  };

  const select = (i: number | null) => {
    if (i === selected) return;
    const prev = selected;
    selected = i;
    buttons.forEach((b, j) => b.toggleAttribute('data-selected', j === i));
    if (i === null) { thumb.removeAttribute('data-on'); shown = false; }
    else {
      const g = target();
      if (!shown && g) { x = g.x; w = g.w; paint(); }
      thumb.setAttribute('data-on', '');
      if (shown && prev !== null && !reduce.matches) {
        thumb.animate([{ scale: '1 1' }, { scale: '1.18 1.12', offset: 0.45 }, { scale: '1 1' }], { duration: 520, easing: 'cubic-bezier(.3, 0, .2, 1)' });
      }
      shown = true;
      until = performance.now() + 900; // 按钮展开动画 .1s 延迟 + .6s
      if (!raf) raf = requestAnimationFrame(follow);
    }
    onChange?.(i);
  };

  for (const it of items) {
    if (it === 'separator') { el.append(h('div', { class: 'et-sep', 'aria-hidden': 'true' })); continue; }
    const idx = buttons.length;
    const label = h('span', {}, it.title);
    const b = it.href
      ? h('a', { class: 'act et-btn', href: it.href, target: '_blank', rel: 'noopener', title: it.title, 'aria-label': it.title }, icon(it.icon), label)
      : h('button', { class: 'act et-btn', type: 'button', title: it.title, 'aria-label': it.title }, icon(it.icon), label);
    b.addEventListener('click', () => { select(idx); it.run?.(); });
    buttons.push(b);
    el.append(b);
  }

  // useOnClickOutside：shadow DOM 里要看 composedPath
  addEventListener('pointerdown', (e) => { if (selected !== null && !e.composedPath().includes(el)) select(null); }, true);

  return { el, thumb, buttons, select };
}

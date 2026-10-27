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
  const buttons: HTMLElement[] = [];
  let selected: number | null = null;

  const select = (i: number | null) => {
    if (i === selected) return;
    selected = i;
    buttons.forEach((b, j) => b.toggleAttribute('data-selected', j === i));
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

  return { el, buttons, select };
}

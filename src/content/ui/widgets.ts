import { h } from './dom';
import type { Video } from '../api/feed';

/**
 * 首页足迹卡片右侧的「弹性画廊」：移植用户贴来的 21st Elastic Gallery。
 * 五条封面横向排开，悬停 / 点击的一条 flex 4、其余 flex 1（700ms cubic-bezier(.25,1,.5,1)），
 * 非激活条压暗 brightness .5、封面放大 1.1，标题竖排；激活条底部渐变 + 标签 + 标题 + 箭头入口。
 * 内容取自首页推荐流：每次加载 / 换一批时，推荐里的前 5 个放进画廊（不再在下面网格里重复）。
 */

interface Item { title: string; cover: string; tag: string; url: string; pct: number; cta: string }

const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>';

const fmtViews = (n: number) => (n >= 1e8 ? `${(n / 1e8).toFixed(1)}亿` : n >= 1e4 ? `${(n / 1e4).toFixed(1)}万` : String(n));

export interface Gallery { el: HTMLElement; show(list: Video[]): void; filled(): boolean }

export function createWidgets(): Gallery {
  const root = h('section', { class: 'eg', 'aria-label': '为你推荐' });
  for (let k = 0; k < 5; k++) root.append(h('div', { class: 'eg-item sk' }));
  let has = false;
  const show = (list: Video[]) => {
    const items: Item[] = list.slice(0, 5).map((v) => ({
      title: v.title, cover: v.cover, url: `https://www.bilibili.com/video/${v.bvid}`, pct: 0, cta: '去看看',
      tag: v.reason || `${v.author} · ${fmtViews(v.views)} 播放`,
    }));
    if (!items.length) return;
    has = true;
    root.textContent = '';
    const els: HTMLElement[] = [];
    const activate = (n: number) => els.forEach((e, k) => e.classList.toggle('on', k === n));
    items.forEach((it, n) => {
      const cta = h('span', { class: 'eg-cta' }, it.cta);
      cta.insertAdjacentHTML('beforeend', ARROW);
      const el = h('a', { class: 'eg-item', href: it.url, target: '_blank', rel: 'noopener', title: it.title },
        h('div', { class: 'eg-bg' },
          h('img', { src: it.cover, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }),
          h('div', { class: 'eg-shade' })),
        h('div', { class: 'eg-body' },
          h('div', { class: 'eg-on' },
            h('span', { class: 'eg-tag' }, it.tag),
            h('h3', { class: 'eg-title' }, it.title),
            cta),
          h('div', { class: 'eg-off' }, h('span', { class: 'eg-v' }, it.title), h('span', { class: 'eg-no' }, String(n + 1).padStart(2, '0')))),
      );
      // 悬停切换；第一次点击（触屏）只激活不跳转
      el.addEventListener('mouseenter', () => activate(n));
      el.addEventListener('click', (e) => { if (!el.classList.contains('on')) { e.preventDefault(); activate(n); } });
      els.push(el);
      root.append(el);
    });
    activate(0);
    root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
  };
  return { el: root, show, filled: () => has };
}

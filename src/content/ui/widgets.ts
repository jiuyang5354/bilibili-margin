import { h } from './dom';
import { historyList } from '../api/history';
import { popular } from '../api/feed';

/**
 * 首页足迹卡片右侧的「弹性画廊」：移植用户贴来的 21st Elastic Gallery。
 * 五条封面横向排开，悬停 / 点击的一条 flex 4、其余 flex 1（700ms cubic-bezier(.25,1,.5,1)），
 * 非激活条压暗 brightness .5、封面放大 1.1，标题竖排；激活条底部渐变 + 标签 + 标题 + 箭头入口。
 * 登录后放最近看过的 5 个视频（带进度、点开从上次位置继续），未登录放热门前 5。
 */

interface Item { title: string; cover: string; tag: string; url: string; pct: number; cta: string }

const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>';

async function resume(): Promise<Item[]> {
  try {
    const { list } = await historyList('archive', null);
    return list.filter((x) => x.cover).slice(0, 5).map((it) => {
      const done = it.progress < 0 || (it.duration > 0 && it.progress >= it.duration - 5);
      const p = done ? 0 : it.progress;
      const url = p > 0 ? `${it.url}${it.url.includes('?') ? '&' : '?'}t=${p}` : it.url;
      const pct = done ? 100 : it.duration ? Math.round((p / it.duration) * 100) : 0;
      return { title: it.title, cover: it.cover, tag: done ? '已看完' : `继续观看 ${pct}%`, url, pct, cta: done ? '再看一遍' : '接着看' };
    });
  } catch { return []; }
}

async function hot(): Promise<Item[]> {
  try {
    const { list } = await popular(1);
    return list.slice(0, 5).map((v) => ({ title: v.title, cover: v.cover, tag: v.author ? `热门 · ${v.author}` : '热门', url: `https://www.bilibili.com/video/${v.bvid}`, pct: 0, cta: '去看看' }));
  } catch { return []; }
}

export function createWidgets(): HTMLElement {
  const root = h('section', { class: 'eg', 'aria-label': '继续观看' });
  for (let k = 0; k < 5; k++) root.append(h('div', { class: 'eg-item sk' }));
  (async () => {
    let items = await resume();
    if (items.length < 3) items = await hot();
    root.textContent = '';
    if (!items.length) { root.append(h('p', { class: 'eg-empty' }, '暂时没有可以展示的视频')); return; }
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
        it.pct > 0 && it.pct < 100 ? h('i', { class: 'eg-pct', style: `width:${it.pct}%` }) : '',
      );
      // 悬停切换；第一次点击（触屏）只激活不跳转
      el.addEventListener('mouseenter', () => activate(n));
      el.addEventListener('click', (e) => { if (!el.classList.contains('on')) { e.preventDefault(); activate(n); } });
      els.push(el);
      root.append(el);
    });
    activate(Math.min(items.length - 1, 0));
  })();
  return root;
}

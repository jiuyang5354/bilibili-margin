import { h } from './dom';
import { historyList, type HistItem } from '../api/history';
import { hotSearch, rememberSearch, searchUrl, type Hot } from '../api/search';
import { popular } from '../api/feed';

/**
 * 首页足迹卡片右侧的两块小组件（视口足够宽时与足迹卡片同排，不够宽时排到下一行）：
 * - 继续观看：移植 21st「Music Player Card」（ravikatiyar162）——头像行 + 封面 + 底部渐变上的进度条与时间 + 居中播放键
 * - 热搜轮播：移植 21st「News Card」（ssych ui）——小标题、圆角面板里一条一条换的热搜、底部胶囊分页点
 */

const mmss = (s: number) => {
  s = Math.max(0, Math.floor(s));
  const hh = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return hh ? `${hh}:${p(m)}:${p(ss)}` : `${m}:${p(ss)}`;
};

interface Playing { title: string; cover: string; author: string; face: string; url: string; progress: number; duration: number; label: string }

async function lastWatched(): Promise<Playing | null> {
  try {
    const { list } = await historyList('archive', null);
    const it: HistItem | undefined = list.find((x) => x.duration > 0 && x.progress >= 0 && x.progress < x.duration - 5) ?? list[0];
    if (!it) return null;
    const p = it.progress < 0 ? it.duration : it.progress;
    const url = p > 0 && p < it.duration ? `${it.url}${it.url.includes('?') ? '&' : '?'}t=${p}` : it.url;
    return { title: it.title, cover: it.cover, author: it.author, face: it.face, url, progress: p, duration: it.duration, label: '继续观看' };
  } catch { return null; }
}

async function trendingPick(): Promise<Playing | null> {
  try {
    const { list } = await popular(1);
    const v = list[0];
    if (!v) return null;
    return { title: v.title, cover: v.cover, author: v.author, face: v.face, url: `https://www.bilibili.com/video/${v.bvid}`, progress: 0, duration: v.duration, label: '正在热门' };
  } catch { return null; }
}

function playBtn(): HTMLElement {
  const b = h('span', { class: 'wg-playbtn', 'aria-hidden': 'true' });
  b.innerHTML = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5z"/></svg>';
  return b;
}

function playerCard(): HTMLElement {
  const el = h('section', { class: 'wg wg-play', 'aria-label': '继续观看' });
  el.append(h('div', { class: 'wg-sk' }));
  (async () => {
    const it = (await lastWatched()) ?? (await trendingPick());
    el.textContent = '';
    if (!it) { el.append(h('p', { class: 'wg-empty' }, '暂时没有可以接着看的视频')); return; }
    const pct = it.duration ? Math.min(100, (it.progress / it.duration) * 100) : 0;
    const face = it.face ? h('img', { class: 'wg-face', src: it.face, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : h('span', { class: 'wg-face' }, it.author.charAt(0));
    el.append(
      h('div', { class: 'wg-head' },
        face,
        h('div', { class: 'wg-who' }, h('b', {}, it.author || 'UP 主'), h('small', {}, it.label)),
        h('span', { class: 'wg-kicker caps' }, it.progress ? 'RESUME' : 'HOT')),
      h('a', { class: 'wg-title2', href: it.url, target: '_blank', rel: 'noopener' }, it.title),
      h('a', { class: 'wg-art', href: it.url, target: '_blank', rel: 'noopener', title: it.title },
        h('img', { src: it.cover, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }),
        h('div', { class: 'wg-shade' },
          h('p', { class: 'wg-title' }, it.title),
          it.progress
            ? h('div', { class: 'wg-prog' },
              h('div', { class: 'wg-time' }, h('span', {}, mmss(it.progress)), h('span', {}, `-${mmss(it.duration - it.progress)}`)),
              h('div', { class: 'wg-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(pct)) },
                h('i', { style: `width:${pct}%` })))
            : h('div', { class: 'wg-time' }, h('span', {}, mmss(it.duration)), h('span', {})),
        ),
        playBtn()),
    );
  })();
  return el;
}

function newsCard(): HTMLElement {
  const el = h('section', { class: 'wg wg-news', 'aria-label': 'B 站热搜' });
  const panel = h('a', { class: 'wg-panel', target: '_blank', rel: 'noopener' });
  const dots = h('div', { class: 'wg-dots' });
  el.append(h('div', { class: 'wg-label' }, h('span', { class: 'caps' }, 'TRENDING'), h('span', {}, 'B 站热搜')), panel, dots);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let items: Hot[] = [], i = 0, timer = 0;
  const show = (n: number, anim = true) => {
    i = n;
    const it = items[i];
    panel.href = searchUrl(it.keyword);
    panel.onclick = () => rememberSearch(it.keyword);
    const body = h('div', { class: 'wg-story' },
      h('div', { class: 'wg-rank' }, String(i + 1).padStart(2, '0')),
      h('p', { class: 'wg-head-line' }, it.name),
      h('div', { class: 'wg-src' }, `热搜 · 第 ${i + 1} 名`));
    const old = panel.firstElementChild as HTMLElement | null;
    if (old && anim && !reduced) {
      old.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-4px)' }], { duration: 180, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' })
        .finished.then(() => { old.remove(); panel.append(body); body.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: 'cubic-bezier(.16,1,.3,1)' }); });
    } else { panel.textContent = ''; panel.append(body); }
    [...dots.children].forEach((d, k) => d.setAttribute('aria-current', String(k === i)));
  };
  const start = () => { clearInterval(timer); if (!reduced && items.length > 1) timer = window.setInterval(() => { if (!document.hidden) show((i + 1) % items.length); }, 5200); };
  hotSearch().then((hot) => {
    items = hot.slice(0, 6);
    if (!items.length) { panel.append(h('p', { class: 'wg-empty' }, '热搜暂时取不到')); return; }
    items.forEach((_, n) => dots.append(h('button', { type: 'button', 'aria-label': `第 ${n + 1} 条`, onclick: () => { show(n); start(); } })));
    show(0, false);
    start();
  });
  el.addEventListener('pointerenter', () => clearInterval(timer));
  el.addEventListener('pointerleave', start);
  return el;
}

export function createWidgets(): HTMLElement {
  return h('div', { class: 'widgets' }, playerCard(), newsCard());
}

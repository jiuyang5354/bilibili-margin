import { folderVideos, folders, type Folder } from '../api/fav';
import { videoCard, skeleton } from './card';
import { h, icon, ICONS } from './dom';
import { createSheet, type Sheet } from './sheet';

// 文件夹几何（340 × 272 坐标系，CSS 统一缩放）
const BACK_PATH = 'M0 56A22 22 0 0 1 22 34L146 34C170 34 172 0 198 0L318 0A22 22 0 0 1 340 22L340 250A22 22 0 0 1 318 272L22 272A22 22 0 0 1 0 250Z';
const FRONT_PATH = 'M0 22A22 22 0 0 1 22 0L118 0C144 0 146 32 172 32L318 32A22 22 0 0 1 340 54L340 176A22 22 0 0 1 318 198L22 198A22 22 0 0 1 0 176Z';

/** 收藏夹抽屉：玻璃文件夹 → 视频网格（无限加载） */
export function createFavorites(onRender: (grid: HTMLElement) => void): Sheet {
  let loaded = false;
  const shelf = h('div', { class: 'shelf' });
  const grid = h('div', { class: 'grid fav-grid' });
  const status = h('div', { class: 'status' });
  const sentinel = h('div', { class: 'sentinel' });
  const crumb = h('div', { class: 'crumb' });
  let current: Folder | null = null;
  let page = 1;
  let more = false;
  let busy = false;
  let gen = 0;

  const sheet = createSheet({ title: '收藏夹', eyebrow: 'FAVORITES', width: 820, onOpen: () => { if (!loaded) init(); } });
  sheet.body.classList.add('fav-body');
  sheet.body.append(shelf, crumb, grid, status, sentinel);
  onRender(grid);

  async function init() {
    loaded = true;
    shelf.replaceChildren(...Array.from({ length: 4 }, () => h('div', { class: 'fd sk' })));
    try {
      const list = await folders();
      if (!list) {
        shelf.replaceChildren(h('div', { class: 'empty' }, h('p', {}, '登录后才能看到你的收藏夹'), h('a', { class: 'user', href: 'https://passport.bilibili.com/login', target: '_blank', rel: 'noopener' }, '去登录')));
        return;
      }
      shelf.replaceChildren(...list.map((f, i) => folderCard(f, i)));
      if (list[0]) open(list[0]);
    } catch (e) {
      loaded = false;
      shelf.replaceChildren(h('div', { class: 'empty' }, h('p', {}, `加载失败：${(e as Error).message}`)));
    }
  }

  /** 玻璃文件夹：后板带弯角标签、封面从口袋里露出、前板毛玻璃，指针靠近时前倾
   *  （形态参考 21st「Glassmorphism Folder Cards」，原生重写） */
  function folderCard(f: Folder, i: number): HTMLElement {
    const NS = 'http://www.w3.org/2000/svg';
    const rim = (d: string, w: number, hh: number, cls: string) => {
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${w} ${hh}`);
      svg.setAttribute('class', `fd-rim ${cls}`);
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      svg.append(path);
      return svg;
    };
    const img = (w: number, hh: number) => f.cover ? h('img', { src: `${f.cover}@${w}w_${hh}h_1c.webp`, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : null;
    const key = h('a', {
      class: 'fd-key', href: `https://space.bilibili.com/${f.mid}/favlist?fid=${f.id}`, target: '_blank', rel: 'noopener',
      title: '在 B 站打开', 'aria-label': `在 B 站打开「${f.title}」`, onclick: (e: Event) => e.stopPropagation(),
    }, icon(ICONS.arrow));
    const b = h('div', { class: 'fd', style: `--i:${i}`, role: 'button', tabindex: 0, 'aria-label': `${f.title}，${f.count} 个视频`, onclick: () => open(f) },
      h('div', { class: 'fd-stage' },
        h('div', { class: 'fd-tilt' },
          h('span', { class: 'fd-shadow' }),
          h('div', { class: 'fd-back' }, img(400, 320), h('span', { class: 'fd-sheen' })),
          rim(BACK_PATH, 340, 272, 'fd-back-rim'),
          h('div', { class: 'fd-sheet' }, img(320, 200)),
          h('div', { class: 'fd-front' },
            h('span', { class: 'fd-blur' }, img(400, 320)),
            h('span', { class: 'fd-tint' }),
            h('span', { class: 'fd-spec' }),
            rim(FRONT_PATH, 340, 198, 'fd-front-rim'),
            h('span', { class: 'fd-label' }, h('b', {}, f.title), h('small', {}, `${f.count} 个视频`)),
            key,
          ),
        ),
      ),
    );
    b.dataset.id = String(f.id);
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(f); } });
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      b.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
      b.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
    });
    b.addEventListener('pointerleave', () => { b.style.setProperty('--px', '0'); b.style.setProperty('--py', '0'); });
    return b;
  }

  function open(f: Folder) {
    current = f;
    gen++;
    page = 1;
    more = true;
    busy = false;
    shelf.querySelectorAll<HTMLElement>('.fd').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.id === String(f.id))));
    crumb.replaceChildren(h('span', {}, f.title), h('small', {}, `${f.count} 个视频`));
    grid.replaceChildren();
    status.replaceChildren();
    sheet.body.scrollTo({ top: 0 });
    load();
  }

  async function load() {
    if (!current || busy || !more) return;
    busy = true;
    const g = gen;
    const sk = [...skeleton(page === 1 ? 6 : 3).childNodes];
    grid.append(...sk);
    try {
      const r = await folderVideos(current.id, page++);
      if (g !== gen) return;
      sk.forEach((n) => (n as Element).remove());
      const start = grid.children.length;
      r.list.forEach((v, i) => grid.append(videoCard(v, start + i, { compact: true })));
      more = r.more;
      if (!more) status.replaceChildren(h('span', {}, grid.children.length ? '到底了' : '这个收藏夹是空的'));
    } catch (e) {
      if (g !== gen) return;
      sk.forEach((n) => (n as Element).remove());
      status.replaceChildren(h('span', {}, `加载失败：${(e as Error).message}`));
    } finally {
      if (g === gen) busy = false;
    }
  }

  new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) load(); }, { root: sheet.body, rootMargin: '600px 0px' }).observe(sentinel);
  return sheet;
}

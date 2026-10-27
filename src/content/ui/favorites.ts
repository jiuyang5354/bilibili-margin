import { folderVideos, folders, type Folder } from '../api/fav';
import { videoCard, skeleton } from './card';
import { h, icon, ICONS } from './dom';
import { createSheet, type Sheet } from './sheet';

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
    shelf.replaceChildren(...Array.from({ length: 4 }, () => h('div', { class: 'folder sk' })));
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

  function folderCard(f: Folder, i: number): HTMLElement {
    const b = h('button', { type: 'button', class: 'folder', style: `--i:${i}`, onclick: () => open(f) },
      h('span', { class: 'folder-tab' }),
      h('span', { class: 'folder-paper' }, f.cover ? h('img', { src: `${f.cover}@320w_200h_1c.webp`, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : icon(ICONS.folder)),
      h('span', { class: 'folder-front' }, h('b', {}, f.title), h('small', {}, `${f.count} 个视频`)),
    );
    b.dataset.id = String(f.id);
    return b;
  }

  function open(f: Folder) {
    current = f;
    gen++;
    page = 1;
    more = true;
    busy = false;
    shelf.querySelectorAll<HTMLElement>('.folder').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.id === String(f.id))));
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

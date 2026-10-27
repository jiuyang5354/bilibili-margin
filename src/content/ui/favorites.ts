import { folderVideos, folders, type Folder } from '../api/fav';
import { videoCard, skeleton } from './card';
import { h } from './dom';
import { glassFolder, type GFFile } from './glass-folder';
import type { ArtPreset } from './folder-art';
import type { Video } from '../api/feed';
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
    shelf.replaceChildren(...Array.from({ length: 4 }, () => h('div', { class: 'gf-sk sk' })));
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

  const ARTS: ArtPreset[] = ['aurora', 'ember', 'dusk', 'glacier', 'verdant'];
  const firstPage = new Map<number, Promise<{ list: Video[]; more: boolean }>>();
  const page1 = (id: number) => { let p = firstPage.get(id); if (!p) { p = folderVideos(id, 1); p.catch(() => firstPage.delete(id)); firstPage.set(id, p); } return p; };
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  /** 玻璃文件夹（按 21st「Glass Folder Cards」源码原生移植）：
   *  后板是收藏夹封面（没有封面就生成液态纹理），口袋里是最近收藏的 4 个视频，
   *  点开后视频扇形升起、可直接点进去；··· 菜单里是查看全部 / 在 B 站打开 */
  function folderCard(f: Folder, i: number): HTMLElement {
    const gf = glassFolder({
      label: f.title,
      meta: `${f.count} 个视频`,
      image: f.cover ? `${f.cover}@728w_592h_1c.webp` : undefined,
      art: ARTS[f.id % ARTS.length],
      seed: f.id % 997,
      width: 236,
      appearDelay: i * 140,
      onOpenChange: (o) => { if (o) open(f); },
      menu: [
        { label: '查看全部视频', onSelect: () => { open(f); crumb.scrollIntoView({ behavior: 'smooth', block: 'start' }); } },
        { label: '在 B 站打开', onSelect: () => window.open(`https://space.bilibili.com/${f.mid}/favlist?fid=${f.id}`, '_blank', 'noopener') },
      ],
    });
    gf.el.dataset.id = String(f.id);
    page1(f.id).then((r) => {
      // 最新收藏放在最前面（离玻璃最近）
      const files: GFFile[] = r.list.slice(0, 4).reverse().map((v) => ({
        name: v.title, meta: v.duration ? mmss(v.duration) : undefined,
        image: v.cover ? `${v.cover}@544w_368h_1c.webp` : undefined, art: v.cover ? undefined : ARTS[v.mid % ARTS.length],
        href: `https://www.bilibili.com/video/${v.bvid}`,
      }));
      gf.setFiles(files);
    }).catch(() => {});
    return gf.el;
  }

  function open(f: Folder) {
    if (current?.id === f.id && grid.children.length) return;
    current = f;
    gen++;
    page = 1;
    more = true;
    busy = false;
    shelf.querySelectorAll<HTMLElement>('.gf-root').forEach((el) => el.toggleAttribute('data-current', el.dataset.id === String(f.id)));
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
      const r = await (page === 1 ? page1(current.id) : folderVideos(current.id, page)); page++;
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

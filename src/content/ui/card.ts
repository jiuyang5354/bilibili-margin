import type { Video } from '../api/feed';
import { fmtAgo, fmtCount, fmtDuration, h } from './dom';

const thumb = (url: string) => (url ? `${url}@672w_378h_1c.webp` : '');

export function videoCard(v: Video, index: number): HTMLElement {
  const href = `https://www.bilibili.com/video/${v.bvid}`;
  return h('article', { class: 'card', style: `--i:${index % 12}` },
    h('a', { class: 'cover', href, target: '_blank', rel: 'noopener', title: v.title },
      h('img', { src: thumb(v.cover), alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' }),
      v.duration ? h('span', { class: 'dur' }, fmtDuration(v.duration)) : null,
    ),
    h('div', { class: 'body' },
      h('a', { class: 'title', href, target: '_blank', rel: 'noopener' }, v.title),
      h('div', { class: 'meta' },
        h('a', { class: 'author', href: `https://space.bilibili.com/${v.mid}`, target: '_blank', rel: 'noopener' }, v.author),
        h('span', { class: 'dot' }, '·'),
        h('span', {}, `${fmtCount(v.views)} 播放`),
        v.pubdate ? h('span', { class: 'dot' }, '·') : null,
        v.pubdate ? h('span', {}, fmtAgo(v.pubdate)) : null,
      ),
      v.reason ? h('span', { class: 'reason' }, v.reason) : null,
    ),
  );
}

export function skeleton(n: number): DocumentFragment {
  const f = document.createDocumentFragment();
  for (let i = 0; i < n; i++) f.append(h('div', { class: 'card sk' }, h('div', { class: 'cover' }), h('div', { class: 'line' }), h('div', { class: 'line short' })));
  return f;
}

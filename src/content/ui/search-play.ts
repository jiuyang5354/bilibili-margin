import { icon, ICONS } from './dom';
import { openVideoModal } from './video-modal';

const CARD_SEL = '.bili-video-card';
const WRAP_SEL = '.bili-video-card__image--wrap, .bili-video-card__image, .bili-video-card__cover';
const EXACT_LINK_SEL = '#margin-search-exact-results .mx-cover';
const BTN_CLASS = 'margin-search-play';

function makePlayButton(getTarget: () => { bvid: string; title?: string; cover?: string } | null): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = BTN_CLASS;
  btn.title = '在当前窗口播放';
  btn.setAttribute('aria-label', '在当前窗口播放');
  btn.append(icon(ICONS.play));
  const stop = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };
  btn.addEventListener('pointerdown', (e) => e.stopPropagation());
  btn.addEventListener('click', (e) => {
    stop(e);
    const target = getTarget();
    if (target) openVideoModal(target, btn);
  });
  return btn;
}

function attachToNativeCard(card: HTMLElement): void {
  if (card.querySelector(`.${BTN_CLASS}`)) return;
  const link = card.querySelector<HTMLAnchorElement>('a[href*="/video/BV"]');
  const bvid = link?.href.match(/\/video\/(BV[0-9A-Za-z]{10})(?:[/?#]|$)/)?.[1];
  if (!bvid) return;
  const wrap = card.querySelector<HTMLElement>(WRAP_SEL) ?? link;
  if (!wrap) return;
  // 保持原生容器静态定位不被破坏：只在非定位容器上标记定位类
  wrap.classList.add('margin-search-cover');
  const titleEl = card.querySelector('.bili-video-card__info--tit');
  const title = (titleEl?.getAttribute('title') || titleEl?.textContent || '').trim() || bvid;
  const btn = makePlayButton(() => {
    const img = card.querySelector<HTMLImageElement>('img');
    const cover = img?.currentSrc || img?.src || img?.getAttribute('data-src') || '';
    const liveTitle = (card.querySelector('.bili-video-card__info--tit')?.getAttribute('title') || card.querySelector('.bili-video-card__info--tit')?.textContent || '').trim() || title;
    return { bvid, title: liveTitle, cover };
  });
  btn.setAttribute('aria-label', `在当前窗口播放：${title}`);
  wrap.append(btn);
}
function attachToExactCard(cover: HTMLElement): void {
  const li = cover.closest<HTMLElement>('li[data-bvid]');
  if (!li || cover.querySelector(`.${BTN_CLASS}`)) return;
  const bvid = li.dataset.bvid ?? cover.getAttribute('href')?.match(/\/video\/(BV[0-9A-Za-z]{10})(?:[/?#]|$)/)?.[1];
  if (!bvid) return;
  cover.classList.add('margin-search-cover');
  const title = li.querySelector('.mx-title')?.textContent?.trim() || bvid;
  const btn = makePlayButton(() => {
    const img = cover.querySelector<HTMLImageElement>('img');
    return { bvid, title, cover: img?.currentSrc || img?.src || '' };
  });
  btn.setAttribute('aria-label', `在当前窗口播放：${title}`);
  cover.append(btn);
}

export function mountSearchPlayButtons(): () => void {
  const scan = (root: ParentNode = document) => {
    root.querySelectorAll<HTMLElement>(CARD_SEL).forEach(attachToNativeCard);
    root.querySelectorAll<HTMLElement>(EXACT_LINK_SEL).forEach(attachToExactCard);
  };
  let timer = 0;
  const schedule = () => {
    if (timer) return;
    timer = window.setTimeout(() => {
      timer = 0;
      scan();
    }, 80);
  };

  scan();
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      for (const node of r.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches(CARD_SEL)) attachToNativeCard(node);
        else if (node.matches(EXACT_LINK_SEL)) attachToExactCard(node);
        else if (node.querySelector(`${CARD_SEL}, ${EXACT_LINK_SEL}`)) {
          schedule();
          return;
        }
      }
    }
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  else document.addEventListener('DOMContentLoaded', () => {
    scan();
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  }, { once: true });

  return () => {
    clearTimeout(timer);
    observer.disconnect();
    document.querySelectorAll(`.${BTN_CLASS}`).forEach((el) => el.remove());
  };
}

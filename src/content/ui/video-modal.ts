import type { Video } from '../api/feed';
import { h, icon, ICONS } from './dom';
import { containModalFocus } from './modal-focus';
import { attachGlass, filtersIn } from './liquid-glass';
import { toast } from './controls';

export interface VideoModalTarget {
  bvid: string;
  title?: string;
  author?: string;
  cover?: string;
  aid?: number;
}

export interface VideoModalApi {
  open(target: VideoModalTarget | Video): void;
  close(): void;
  minimize(): void;
  maximize(): void;
  restore(): void;
  isOpen(): boolean;
  isMinimized(): boolean;
  el: HTMLElement;
}

export type ModalState = 'closed' | 'open' | 'minimized';

const MINIMIZE_ICON = '<g data-margin="minimize" transform="scale(1.5)" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"><line x1="3.5" y1="8" x2="12.5" y2="8"/></g>';
const MAXIMIZE_ICON = '<g data-margin="maximize" transform="scale(1.5)" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M6.25 3.25 H4 A1.75 1.75 0 0 0 2.25 5 V12 A1.75 1.75 0 0 0 4 13.75 H11 A1.75 1.75 0 0 0 12.75 12 V9.75"/><path d="M9.25 2.25 H13.75 V6.75"/><line x1="13.5" y1="2.5" x2="7.75" y2="8.25"/></g>';
const RESTORE_ICON = '<g data-margin="restore" transform="scale(1.5)" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><polyline points="5.5 10.5 5.5 5.5 10.5 5.5"/><line x1="5.75" y1="5.75" x2="12.75" y2="12.75"/><polyline points="3.5 12.5 3.5 3.5 12.5 3.5" opacity=".45"/></g>';

export function buildWatchModalUrl(bvid: string, p?: number): string {
  const clean = /^BV[0-9A-Za-z]{10}$/.test(bvid) ? bvid : '';
  const base = `https://www.bilibili.com/video/${clean}/`;
  const url = new URL(base);
  url.searchParams.set('margin_modal', '1');
  if (p && p > 1) url.searchParams.set('p', String(p));
  return url.toString();
}

export function cleanWatchTabUrl(rawHref: string, fallbackBvid: string): string {
  try {
    const u = new URL(rawHref);
    u.searchParams.delete('margin_modal');
    if (u.hostname.endsWith('.bilibili.com') && /\/video\/BV[0-9A-Za-z]{10}/.test(u.pathname)) {
      return u.toString();
    }
  } catch { /* fallback */ }
  return `https://www.bilibili.com/video/${fallbackBvid}`;
}

export function pauseMediaInDocument(doc: Document | null | undefined): boolean {
  if (!doc) return false;
  let paused = false;
  try {
    const list = doc.querySelectorAll<HTMLMediaElement>('video, audio, bwp-video');
    for (const m of list) {
      if (typeof m.pause === 'function' && !m.paused) {
        m.pause();
        paused = true;
      }
    }
    const playBtn = doc.querySelector<HTMLElement>('.bpx-player-ctrl-play');
    const state = doc.querySelector('.bpx-player-container')?.getAttribute('data-state');
    if (!paused && playBtn && state === 'playing') {
      playBtn.click();
      paused = true;
    }
  } catch { /* cross-origin or detached */ }
  return paused;
}

export function resumeMediaInDocument(doc: Document | null | undefined): boolean {
  if (!doc) return false;
  try {
    const list = doc.querySelectorAll<HTMLMediaElement>('video, audio, bwp-video');
    for (const m of list) {
      if (typeof m.play === 'function' && m.paused) {
        void m.play().catch(() => {});
        return true;
      }
    }
  } catch { /* ignore */ }
  return false;
}

class VideoModalManager {
  private layer: HTMLElement | null = null;
  private scrim: HTMLElement | null = null;
  private panel: HTMLElement | null = null;
  private controlsDock: HTMLElement | null = null;
  private miniBar: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private miniTitleEl: HTMLElement | null = null;
  private miniSubEl: HTMLElement | null = null;
  private frameWrap: HTMLElement | null = null;
  private themeObserver: MutationObserver | null = null;
  private frame: HTMLIFrameElement | null = null;
  private loadingEl: HTMLElement | null = null;
  private minBtn: HTMLButtonElement | null = null;
  private maxBtn: HTMLButtonElement | null = null;
  private closeBtn: HTMLButtonElement | null = null;
  private restoreBtn: HTMLButtonElement | null = null;
  private releaseFocus: (() => void) | null = null;
  private disposeGlass: (() => void)[] = [];
  private state: ModalState = 'closed';
  private current: VideoModalTarget | null = null;
  private frameHref = '';
  private messageHandler: ((e: MessageEvent) => void) | null = null;
  private hostRoot: ShadowRoot | null = null;
  private appEl: HTMLElement | null = null;
  private onOpenChange?: (open: boolean) => void;
  private loadTimer = 0;

  mount(root: ShadowRoot, appEl: HTMLElement, onOpenChange?: (open: boolean) => void): HTMLElement {
    if (this.layer && this.hostRoot === root) return this.layer;
    this.dispose();
    this.hostRoot = root;
    this.appEl = appEl;
    this.onOpenChange = onOpenChange;

    this.scrim = h('div', { class: 'vm-scrim' });
    this.titleEl = h('span', { class: 'vm-title-text' }, '');
    this.minBtn = h('button', {
      type: 'button',
      class: 'vm-ctrl vm-ctrl-min',
      title: '最小化到右下角并暂停',
      'aria-label': '最小化',
      onclick: (e: Event) => { e.stopPropagation(); this.minimize(); },
    }, icon(MINIMIZE_ICON)) as HTMLButtonElement;

    this.maxBtn = h('button', {
      type: 'button',
      class: 'vm-ctrl vm-ctrl-max',
      title: '在新标签页中打开完整页面',
      'aria-label': '最大化到新标签页',
      onclick: (e: Event) => { e.stopPropagation(); this.maximize(); },
    }, icon(MAXIMIZE_ICON)) as HTMLButtonElement;

    this.closeBtn = h('button', {
      type: 'button',
      class: 'vm-ctrl vm-ctrl-close',
      title: '关闭播放窗口 (Esc)',
      'aria-label': '关闭',
      onclick: (e: Event) => { e.stopPropagation(); this.close(); },
    }, icon(ICONS.close)) as HTMLButtonElement;

    this.controlsDock = h('div', { class: 'vm-controls', role: 'toolbar', 'aria-label': '窗口控制' },
      this.minBtn, this.maxBtn, this.closeBtn);

    const badge = h('div', { class: 'vm-badge' },
      h('span', { class: 'vm-badge-dot', 'aria-hidden': 'true' }),
      this.titleEl,
    );

    this.restoreBtn = h('button', {
      type: 'button',
      class: 'vm-mini-restore',
      title: '还原播放窗口',
      'aria-label': '还原播放窗口',
      onclick: (e: Event) => { e.stopPropagation(); this.restore(); },
    }, icon(RESTORE_ICON)) as HTMLButtonElement;

    this.miniTitleEl = h('div', { class: 'vm-mini-title' }, '');
    this.miniSubEl = h('div', { class: 'vm-mini-sub' }, '已暂停 · 点击还原继续播放');
    const miniMeta = h('div', { class: 'vm-mini-meta', onclick: () => this.restore() }, this.miniTitleEl, this.miniSubEl);
    this.miniBar = h('div', { class: 'vm-mini-bar', hidden: '' },
      miniMeta,
      h('div', { class: 'vm-mini-actions' }, this.restoreBtn),
    );

    this.loadingEl = h('div', { class: 'vm-loading', role: 'status' },
      h('div', { class: 'vm-spinner', 'aria-hidden': 'true' }),
      h('span', {}, '正在载入视频播放页…'),
    );

    this.frameWrap = h('div', { class: 'vm-frame-wrap' }, this.loadingEl);

    const header = h('div', { class: 'vm-top' }, badge, this.controlsDock);

    this.panel = h('section', {
      class: 'vm-panel',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': '当前窗口播放',
      tabindex: '-1',
    }, header, this.frameWrap, this.miniBar);

    this.layer = h('div', {
      class: 'vm-layer',
      'data-state': 'closed',
      hidden: '',
    }, this.scrim, this.panel);
    this.layer.inert = true;

    this.scrim.addEventListener('click', () => {
      if (this.state === 'open') this.minimize();
    });

    this.panel.addEventListener('click', (e) => {
      if (this.state === 'minimized' && !(e.target as Element).closest('button')) {
        this.restore();
      }
    });

    const filters = filtersIn(root);
    this.disposeGlass = [
      attachGlass(this.controlsDock, filters, { profile: 'gradient', blur: 6, strength: 0.35, sat: '145%' }),
      attachGlass(badge, filters, { profile: 'gradient', blur: 6, strength: 0.25, sat: '140%' }),
    ];
    this.themeObserver = new MutationObserver(() => this.syncFrameTheme());
    this.themeObserver.observe(appEl, { attributes: true, attributeFilter: ['data-theme'] });
    this.messageHandler = (e: MessageEvent) => {
      if (e.source !== this.frame?.contentWindow || e.origin !== 'https://www.bilibili.com') return;
      const st = (e.data as { marginModalState?: { title?: string; url?: string } } | null)?.marginModalState;
      if (!st) return;
      if (st.title && this.titleEl && this.miniTitleEl) {
        this.titleEl.textContent = st.title;
        this.titleEl.title = st.title;
        this.miniTitleEl.textContent = st.title;
        this.miniTitleEl.title = st.title;
      }
      if (st.url) this.frameHref = st.url;
    };
    addEventListener('message', this.messageHandler);

    return this.layer;
  }

  open(target: VideoModalTarget | Video): void {
    if (!this.layer || !this.panel || !this.frameWrap) return;
    if (!/^BV[0-9A-Za-z]{10}$/.test(target.bvid)) {
      if (this.appEl) toast(this.appEl, '暂时只支持播放 BV 视频');
      return;
    }
    document.dispatchEvent(new CustomEvent('margin:modal-open'));
    // 若在播放页/收藏夹打开模态框，先暂停原页面正在播放的原生视频和悬停预览
    pauseMediaInDocument(document);
    if (this.hostRoot) {
      for (const m of this.hostRoot.querySelectorAll<HTMLMediaElement>('video, audio, bwp-video')) {
        if (!m.paused) m.pause();
      }
    }

    const sameVideo = this.current?.bvid === target.bvid && this.state !== 'closed';
    this.current = {
      bvid: target.bvid,
      title: target.title || target.bvid,
      author: target.author,
      cover: target.cover,
      aid: target.aid,
    };

    const label = this.current.title || this.current.bvid;
    if (this.titleEl) {
      this.titleEl.textContent = label;
      this.titleEl.title = label;
    }
    if (this.miniTitleEl) {
      this.miniTitleEl.textContent = label;
      this.miniTitleEl.title = label;
    }

    if (sameVideo && this.state === 'minimized') {
      this.restore();
      return;
    }

    this.ensureFrame(buildWatchModalUrl(this.current.bvid));
    this.enterOpenState();
  }

  private ensureFrame(src: string): void {
    if (!this.frameWrap) return;
    clearTimeout(this.loadTimer);
    if (this.loadingEl) this.loadingEl.hidden = false;

    if (!this.frame) {
      const iframe = document.createElement('iframe');
      iframe.className = 'vm-frame';
      iframe.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write';
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      // 阻止内嵌播放页的防嵌套脚本（window.open(location.href, '_top')）或跨域跳转带走顶层页面
      iframe.setAttribute(
        'sandbox',
        'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-modals',
      );
      iframe.title = '视频播放窗口';
      iframe.addEventListener('load', () => {
        clearTimeout(this.loadTimer);
        if (this.loadingEl) this.loadingEl.hidden = true;
        this.syncFrameTitle();
        this.syncFrameTheme();
        if (this.state === 'minimized') {
          pauseMediaInDocument(this.frame?.contentDocument);
          this.frame?.contentWindow?.postMessage({ marginModal: 'pause' }, 'https://www.bilibili.com');
        }
      });
      this.frame = iframe;
      this.frameWrap.prepend(iframe);
    }

    if (this.frame.src !== src) {
      this.frameHref = src;
      this.frame.src = src;
    } else if (this.loadingEl) {
      this.loadingEl.hidden = true;
    }

    this.loadTimer = window.setTimeout(() => {
      if (this.loadingEl) this.loadingEl.hidden = true;
    }, 8000);
  }

  private syncFrameTitle(): void {
    try {
      const doc = this.frame?.contentDocument;
      const t = doc?.querySelector('h1.video-title, .video-title')?.textContent?.trim();
      if (t && this.titleEl && this.miniTitleEl) {
        this.titleEl.textContent = t;
        this.miniTitleEl.textContent = t;
      }
    } catch { /* ignore */ }
  }

  private syncFrameTheme(): void {
    try {
      const doc = this.frame?.contentDocument;
      if (!doc || !this.appEl || doc.location.href === 'about:blank') return;
      const theme = this.appEl.dataset.theme;
      if (theme === 'dark' || theme === 'light') {
        doc.documentElement.dataset.marginTheme = theme;
      }
    } catch { /* ignore */ }
  }
  private enterOpenState(): void {
    if (!this.layer || !this.panel) return;
    const prev = this.state;
    this.state = 'open';
    this.layer.hidden = false;
    this.layer.inert = false;
    this.layer.dataset.state = 'open';
    this.panel.setAttribute('aria-modal', 'true');
    if (this.miniBar) this.miniBar.hidden = true;
    if (this.minBtn) this.minBtn.hidden = false;
    if (this.restoreBtn) this.restoreBtn.hidden = true;

    this.releaseFocus?.();
    this.releaseFocus = containModalFocus(this.layer, this.panel, () => this.close());
    if (prev !== 'open') this.onOpenChange?.(true);
  }

  minimize(): void {
    if (this.state !== 'open' || !this.layer || !this.panel) return;
    this.state = 'minimized';
    pauseMediaInDocument(this.frame?.contentDocument);
    this.frame?.contentWindow?.postMessage({ marginModal: 'pause' }, 'https://www.bilibili.com');
    this.releaseFocus?.();
    this.releaseFocus = null;
    this.layer.dataset.state = 'minimized';
    this.layer.inert = false;
    this.panel.setAttribute('aria-modal', 'false');
    if (this.miniBar) this.miniBar.hidden = false;
    if (this.minBtn) this.minBtn.hidden = true;
    if (this.restoreBtn) this.restoreBtn.hidden = false;
    this.onOpenChange?.(false);
  }

  restore(): void {
    if (this.state !== 'minimized' || !this.layer || !this.panel) return;
    this.enterOpenState();
    resumeMediaInDocument(this.frame?.contentDocument);
    this.frame?.contentWindow?.postMessage({ marginModal: 'resume' }, 'https://www.bilibili.com');
  }

  maximize(): void {
    const bvid = this.current?.bvid;
    if (!bvid) return;
    let url = this.frameHref ? cleanWatchTabUrl(this.frameHref, bvid) : `https://www.bilibili.com/video/${bvid}`;
    try {
      const href = this.frame?.contentWindow?.location?.href;
      if (href) url = cleanWatchTabUrl(href, bvid);
    } catch { /* cross-origin fallback */ }
    this.close();
    window.open(url, '_blank', 'noopener');
  }

  close(): void {
    if (this.state === 'closed' || !this.layer) return;
    this.state = 'closed';
    clearTimeout(this.loadTimer);
    pauseMediaInDocument(this.frame?.contentDocument);
    this.frame?.contentWindow?.postMessage({ marginModal: 'pause' }, 'https://www.bilibili.com');
    this.releaseFocus?.();
    this.releaseFocus = null;
    this.layer.dataset.state = 'closed';
    this.layer.inert = true;
    this.layer.hidden = true;
    if (this.miniBar) this.miniBar.hidden = true;
    if (this.frame) {
      try {
        const doc = this.frame.contentDocument;
        if (doc) {
          for (const m of doc.querySelectorAll<HTMLMediaElement>('video, audio, bwp-video')) {
            m.pause();
            m.removeAttribute('src');
            m.load();
          }
        }
      } catch { /* cross-origin iframe cleanup handled via postMessage & src='about:blank' */ }
      this.frame.src = 'about:blank';
      this.frame.remove();
      this.frame = null;
    }
    this.frameHref = '';
    this.current = null;
    this.onOpenChange?.(false);
  }
  isOpen(): boolean { return this.state === 'open'; }
  isMinimized(): boolean { return this.state === 'minimized'; }

  dispose(): void {
    this.close();
    if (this.messageHandler) {
      removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    this.themeObserver?.disconnect();
    this.themeObserver = null;
    for (const d of this.disposeGlass) d();
    this.disposeGlass = [];
    this.layer?.remove();
    this.layer = null;
    this.hostRoot = null;
    this.appEl = null;
  }
}

const instances = new WeakMap<ShadowRoot, VideoModalManager>();
let activeModal: VideoModalManager | null = null;

export function mountVideoModal(root: ShadowRoot, appEl: HTMLElement, onOpenChange?: (open: boolean) => void): VideoModalApi {
  let mgr = instances.get(root);
  if (!mgr) {
    mgr = new VideoModalManager();
    instances.set(root, mgr);
  }
  const layer = mgr.mount(root, appEl, onOpenChange);
  if (layer.parentElement !== appEl) appEl.append(layer);
  activeModal = mgr;
  return {
    open: (t) => mgr!.open(t),
    close: () => mgr!.close(),
    minimize: () => mgr!.minimize(),
    maximize: () => mgr!.maximize(),
    restore: () => mgr!.restore(),
    isOpen: () => mgr!.isOpen(),
    isMinimized: () => mgr!.isMinimized(),
    el: layer,
  };
}

export function openVideoModal(target: VideoModalTarget | Video, sourceNode?: Node | null): boolean {
  const root = sourceNode?.getRootNode();
  const mgr = (root instanceof ShadowRoot ? instances.get(root) : null) ?? activeModal;
  if (!mgr) return false;
  mgr.open(target);
  return true;
}

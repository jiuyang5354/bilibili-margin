import type { Settings } from '../../shared/settings';
import { saveSettings } from '../../shared/settings';
import { h, ICONS } from './dom';
import { toast } from './controls';
import { addWatchLater } from '../api/search';
import { createFavorites } from './favorites';
import { createHeader, type Header } from './header';
import { attachPreview } from './preview';
import { createSettingsPanel, type SettingsPanel } from './settings-panel';
import type { Sheet } from './sheet';
import { attachGlass, filtersIn } from './liquid-glass';
import { createFloatingMenu } from './floating-menu';
import { createCommandPalette } from './command-palette';
import { createContextMenu } from './context-menu';
import { bindCardMenu } from './card-menu';
import css from '../styles.css?inline';
import pageCss from '../watch.css?inline';

/**
 * 播放页：不替换 B 站原生播放器、弹幕、评论，只做两件事——
 * 1) 换上和首页一致的顶栏（Shadow DOM）；
 * 2) 用全局样式重写 B 站的主题变量和版式（变量能穿透评论区的 Shadow DOM）。
 */
export class WatchSkin {
  readonly host: HTMLElement;
  private app: HTMLElement;
  private head: Header;
  private panel: SettingsPanel;
  private fav: Sheet;
  private media = matchMedia('(prefers-color-scheme: dark)');
  private fadeTimer = 0;

  constructor(private settings: Settings) {
    const de = document.documentElement;
    de.classList.add('margin-watch');
    de.append(h('style', { id: 'margin-watch-css' }, pageCss));

    this.host = h('div', { id: 'margin-watch-top' });
    const root = this.host.attachShadow({ mode: 'open' });
    root.append(h('style', {}, css));

    this.panel = createSettingsPanel(() => this.settings, () => null);
    this.fav = createFavorites((g) => attachPreview(g, () => this.settings.hoverPreview));
    const open = (u: string) => window.open(u, '_blank', 'noopener');
    const clickSel = (sel: string) => (document.querySelector(sel) as HTMLElement | null)?.click();
    const palette = createCommandPalette([
      { id: 'w-top', title: '回到顶部', cat: '操作', icon: ICONS.top, run: () => scrollTo({ top: 0, behavior: 'smooth' }) },
      { id: 'w-comments', title: '看评论', cat: '跳转', icon: ICONS.message, keys: ['评论'], run: () => document.querySelector('#commentapp, bili-comments, .comment-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
      { id: 'w-web', title: '网页全屏', cat: '操作', icon: ICONS.image, keys: ['全屏'], run: () => clickSel('.bpx-player-ctrl-web') },
      { id: 'w-wide', title: '宽屏模式', cat: '操作', icon: ICONS.image, keys: ['宽屏'], run: () => clickSel('.bpx-player-ctrl-wide') },
      { id: 'w-later', title: '把这个视频加入稍后再看', cat: '操作', icon: ICONS.later, keys: ['稍后'], run: async () => { const bv = location.pathname.match(/BV\w+/)?.[0]; if (!bv) return; const r = await addWatchLater(bv); toast(this.app, r.msg); } },
      { id: 'w-copy', title: '复制视频链接', cat: '操作', icon: ICONS.link, keys: ['分享'], run: () => navigator.clipboard.writeText(location.href.split('?')[0]).then(() => toast(this.app, '链接已复制')) },
      { id: 'fav', title: '打开收藏夹', cat: '操作', icon: ICONS.fav, keys: ['收藏'], run: () => this.fav.open() },
      { id: 'theme', title: '切换亮色 / 暗色', cat: '操作', icon: ICONS.moon, keys: ['主题', '夜间'], run: () => this.toggleTheme() },
      { id: 'settings', title: '打开设置', cat: '操作', icon: ICONS.gear, run: () => this.panel.sheet.open() },
      { id: 'home', title: '回首页', cat: '跳转', icon: ICONS.logo, run: () => { location.href = 'https://www.bilibili.com/'; } },
      { id: 'later', title: '稍后再看列表', cat: '跳转', icon: ICONS.later, run: () => open('https://www.bilibili.com/watchlater/#/list') },
      { id: 'history', title: '观看历史', cat: '跳转', icon: ICONS.history, run: () => open('https://www.bilibili.com/history') },
      { id: 'off', title: '本次回到 B 站原版', cat: '操作', icon: ICONS.exit, keys: ['原版'], run: () => { sessionStorage.setItem('margin:off', '1'); location.reload(); } },
    ]);
    const cm = createContextMenu();
    this.head = createHeader({
      onTheme: () => this.toggleTheme(),
      onSearch: (q) => palette.open(q),
      tabs: [
        { title: '动态', icon: ICONS.moments, href: 'https://t.bilibili.com/' },
        { title: '消息', icon: ICONS.message, href: 'https://message.bilibili.com/' },
        { title: '历史', icon: ICONS.history, href: 'https://www.bilibili.com/history' },
        'separator',
        { title: '收藏', icon: ICONS.fav, run: () => this.fav.open() },
        { title: '设置', icon: ICONS.gear, run: () => this.panel.sheet.open() },
        { title: '原版', icon: ICONS.exit, run: () => { sessionStorage.setItem('margin:off', '1'); location.reload(); } },
      ],
    });
    const click = (sel: string) => (document.querySelector(sel) as HTMLElement | null)?.click();
    const quick = createFloatingMenu([
      { label: '回到顶部', run: () => scrollTo({ top: 0, behavior: 'smooth' }) },
      { label: '看评论', run: () => document.querySelector('#commentapp, bili-comments, .comment-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
      { label: '网页全屏', run: () => click('.bpx-player-ctrl-web') },
      { label: '宽屏模式', run: () => click('.bpx-player-ctrl-wide') },
      { label: '收藏夹', run: () => this.fav.open() },
    ]);
    this.app = h('div', { class: 'app wt', 'data-bg': 'off' }, this.head.el, quick.el, this.panel.sheet.el, this.fav.el, palette.el, cm.el);
    root.append(this.app);
    const lg = filtersIn(root);
    this.head.glass.forEach((g) => attachGlass(g, lg));
    attachGlass(this.head.thumb, lg, { blur: 2, strength: 0.4 });
    const favGrid = this.fav.el.querySelector('.fav-grid') as HTMLElement | null;
    if (favGrid) bindCardMenu(favGrid, cm, () => this.app);
    de.append(this.host);

    this.applyTheme(false);
    this.media.addEventListener('change', () => this.applyTheme(false));
    this.watchScreen();
  }

  update(s: Settings): void {
    const prev = this.settings;
    this.settings = s;
    if (prev.theme !== s.theme) this.applyTheme(false);
    this.panel.sync(s);
  }

  private resolved(): 'light' | 'dark' {
    const t = this.settings.theme;
    return t === 'auto' ? (this.media.matches ? 'dark' : 'light') : t;
  }

  private applyTheme(animate: boolean): void {
    const t = this.resolved();
    document.documentElement.dataset.marginTheme = t;
    this.app.dataset.theme = t;
    this.head.sunMoon.set(t, animate);
  }

  private async toggleTheme(): Promise<void> {
    const next = this.resolved() === 'dark' ? 'light' : 'dark';
    const de = document.documentElement;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const ms = this.head.sunMoon.duration;
      de.style.setProperty('--m-fade', `${ms}ms`);
      de.classList.add('margin-fading');
      this.app.classList.add('theme-fading');
      this.app.style.setProperty('--fade', `${ms}ms`);
      clearTimeout(this.fadeTimer);
      this.fadeTimer = window.setTimeout(() => { de.classList.remove('margin-fading'); this.app.classList.remove('theme-fading'); }, ms + 100);
    }
    this.settings = await saveSettings({ theme: next });
    this.applyTheme(true);
  }

  /** 网页全屏 / 全屏时收起顶栏，不挡播放器 */
  private watchScreen(): void {
    const sync = () => {
      const p = document.querySelector('.bpx-player-container');
      const screen = p?.getAttribute('data-screen') ?? 'normal';
      const hide = screen === 'web' || screen === 'full' || !!document.fullscreenElement;
      this.host.toggleAttribute('hidden', hide);
      document.documentElement.classList.toggle('margin-webscreen', hide);
    };
    new MutationObserver(sync).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['data-screen'] });
    document.addEventListener('fullscreenchange', sync);
    sync();
  }
}

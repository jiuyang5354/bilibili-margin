import type { Settings } from '../../shared/settings';
import { saveSettings } from '../../shared/settings';
import { h, ICONS } from './dom';
import { createFavorites } from './favorites';
import { createHeader, type Header } from './header';
import { attachPreview } from './preview';
import { createSettingsPanel, type SettingsPanel } from './settings-panel';
import type { Sheet } from './sheet';
import { attachGlass, filtersIn } from './liquid-glass';
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
    this.head = createHeader({
      onTheme: () => this.toggleTheme(),
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
    this.app = h('div', { class: 'app wt', 'data-bg': 'off' }, this.head.el, this.panel.sheet.el, this.fav.el);
    root.append(this.app);
    const lg = filtersIn(root);
    this.head.glass.forEach((g) => attachGlass(g, lg));
    attachGlass(this.head.thumb, lg, { blur: 2, strength: 0.4 });
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

import { nav } from '../api/http';
import { popular, recommended, type Video } from '../api/feed';
import type { Settings } from '../../shared/settings';
import { saveSettings } from '../../shared/settings';
import { BackgroundLayer } from '../bg/background';
import { compileFilter, type Predicate } from '../filter';
import { videoCard, skeleton } from './card';
import { toast } from './controls';
import { h, icon, ICONS } from './dom';
import { createFavorites } from './favorites';
import { attachPreview } from './preview';
import { createSettingsPanel, type SettingsPanel } from './settings-panel';
import type { Sheet } from './sheet';
import css from '../styles.css?inline';

type Tab = 'rcmd' | 'popular';

export class MarginApp {
  readonly host: HTMLElement;
  private root: ShadowRoot;
  private app!: HTMLElement;
  private grid!: HTMLElement;
  private status!: HTMLElement;
  private sentinel!: HTMLElement;
  private themeBtn!: HTMLButtonElement;
  private bg = new BackgroundLayer();
  private panel!: SettingsPanel;
  private fav!: Sheet;
  private tab: Tab = 'rcmd';
  private round = 1;
  private page = 1;
  private loading = false;
  private done = false;
  private items: Video[] = [];
  private seen = new Set<string>();
  private keep: Predicate;
  private gen = 0;
  private media = matchMedia('(prefers-color-scheme: dark)');

  constructor(private settings: Settings) {
    this.keep = compileFilter(settings.filters);
    this.host = h('div', { id: 'margin-root' });
    this.root = this.host.attachShadow({ mode: 'open' });
    this.root.append(h('style', {}, css));
    this.render();
    this.applyTheme();
    this.media.addEventListener('change', () => this.applyTheme());
  }

  update(s: Settings): void {
    const prev = this.settings;
    this.settings = s;
    if (JSON.stringify(prev.filters) !== JSON.stringify(s.filters)) {
      this.keep = compileFilter(s.filters);
      this.repaint();
    }
    if (prev.theme !== s.theme || JSON.stringify(prev.bg) !== JSON.stringify(s.bg)) this.applyTheme();
    this.panel.sync(s);
  }

  private resolvedTheme(): 'light' | 'dark' {
    const t = this.settings.theme;
    return t === 'auto' ? (this.media.matches ? 'dark' : 'light') : t;
  }

  private applyTheme(): void {
    const t = this.resolvedTheme();
    this.app.dataset.theme = t;
    this.app.dataset.bg = this.settings.bg.mode;
    this.themeBtn.replaceChildren(icon(t === 'dark' ? ICONS.sun : ICONS.moon));
    this.themeBtn.title = t === 'dark' ? '切换到亮色' : '切换到暗色';
    this.bg.apply(this.settings.bg, t).then(() => this.panel?.sync(this.settings));
  }

  private render(): void {
    const link = (href: string, label: string, ic: string) =>
      h('a', { class: 'act opt', href, target: '_blank', rel: 'noopener', title: label }, icon(ic), h('span', {}, label));
    const btn = (label: string, ic: string, run: () => void) =>
      h('button', { class: 'act', type: 'button', title: label, onclick: run }, icon(ic), h('span', {}, label));

    this.themeBtn = h('button', { class: 'act icon-only', type: 'button', onclick: () => this.toggleTheme() });
    const user = h('a', { class: 'user', href: 'https://passport.bilibili.com/login', target: '_blank', rel: 'noopener' }, '登录');
    nav().then((n) => {
      if (!n?.isLogin) return;
      user.href = `https://space.bilibili.com/${n.mid}`;
      user.title = n.uname ?? '';
      user.replaceChildren(h('img', { src: `${(n.face ?? '').replace(/^http:/, 'https:')}@80w_80h_1c.webp`, alt: n.uname ?? '', referrerpolicy: 'no-referrer' }));
      user.classList.add('in');
    }).catch(() => {});

    const input = h('input', { type: 'search', placeholder: '搜索视频、UP 主', autocomplete: 'off', 'aria-label': '搜索' });
    const search = h('form', {
      class: 'search', role: 'search',
      onsubmit: (e: Event) => {
        e.preventDefault();
        const q = input.value.trim();
        if (q) window.open(`https://search.bilibili.com/all?keyword=${encodeURIComponent(q)}`, '_blank', 'noopener');
      },
    }, icon(ICONS.search), input, h('kbd', {}, '/'));

    this.panel = createSettingsPanel(() => this.settings, () => this.bg.shader);
    this.fav = createFavorites((g) => attachPreview(g, () => this.settings.hoverPreview));

    const header = h('header', { class: 'top' },
      h('a', { class: 'brand', href: '/', title: '映间 MARGIN' }, h('span', { class: 'mark' }, icon(ICONS.logo)), h('b', {}, '映间'), h('small', {}, 'MARGIN')),
      search,
      h('nav', { class: 'acts' },
        link('https://t.bilibili.com/', '动态', ICONS.moments),
        link('https://message.bilibili.com/', '消息', ICONS.message),
        btn('收藏', ICONS.fav, () => this.fav.open()),
        link('https://www.bilibili.com/history', '历史', ICONS.history),
        btn('设置', ICONS.gear, () => this.panel.sheet.open()),
        this.themeBtn,
        user,
      ),
    );

    const tabs = h('div', { class: 'tabs', role: 'tablist' });
    const mkTab = (id: Tab, label: string) => {
      const b = h('button', { class: 'tab', role: 'tab', type: 'button', 'aria-selected': String(id === this.tab), onclick: () => this.switchTab(id, tabs) }, label);
      b.dataset.tab = id;
      return b;
    };
    tabs.append(mkTab('rcmd', '推荐'), mkTab('popular', '热门'));
    const refresh = h('button', { class: 'ghost', type: 'button', title: '换一批', onclick: () => this.reload() }, icon(ICONS.refresh), h('span', {}, '换一批'));

    this.grid = h('section', { class: 'grid', 'aria-live': 'polite' });
    this.status = h('div', { class: 'status' });
    this.sentinel = h('div', { class: 'sentinel' });
    attachPreview(this.grid, () => this.settings.hoverPreview);

    const exit = h('button', {
      class: 'ghost small', type: 'button', onclick: () => { sessionStorage.setItem('margin:off', '1'); location.reload(); },
    }, icon(ICONS.exit), h('span', {}, '本次回到 B 站原版首页'));

    this.app = h('div', { class: 'app' },
      this.bg.el,
      header,
      h('main', { class: 'main' },
        h('div', { class: 'bar' }, h('div', { class: 'eyebrow' }, h('span', {}, todayLabel()), h('span', {}, 'BILIBILI · 首页')), h('div', { class: 'bar-row' }, tabs, refresh)),
        this.grid, this.status, this.sentinel,
        h('footer', { class: 'foot' }, exit, h('span', {}, '映间 MARGIN · 非 B 站官方')),
      ),
      this.panel.sheet.el,
      this.fav.el,
    );
    this.root.append(this.app);

    new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) this.load(); }, { root: this.app, rootMargin: '900px 0px' }).observe(this.sentinel);

    addEventListener('keydown', (e) => {
      if (e.key === '/' && !e.composedPath().some((n) => n instanceof HTMLInputElement)) { e.preventDefault(); input.focus(); }
    });

    this.load();
  }

  private async toggleTheme(): Promise<void> {
    const next = this.resolvedTheme() === 'dark' ? 'light' : 'dark';
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    this.settings = await saveSettings({ theme: next });
    if (doc.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) doc.startViewTransition(() => this.applyTheme());
    else this.applyTheme();
  }

  private switchTab(id: Tab, tabs: HTMLElement): void {
    if (id === this.tab) return;
    this.tab = id;
    tabs.querySelectorAll<HTMLElement>('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === id)));
    this.reload();
  }

  private reload(): void {
    this.gen++;
    this.grid.replaceChildren();
    this.items = [];
    this.seen.clear();
    this.done = false;
    this.loading = false;
    this.page = 1;
    this.round++;
    this.app.scrollTo({ top: 0 });
    this.load();
  }

  /** 过滤条件变化后，用已加载的数据重画网格 */
  private repaint(): void {
    const shown = this.items.filter(this.keep);
    this.grid.replaceChildren(...shown.map((v, i) => videoCard(v, i, { onBlock: (x) => this.blockUp(x) })));
    this.grid.querySelectorAll('.card').forEach((c) => c.classList.add('still'));
    this.fillIfShort();
  }

  private async blockUp(v: Video): Promise<void> {
    const before = this.settings.filters.ups;
    if (before.includes(v.author) || before.includes(String(v.mid))) return;
    await saveSettings({ filters: { ...this.settings.filters, ups: [...before, v.author] } });
    toast(this.app, `已屏蔽「${v.author}」`, { label: '撤销', run: () => saveSettings({ filters: { ...this.settings.filters, ups: this.settings.filters.ups.filter((u) => u !== v.author) } }) });
  }

  private fillIfShort(): void {
    const r = this.sentinel.getBoundingClientRect();
    if (!this.done && !this.loading && r.top < innerHeight + 900) this.load();
  }

  private async load(attempt = 0): Promise<void> {
    if (this.loading || this.done) return;
    this.loading = true;
    const gen = this.gen;
    const sk = skeleton(this.grid.children.length ? 4 : 12);
    const skNodes = [...sk.childNodes];
    this.grid.append(sk);
    this.status.replaceChildren();
    let added = 0;
    try {
      let list: Video[];
      if (this.tab === 'rcmd') {
        const batches = await Promise.all([recommended(this.round), recommended(this.round + 1)]);
        this.round += 2;
        list = batches.flat();
      } else {
        const r = await popular(this.page++);
        list = r.list;
        this.done = r.done;
      }
      if (gen !== this.gen) return;
      skNodes.forEach((n) => (n as Element).remove());
      const start = this.grid.children.length;
      for (const v of list) {
        if (this.seen.has(v.bvid)) continue;
        this.seen.add(v.bvid);
        this.items.push(v);
        if (!this.keep(v)) continue;
        this.grid.append(videoCard(v, start + added++, { onBlock: (x) => this.blockUp(x) }));
      }
      if (this.done) this.status.replaceChildren(h('span', {}, '没有更多了'));
    } catch (err) {
      if (gen !== this.gen) return;
      skNodes.forEach((n) => (n as Element).remove());
      this.status.replaceChildren(h('span', {}, `加载失败：${(err as Error).message}`), h('button', { class: 'ghost small', type: 'button', onclick: () => this.load() }, '重试'));
      return;
    } finally {
      if (gen === this.gen) this.loading = false;
    }
    // 被过滤掉太多时自动补一批
    if (gen === this.gen && added < 6 && attempt < 4) this.load(attempt + 1);
    else requestAnimationFrame(() => this.fillIfShort());
  }
}

function todayLabel(): string {
  const d = new Date();
  const w = '日一二三四五六'[d.getDay()];
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 · 周${w}`;
}

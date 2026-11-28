import { attachPreview } from './preview';
import { saveSettings, type Settings } from '../../shared/settings';
import { nav } from '../api/http';
import { account, accountStat } from '../api/account';
import { followFeed, followFeedUpdates, followings, followingLive, portal, searchFollowing, type Dyn, type FeedType, type LiveUp, type Up } from '../api/dyn';
import { hotSearch } from '../api/search';
import { dynCard } from './dyn';
import { compileDynFilter } from '../filter';
import { cachedTags } from '../tags';
import { fmtCount, h, icon, ICONS } from './dom';
import { HEADER_ICONS } from './header-icons';
import { PageShell } from './shell';
import { targetOfDyn } from '../filter-targets';
import { uiReducedMotion as reducedMotion } from '../motion';
import { createDynamicComposer } from './dynamic-composer';
import { toast } from './controls';
import { every } from '../sched';

type FeedTab = FeedType | 'posts';
const TYPES: [FeedTab, string][] = [['all', '全部'], ['posts', '图文'], ['video', '视频投稿'], ['pgc', '追番追剧'], ['article', '专栏']];
const TAB_LABEL = Object.fromEntries(TYPES) as Record<FeedTab, string>;
function matchesTab(d: Dyn, tab: FeedTab): boolean {
  if (tab === 'all') return true;
  if (tab === 'posts') return ['DYNAMIC_TYPE_WORD', 'DYNAMIC_TYPE_DRAW', 'DYNAMIC_TYPE_ARTICLE'].includes(d.type);
  if (tab === 'video') return d.type === 'DYNAMIC_TYPE_AV';
  if (tab === 'pgc') return d.type.startsWith('DYNAMIC_TYPE_PGC') || d.type === 'DYNAMIC_TYPE_BANGUMI';
  return d.type === 'DYNAMIC_TYPE_ARTICLE';
}
const ext = { target: '_blank', rel: 'noopener' };
const face = (src: string, cls: string, w = 96) => h('img', { class: cls, src: src ? `${src}@${w}w_${w}h_1c.webp` : '', alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });

/**
 * 动态首页（t.bilibili.com）：和个人空间的动态 tab 用同一张杂志单栏卡（ui/dyn.ts），
 * 两侧是映间的侧栏——左：我的名片 + 正在直播；右：热搜。
 * 结构参考 21st「SocialPostCard」(ruixen.ui, 2652) 的作者行 / 正文 / 媒体 / 操作分层，以及「Activity Timeline」(28340) 的头像条。
 */
export class FeedApp {
  readonly shell: PageShell;
  private type: FeedTab;
  private host = 0;
  private offset = '';
  private done = false;
  private loading = false;
  private gen = 0;
  private baseline = '';
  private updateRequest: AbortController | null = null;
  private newPill!: HTMLButtonElement;
  private newLabel!: HTMLElement;
  private autoButton!: HTMLButtonElement;
  private rightAside!: HTMLElement;
  private hotBox: HTMLElement | null = null;
  private list!: HTMLElement;
  private status!: HTMLElement;
  private sentinel!: HTMLElement;
  private strip!: HTMLElement;
  private tabs!: HTMLElement;
  private followParent?: HTMLElement;
  private followingStarted = false;

  constructor(settings: Settings) {
    this.shell = new PageShell(settings, 'feed');
    this.shell.app.style.setProperty('--margin-dfs', `${settings.dynamicSize}px`);
    document.title = '动态 · 映间';
    const t = new URLSearchParams(location.search).get('tab');
    this.type = t === 'posts' || t === 'video' || t === 'pgc' || t === 'article' ? t : 'all';
    this.render();
  }

  update(s: Settings): void {
    this.shell.update(s);
    this.shell.app.style.setProperty('--margin-dfs', `${s.dynamicSize}px`);
    this.autoButton.setAttribute('aria-checked', String(s.feedAutoRefresh));
    this.syncHot();
    this.applyLayout();
    const box = this.shell.app.querySelector<HTMLElement>('.fd-follows');
    if (box) box.hidden = !s.feedFollowList || s.feedLayout === 'sidebar';
    else if (s.feedFollowList && this.followParent) void this.renderFollowList(this.followParent);
  }

  private applyLayout(): void {
    const app = this.shell.app;
    const sidebar = this.shell.settings.feedLayout === 'sidebar';
    app.classList.toggle('fd-sidebar', sidebar);
    const left = app.querySelector('.fd-left');
    const bar = app.querySelector('.fd-bar');
    if (sidebar) { if (this.strip.parentElement !== left) left?.append(this.strip); }
    else if (this.strip.nextElementSibling !== bar) bar?.before(this.strip);
    const live = app.querySelector('.fd-live');
    const follows = app.querySelector<HTMLElement>('.fd-follows');
    const firstFollow = sidebar ? this.strip : follows;
    if (live && left && (live.parentElement !== left || (firstFollow && live.nextElementSibling !== firstFollow))) left.insertBefore(live, firstFollow);
    if (follows) follows.hidden = sidebar || !this.shell.settings.feedFollowList;
  }

  private render(): void {
    const s = this.shell;
    const left = h('aside', { class: 'fd-side fd-left' });
    this.rightAside = h('aside', { class: 'fd-side fd-right' });
    this.strip = h('div', { class: 'fd-ups' });
    this.tabs = h('div', { class: 'tabs fd-tabs', role: 'tablist' }, ...TYPES.map(([id, label]) => {
      const b = h('button', { class: 'tab', role: 'tab', type: 'button', 'aria-selected': String(id === this.type), onclick: () => this.setType(id) }, label);
      b.dataset.tab = id;
      return b;
    }));
    const refresh = h('button', { class: 'fd-refresh-btn', type: 'button', title: '刷新动态', disabled: true, onclick: () => this.reload() }, icon(ICONS.refresh), '刷新');
    this.autoButton = h('button', { class: 'fd-auto-btn', type: 'button', role: 'switch', 'aria-checked': String(s.settings.feedAutoRefresh) }, '自动刷新');
    this.autoButton.addEventListener('click', async () => {
      this.autoButton.disabled = true;
      try { await saveSettings({ feedAutoRefresh: !s.settings.feedAutoRefresh }); }
      catch { toast(s.app, '自动刷新设置保存失败，请重试'); }
      finally { this.autoButton.disabled = false; }
    });
    this.newLabel = h('span');
    this.newPill = h('button', { class: 'fd-new-pill', type: 'button', hidden: true, onclick: () => {
      s.app.scrollTo({ top: 0, behavior: reducedMotion() ? 'instant' : 'smooth' });
      this.reload();
    } }, icon(ICONS.arrowUp), h('i', { 'aria-hidden': 'true' }), this.newLabel);
    let composer: ReturnType<typeof createDynamicComposer> | null = null;
    const post = h('button', { type: 'button', class: 'fd-post', onclick: () => {
      composer ??= createDynamicComposer(s.app, () => this.reload()); composer.open();
    } }, icon(ICONS.plus), h('span', {}, '发动态'));
    this.list = h('div', { class: 'dy-list fd-list' });
    attachPreview(this.list, () => this.shell.settings.hoverPreview);
    this.status = h('div', { class: 'status' });
    this.sentinel = h('div', { class: 'sentinel' });
    const center = h('section', { class: 'fd-main' },
      h('header', { class: 'fd-head' },
        h('div', {}, h('div', { class: 'eyebrow' }, h('span', { class: 'en' }, 'Following'), h('span', {}, '关注的人')), h('h1', { class: 'fd-h1' }, '动态')),
        post),
      this.strip,
      h('div', { class: 'bar-row fd-bar' }, this.tabs, h('div', { class: 'fd-bar-acts' }, refresh, this.autoButton)),
      this.newPill, this.list, this.status, this.sentinel);
    s.main.append(h('div', { class: 'fd' }, left, center, this.rightAside));
    this.applyLayout();
    new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) this.load(); }, { root: s.app, rootMargin: '1200px 0px' }).observe(this.sentinel);
    // 动态流同时用 compileDynFilter（含转发内容）和 FilterRuntime，条件变化后重新拉取一次
    this.shell.filter.onChange(() => this.reload());
    let st = 0;
    s.app.addEventListener('scroll', () => { clearTimeout(st); st = window.setTimeout(() => this.fill(), 160); }, { passive: true });

    this.syncHot();
    nav().then((n) => {
      if (!n?.isLogin) {
        this.done = true;
        left.remove();
        this.list.replaceChildren(h('div', { class: 'ms-empty' }, h('p', {}, '登录后查看关注的人的动态'), h('a', { class: 'sp-follow', href: 'https://passport.bilibili.com/login', ...ext }, '去登录')));
        return;
      }
      refresh.disabled = false;
      this.startPolling();
      this.renderMe(left);
      this.followParent = left;
      portal().then((p) => { this.renderUps(p.ups); this.renderLive(left, p.live, p.liveCount); this.applyLayout(); }).catch(() => { /* 头像条可缺省 */ });
      void this.renderFollowList(left);
      this.load();
    }).catch(() => { refresh.disabled = false; this.load(); });
  }

  private startPolling(): void {
    const poll = () => { void this.pollUpdates(); };
    let stop = every(60_000, poll);
    let hiddenAt = document.hidden ? Date.now() : 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt > 15_000) {
        stop();
        poll();
        stop = every(60_000, poll);
      }
      hiddenAt = 0;
    });
  }

  private async pollUpdates(): Promise<void> {
    if (document.hidden || this.host || !this.baseline || this.loading || this.updateRequest) return;
    const request = new AbortController();
    this.updateRequest = request;
    let count: number;
    try { count = await followFeedUpdates(this.type === 'posts' ? 'all' : this.type, this.baseline, request.signal); }
    catch { return; }
    finally { if (this.updateRequest === request) this.updateRequest = null; }
    if (request.signal.aborted || document.hidden) return;
    const { app, settings } = this.shell;
    if (count > 0 && settings.feedAutoRefresh && app.scrollTop <= 40 && !app.querySelector('.sheet-layer[data-open="true"]')) {
      this.reload();
      toast(app, `已自动更新 ${count} 条新动态`);
    } else this.setPending(count);
  }

  private setPending(n: number): void {
    this.newPill.hidden = n <= 0;
    this.newLabel.textContent = n > 0 ? `有 ${n > 99 ? '99+' : n} 条新动态 · 点击刷新` : '';
  }

  /** #16：左侧「关注」列表——比头像条能装更多人，点一行就把动态流切成该 UP */
  private async renderFollowList(left: HTMLElement): Promise<void> {
    if (this.followingStarted || !this.shell.settings.feedFollowList || this.shell.settings.feedLayout === 'sidebar') return;
    this.followingStarted = true;
    const a = await account().catch(() => null);
    if (!a || !this.shell.settings.feedFollowList) { this.followingStarted = false; return; }
    const list = h('div', { style: 'display:flex;flex-direction:column;gap:2px;max-height:46vh;overflow:auto' });
    const more = h('button', {
      type: 'button', class: 'ghost',
      style: 'margin-top:6px;width:100%;background:none;border:0;color:inherit;opacity:.65;cursor:pointer;font:inherit;font-size:12px;padding:6px',
    }, '加载更多');
    const head = h('div', { style: 'display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px' },
      h('h3', { style: 'margin:0;font-size:13px;font-weight:600' }, '关注'),
      h('a', { class: 'ghost', href: `https://space.bilibili.com/${a.mid}/fans/follow`, target: '_blank', rel: 'noopener', style: 'font-size:11px;opacity:.6;text-decoration:none;color:inherit' }, '全部'));
    const box = h('section', { class: 'fd-card fd-follows', style: 'padding:12px' }, head, list, more);
    box.hidden = this.shell.app.classList.contains('fd-sidebar') || !this.shell.settings.feedFollowList;
    left.append(box);

    let pn = 0, done = false, loading = false;
    const row = (u: { mid: number; name: string; face: string }) => h('button', {
      type: 'button', class: 'fd-up',
      style: 'display:flex;align-items:center;gap:8px;background:none;border:0;color:inherit;cursor:pointer;padding:5px 6px;border-radius:8px;text-align:left;font:inherit;width:100%',
      title: u.name,
      onclick: () => this.selectUp(u.mid, true),
      onmouseenter: (e: Event) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.06)'; },
      onmouseleave: (e: Event) => { (e.currentTarget as HTMLElement).style.background = ''; },
    }, h('span', { style: 'width:26px;height:26px;border-radius:50%;overflow:hidden;flex:none;display:block' }, face(u.face, '', 64)),
       h('span', { style: 'font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, u.name));

    const load = async (): Promise<void> => {
      if (loading || done) return;
      loading = true; more.textContent = '加载中…';
      try {
        const r = await followings(a.mid, ++pn, 30);
        for (const u of r.list) list.append(row(u));
        done = !r.hasMore;
        more.style.display = done ? 'none' : 'block';
        more.textContent = '加载更多';
      } catch {
        more.style.display = 'none';
        if (!list.children.length) list.append(h('p', { style: 'opacity:.55;font-size:12px;margin:0' }, '没取到关注列表'));
      } finally { loading = false; }
    };
    more.onclick = () => void load();
    await load();
  }

  private async renderMe(left: HTMLElement): Promise<void> {
    const card = h('section', { class: 'fd-card fd-me' }, h('div', { class: 'line' }), h('div', { class: 'line short' }));
    left.prepend(card);
    const [a, st] = await Promise.all([account(), accountStat().catch(() => null)]);
    if (!a) { card.remove(); return; }
    const space = `https://space.bilibili.com/${a.mid}`;
    const stat = (n: number | undefined, label: string, href: string) => h('a', { class: 'fd-stat', href, ...ext }, h('b', {}, n == null ? '—' : fmtCount(n)), h('span', {}, label));
    card.replaceChildren(
      h('a', { class: 'fd-me-id', href: space, ...ext },
        face(a.face, 'fd-me-face', 112),
        h('span', { class: 'fd-me-name' }, h('b', { style: a.vipColor ? `color:${a.vipColor}` : '' }, a.name), h('span', {}, h('i', { class: 'fd-lv' }, `LV${a.level}`), a.vipLabel ? h('i', { class: 'fd-vip' }, a.vipLabel) : null))),
      h('div', { class: 'fd-stats' },
        stat(st?.following, '关注', `${space}/relation/follow`),
        stat(st?.follower, '粉丝', `${space}/relation/fans`),
        stat(st?.dynamic, '动态', `${space}/dynamic`)));
  }

  private renderLive(left: HTMLElement, live: LiveUp[], count: number): void {
    if (!live.length) return;
    const row = (u: LiveUp) => h('a', { class: 'fd-live-row', href: u.url, ...ext },
      h('span', { class: 'fd-live-face' }, face(u.face, '', 80)),
      h('span', { class: 'fd-live-b' }, h('b', {}, u.name), h('span', {}, u.title)));
    let entries = live, shown = Math.min(8, live.length), complete = count <= live.length, busy = false;
    const list = h('div', {}, ...entries.slice(0, shown).map(row));
    const more = h('button', { class: 'ghost small fd-live-more', type: 'button', hidden: shown >= entries.length && complete }, '加载更多') as HTMLButtonElement;
    more.addEventListener('click', async () => {
      if (busy) return;
      busy = true; more.disabled = true; more.textContent = '加载中…';
      try {
        if (!complete) { const extra = await followingLive(); const seen = new Set(entries.map(u => u.url)); entries = [...entries]; for (const u of extra) if (!seen.has(u.url)) { seen.add(u.url); entries.push(u); } complete = true; }
        const next = entries.slice(shown, shown + 8); shown += next.length; list.append(...next.map(row));
        more.hidden = shown >= entries.length; more.textContent = '加载更多';
      } catch { more.textContent = '加载失败，重试'; }
      finally { busy = false; more.disabled = false; }
    });
    left.append(h('section', { class: 'fd-card fd-live' },
      h('div', { class: 'fd-card-h' }, h('span', {}, '正在直播'), h('b', {}, String(count))),
      list, more));
  }

  /** 切换只看某个 UP（0 = 全部），同步头像条选中态。固定可见的入口（侧栏布局的头像条、左侧关注列表）点完回到顶部；
   *  经典布局的头像条跟着内容滚，能点到它说明已经在顶部，不用滚。 */
  private selectUp(mid: number, fromFixed: boolean): void {
    this.host = this.host === mid ? 0 : mid;
    if (fromFixed) this.shell.app.scrollTo({ top: 0, behavior: reducedMotion() ? 'instant' : 'smooth' });
    this.strip.querySelectorAll<HTMLElement>('.fd-up').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.mid) === this.host)));
    void this.reload();
  }

  private renderUps(ups: Up[]): void {
    if (!ups.length) return;
    const mk = (mid: number, name: string, img: Node, fresh = false) => {
      const b = h('button', { class: 'fd-up', type: 'button', title: fresh ? `${name} · 有新动态` : name, 'aria-pressed': String(mid === this.host) }, h('span', { class: 'fd-up-face' }, img), h('span', { class: 'fd-up-name' }, name));
      b.dataset.mid = String(mid);
      if (fresh) b.classList.add('fresh');
      b.addEventListener('click', () => {
        this.selectUp(mid, this.shell.settings.feedLayout === 'sidebar');
        b.classList.remove('fresh');
        if (b.parentElement === row) {
          const item = b.getBoundingClientRect(), bounds = row.getBoundingClientRect();
          row.scrollBy({ left: item.left - bounds.left - (bounds.width - item.width) / 2, behavior: reducedMotion() ? 'instant' : 'smooth' });
        }
      });
      return b;
    };
    // v0.49：不再只取前 30 个（关注多的人翻不到，B 站评论反馈）；可在自己的关注里搜昵称；滚轮横向翻
    const all = mk(0, '全部动态', h('span', { class: 'fd-up-all' }, icon(HEADER_ICONS['动态'].replaceAll('margin-header-moments-clip0', 'margin-feed-moments-clip0'))));
    const row = h('div', { class: 'fd-ups-row' });
    const move = (direction: number) => row.scrollBy({ left: direction * row.clientWidth * .8, behavior: reducedMotion() ? 'instant' : 'smooth' });
    const prev = h('button', { class: 'fd-ups-scroll', type: 'button', 'aria-label': '向左滚动关注列表', onclick: () => move(-1) }, icon(ICONS.back));
    const next = h('button', { class: 'fd-ups-scroll', type: 'button', 'aria-label': '向右滚动关注列表', onclick: () => move(1) }, icon(ICONS.chevronRight));
    const updateScroll = () => {
      prev.disabled = row.scrollLeft <= 1;
      next.disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 1;
    };
    row.addEventListener('scroll', updateScroll, { passive: true });
    new ResizeObserver(updateScroll).observe(row);
    const sorted = [...ups].sort((x, y) => Number(y.fresh) - Number(x.fresh));
    const paint = (list: Up[], empty = '') => {
      row.replaceChildren(...list.map((u) => mk(u.mid, u.name, face(u.face, '', 96), u.fresh)));
      if (!list.length && empty) row.append(h('span', { class: 'fd-ups-empty' }, empty));
      row.scrollLeft = 0;
      updateScroll();
    };
    const input = h('input', { class: 'fd-ups-q', type: 'search', placeholder: '搜索', 'aria-label': '在关注里搜 UP 主' }) as HTMLInputElement;
    let qt = 0, seq = 0, me = 0;
    input.addEventListener('input', () => {
      clearTimeout(qt);
      const q = input.value.trim();
      if (!q) { paint(sorted); return; }
      qt = window.setTimeout(async () => {
        const my = ++seq;
        try {
          if (!me) me = (await account())?.mid ?? 0;
          const r = me ? await searchFollowing(me, q) : [];
          if (my === seq) paint(r, '没找到');
        } catch { if (my === seq) paint([], '搜索失败'); }
      }, 300);
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape' && input.value) { e.stopPropagation(); input.value = ''; paint(sorted); } });
    const search = h('label', { class: 'fd-up fd-ups-search', title: '在关注里搜 UP 主' }, h('span', { class: 'fd-up-all' }, icon(ICONS.search)), input);
    row.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || row.scrollWidth <= row.clientWidth) return;
      const max = row.scrollWidth - row.clientWidth;
      if ((e.deltaY < 0 && row.scrollLeft <= 0) || (e.deltaY > 0 && row.scrollLeft >= max - 1)) return;
      e.preventDefault();
      row.scrollLeft += e.deltaY;
    }, { passive: false });
    paint(sorted);
    this.strip.replaceChildren(all, search, prev, row, next);
  }

  private syncHot(): void {
    if (this.shell.settings.hideHotSearch) {
      this.hotBox?.remove();
      this.hotBox = null;
    } else if (!this.hotBox) void this.renderHot();
  }

  private async renderHot(): Promise<void> {
    const box = h('section', { class: 'fd-card fd-hot' }, h('div', { class: 'fd-card-h' }, h('span', {}, '热搜'), h('b', {}, 'TRENDING')));
    this.hotBox = box;
    this.rightAside.append(box);
    const list = await hotSearch();
    if (this.hotBox !== box) return;
    if (!list.length) { box.remove(); this.hotBox = null; return; }
    box.append(h('ol', { class: 'fd-hot-list' }, ...list.slice(0, 10).map((x, i) =>
      h('li', {}, h('a', { href: `https://search.bilibili.com/all?keyword=${encodeURIComponent(x.keyword)}`, ...ext }, h('i', { class: i < 3 ? 'hot' : '' }, String(i + 1).padStart(2, '0')), h('span', {}, x.name))))));
  }

  private setType(t: FeedTab): void {
    if (t === this.type) return;
    this.type = t;
    this.tabs.querySelectorAll<HTMLElement>('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    const u = new URL(location.href);
    if (t === 'all') u.searchParams.delete('tab'); else u.searchParams.set('tab', t);
    history.replaceState(null, '', u);
    this.reload();
  }

  private reload(): void {
    this.gen++;
    this.updateRequest?.abort();
    this.updateRequest = null;
    this.baseline = '';
    this.setPending(0);
    this.offset = ''; this.done = false; this.loading = false;
    this.list.replaceChildren();
    this.status.textContent = '';
    this.load();
  }

  private async load(): Promise<void> {
    if (this.loading || this.done || this.status.firstElementChild) return;
    this.loading = true;
    const gen = this.gen;
    const sk = Array.from({ length: this.offset ? 1 : 3 }, () => h('article', { class: 'dy sk' }, h('div', { class: 'line short' }), h('div', { class: 'line' }), h('div', { class: 'line' })));
    this.list.append(...sk);
    try {
      const clientFilter = this.type === 'posts' || (!!this.host && this.type !== 'all');
      const requestType: FeedType = this.host || this.type === 'posts' ? 'all' : this.type;
      const r = await followFeed(requestType, this.offset, this.host);
      if (gen !== this.gen) return;
      if (!this.offset && !this.host && r.baseline) this.baseline = r.baseline;
      // 动态里转发的视频也按标签过滤：先预热标签，再编译保留条件
      const items = clientFilter ? r.list.filter(d => matchesTab(d, this.type)) : r.list;
      await this.shell.filter.prepare(items.map((d) => d.video?.bvid));
      if (gen !== this.gen) return;
      sk.forEach((n) => n.remove());
      const keep = compileDynFilter(this.shell.settings.filters, cachedTags);
      const shown = items.filter(keep);
      shown.forEach((d) => {
        const card = dynCard(d, false, true);
        card.toggleAttribute('data-margin-filtered', !this.shell.filter.allows(targetOfDyn(d)));
        this.list.append(card);
      });
      this.done = !r.more || !r.offset || r.offset === this.offset;
      this.offset = r.offset;
      if (clientFilter && !shown.length && !this.done) {
        this.status.replaceChildren(h('button', { type: 'button', class: 'ghost', onclick: () => { this.status.replaceChildren(); void this.load(); } }, `继续查找${TAB_LABEL[this.type]}`));
        return;
      }
      if (this.done && !this.list.children.length) this.list.append(h('div', { class: 'ms-empty' }, h('p', {}, '这里还空着')));
      else if (this.done) this.status.textContent = '— 到底了 —';
    } catch (e) {
      if (gen !== this.gen) return;
      sk.forEach((n) => n.remove());
      this.done = true;
      this.status.textContent = `加载失败：${(e as Error).message}`;
    } finally {
      if (gen === this.gen) this.loading = false;
    }
    if (gen === this.gen) requestAnimationFrame(() => this.fill());
  }

  /** 哨兵加载完仍在视口附近时 IntersectionObserver 不会再触发，按剩余高度补查 */
  private fill(): void {
    if (this.done || this.loading) return;
    const a = this.shell.app;
    if (a.scrollHeight - a.scrollTop - a.clientHeight < 1400) this.load();
  }
}

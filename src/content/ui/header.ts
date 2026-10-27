import { nav } from '../api/http';
import { h, icon, ICONS } from './dom';
import { createExpandableTabs, type TabItem } from './expandable-tabs';
import { createSunMoon, type SunMoon } from './sun-moon';

export interface Header { el: HTMLElement; input: HTMLInputElement; sunMoon: SunMoon; /** 液态玻璃块：搜索框、快捷入口胶囊、选中滑块 */ glass: HTMLElement[]; thumb: HTMLElement }

/** 首页和播放页共用的顶栏：标志、搜索、Expandable Tabs、日月主题按钮、头像 */
export function createHeader(o: { tabs: TabItem[]; onTheme: () => void; onSearch?: (q: string) => void }): Header {
  const user = h('a', { class: 'user', href: 'https://passport.bilibili.com/login', target: '_blank', rel: 'noopener' }, '登录');
  nav().then((n) => {
    if (!n?.isLogin) return;
    user.href = `https://space.bilibili.com/${n.mid}`;
    user.title = n.uname ?? '';
    user.replaceChildren(h('img', { src: `${(n.face ?? '').replace(/^http:/, 'https:')}@80w_80h_1c.webp`, alt: n.uname ?? '', referrerpolicy: 'no-referrer' }));
    user.classList.add('in');
  }).catch(() => {});

  const input = h('input', { type: 'search', placeholder: '搜索视频、UP 主', autocomplete: 'off', 'aria-label': '搜索' }) as HTMLInputElement;
  const search = h('form', {
    class: 'search', role: 'search',
    onsubmit: (e: Event) => {
      e.preventDefault();
      const q = input.value.trim();
      if (q) window.open(`https://search.bilibili.com/all?keyword=${encodeURIComponent(q)}`, '_blank', 'noopener');
    },
  }, icon(ICONS.search), input, h('kbd', {}, '/'));
  if (o.onSearch) {
    // 顶栏搜索框只做入口：点一下、或开始打字，就交给命令面板
    input.readOnly = true;
    const openP = () => { const q = input.value; input.value = ''; input.blur(); o.onSearch!(q); };
    search.addEventListener('pointerdown', (e) => { e.preventDefault(); openP(); });
    input.addEventListener('focus', openP);
  }

  const tabsNav = createExpandableTabs(o.tabs);
  const sunMoon = createSunMoon(o.onTheme);
  const el = h('header', { class: 'top' },
    h('a', { class: 'brand', href: 'https://www.bilibili.com/', title: '映间 MARGIN', 'aria-label': '映间 MARGIN 首页' }, h('span', { class: 'mark' }, icon(ICONS.logo))),
    search,
    h('div', { class: 'acts' }, tabsNav.el, sunMoon.el, user),
  );

  if (!o.onSearch) addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const typing = e.composedPath().some((n) => n instanceof HTMLInputElement || n instanceof HTMLTextAreaElement || (n instanceof HTMLElement && n.isContentEditable));
    if (typing) return;
    e.preventDefault();
    input.focus();
  });
  return { el, input, sunMoon, glass: [search, tabsNav.el], thumb: tabsNav.thumb };
}

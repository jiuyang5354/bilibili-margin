import { loadSettings, onSettingsChange } from '../shared/settings';
import { MarginApp } from './ui/app';
import { startTracking } from './footprint/store';
import { WatchSkin, type SkinKind } from './ui/watch';
import { injectFonts } from './fonts';
import { hideOriginal } from './ui/shell';
import { SpaceApp } from './ui/space';
import { MessageApp } from './ui/message';
import { HistoryApp } from './ui/history';
import { FeedApp } from './ui/feedpage';
import { muteNative, setGuard, guardEnabled } from './native-guard';

const isHome = () => location.hostname === 'www.bilibili.com' && /^\/(?:[a-z]{2}(?:-[A-Za-z]{2,4})?\/?)?(?:index\.html)?$/.test(location.pathname);

const isWatch = () => location.hostname === 'www.bilibili.com' && /^\/(?:[a-z]{2}(?:-[A-Za-z]{2,4})?\/)?video\/(?:BV|av)/i.test(location.pathname);
const isSearch = () => location.hostname === 'search.bilibili.com';
/** 其他接管的页面：除首页、播放页外的 B 站页面（空间、番剧、动态、历史、专栏、稍后再看…） */
const SKIP = /^\/(?:[a-z]{2}(?:-[A-Za-z]{2,4})?\/)?(?:blackboard|correspond|v\/topic|festival|bnj|ssr)/;
const isPage = () => /^(www|space|t)\.bilibili\.com$/.test(location.hostname) && !SKIP.test(location.pathname) && window.top === window;
const LOC = '(?:[a-z]{2}(?:-[A-Za-z]{2,4})?/)?';
const spaceMatch = () => location.hostname === 'space.bilibili.com' ? location.pathname.match(new RegExp(`^/${LOC}(\\d+)(?:/(video|upload/video|dynamic|upload))?/?$`)) : null;
const isMessage = () => location.hostname === 'message.bilibili.com' && window.top === window;
const isHistory = () => location.hostname === 'www.bilibili.com' && /^\/(?:account\/)?history\/?$/.test(location.pathname) && window.top === window;
const isFeed = () => location.hostname === 't.bilibili.com' && /^\/?$/.test(location.pathname) && window.top === window;
const offByUrl = () => new URLSearchParams(location.search).get('margin') === 'off';

async function startWatch(kind: SkinKind = 'watch'): Promise<void> {
  if (sessionStorage.getItem('margin:off') || offByUrl()) { sessionStorage.removeItem('margin:off'); return; }
  const settings = await loadSettings();
  if (!settings.enabled || !settings.watch) return;
  // document_start 就挂上，避免先闪一下原版
  const skin = new WatchSkin(settings, kind);
  onSettingsChange((next, prev) => {
    if (next.enabled !== prev.enabled || next.watch !== prev.watch) location.reload();
    else skin.update(next);
  });
}

async function start(): Promise<void> {
  injectFonts();
  startTracking(); // 足迹在所有 B 站页面记录，不只首页
  if (isWatch()) return startWatch();
  const sm = spaceMatch();
  // 空间页的投稿接口依赖原版脚本写的指纹 cookie，不拦会 412
  if (sm) return takeover((st) => new SpaceApp(st, Number(sm[1]), sm[2] === 'dynamic' ? 'dynamic' : 'video'), false);
  if (isMessage()) return takeover((st) => new MessageApp(st));
  if (isHistory()) return takeover((st) => new HistoryApp(st));
  if (isFeed()) return takeover((st) => new FeedApp(st));
  if (isSearch()) return startWatch('search');
  if (!isHome() && isPage()) return startWatch('page');
  if (!isHome() || sessionStorage.getItem('margin:off') || offByUrl()) {
    sessionStorage.removeItem('margin:off');
    return;
  }
  // Hide the original page as early as possible to avoid a flash.
  const hide = document.createElement('style');
  hide.id = 'margin-hide';
  hide.textContent = 'html{background:#111!important;overflow:hidden!important}body{display:none!important}@media (prefers-color-scheme: light){html{background:#f5f4f1!important}}';
  document.documentElement.append(hide);
  const unmute = muteNative();

  const settings = await loadSettings();
  if (!settings.enabled) { hide.remove(); unmute(); return disabledAfterMute(); }
  setGuard(true);

  const app = new MarginApp(settings);
  document.documentElement.append(app.host);

  onSettingsChange((next, prev) => {
    if (next.enabled !== prev.enabled) location.reload();
    else app.update(next);
  });
}

/** 接管式页面：先藏原版，再挂映间页面；设置里关掉「其他页面重设计」就保留原版 */
async function takeover(make: (s: Awaited<ReturnType<typeof loadSettings>>) => { shell: { host: HTMLElement }; update(s: Awaited<ReturnType<typeof loadSettings>>): void }, mute = true): Promise<void> {
  if (sessionStorage.getItem('margin:off') || offByUrl()) { sessionStorage.removeItem('margin:off'); return; }
  const hide = hideOriginal();
  const unmute = mute ? muteNative() : () => {};
  const settings = await loadSettings();
  if (!settings.enabled || !settings.watch) { hide.remove(); unmute(); return mute ? disabledAfterMute() : undefined; }
  if (mute) setGuard(true);
  const page = make(settings);
  document.documentElement.append(page.shell.host);
  onSettingsChange((next, prev) => {
    if (next.enabled !== prev.enabled || next.watch !== prev.watch) location.reload();
    else page.update(next);
  });
}

/** 映间被关掉但原版脚本已被拦：记下来，刷新一次让原版完整加载 */
function disabledAfterMute(): void {
  if (!guardEnabled()) return;
  setGuard(false);
  location.reload();
}

start().catch((e) => console.error("[MARGIN]", e));

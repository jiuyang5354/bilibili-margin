import { loadSettings, onSettingsChange } from '../shared/settings';
import { MarginApp } from './ui/app';
import { startTracking } from './footprint/store';
import { WatchSkin } from './ui/watch';

const isHome = () => location.hostname === 'www.bilibili.com' && /^\/(?:[a-z]{2}(?:-[A-Za-z]{2,4})?\/?)?(?:index\.html)?$/.test(location.pathname);

const isWatch = () => location.hostname === 'www.bilibili.com' && /^\/(?:[a-z]{2}(?:-[A-Za-z]{2,4})?\/)?video\/(?:BV|av)/i.test(location.pathname);
const offByUrl = () => new URLSearchParams(location.search).get('margin') === 'off';

async function startWatch(): Promise<void> {
  if (sessionStorage.getItem('margin:off') || offByUrl()) { sessionStorage.removeItem('margin:off'); return; }
  const settings = await loadSettings();
  if (!settings.enabled || !settings.watch) return;
  // document_start 就挂上，避免先闪一下原版
  const skin = new WatchSkin(settings);
  onSettingsChange((next, prev) => {
    if (next.enabled !== prev.enabled || next.watch !== prev.watch) location.reload();
    else skin.update(next);
  });
}

async function start(): Promise<void> {
  startTracking(); // 足迹在所有 B 站页面记录，不只首页
  if (isWatch()) return startWatch();
  if (!isHome() || sessionStorage.getItem('margin:off') || offByUrl()) {
    sessionStorage.removeItem('margin:off');
    return;
  }
  // Hide the original page as early as possible to avoid a flash.
  const hide = document.createElement('style');
  hide.id = 'margin-hide';
  hide.textContent = 'html{background:#111!important;overflow:hidden!important}body{display:none!important}@media (prefers-color-scheme: light){html{background:#f5f4f1!important}}';
  document.documentElement.append(hide);

  const settings = await loadSettings();
  if (!settings.enabled) { hide.remove(); return; }

  const app = new MarginApp(settings);
  document.documentElement.append(app.host);

  onSettingsChange((next, prev) => {
    if (next.enabled !== prev.enabled) location.reload();
    else app.update(next);
  });
}

start().catch((e) => console.error("[MARGIN]", e));

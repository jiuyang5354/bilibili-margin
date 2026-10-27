import { loadSettings, onSettingsChange } from '../shared/settings';
import { MarginApp } from './ui/app';

const isHome = () => location.hostname === 'www.bilibili.com' && /^\/(?:[a-z]{2}(?:-[A-Za-z]{2,4})?\/?)?(?:index\.html)?$/.test(location.pathname);

async function start(): Promise<void> {
  if (!isHome() || sessionStorage.getItem('margin:off')) {
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

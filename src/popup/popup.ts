import { loadSettings, saveSettings, type Palette, type Settings, type Theme } from '../shared/settings';

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;

function paint(s: Settings): void {
  $('#enabled').setAttribute('aria-checked', String(s.enabled));
  document.querySelectorAll<HTMLButtonElement>('#palette button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === s.palette)));
  document.querySelectorAll<HTMLButtonElement>('#theme button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === s.theme)));
}

(async () => {
  $('#ver').textContent = chrome.runtime.getManifest().version;
  let s = await loadSettings();
  paint(s);
  $('#enabled').addEventListener('click', async () => { s = await saveSettings({ enabled: !s.enabled }); paint(s); });
  $('#theme').addEventListener('click', async (e) => {
    const v = (e.target as HTMLElement).closest('button')?.dataset.v as Theme | undefined;
    if (!v) return;
    s = await saveSettings({ theme: v });
    paint(s);
  });
  $('#palette').addEventListener('click', async (e) => {
    const v = (e.target as HTMLElement).closest('button')?.dataset.v as Palette | undefined;
    if (!v) return;
    s = await saveSettings({ palette: v });
    paint(s);
  });
})();

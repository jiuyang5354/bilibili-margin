export type Theme = 'auto' | 'light' | 'dark';
export interface Settings {
  enabled: boolean;
  theme: Theme;
}
export const DEFAULTS: Settings = { enabled: true, theme: 'auto' };
const KEY = 'margin:settings';

export async function loadSettings(): Promise<Settings> {
  const r = await chrome.storage.local.get(KEY);
  return { ...DEFAULTS, ...(r[KEY] as Partial<Settings> | undefined) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}

export function onSettingsChange(cb: (s: Settings, prev: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[KEY]) return;
    cb({ ...DEFAULTS, ...(changes[KEY].newValue as Partial<Settings>) }, { ...DEFAULTS, ...(changes[KEY].oldValue as Partial<Settings>) });
  });
}

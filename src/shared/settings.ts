export type Theme = 'auto' | 'light' | 'dark';
/** 只保留经典配色（雾蓝 / 夜蓝已按用户要求移除） */
export type Palette = 'classic';
export type ShaderId = 'aurora' | 'silk' | 'mesh' | 'grain' | 'ice';
export type BgMode = 'random' | 'fixed' | 'image' | 'off';

export interface Filters {
  /** 标题关键词；写成 /正则/ 时按正则匹配 */
  keywords: string[];
  /** UP 主昵称或 MID */
  ups: string[];
  minViews: number;
  /** 秒 */
  minDuration: number;
}

export interface Background {
  mode: BgMode;
  shader: ShaderId;
  /** 0–1 */
  intensity: number;
}

export interface Settings {
  enabled: boolean;
  theme: Theme;
  palette: Palette;
  hoverPreview: boolean;
  filters: Filters;
  bg: Background;
}

export const DEFAULTS: Settings = {
  enabled: true,
  theme: 'auto',
  palette: 'classic',
  hoverPreview: true,
  filters: { keywords: [], ups: [], minViews: 0, minDuration: 0 },
  bg: { mode: 'random', shader: 'aurora', intensity: 0.6 },
};

const KEY = 'margin:settings';
export const BG_IMAGE_KEY = 'margin:bg-image';

function merge(raw: Partial<Settings> | undefined): Settings {
  const r = raw ?? {};
  return {
    ...DEFAULTS,
    ...r,
    filters: { ...DEFAULTS.filters, ...(r.filters ?? {}) },
    bg: { ...DEFAULTS.bg, ...(r.bg ?? {}) },
    palette: 'classic', // 旧版存过 mist，统一回到经典
  };
}

export async function loadSettings(): Promise<Settings> {
  const r = await chrome.storage.local.get(KEY);
  return merge(r[KEY] as Partial<Settings> | undefined);
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = merge({ ...(await loadSettings()), ...patch });
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}

export function onSettingsChange(cb: (s: Settings, prev: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[KEY]) return;
    cb(merge(changes[KEY].newValue as Partial<Settings>), merge(changes[KEY].oldValue as Partial<Settings>));
  });
}

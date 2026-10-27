import { md5 } from './md5';

const API = 'https://api.bilibili.com';

interface Resp<T> { code: number; message?: string; data: T }

export async function getJSON<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const url = `${API}${path}${q.size ? `?${q}` : ''}`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as Resp<T>;
  if (body.code !== 0) throw new Error(body.message || `code ${body.code}`);
  return body.data;
}

// ---- WBI signing ----
const MIXIN = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52];
let mixinKey: Promise<string> | null = null;

export interface NavInfo {
  isLogin: boolean;
  uname?: string;
  face?: string;
  mid?: number;
  wbi_img: { img_url: string; sub_url: string };
}

let navCache: Promise<NavInfo> | null = null;
export function nav(): Promise<NavInfo> {
  // /nav answers code -101 when logged out but still carries wbi_img, so read it raw.
  navCache ??= fetch(`${API}/x/web-interface/nav`, { credentials: 'include' })
    .then((r) => r.json())
    .then((b) => b.data as NavInfo);
  return navCache;
}

function getMixinKey(): Promise<string> {
  mixinKey ??= nav().then(({ wbi_img }) => {
    const name = (u: string) => u.slice(u.lastIndexOf('/') + 1).split('.')[0];
    const raw = name(wbi_img.img_url) + name(wbi_img.sub_url);
    return MIXIN.map((i) => raw[i]).join('').slice(0, 32);
  });
  return mixinKey;
}

export async function getWbi<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const key = await getMixinKey();
  const all: Record<string, string> = { ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), wts: String(Math.round(Date.now() / 1000)) };
  const query = Object.keys(all).sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(all[k].replace(/[!'()*]/g, ''))}`)
    .join('&');
  const res = await fetch(`${API}${path}?${query}&w_rid=${md5(query + key)}`, { credentials: 'include' });
  const body = (await res.json()) as Resp<T>;
  if (body.code !== 0) throw new Error(body.message || `code ${body.code}`);
  return body.data;
}

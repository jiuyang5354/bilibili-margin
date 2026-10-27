/** 搜索联想、热搜、稍后再看——都是 B 站网页端自己在用的接口（只允许 www.bilibili.com 跨域） */
export interface Suggest { term: string; html: string }
export interface Hot { keyword: string; name: string }

export async function suggest(term: string, signal?: AbortSignal): Promise<Suggest[]> {
  const r = await fetch(`https://s.search.bilibili.com/main/suggest?term=${encodeURIComponent(term)}&main_ver=v1`, { credentials: 'include', signal });
  const b = await r.json();
  const tags = (b?.result?.tag ?? []) as { value: string; name: string }[];
  return tags.slice(0, 8).map((t) => ({ term: t.value, html: t.name }));
}

let hotCache: Promise<Hot[]> | null = null;
export function hotSearch(): Promise<Hot[]> {
  hotCache ??= fetch('https://api.bilibili.com/x/web-interface/search/square?limit=10', { credentials: 'include' })
    .then((r) => r.json())
    .then((b) => ((b?.data?.trending?.list ?? []) as { keyword: string; show_name: string }[]).map((x) => ({ keyword: x.keyword, name: x.show_name || x.keyword })))
    .catch(() => { hotCache = null; return []; });
  return hotCache;
}

const csrf = () => document.cookie.match(/(?:^|;\s*)bili_jct=([^;]+)/)?.[1] ?? '';

/** 加入稍后再看；未登录返回 false */
export async function addWatchLater(bvid: string): Promise<{ ok: boolean; msg: string }> {
  const token = csrf();
  if (!token) return { ok: false, msg: '登录 B 站后才能用稍后再看' };
  const r = await fetch('https://api.bilibili.com/x/v2/history/toview/add', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ bvid, csrf: token }),
  });
  const b = await r.json().catch(() => ({ code: -1 }));
  return b.code === 0 ? { ok: true, msg: '已加入稍后再看' } : { ok: false, msg: b.message || '没加上，稍后再试' };
}

const HKEY = 'margin:search-history';
export function searchHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch { return []; }
}
export function rememberSearch(q: string): void {
  const list = [q, ...searchHistory().filter((x) => x !== q)].slice(0, 8);
  localStorage.setItem(HKEY, JSON.stringify(list));
}
export function forgetSearch(q?: string): void {
  localStorage.setItem(HKEY, JSON.stringify(q ? searchHistory().filter((x) => x !== q) : []));
}
export const searchUrl = (q: string) => `https://search.bilibili.com/all?keyword=${encodeURIComponent(q)}`;

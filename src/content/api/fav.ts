import { getJSON, nav } from './http';
import type { Video } from './feed';

export interface Folder { id: number; title: string; count: number; cover: string }

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function folders(): Promise<Folder[] | null> {
  const n = await nav();
  if (!n?.isLogin || !n.mid) return null;
  const data = await getJSON<{ list: any[] | null }>('/x/v3/fav/folder/created/list', { up_mid: n.mid, pn: 1, ps: 50 });
  return (data.list ?? []).map((f) => ({ id: f.id, title: f.title, count: f.media_count, cover: String(f.cover || '').replace(/^http:/, 'https:') }));
}

export async function folderVideos(id: number, page: number): Promise<{ list: Video[]; more: boolean }> {
  const data = await getJSON<{ medias: any[] | null; has_more: boolean }>('/x/v3/fav/resource/list', { media_id: id, pn: page, ps: 20, platform: 'web' });
  const list = (data.medias ?? [])
    .filter((m) => m.type === 2 && m.bvid && m.attr === 0)
    .map((m): Video => ({
      bvid: m.bvid, cid: m.ugc?.first_cid ?? 0, title: m.title,
      cover: String(m.cover || '').replace(/^http:/, 'https:'), duration: m.duration ?? 0,
      author: m.upper?.name ?? '', mid: m.upper?.mid ?? 0, face: m.upper?.face ?? '',
      views: m.cnt_info?.play ?? 0, danmaku: m.cnt_info?.danmaku ?? 0, pubdate: m.fav_time ?? m.pubtime ?? 0,
    }));
  return { list, more: !!data.has_more };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { DynamicPicture } from './dynamic-publish';
import { getJSON, postForm, postJSON } from './http';
import { parseCountText, parseDurationText } from '../parse';
import type { Video } from './feed';

/** 一条动态，抽成渲染需要的最小结构 */
export interface DynText { text: string; emoji?: string }
interface ReserveStyle {
  text?: string; disable?: number; toast?: string;
  interactive?: { popups?: string; desc?: string; confirm?: string; cancel?: string };
}
export interface DynReserve {
  rid: string; title: string; state: number; reserve_total: number; jump_url: string;
  desc1?: { text: string }; desc2?: { text: string; visible: boolean };
  desc3?: { text: string; jump_url: string };
  premiere?: { cover: string; online?: string }; badge_text?: string;
  button?: { type: number; status: number; check?: ReserveStyle; uncheck?: ReserveStyle; jump_style?: ReserveStyle };
}
export interface Dyn {
  id: string; type: string; author: string; face: string; mid: number; ts: number; time: string;
  text: string; richText?: DynText[]; title?: string;
  video?: { bvid: string; title: string; cover: string; dur: string; play: string; danmaku?: string; desc: string; ad?: boolean };
  pics: string[];
  article?: { title: string; cover: string; desc: string; url: string };
  /** 直播（开播提醒 LIVE_RCMD / 直播间分享 LIVE），#4 */
  live?: { title: string; cover: string; url: string; on: boolean; meta: string };
  /** 其它带卡片的类型（合集、番剧、课程、音乐、通用卡片），统一成链接卡 */
  link?: { title: string; cover: string; desc: string; url: string; kind: string };
  attachment?: Dyn['link'];
  reserve?: DynReserve;
  /** 充电专属等来源角标（如 module_author.icon_badge / major.archive.badge / basic.is_only_fans） */
  badge?: string;
  /** 未解锁的充电专属动态、受限或失效动态占位（MAJOR_TYPE_BLOCKED / MAJOR_TYPE_UPOWER_COMMON / MAJOR_TYPE_NONE） */
  blocked?: { title: string; hint: string; url: string; action?: string; charging?: boolean };
  orig?: Dyn | null;
  stat: { comment: number; forward: number; like: number };
  url: string;
  editable?: boolean; deleteParams?: Record<string, unknown>;
  /** v0.50 动态页直接互动：自己是否已赞、评论区 type/oid */
  liked?: boolean; cmtType?: number; cmtOid?: string;
}

export const DYN_FEATURES = 'itemOpusStyle,listOnlyfans,onlyfansVote,onlyfansAssetsV2';
const https = (u: unknown) => String(u ?? '').replace(/^\/\//, 'https://').replace(/^http:/, 'https:');
const reserveUrl = (u: unknown) => /^https:\/\//.test(https(u)) ? https(u) : '';
const cleanText = (v: unknown) => typeof v === 'string' ? v.trim() : '';

export function toDyn(it: any): Dyn | null {
  if (!it?.modules) return null;
  const m = it.modules, a = m.module_author ?? {}, d = m.module_dynamic ?? {}, s = m.module_stat ?? {};
  const major = d.major ?? {};
  const opus = major.opus;
  const desc = opus?.summary?.text != null ? opus.summary : d.desc;
  const text = (desc?.text ?? '').trim();
  const nodes: DynText[] = (desc?.rich_text_nodes ?? []).map((n: any) => {
    const emoji = https(n.emoji?.icon_url);
    return { text: String(n.text ?? n.orig_text ?? n.emoji?.text ?? ''),
      ...(n.type === 'RICH_TEXT_NODE_TYPE_EMOJI' && /^https:\/\//.test(emoji) ? { emoji } : {}) };
  });
  const out: Dyn = {
    id: it.id_str, type: it.type, author: a.name ?? '', face: https(a.face), mid: a.mid ?? 0, ts: a.pub_ts ?? 0, time: a.pub_time ?? '',
    text, richText: nodes.length && nodes.map((n) => n.text).join('').trim() === text ? nodes : undefined,
    title: opus?.title || undefined, pics: [],
    stat: { comment: s.comment?.count ?? 0, forward: s.forward?.count ?? 0, like: s.like?.count ?? 0 },
    url: `https://www.bilibili.com/opus/${it.id_str}`,
    liked: s.like?.status === true, cmtType: Number(it.basic?.comment_type) || undefined, cmtOid: it.basic?.comment_id_str || undefined,
  };
  const menu = m.module_more?.three_point_items;
  if (Array.isArray(menu)) {
    out.editable = it.basic?.editable === true && menu.some(item => item.type === 'THREE_POINT_EDIT');
    const remove = menu.find(item => item.type === 'THREE_POINT_DELETE');
    if (remove) out.deleteParams = remove.params ?? {};
  }
  if (major.archive) {
    const v = major.archive;
    const ad = v.is_ad === true || Boolean(v.ad_info) || Boolean(v.business_info) || undefined;
    out.video = { bvid: v.bvid, title: v.title, cover: https(v.cover), dur: v.duration_text ?? '', play: String(v.stat?.play ?? ''), danmaku: v.stat?.danmaku == null ? undefined : String(v.stat.danmaku), desc: v.desc ?? '', ad };
    out.url = `https://www.bilibili.com/video/${v.bvid}`;
    if (!out.cmtType && !out.cmtOid && v.aid) { out.cmtType = 1; out.cmtOid = String(v.aid); }
  }
  if (opus?.pics) out.pics = opus.pics.map((p: any) => https(p.url));
  else if (major.draw?.items) out.pics = major.draw.items.map((p: any) => https(p.src));
  if (major.article) {
    const r = major.article;
    out.article = { title: r.title, cover: https(r.covers?.[0]), desc: r.desc ?? '', url: https(r.jump_url) };
  }
  if (major.live_rcmd) {
    let c: any = {};
    try { c = JSON.parse(major.live_rcmd.content || '{}'); } catch { /* ignore */ }
    const li = c.live_play_info ?? {};
    const url = https(li.link || (li.room_id ? `https://live.bilibili.com/${li.room_id}` : ''));
    out.live = { title: li.title ?? '', cover: https(li.cover), url, on: li.live_status === 1 || c.live_status === 1 || !!li.live_start_time, meta: [li.area_name, li.watched_show?.text_large].filter(Boolean).join(' · ') };
    if (url) out.url = url;
  } else if (major.live) {
    const l = major.live;
    out.live = { title: l.title ?? '', cover: https(l.cover), url: https(l.jump_url), on: l.live_state === 1, meta: [l.desc_first, l.desc_second].filter(Boolean).join(' · ') };
    if (out.live.url) out.url = out.live.url;
  }
  const lk = major.ugc_season ?? major.pgc ?? major.courses ?? major.music ?? major.common;
  if (!out.video && !out.live && !out.article && lk) {
    const kind = major.ugc_season ? '合集' : major.pgc ? '番剧' : major.courses ? '课程' : major.music ? '音乐' : (lk.badge?.text || '');
    out.link = { title: lk.title ?? '', cover: https(lk.cover), desc: lk.desc ?? lk.sub_title ?? lk.label ?? '', url: https(lk.jump_url), kind };
    if (out.link.url) out.url = out.link.url;
  }
  const ugc = d.additional?.ugc;
  const ugcUrl = https(ugc?.jump_url);
  if (/^https:\/\//.test(ugcUrl)) {
    out.attachment = { title: ugc.title ?? '', cover: https(ugc.cover), url: ugcUrl, kind: '视频',
      desc: ugc.stat ? [ugc.stat.play ? `${ugc.stat.play}播放` : '', ugc.stat.danmaku ? `${ugc.stat.danmaku}弹幕` : ''].filter(Boolean).join(' · ') : ugc.desc_second ?? '' };
  }
  const reserve = d.additional?.reserve;
  if (reserve) {
    out.reserve = { ...reserve, rid: String(reserve.rid ?? ''), title: String(reserve.title ?? ''),
      jump_url: reserveUrl(reserve.jump_url),
      desc3: reserve.desc3 ? { text: String(reserve.desc3.text ?? ''), jump_url: reserveUrl(reserve.desc3.jump_url) } : undefined,
      premiere: reserve.premiere ? { ...reserve.premiere, cover: reserveUrl(reserve.premiere.cover) } : undefined };
  }
  const rawBadge = cleanText(a.icon_badge?.text)
    || cleanText(major.archive?.badge?.text)
    || cleanText(major.upower_common?.title_prefix)
    || (cleanText(m.module_tag?.text).includes('充电') ? cleanText(m.module_tag?.text) : '')
    || (it.basic?.is_only_fans === true || cleanText(a.pub_action).includes('充电') ? '充电专属' : '');
  if (rawBadge) out.badge = rawBadge;
  if (major.blocked || major.type === 'MAJOR_TYPE_BLOCKED') {
    const b = major.blocked ?? {};
    const charging = b.blocked_type === 3 || b.blocked_type === 4 || it.basic?.is_only_fans === true
      || /充电|专属/.test(`${b.title ?? ''}${b.hint_message ?? ''}${b.text ?? ''}${b.sub_title ?? ''}${out.badge ?? ''}${a.pub_action ?? ''}`);
    const title = cleanText(b.title) || (charging ? '充电专属动态' : '内容暂不可见');
    const hint = [cleanText(b.hint_message) || cleanText(b.text), cleanText(b.sub_title)].filter(Boolean).join(' · ')
      || (charging ? '该动态为充电专属，未开启充电时无法直接展示正文，前往原动态页可查看详情或开通充电' : '前往原动态页查看详情');
    const jump = reserveUrl(b.button?.jump_url) || reserveUrl(b.jump_url) || out.url;
    const action = cleanText(b.button?.text) || (charging ? '去充电查看' : '查看详情');
    out.blocked = { title, hint, url: jump, action, charging };
    if (charging && !out.badge) out.badge = '充电专属';
  } else if (major.upower_common || major.type === 'MAJOR_TYPE_UPOWER_COMMON') {
    const u = major.upower_common ?? {};
    const title = [cleanText(u.title_prefix), cleanText(u.title)].filter(Boolean).join(' · ') || '充电专属动态';
    const hint = cleanText(u.sub_title) || '该动态为充电专属内容，前往原动态页查看详情';
    const jump = reserveUrl(u.button?.jump_url) || reserveUrl(u.jump_url) || out.url;
    const action = cleanText(u.button?.text) || '查看详情';
    out.blocked = { title, hint, url: jump, action, charging: true };
    if (!out.badge) out.badge = cleanText(u.title_prefix) || '充电专属';
  } else if (major.none || major.type === 'MAJOR_TYPE_NONE') {
    const tips = cleanText(major.none?.tips);
    const charging = it.basic?.is_only_fans === true || /充电|专属/.test(`${tips}${out.badge ?? ''}${a.pub_action ?? ''}`);
    if (tips || charging) {
      out.blocked = {
        title: charging ? '充电专属动态' : '动态暂不可见',
        hint: tips || '该动态为充电专属，前往原动态页查看详情',
        url: out.url,
        action: charging ? '去充电查看' : undefined,
        charging,
      };
      if (charging && !out.badge) out.badge = '充电专属';
    }
  }
  if (it.orig) out.orig = toDyn(it.orig);
  const emptyBody = !out.title && !out.text && !out.video && !out.pics.length
    && !out.article && !out.live && !out.link && !out.attachment && !out.reserve && !out.orig && !out.blocked;
  if (emptyBody) {
    const pubAction = cleanText(a.pub_action);
    const charging = it.basic?.is_only_fans === true
      || /充电|专属/.test(`${out.badge ?? ''}${pubAction}${major.type ?? ''}`);
    if (charging) {
      out.blocked = {
        title: '充电专属动态',
        hint: '未开启充电时无法直接展示正文，前往原动态页可查看详情或开通充电',
        url: out.url,
        action: '去充电查看',
        charging: true,
      };
      if (!out.badge) out.badge = '充电专属';
    } else if (pubAction || major.type) {
      out.blocked = {
        title: pubAction || '暂不支持直接预览此动态',
        hint: '前往 B 站原动态页查看完整内容',
        url: out.url,
        action: '查看详情',
        charging: false,
      };
    }
  }
  return out;
}

/** 与原生预约卡使用同一接口，状态和人数以服务器返回值为准。 */
export async function dynReserve(id: string, reserve: DynReserve): Promise<string> {
  const result = await postJSON<{ final_btn_status: number; desc_update?: string; reserve_update?: number; toast?: string }>(
    '/x/dynamic/feed/reserve/click', { reserve_id: reserve.rid, cur_btn_status: reserve.button!.status,
      dynamic_id_str: id, reserve_total: reserve.reserve_total, spmid: '' });
  if (result.final_btn_status !== 1 && result.final_btn_status !== 2) throw new Error('预约状态未确认，请刷新后重试');
  reserve.button!.status = result.final_btn_status;
  if (result.desc_update !== undefined && reserve.desc2) reserve.desc2.text = result.desc_update;
  if (result.reserve_update !== undefined) reserve.reserve_total = result.reserve_update;
  return result.toast || (result.final_btn_status === 2 ? '预约成功' : '已取消预约');
}

export async function deleteSpaceDynamic(d: Dyn): Promise<void> {
  if (!d.deleteParams || !/^\d+$/.test(d.id)) throw new Error('当前动态不可删除');
  await postJSON('/x/dynamic/feed/operate/remove', { ...d.deleteParams, dyn_id_str: d.id }, { platform: 'web' });
}

export async function spaceDynamics(mid: number, offset: string): Promise<{ list: Dyn[]; offset: string; more: boolean }> {
  const d = await getJSON<any>('/x/polymer/web-dynamic/v1/feed/space', { host_mid: mid, offset, timezone_offset: -480, features: DYN_FEATURES });
  return { list: (d.items ?? []).map(toDyn).filter(Boolean) as Dyn[], offset: d.offset ?? '', more: !!d.has_more };
}

export type FeedType = 'all' | 'video' | 'pgc' | 'article';
/** 关注动态流；hostMid 只看某个 UP */
export async function followFeed(type: FeedType, offset: string, hostMid = 0, signal?: AbortSignal): Promise<{ list: Dyn[]; offset: string; more: boolean; baseline: string }> {
  const p: Record<string, string | number> = { type, offset, timezone_offset: -480, features: DYN_FEATURES };
  if (hostMid) p.host_mid = hostMid;
  const d = await getJSON<any>('/x/polymer/web-dynamic/v1/feed/all', p, signal);
  return { list: (d.items ?? []).map(toDyn).filter(Boolean) as Dyn[], offset: d.offset ?? '', more: !!d.has_more, baseline: d.update_baseline ?? '' };
}

export async function followFeedUpdates(type: FeedType, baseline: string, signal?: AbortSignal): Promise<number> {
  const d = await getJSON<{ update_num?: number }>('/x/polymer/web-dynamic/v1/feed/all/update', { type, update_baseline: baseline }, signal);
  return Math.max(0, Number(d.update_num) || 0);
}

/** 首页「关注」只取作者直接投稿的视频，沿用动态流顺序和游标。 */
export async function followedVideos(offset: string, signal: AbortSignal): Promise<{ list: Video[]; offset: string; more: boolean }> {
  const page = await followFeed('video', offset, 0, signal);
  const list = page.list.flatMap((d): Video[] => {
    const v = d.video;
    if (d.type !== 'DYNAMIC_TYPE_AV' || !v?.bvid || !v.title || v.ad) return [];
    return [{
      bvid: v.bvid, cid: 0, title: v.title, cover: v.cover, author: d.author, mid: d.mid, face: d.face,
      duration: parseDurationText(v.dur) ?? 0, views: parseCountText(v.play) ?? NaN,
      danmaku: parseCountText(v.danmaku) ?? NaN, pubdate: d.ts,
    }];
  });
  return { list, offset: page.offset, more: page.more && !!page.offset && page.offset !== offset };
}

export interface Up { mid: number; name: string; face: string; fresh: boolean }
export interface LiveUp { mid: number; name: string; face: string; title: string; url: string }
/** The native followed-live list is read only after the user asks for more. */
export async function followingLive(): Promise<LiveUp[]> {
  const response = await fetch('https://api.live.bilibili.com/xlive/web-ucenter/v1/xfetter/GetWebList?hit_ab=true', { credentials: 'include', signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('直播列表暂时不可用');
  const body = await response.json();
  if (body.code !== 0) throw new Error(body.message || body.msg || '直播列表暂时不可用');
  return (body.data?.rooms ?? body.data?.list ?? []).flatMap((u: any) => {
    const room = Number(u.room_id ?? u.roomid);
    return Number.isSafeInteger(room) && room > 0 ? [{ mid: Number(u.uid ?? u.mid) || 0, name: String(u.uname || ''), face: https(u.face), title: String(u.title || ''), url: `https://live.bilibili.com/${room}` }] : [];
  });
}
/** 顶部「最常访问」头像条 + 正在直播 */
export async function portal(): Promise<{ ups: Up[]; live: LiveUp[]; liveCount: number }> {
  const d = await getJSON<any>('/x/polymer/web-dynamic/v1/portal');
  // v0.49：B 站把 up_list 从 { items } 改成了直接的数组，旧写法拿到空列表，动态页头像条整条消失（B 站评论反馈）
  const rawUps: any[] = Array.isArray(d.up_list) ? d.up_list : (d.up_list?.items ?? []);
  const ups = rawUps.map((u: any) => ({ mid: u.mid, name: u.uname, face: https(u.face), fresh: !!u.has_update }));
  const live = (d.live_users?.items ?? []).map((u: any) => ({ mid: u.mid, name: u.uname, face: https(u.face), title: u.title ?? '', url: https(u.jump_url || `https://live.bilibili.com/${u.room_id}`) }));
  return { ups, live, liveCount: d.live_users?.count ?? live.length };
}

/** #16：关注列表分页（动态页左侧「关注」区用），按最近互动排序 */
export async function followings(me: number, pn: number, ps = 30): Promise<{ list: Up[]; hasMore: boolean; total: number }> {
  const d = await getJSON<any>('/x/relation/followings', { vmid: me, pn, ps, order: 'mtime' });
  const list = (d.list ?? []).map((u: any) => ({ mid: u.mid, name: u.uname, face: https(u.face), fresh: false }));
  return { list, hasMore: list.length >= ps, total: d.total ?? 0 };
}

/** v0.49：在自己的关注里按昵称搜 UP（关注多时头像条翻不完，B 站评论反馈） */
export async function searchFollowing(me: number, name: string): Promise<Up[]> {
  const d = await getJSON<any>('/x/relation/followings/search', { vmid: me, pn: 1, ps: 30, name });
  return (d.list ?? []).map((u: any) => ({ mid: u.mid, name: u.uname, face: https(u.face), fresh: false }));
}

/* ---- v0.50 动态页直接点赞 / 转发 / 评论（B 站评论建议：不用跳详情页）---- */
/** 点赞 / 取消赞，接口同 B 站动态页（bilibili-API-collect：dynamic/action） */
export async function dynLike(id: string, on: boolean): Promise<void> {
  await postJSON('/x/dynamic/feed/dyn/thumb', { dyn_id_str: id, up: on ? 1 : 2, spmid: '333.1365.0.0' });
}
/** 转发（可带一句话）；空文字时和 B 站一样只转发 */
export async function dynRepost(id: string, text: string): Promise<void> {
  await postJSON('/x/dynamic/feed/create/dyn', {
    dyn_req: { content: { contents: text ? [{ raw_text: text, type: 1, biz_id: '' }] : [] }, scene: 4, attach_card: null, meta: { app_meta: { from: 'create.dynamic.web', mobi_app: 'web' } } },
    web_repost_src: { dyn_id_str: id },
  }, { platform: 'web' });
}
/** 列表接口偶尔省略 basic，点开评论时才补详情，不为整页动态预取。 */
export async function dynCommentTarget(d: Dyn): Promise<{ type: number; oid: string } | null> {
  if (d.cmtType && d.cmtOid) return { type: d.cmtType, oid: d.cmtOid };
  const detail = await getJSON<any>('/x/polymer/web-dynamic/v1/detail', { id: d.id });
  const item = toDyn(detail.item);
  if (!item?.cmtType || !item.cmtOid) return null;
  d.cmtType = item.cmtType; d.cmtOid = item.cmtOid;
  return { type: item.cmtType, oid: item.cmtOid };
}

export interface Reply { rpid: string; name: string; face: string; mid: number; text: string; richText?: DynText[]; pictures?: string[]; like: number; liked: boolean; ts: number; rcount: number; location?: string; top?: boolean }
function toReply(r: any): Reply {
  return {
    rpid: String(r.rpid_str ?? r.rpid), name: r.member?.uname ?? '', face: https(r.member?.avatar), mid: Number(r.mid ?? r.member?.mid) || 0,
    text: r.content?.message ?? '',
    pictures: (Array.isArray(r.content?.pictures) ? r.content.pictures : []).map((p: any) => https(p?.img_src)).filter((url: string) => /^https:\/\/([a-z0-9-]+\.)*(hdslb\.com|biliimg\.com)\//i.test(url)),
    richText: String(r.content?.message ?? '').split(/(\[[^\]\r\n]+\])/g).filter(Boolean).map((text) => {
      const emoji = https(r.content?.emote?.[text]?.url);
      return { text, ...(/^https:\/\//.test(emoji) ? { emoji } : {}) };
    }),
    like: Math.max(Number(r.like) || 0, 0), liked: r.action === 1, ts: r.ctime ?? 0, rcount: r.rcount ?? 0,
    location: typeof r.reply_control?.location === 'string' ? r.reply_control.location.trim() || undefined : undefined,
  };
}
/** 热门评论按页读取；置顶只在第一页合并，避免挤掉该页最后一条普通评论。 */
export async function dynReplies(type: number, oid: string, ps = 8, pn = 1): Promise<{ list: Reply[]; count: number; more: boolean }> {
  const d = await getJSON<any>('/x/v2/reply', { type, oid, sort: 1, ps, pn });
  const seen = new Set<string>();
  const rows = d.replies ?? [];
  const pinned: any[] = pn === 1 ? [...(d.top_replies ?? []), ...(d.upper?.top ? [d.upper.top] : [])] : [];
  const pinnedIds = new Set(pinned.map(r => String(r.rpid_str ?? r.rpid)));
  const list = [...pinned, ...rows].map(raw => {
    const reply = toReply(raw);
    if (pinnedIds.has(reply.rpid)) reply.top = true;
    return reply;
  }).filter((r) => !seen.has(r.rpid) && seen.add(r.rpid));
  const more = rows.length > 0 && (typeof d.page?.count === 'number' ? pn * (d.page.size || ps) < d.page.count : rows.length >= ps);
  return { list, count: d.page?.acount ?? d.page?.count ?? list.length, more };
}
export async function dynSubReplies(type: number, oid: string, root: string, pn: number): Promise<{ list: Reply[]; more: boolean }> {
  const ps = 10;
  const d = await getJSON<any>('/x/v2/reply/reply', { type, oid, root, pn, ps });
  const list: Reply[] = (d.replies ?? []).map(toReply);
  return { list, more: list.length > 0 && pn * (d.page?.size || ps) < (d.page?.count ?? 0) };
}
export async function dynReply(type: number, oid: string, message: string, target?: { root: string; parent: string }, extra?: { mentions: Record<string, number>; pictures: DynamicPicture[] }): Promise<Reply | null> {
  const data = await postForm<any>('/x/v2/reply/add', { type, oid, message, plat: 1, ...target,
    ...(extra && Object.keys(extra.mentions).length ? { at_name_to_mid: JSON.stringify(extra.mentions) } : {}),
    ...(extra?.pictures.length ? { pictures: JSON.stringify(extra.pictures) } : {}), });
  return data?.reply?.rpid_str || data?.reply?.rpid ? toReply(data.reply) : null;
}

export async function dynReplyLike(type: number, oid: string, rpid: string, liked: boolean): Promise<void> {
  await postForm('/x/v2/reply/action', { type, oid, rpid, action: liked ? 1 : 0 });
}

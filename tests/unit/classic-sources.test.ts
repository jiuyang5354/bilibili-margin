import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { account } from '../../src/content/api/account';
import { getJSON, getWbi } from '../../src/content/api/http';
import { followClassics, resetClassics } from '../../src/content/api/space';

vi.mock('../../src/content/api/account', () => ({ account: vi.fn() }));
vi.mock('../../src/content/api/http', () => ({ getJSON: vi.fn(), getWbi: vi.fn() }));

const response = (data: unknown, code = 0) => new Response(JSON.stringify({ code, data }));
const signal = () => new AbortController().signal;
const now = Math.floor(Date.now() / 1000);
const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  resetClassics();
  vi.resetAllMocks();
  vi.mocked(account).mockResolvedValue({ mid: 1 } as Awaited<ReturnType<typeof account>>);
  vi.stubGlobal('fetch', fetcher);
  vi.spyOn(Math, 'random').mockReturnValue(0.999);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('keeps every pool intact when a concurrent source is still loading and the batch is aborted', async () => {
  vi.mocked(getJSON).mockResolvedValue({ list: [{ mid: 11 }, { mid: 12 }, { mid: 13 }] });
  fetcher.mockImplementation(async () => response(Array.from({ length: 8 }, (_, i) => ({ bvid: `BVlike${i}`, pubdate: now }))));
  const uploads = (mid: number) => ({ list: { vlist: [{ bvid: `BVfollow${mid}`, created: now - 100 * 86400 }] } });
  let release: () => void = () => {};
  vi.mocked(getWbi).mockImplementation(async (_path, params) => {
    if (params?.mid === 13) await new Promise<void>(resolve => { release = resolve; });
    return uploads(Number(params?.mid));
  });

  const firstSignal = signal();
  const first = await followClassics(firstSignal, ['follow', 'like']);
  expect(first.list.map(video => video.bvid)).toEqual(['BVfollow11', 'BVfollow12', 'BVlike0', 'BVlike1', 'BVlike2', 'BVlike3']);
  expect(first.done).toBe(false);
  expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/like/video'), expect.objectContaining({ signal: firstSignal }));
  const controller = new AbortController();
  const pending = followClassics(controller.signal, ['like', 'follow', 'like']);
  await vi.waitFor(() => expect(getWbi).toHaveBeenCalledTimes(3));
  controller.abort();
  release();
  await expect(pending).rejects.toHaveProperty('name', 'AbortError');
  vi.mocked(getWbi).mockResolvedValue(uploads(13));

  const retry = await followClassics(signal(), ['follow', 'like']);
  expect(retry.list.map(video => video.bvid)).toEqual(['BVfollow13', 'BVlike4', 'BVlike5', 'BVlike6', 'BVlike7']);
  expect(retry.done).toBe(true);
  expect(getJSON).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('samples additional favorite pages, drains the buffer, and deduplicates across batches and sources', async () => {
  const pages: number[] = [];
  const shared = { type: 2, attr: 0, bvid: 'BVshared', pubtime: 2, ctime: 3, fav_time: 4 };
  vi.mocked(getJSON).mockImplementation(async (path, params, requestSignal) => {
    expect(requestSignal).toBeInstanceOf(AbortSignal);
    if (path.endsWith('/created/list')) return { list: [] };
    if (path.endsWith('/created/list-all')) return { list: [{ id: 5, media_count: 41 }, { id: 6, media_count: 0 }] };
    expect(path).toBe('/x/v3/fav/resource/list');
    expect(params).toMatchObject({ media_id: 5, ps: 20, platform: 'web' });
    const page = Number(params?.pn);
    pages.push(page);
    return { medias: [
      shared, { type: 1, attr: 0, bvid: 'BVnotVideo' }, { type: 2, attr: 1, bvid: 'BVdeleted' },
      ...Array.from({ length: 3 }, (_, i) => ({ ...shared, bvid: `BVfav${page}${i}`, pubtime: 0 })),
    ] };
  });
  fetcher.mockImplementation(async url => String(url).includes('/coin/')
    ? response(null, 53013) : response([{ bvid: shared.bvid, pubdate: now }]));

  const load = () => followClassics(signal(), ['like', 'coin', 'fav']);
  const first = await load();
  expect(pages).toEqual([1, 2]);
  expect(first.list).toHaveLength(4);
  expect(first.done).toBe(false);

  const rest = await load();
  expect(pages).toEqual([1, 2]);
  expect(rest.done).toBe(false);
  const last = await load();
  expect(pages).toEqual([1, 2, 3]);
  expect(last.done).toBe(true);
  const videos = [...first.list, ...rest.list, ...last.list];
  expect(videos.map(video => video.bvid)).toEqual([
    'BVshared', 'BVfav10', 'BVfav11', 'BVfav12', 'BVfav20', 'BVfav21', 'BVfav22', 'BVfav30', 'BVfav31', 'BVfav32',
  ]);
  expect(videos[0]).toMatchObject({ reason: '赞过', pubdate: now });
  expect(videos.slice(1).every(video => video.reason === '收藏过' && video.pubdate === 3)).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(2);

  const single = await followClassics(signal(), ['fav']);
  expect(single.list[0]).toMatchObject({ bvid: shared.bvid, reason: '收藏过', pubdate: 2 });
  expect(single.done).toBe(false);
});

it('preserves the login and empty-following hints and retries a failed first batch', async () => {
  vi.mocked(account).mockResolvedValueOnce(null);
  await expect(followClassics(signal(), ['follow'])).rejects.toThrow('登录后才能看老片回顾');
  vi.mocked(getJSON).mockRejectedValueOnce(new Error('private'));
  await expect(followClassics(signal(), ['follow'])).rejects.toThrow('还没有关注的 UP 主，或关注列表不公开');
  vi.mocked(getJSON).mockResolvedValueOnce({ list: [{ mid: 11 }] });
  vi.mocked(getWbi).mockResolvedValueOnce({ list: { vlist: [{ bvid: 'BVfollow11', created: now - 180 * 86400 }] } });
  await expect(followClassics(signal(), ['follow'])).resolves.toMatchObject({ list: [{ bvid: 'BVfollow11' }], done: true });
});

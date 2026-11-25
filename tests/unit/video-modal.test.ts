import { describe, expect, it, vi } from 'vitest';

const noopObserver = class { observe() {} unobserve() {} disconnect() {} };
vi.stubGlobal('DOMParser', class {
  parseFromString() {
    return { body: { childNodes: [] }, documentElement: { childNodes: [] } };
  }
});
vi.stubGlobal('ResizeObserver', noopObserver);
vi.stubGlobal('IntersectionObserver', noopObserver);
vi.stubGlobal('document', { createElement: () => ({}), cookie: '' });

// DOM/Observer globals must be stubbed before loading UI modules in Node test environment.
const { buildWatchModalUrl, cleanWatchTabUrl, pauseMediaInDocument, resumeMediaInDocument } = await import('../../src/content/ui/video-modal');
describe('video modal helpers', () => {
  it('builds a clean watch modal url with margin_modal=1', () => {
    expect(buildWatchModalUrl('BV1mdxN68E7F')).toBe('https://www.bilibili.com/video/BV1mdxN68E7F/?margin_modal=1');
    expect(buildWatchModalUrl('BV1mdxN68E7F', 3)).toBe('https://www.bilibili.com/video/BV1mdxN68E7F/?margin_modal=1&p=3');
  });

  it('strips margin_modal when maximizing to a full tab', () => {
    expect(cleanWatchTabUrl('https://www.bilibili.com/video/BV1mdxN68E7F/?margin_modal=1&p=2&t=45', 'BV1mdxN68E7F'))
      .toBe('https://www.bilibili.com/video/BV1mdxN68E7F/?p=2&t=45');
    expect(cleanWatchTabUrl('about:blank', 'BV1mdxN68E7F')).toBe('https://www.bilibili.com/video/BV1mdxN68E7F');
  });

  it('pauses and resumes media elements in a document', () => {
    const media = { paused: false, pause: vi.fn(), play: vi.fn(async () => {}) };
    const doc = {
      querySelectorAll: () => [media],
      querySelector: () => null,
    } as unknown as Document;

    expect(pauseMediaInDocument(doc)).toBe(true);
    expect(media.pause).toHaveBeenCalledTimes(1);

    media.paused = true;
    expect(resumeMediaInDocument(doc)).toBe(true);
    expect(media.play).toHaveBeenCalledTimes(1);
  });
});

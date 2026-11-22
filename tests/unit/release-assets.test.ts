import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pickArchive, type ReleaseInfo } from '../../src/shared/releases';

const info = (assets: ReleaseInfo['assets']): ReleaseInfo => ({
  at: Date.now(), tag: '0.60.89', name: 'v0.6.89', url: 'https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.60.89', assets,
});

beforeEach(() => {
  vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://abc/${path}` } });
});

describe('发布包挑选', () => {
  it('Chrome 取 margin.zip，Firefox 取 margin-firefox.zip', () => {
    const assets = [
      { name: 'margin-firefox.zip', url: 'https://github.com/jiuyang5354/bilibili-margin/releases/download/v0.60.89/margin-firefox.zip', size: 10 },
      { name: 'margin.zip', url: 'https://github.com/jiuyang5354/bilibili-margin/releases/download/v0.60.89/margin.zip', size: 20 },
    ];
    expect(pickArchive(info(assets))?.name).toBe('margin.zip');
    vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `moz-extension://abc/${path}` } });
    expect(pickArchive(info(assets))?.name).toBe('margin-firefox.zip');
  });
  it('地址不合规的附件不会被采用，改用约定好的下载地址', () => {
    const evil = [{ name: 'margin.zip', url: 'https://evil.test/margin.zip', size: 1 }];
    expect(pickArchive(info(evil))?.url).toBe('https://github.com/jiuyang5354/bilibili-margin/releases/download/v0.60.89/margin.zip');
    const other = [{ name: 'margin.zip', url: 'https://github.com/other/repo/releases/download/v1.0.0/margin.zip', size: 1 }];
    expect(pickArchive(info(other))?.url).toBe('https://github.com/jiuyang5354/bilibili-margin/releases/download/v0.60.89/margin.zip');
  });
  it('没有附件列表时按 GitHub 的固定命名拼出下载地址', () => {
    expect(pickArchive(info(undefined))?.url).toBe('https://github.com/jiuyang5354/bilibili-margin/releases/download/v0.60.89/margin.zip');
    expect(pickArchive(info([]))?.url).toBe('https://github.com/jiuyang5354/bilibili-margin/releases/download/v0.60.89/margin.zip');
    expect(pickArchive(info([]))?.size).toBe(0);
  });
});

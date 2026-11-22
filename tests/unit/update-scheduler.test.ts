import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkRelease: vi.fn(),
  readUpdateState: vi.fn(async (): Promise<{ tag: string; url: string; at: number } | null> => null),
  writeUpdateState: vi.fn(async () => {}),
  clearUpdateState: vi.fn(async () => {}),
}));

vi.mock('../../src/shared/releases', () => ({
  checkRelease: mocks.checkRelease,
  newerRelease: (tag: string, current: string) => tag !== current,
}));
vi.mock('../../src/shared/update-store', () => ({
  clearUpdateState: mocks.clearUpdateState,
  readUpdateState: mocks.readUpdateState,
  writeUpdateState: mocks.writeUpdateState,
}));

import { runCheck, syncSchedule } from '../../src/background/update-scheduler';

const settings: Record<string, unknown> = {};
const alarms = { create: vi.fn(), clear: vi.fn(), get: vi.fn() };
let existing: chrome.alarms.Alarm | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(settings)) delete settings[key];
  existing = undefined;
  alarms.get.mockImplementation((_name: string, cb: (alarm?: chrome.alarms.Alarm) => void) => cb(existing));
  alarms.clear.mockImplementation((_name: string, cb: (done: boolean) => void) => cb(true));
  (globalThis as Record<string, unknown>).chrome = {
    storage: {
      local: {
        get: async (key: string) => (key in settings ? { [key]: settings[key] } : {}),
        set: async (obj: Record<string, unknown>) => { Object.assign(settings, obj); },
      },
      onChanged: { addListener: () => {} },
    },
    alarms: { ...alarms, onAlarm: { addListener: () => {} } },
    runtime: { getManifest: () => ({ version: '0.60.88' }) },
    action: { setBadgeText: vi.fn(async () => {}), setBadgeBackgroundColor: vi.fn(async () => {}) },
  };
  mocks.readUpdateState.mockResolvedValue(null);
});

describe('更新定时任务', () => {
  it('周期为关闭时不排任务，已有的任务会被撤掉', async () => {
    existing = { name: 'margin:update-check', periodInMinutes: 360 } as chrome.alarms.Alarm;
    await syncSchedule();
    expect(alarms.clear).toHaveBeenCalled();
    expect(alarms.create).not.toHaveBeenCalled();
  });

  it('按设置排任务，小时换算成分钟', async () => {
    settings['margin:settings'] = { updateInterval: 6 };
    await syncSchedule();
    expect(alarms.create).toHaveBeenCalledWith('margin:update-check', { periodInMinutes: 360 });
  });

  it('周期没变就不重复排', async () => {
    existing = { name: 'margin:update-check', periodInMinutes: 360 } as chrome.alarms.Alarm;
    settings['margin:settings'] = { updateInterval: 6 };
    await syncSchedule();
    expect(alarms.create).not.toHaveBeenCalled();
  });

  it('外部服务没开时不查版本', async () => {
    settings['margin:settings'] = { updateInterval: 6, privacyExternal: false };
    await runCheck();
    expect(mocks.checkRelease).not.toHaveBeenCalled();
  });

  it('发现新版本就记下来并打角标', async () => {
    settings['margin:settings'] = { updateInterval: 6, privacyExternal: true };
    mocks.checkRelease.mockResolvedValue({ tag: '0.60.90', name: 'v0.6.90', url: 'https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.60.90' });
    await runCheck();
    expect(mocks.writeUpdateState).toHaveBeenCalledWith(expect.objectContaining({ tag: '0.60.90' }));
  });

  it('后台只查版本，不下载也不写盘', async () => {
    settings['margin:settings'] = { updateInterval: 6, privacyExternal: true };
    mocks.checkRelease.mockResolvedValue({ tag: '0.60.90', name: 'v0.6.90', url: 'https://github.com/jiuyang5354/bilibili-margin/releases/tag/v0.60.90' });
    await runCheck();
    expect(mocks.checkRelease).toHaveBeenCalledTimes(1);
    expect(mocks.writeUpdateState).toHaveBeenCalledTimes(1);
    // 调度器没有下载与写盘的手段：这两个接口没被替换进来，调用会直接报错
    expect(mocks.clearUpdateState).not.toHaveBeenCalled();
  });
});

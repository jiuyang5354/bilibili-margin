import { describe, expect, it } from 'vitest';
import { writeFiles } from '../../src/shared/installer';
import type { ZipFile } from '../../src/shared/zip';

/** 内存版的目录句柄：够 writeFiles 用，也能模拟写到一半失败 */
class FakeFile {
  data: Uint8Array | null = null;
  failOn: string | null = null;
  constructor(private readonly dir: FakeDir) {}
  async getFile() {
    const bytes = this.data ?? new Uint8Array();
    return { arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } as unknown as File;
  }
  async createWritable() {
    const self = this;
    let buffer = new Uint8Array(0);
    return {
      write: async (chunk: Uint8Array) => {
        if (self.failOn) throw new Error('磁盘空间不足');
        buffer = new Uint8Array(chunk);
      },
      close: async () => { self.data = buffer; },
    };
  }
}

class FakeDir {
  files = new Map<string, FakeFile>();
  dirs = new Map<string, FakeDir>();
  /** 写到这些文件时抛错，用来模拟磁盘满或写入被中断；按完整路径匹配 */
  failOn: string[] = [];
  /** 当前目录在整体里的路径前缀，用来拼出完整路径 */
  prefix = '';
  /** 记录写入顺序，用来确认清单最后写 */
  order: string[] = [];
  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FakeFile> {
    let file = this.files.get(name);
    if (!file) {
      if (!options?.create) throw new Error(`没有这个文件：${name}`);
      file = new FakeFile(this);
      this.files.set(name, file);
    }
    const path = `${this.prefix}${name}`;
    file.failOn = this.failOn.includes(path) ? path : null;
    return file;
  }
  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FakeDir> {
    let dir = this.dirs.get(name);
    if (!dir) {
      if (!options?.create) throw new Error(`没有这个目录：${name}`);
      dir = new FakeDir();
      dir.failOn = this.failOn;
      dir.prefix = `${this.prefix}${name}/`;
      this.dirs.set(name, dir);
    }
    return dir;
  }
  async removeEntry(name: string): Promise<void> {
    if (!this.files.has(name)) throw new Error(`没有这个文件：${name}`);
    this.files.delete(name);
  }
  note(path: string): void { this.order.push(path); }
}

const bytes = (text: string) => new TextEncoder().encode(text);
const file = (path: string, text: string): ZipFile => ({ path, data: bytes(text) });
const content = (dir: FakeDir, path: string) => {
  const parts = path.split('/');
  const name = parts.pop()!;
  let target = dir;
  for (const part of parts) target = target.dirs.get(part)!;
  return new TextDecoder().decode(target.files.get(name)?.data ?? new Uint8Array());
};

describe('写扩展目录', () => {
  it('写入所有文件，清单排在最后', async () => {
    const dir = new FakeDir();
    const count = await writeFiles(dir as unknown as FileSystemDirectoryHandle, [
      file('manifest.json', '{"version":"0.60.90"}'),
      file('background.js', 'new background'),
      file('pages/home.js', 'new home'),
    ]);
    expect(count).toBe(3);
    expect(content(dir, 'manifest.json')).toBe('{"version":"0.60.90"}');
    expect(content(dir, 'background.js')).toBe('new background');
    expect(content(dir, 'pages/home.js')).toBe('new home');
  });

  it('写到一半失败时把已经动过的文件还原回去', async () => {
    const dir = new FakeDir();
    dir.files.set('background.js', new FakeFile(dir));
    dir.files.get('background.js')!.data = bytes('old background');
    dir.files.set('manifest.json', new FakeFile(dir));
    dir.files.get('manifest.json')!.data = bytes('{"version":"0.60.89"}');
    dir.failOn = ['pages/home.js'];
    await expect(writeFiles(dir as unknown as FileSystemDirectoryHandle, [
      file('manifest.json', '{"version":"0.60.90"}'),
      file('background.js', 'new background'),
      file('pages/home.js', 'new home'),
    ])).rejects.toThrow('已还原');
    // 旧内容回来了，目录不会停在半新半旧的状态
    expect(content(dir, 'background.js')).toBe('old background');
    expect(content(dir, 'manifest.json')).toBe('{"version":"0.60.89"}');
  });

  it('失败时把原来没有的新文件删掉', async () => {
    const dir = new FakeDir();
    dir.failOn = ['pages/home.js'];
    await expect(writeFiles(dir as unknown as FileSystemDirectoryHandle, [
      file('background.js', 'new background'),
      file('pages/home.js', 'new home'),
    ])).rejects.toThrow('已还原');
    expect(dir.files.has('background.js')).toBe(false);
  });

  it('全部成功时不动原有文件', async () => {
    const dir = new FakeDir();
    dir.files.set('background.js', new FakeFile(dir));
    dir.files.get('background.js')!.data = bytes('old background');
    await writeFiles(dir as unknown as FileSystemDirectoryHandle, [file('background.js', 'new background')]);
    expect(content(dir, 'background.js')).toBe('new background');
  });
});

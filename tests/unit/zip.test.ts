import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { isSafeZipPath, readManifestVersion, unzip } from '../../src/shared/zip';

interface Entry { name: string; data: Buffer; method?: number }

/** 手写一个最小 zip：本地头 + 中央目录 + 结束记录，用来喂给解包器 */
function makeZip(entries: Entry[]): ArrayBuffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const method = entry.method ?? 8;
    const raw = entry.data;
    const payload = method === 0 ? raw : deflateRawSync(raw);
    const name = Buffer.from(entry.name, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(method, 8);
    local.writeUInt32LE(payload.length, 18); local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    locals.push(local, name, payload);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(payload.length, 20); central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + payload.length;
  }
  const directory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12); eocd.writeUInt32LE(offset, 16);
  const buffer = Buffer.concat([...locals, directory, eocd]);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

const decoder = new TextDecoder('utf-8');

describe('zip 解包', () => {
  it('解开 deflate 与 stored 两种条目，并保留子目录结构', async () => {
    const zip = makeZip([
      { name: 'manifest.json', data: Buffer.from('{"version":"0.60.89"}') },
      { name: 'pages/home.js', data: Buffer.from('console.log(1)') },
      { name: 'raw.txt', data: Buffer.from('plain'), method: 0 },
    ]);
    const files = await unzip(zip);
    expect(files.map(file => file.path)).toEqual(['manifest.json', 'pages/home.js', 'raw.txt']);
    expect(decoder.decode(files[1].data)).toBe('console.log(1)');
    expect(decoder.decode(files[2].data)).toBe('plain');
  });

  it('跳过目录条目', async () => {
    const zip = makeZip([{ name: 'pages/', data: Buffer.alloc(0) }, { name: 'pages/home.js', data: Buffer.from('x') }]);
    const files = await unzip(zip);
    expect(files.map(file => file.path)).toEqual(['pages/home.js']);
  });

  it('拒绝越界路径，防止写到目录之外', async () => {
    expect(isSafeZipPath('../evil.js')).toBe(false);
    expect(isSafeZipPath('pages/../../evil.js')).toBe(false);
    expect(isSafeZipPath('/etc/passwd')).toBe(false);
    expect(isSafeZipPath('C:\\Windows\\evil.dll')).toBe(false);
    expect(isSafeZipPath('pages/..\\evil.js')).toBe(false);
    expect(isSafeZipPath('pages/home.js')).toBe(true);
    const zip = makeZip([{ name: '../evil.js', data: Buffer.from('x') }]);
    expect((await unzip(zip)).map(file => file.path)).toEqual([]);
  });

  it('不是 zip 的数据直接报错', async () => {
    await expect(unzip(new TextEncoder().encode('not a zip').buffer as ArrayBuffer)).rejects.toThrow('zip');
  });

  it('读出包里的清单版本', async () => {
    const zip = makeZip([{ name: 'manifest.json', data: Buffer.from('{"version":"0.60.89"}') }]);
    expect(readManifestVersion(await unzip(zip))).toBe('0.60.89');
    const broken = makeZip([{ name: 'other.json', data: Buffer.from('{}') }]);
    expect(readManifestVersion(await unzip(broken))).toBeNull();
  });
});

/**
 * 纯前端 zip 解包（v0.61 自动更新）。
 *
 * 只用浏览器自带的 DecompressionStream 解 deflate，不引第三方库，也不执行包里的任何内容：
 * 解出来的只是一堆字节，写盘和生效由更新页在用户授权的目录里完成。
 * 这里只负责「读包」，不碰文件系统。
 */

/** 坏包保护：条目数与解压后总大小上限，避免解压炸弹把内存撑爆 */
const MAX_ENTRIES = 4096;
const MAX_TOTAL = 64 * 1024 * 1024;

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;
const ZIP64_MARK = 0xffffffff;

export interface ZipFile {
  /** 规范化后的相对路径，用 / 分隔 */
  path: string;
  data: Uint8Array;
}

/**
 * 判断包内路径能不能安全写到目标目录。
 * 拒绝绝对路径、盘符、反斜杠和 .. 段——zip slip 的常见形态都堵掉。
 */
export function isSafeZipPath(name: string): boolean {
  if (!name || name.length > 240) return false;
  if (name.includes('\\')) return false;
  if (name.startsWith('/')) return false;
  if (/^[a-zA-Z]:/.test(name)) return false;
  if (name.includes('\0')) return false;
  return !name.split('/').some(part => part === '..' || part === '.');
}

/** 目录条目（名字以 / 结尾）没有内容，返回 null */
export function zipEntryPath(name: string): string | null {
  if (name.endsWith('/')) return null;
  return isSafeZipPath(name) ? name : null;
}

/** 从尾部往前找中央目录结束记录；注释最长 65535 字节，所以最多回溯 65557 字节 */
function findEocd(view: DataView): number {
  const min = Math.max(0, view.byteLength - 65557);
  for (let i = view.byteLength - 22; i >= min; i--) {
    if (view.getUint32(i, true) !== EOCD_SIG) continue;
    const comment = view.getUint16(i + 20, true);
    if (i + 22 + comment === view.byteLength) return i;
  }
  return -1;
}

/** 用浏览器自带的解压流解开 deflate；stored 直接返回原数据 */
async function decode(data: Uint8Array, method: number): Promise<Uint8Array> {
  if (method === 0) return data;
  if (method !== 8) throw new Error('压缩方式不受支持');
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * 解开一个 zip，返回其中的文件列表（目录条目已剔除）。
 * 只支持 stored 与 deflate：发布用的 zip 由 `zip -9` 生成，就是 deflate。
 */
export async function unzip(buffer: ArrayBuffer): Promise<ZipFile[]> {
  const view = new DataView(buffer);
  const eocd = findEocd(view);
  if (eocd < 0) throw new Error('不是有效的 zip 包');
  const total = view.getUint16(eocd + 10, true);
  const dirOffset = view.getUint32(eocd + 16, true);
  if (total > MAX_ENTRIES) throw new Error('zip 条目过多');
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder('utf-8');
  const files: ZipFile[] = [];
  let at = dirOffset;
  let size = 0;
  for (let i = 0; i < total; i++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== CEN_SIG) throw new Error('zip 中央目录损坏');
    const method = view.getUint16(at + 10, true);
    const compressed = view.getUint32(at + 20, true);
    const uncompressed = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extraLength + commentLength;
    const path = zipEntryPath(name);
    if (!path) continue;
    // zip64 的长度占位值不做支持：这个仓库发布的包远小于 4GB
    if (compressed === ZIP64_MARK || uncompressed === ZIP64_MARK) throw new Error('不支持 zip64 压缩包');
    if (local + 30 > bytes.length || view.getUint32(local, true) !== LOC_SIG) throw new Error('zip 本地文件头损坏');
    const localName = view.getUint16(local + 26, true);
    const localExtra = view.getUint16(local + 28, true);
    const start = local + 30 + localName + localExtra;
    if (start + compressed > bytes.length) throw new Error('zip 文件内容不完整');
    const data = await decode(bytes.subarray(start, start + compressed), method);
    size += data.length;
    if (size > MAX_TOTAL) throw new Error('解压后的文件过大');
    files.push({ path, data });
  }
  return files;
}

/** 从包里取 manifest.json 的版本号，用来核对下载到的包确实是目标版本 */
export function readManifestVersion(files: ZipFile[]): string | null {
  const entry = files.find(file => file.path === 'manifest.json');
  if (!entry) return null;
  try {
    const parsed = JSON.parse(new TextDecoder('utf-8').decode(entry.data)) as { version?: unknown };
    return typeof parsed.version === 'string' ? parsed.version : null;
  } catch { return null; }
}

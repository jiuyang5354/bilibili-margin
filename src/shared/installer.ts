/**
 * 把下载好的发布包写回扩展目录（v0.61）。
 *
 * 浏览器不允许扩展自行改动安装位置，所以这一步只能由用户在更新页里亲手触发。
 *
 * 写入不是原子的：逐个覆盖脚本、清单最后写，中途如果磁盘满或写入被中断，
 * 已经写进去的脚本会是新版、清单还是旧版，目录就恢复不到原状。
 * 所以写入前先把原文件读出来做备份，任何一步失败就用备份逐个还原，
 * 把目录还原到写入之前的样子再报错。
 */
import { readManifestVersion, unzip, type ZipFile } from './zip';

/** 目标目录里得是映间才会写，防止用户选错文件夹把别的东西冲掉 */
export async function isExtensionFolder(dir: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const handle = await dir.getFileHandle('manifest.json');
    const parsed = JSON.parse(await (await handle.getFile()).text()) as { name?: unknown; short_name?: unknown };
    const name = typeof parsed.name === 'string' ? parsed.name : '';
    return parsed.short_name === 'MARGIN' || name === 'MARGIN' || name.includes('MARGIN');
  } catch { return false; }
}

/** 读出某个文件当前的内容；不存在或读不出来都当作 null（写入时新建） */
async function readFile(dir: FileSystemDirectoryHandle, path: string): Promise<Uint8Array | null> {
  const parts = path.split('/');
  const name = parts.pop();
  if (!name) return null;
  try {
    let target = dir;
    for (const part of parts) target = await target.getDirectoryHandle(part);
    const handle = await target.getFileHandle(name);
    return new Uint8Array(await (await handle.getFile()).arrayBuffer());
  } catch { return null; }
}

/** 写一个文件，父目录不存在就建 */
async function writeFile(dir: FileSystemDirectoryHandle, path: string, data: Uint8Array): Promise<void> {
  const parts = path.split('/');
  const name = parts.pop();
  if (!name) return;
  let target = dir;
  for (const part of parts) target = await target.getDirectoryHandle(part, { create: true });
  const handle = await target.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  try { await writable.write(data as unknown as BufferSource); }
  finally { await writable.close(); }
}

/** 删掉一个文件；本来就不在就当没事 */
async function removeFile(dir: FileSystemDirectoryHandle, path: string): Promise<void> {
  const parts = path.split('/');
  const name = parts.pop();
  if (!name) return;
  try {
    let target = dir;
    for (const part of parts) target = await target.getDirectoryHandle(part);
    await target.removeEntry(name);
  } catch { /* 文件本来就不在，无需处理。 */ }
}

/**
 * 写文件。manifest.json 排在最后写：中途失败时目录里还是旧清单，扩展不会半新半旧。
 * 任何一步写失败都会用备份回滚，把已经动过的文件还原回去。
 * 返回实际写入的文件数。
 */
export async function writeFiles(dir: FileSystemDirectoryHandle, files: ZipFile[]): Promise<number> {
  const ordered = [...files].sort((a, b) => (a.path === 'manifest.json' ? 1 : 0) - (b.path === 'manifest.json' ? 1 : 0));
  const backups: (Uint8Array | null)[] = [];
  try {
    for (const file of ordered) {
      backups.push(await readFile(dir, file.path));
      await writeFile(dir, file.path, file.data);
    }
  } catch (error) {
    let broken = false;
    for (let i = 0; i < backups.length; i++) {
      const backup = backups[i];
      try {
        if (backup === null) await removeFile(dir, ordered[i].path);
        else await writeFile(dir, ordered[i].path, backup);
      } catch { broken = true; }
    }
    const reason = error instanceof Error ? error.message : String(error);
    if (broken) throw new Error(`写入中断且没能完全还原，请手动检查扩展目录（${reason}）`);
    throw new Error(`写入中断，扩展目录已还原（${reason}）`);
  }
  return ordered.length;
}

/**
 * 解包并写入。返回实际写入的文件数和包里的版本号。
 * 版本对不上就直接失败，不往目录里写半个版本。
 */
export async function installPackage(dir: FileSystemDirectoryHandle, zip: ArrayBuffer, expectTag: string): Promise<{ files: number; version: string }> {
  const files = await unzip(zip);
  const version = readManifestVersion(files);
  if (!version) throw new Error('更新包里没有 manifest.json');
  if (version !== expectTag) throw new Error(`更新包版本对不上（包内 ${version}，期望 ${expectTag}）`);
  const count = await writeFiles(dir, files);
  return { files: count, version };
}

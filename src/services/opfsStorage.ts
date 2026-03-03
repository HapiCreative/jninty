// ─── Origin Private File System (OPFS) storage service ───
// Provides async file operations backed by the OPFS API.
// Falls back gracefully when OPFS is unavailable (Safari < 15.2, older Firefox).

export const DISPLAY_DIR = "photos/display";
export const ORIGINALS_DIR = "photos/originals";

export function displayPath(photoId: string): string {
  return `${DISPLAY_DIR}/${photoId}.jpg`;
}

export function originalPath(photoId: string): string {
  return `${ORIGINALS_DIR}/${photoId}.jpg`;
}

// ─── Detection ───

let _opfsSupported: boolean | null = null;

export function isOpfsAvailable(): boolean {
  if (_opfsSupported !== null) return _opfsSupported;
  _opfsSupported =
    typeof navigator !== "undefined" &&
    typeof navigator.storage?.getDirectory === "function";
  return _opfsSupported;
}

/** Reset the cached detection result (for testing). */
export function _resetDetection(): void {
  _opfsSupported = null;
}

// ─── Directory traversal ───

async function getNestedDir(
  root: FileSystemDirectoryHandle,
  path: string,
  create: boolean,
): Promise<FileSystemDirectoryHandle | undefined> {
  const parts = path.split("/").filter(Boolean);
  let current = root;
  for (const part of parts) {
    try {
      current = await current.getDirectoryHandle(part, { create });
    } catch {
      return undefined;
    }
  }
  return current;
}

function splitPath(filePath: string): { dir: string; name: string } {
  const lastSlash = filePath.lastIndexOf("/");
  if (lastSlash === -1) return { dir: "", name: filePath };
  return { dir: filePath.slice(0, lastSlash), name: filePath.slice(lastSlash + 1) };
}

// ─── File operations ───

export async function writeFile(path: string, blob: Blob): Promise<void> {
  if (!isOpfsAvailable()) return;
  const root = await navigator.storage.getDirectory();
  const { dir, name } = splitPath(path);

  const parent = dir
    ? await getNestedDir(root, dir, true)
    : root;
  if (!parent) return;

  const fileHandle = await parent.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function readFile(path: string): Promise<Blob | undefined> {
  if (!isOpfsAvailable()) return undefined;
  try {
    const root = await navigator.storage.getDirectory();
    const { dir, name } = splitPath(path);

    const parent = dir
      ? await getNestedDir(root, dir, false)
      : root;
    if (!parent) return undefined;

    const fileHandle = await parent.getFileHandle(name);
    return await fileHandle.getFile();
  } catch {
    return undefined;
  }
}

export async function deleteFile(path: string): Promise<void> {
  if (!isOpfsAvailable()) return;
  try {
    const root = await navigator.storage.getDirectory();
    const { dir, name } = splitPath(path);

    const parent = dir
      ? await getNestedDir(root, dir, false)
      : root;
    if (!parent) return;

    await parent.removeEntry(name);
  } catch {
    // File doesn't exist — no-op
  }
}

export async function getDirectorySize(dirPath: string): Promise<number> {
  if (!isOpfsAvailable()) return 0;
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await getNestedDir(root, dirPath, false);
    if (!dir) return 0;
    return await sumDirectory(dir);
  } catch {
    return 0;
  }
}

// TypeScript DOM lib does not include FileSystemDirectoryHandle.entries()
// even though it exists in all browsers that support OPFS. Cast to work around.
type DirEntries = AsyncIterable<
  [string, FileSystemDirectoryHandle | FileSystemFileHandle]
>;

function dirEntries(dir: FileSystemDirectoryHandle): DirEntries {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (dir as any).entries() as DirEntries;
}

async function sumDirectory(dir: FileSystemDirectoryHandle): Promise<number> {
  let total = 0;
  for await (const [, handle] of dirEntries(dir)) {
    if (handle.kind === "file") {
      const file = await (handle as FileSystemFileHandle).getFile();
      total += file.size;
    } else {
      total += await sumDirectory(handle as FileSystemDirectoryHandle);
    }
  }
  return total;
}

export async function clearDirectory(dirPath: string): Promise<void> {
  if (!isOpfsAvailable()) return;
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await getNestedDir(root, dirPath, false);
    if (!dir) return;

    const names: string[] = [];
    for await (const [name] of dirEntries(dir)) {
      names.push(name);
    }
    for (const name of names) {
      await dir.removeEntry(name, { recursive: true });
    }
  } catch {
    // Directory doesn't exist — no-op
  }
}

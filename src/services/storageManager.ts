import { PythonFile } from '../types/ide';

export interface StorageEstimateInfo {
  supported: boolean;
  usageBytes: number;
  quotaBytes: number;
  persisted: boolean;
}

export interface DirectoryHandleLike {
  name: string;
  kind: 'directory';
  values: () => AsyncIterable<FileSystemHandleLike>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemFileHandleLike>;
  queryPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

interface FileSystemHandleLike {
  kind: 'file' | 'directory';
  name: string;
}

interface FileSystemFileHandleLike extends FileSystemHandleLike {
  kind: 'file';
  getFile: () => Promise<File>;
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
  }>;
}

export function supportsDirectoryAccess(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function getStorageStatus(): Promise<StorageEstimateInfo> {
  try {
    const hasEstimate = typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function';
    const hasPersisted = typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persisted === 'function';
    const estimate = hasEstimate ? await navigator.storage.estimate() : { usage: 0, quota: 0 };
    const persisted = hasPersisted ? await navigator.storage.persisted() : false;
    return {
      supported: hasEstimate,
      usageBytes: estimate.usage ?? 0,
      quotaBytes: estimate.quota ?? 0,
      persisted,
    };
  } catch {
    return {
      supported: false,
      usageBytes: 0,
      quotaBytes: 0,
      persisted: false,
    };
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
      return await navigator.storage.persist();
    }
    return false;
  } catch {
    return false;
  }
}

export async function requestLinkedDirectory(): Promise<DirectoryHandleLike | null> {
  const win = window as unknown as {
    showDirectoryPicker?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<DirectoryHandleLike>;
  };
  if (typeof win.showDirectoryPicker !== 'function') {
    return null;
  }
  const handle = await win.showDirectoryPicker({ mode: 'readwrite' });
  if (handle.requestPermission) {
    const state = await handle.requestPermission({ mode: 'readwrite' });
    if (state !== 'granted') {
      throw new Error('未取得資料夾讀寫授權');
    }
  }
  return handle;
}

const WORKSPACE_TEXT_EXTENSIONS = [
  '.py',
  '.json',
  '.csv',
  '.txt',
  '.md',
  '.html',
  '.xml',
  '.yaml',
  '.yml',
  '.ini',
  '.cfg',
  '.log',
  '.sh',
  '.toml',
];

function isSupportedWorkspaceFilename(name: string): boolean {
  const lower = name.toLowerCase();
  return lower === 'requirements.txt' || WORKSPACE_TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export async function readPythonFilesFromDirectory(handle: DirectoryHandleLike): Promise<PythonFile[]> {
  const imported: PythonFile[] = [];
  for await (const entry of handle.values()) {
    if (entry.kind === 'file' && !entry.name.startsWith('.') && isSupportedWorkspaceFilename(entry.name)) {
      const fileHandle = entry as FileSystemFileHandleLike;
      const file = await fileHandle.getFile();
      if (file.size > 512 * 1024) continue;
      const text = await file.text();
      imported.push({
        id: `fs-${entry.name}-${file.lastModified}`,
        name: entry.name,
        content: text,
        updatedAt: file.lastModified || Date.now(),
      });
    }
  }
  return imported;
}

export async function writeFilesToDirectory(
  handle: DirectoryHandleLike,
  files: PythonFile[]
): Promise<number> {
  if (handle.queryPermission) {
    const state = await handle.queryPermission({ mode: 'readwrite' });
    if (state !== 'granted' && handle.requestPermission) {
      const next = await handle.requestPermission({ mode: 'readwrite' });
      if (next !== 'granted') {
        throw new Error('裝置拒絕寫入資料夾權限');
      }
    }
  }
  let written = 0;
  for (const f of files) {
    const fh = await handle.getFileHandle(f.name, { create: true });
    const writable = await fh.createWritable();
    await writable.write(f.content);
    await writable.close();
    written += 1;
  }
  return written;
}

export function formatStorageBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  if (mb >= 1) {
    return `${mb.toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

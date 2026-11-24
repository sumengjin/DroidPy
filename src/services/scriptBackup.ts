import { PythonFile, ScriptBackupSnapshot } from '../types/ide';

const BACKUP_STORAGE_KEY = 'droidpy_script_backups_v1';

function calcFilesBytes(files: PythonFile[]): number {
  let bytes = 0;
  for (const f of files) {
    bytes += new Blob([f.content]).size;
  }
  return bytes;
}

function makeBackupId(): string {
  return `bak-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function isBackupSnapshot(value: unknown): value is ScriptBackupSnapshot {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ScriptBackupSnapshot>;
  return (
    typeof item.id === 'string' &&
    typeof item.createdAt === 'number' &&
    typeof item.label === 'string' &&
    Array.isArray(item.files) &&
    item.files.every(
      (file) =>
        Boolean(file) &&
        typeof file === 'object' &&
        typeof (file as Partial<PythonFile>).name === 'string' &&
        typeof (file as Partial<PythonFile>).content === 'string'
    )
  );
}

/**
 * Strictly reads the backup store. A malformed store must never be treated as
 * empty during a write, because doing so could overwrite the only recoverable
 * copy of the user's snapshots.
 */
function readSnapshotsStrict(): ScriptBackupSnapshot[] {
  const raw = localStorage.getItem(BACKUP_STORAGE_KEY);
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('備份資料格式異常；為避免覆蓋原始備份，已停止操作。請先匯出或複製原始備份資料。');
  }

  if (!Array.isArray(parsed) || !parsed.every(isBackupSnapshot)) {
    throw new Error('備份資料不完整或格式不相容；為避免遺失資料，已停止操作。');
  }

  return [...parsed].sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Writes exactly the requested snapshot list. localStorage.setItem is atomic
 * for a single key: on quota failure the previous value remains untouched.
 * Never evict older snapshots automatically to make a new backup fit.
 */
function writeSnapshots(list: ScriptBackupSnapshot[]): ScriptBackupSnapshot[] {
  localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(list));
  return [...list].sort((a, b) => b.createdAt - a.createdAt);
}

export function listScriptBackups(): ScriptBackupSnapshot[] {
  try {
    return readSnapshotsStrict();
  } catch {
    // Read-only UI listing may degrade to empty, but all write operations use
    // readSnapshotsStrict() and therefore refuse to overwrite damaged data.
    return [];
  }
}

export function createScriptBackup(
  files: PythonFile[],
  label?: string,
  reason: ScriptBackupSnapshot['reason'] = 'manual'
): ScriptBackupSnapshot {
  const clonedFiles: PythonFile[] = files.map((f) => ({
    id: String(f.id),
    name: String(f.name),
    content: String(f.content),
    updatedAt: typeof f.updatedAt === 'number' ? f.updatedAt : Date.now(),
  }));

  const now = Date.now();
  const d = new Date(now);
  const stamp = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(
    d.getHours()
  ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const snapshot: ScriptBackupSnapshot = {
    id: makeBackupId(),
    createdAt: now,
    label: (label ?? '').trim() || `Snapshot ${stamp}`,
    reason,
    fileCount: clonedFiles.length,
    totalBytes: calcFilesBytes(clonedFiles),
    files: clonedFiles,
  };

  // Do not silently evict any previous backup. If storage is full, this throws
  // and the caller must report failure; the previous stored value is retained.
  const existing = readSnapshotsStrict();
  writeSnapshots([snapshot, ...existing]);
  return snapshot;
}

export function deleteScriptBackup(id: string): ScriptBackupSnapshot[] {
  const next = readSnapshotsStrict().filter((b) => b.id !== id);
  return writeSnapshots(next);
}

export function exportScriptBackupJson(snapshot: ScriptBackupSnapshot): string {
  return JSON.stringify(
    {
      format: 'droidpy-script-backup-v1',
      exportedAt: Date.now(),
      snapshot,
    },
    null,
    2
  );
}

export function parseScriptBackupJson(raw: string): ScriptBackupSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as {
      format?: string;
      snapshot?: Partial<ScriptBackupSnapshot>;
      files?: unknown;
      label?: string;
    };
    const srcFiles = Array.isArray(parsed?.snapshot?.files)
      ? parsed.snapshot.files
      : Array.isArray(parsed?.files)
      ? parsed.files
      : null;
    if (!srcFiles || srcFiles.length === 0) return null;

    const validFiles: PythonFile[] = [];
    for (const item of srcFiles) {
      if (item && typeof item === 'object') {
        const rec = item as Partial<PythonFile>;
        if (typeof rec.name === 'string' && rec.name.trim() && typeof rec.content === 'string') {
          validFiles.push({
            id: typeof rec.id === 'string' && rec.id ? rec.id : `imp-${Date.now()}-${validFiles.length}`,
            name: rec.name.trim(),
            content: rec.content,
            updatedAt: typeof rec.updatedAt === 'number' ? rec.updatedAt : Date.now(),
          });
        }
      }
    }
    if (validFiles.length === 0) return null;

    const rawLabel =
      (typeof parsed?.snapshot?.label === 'string' && parsed.snapshot.label.trim()) ||
      (typeof parsed?.label === 'string' && parsed.label.trim()) ||
      'Imported Backup';

    return createScriptBackup(validFiles, rawLabel, 'import');
  } catch {
    return null;
  }
}

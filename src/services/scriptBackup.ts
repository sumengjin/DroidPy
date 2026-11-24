import { PythonFile, ScriptBackupSnapshot } from '../types/ide';

const BACKUP_STORAGE_KEY = 'droidpy_script_backups_v1';
const MAX_BACKUPS = 25;

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

function writeSnapshots(list: ScriptBackupSnapshot[]): ScriptBackupSnapshot[] {
  let trimmed = list.slice(0, MAX_BACKUPS);
  while (trimmed.length > 0) {
    try {
      localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(trimmed));
      return trimmed;
    } catch {
      // Drop oldest snapshot on storage quota pressure
      trimmed = trimmed.slice(0, trimmed.length - 1);
    }
  }
  return [];
}

export function listScriptBackups(): ScriptBackupSnapshot[] {
  try {
    const raw = localStorage.getItem(BACKUP_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is ScriptBackupSnapshot =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.createdAt === 'number' &&
          Array.isArray(item.files)
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
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

  const existing = listScriptBackups();
  writeSnapshots([snapshot, ...existing]);
  return snapshot;
}

export function deleteScriptBackup(id: string): ScriptBackupSnapshot[] {
  const next = listScriptBackups().filter((b) => b.id !== id);
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

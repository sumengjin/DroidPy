import React, { useCallback, useEffect, useState } from 'react';
import {
  Folder,
  FileText,
  ArrowUp,
  FolderPlus,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Save,
  FolderSync,
  Trash2,
  Loader2,
  HardDrive,
} from 'lucide-react';
import { PythonFile, SdcardEntry, SdcardStatusInfo, TermuxConfig } from '../types/ide';
import {
  backupWorkspaceToSdcard,
  createSdcardFolder,
  deleteSdcardPath,
  listSdcardDirectory,
  readSdcardFile,
  writeSdcardFile,
  getSdcardStatus,
} from '../services/termuxBridge';
import { useI18n } from '../services/i18n';

interface InternalStoragePanelProps {
  termuxConfig: TermuxConfig;
  files: PythonFile[];
  activeFile: PythonFile;
  onOpenSdcardFile: (filename: string, content: string) => void;
  onNotify: (msg: string) => void;
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const InternalStoragePanel: React.FC<InternalStoragePanelProps> = ({
  termuxConfig,
  files,
  activeFile,
  onOpenSdcardFile,
  onNotify,
}) => {
  const { t } = useI18n();
  const [status, setStatus] = useState<SdcardStatusInfo | null>(null);
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<SdcardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadDirectory = useCallback(
    async (relPath: string) => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const [st, list] = await Promise.all([
          getSdcardStatus(termuxConfig),
          listSdcardDirectory(termuxConfig, relPath),
        ]);
        setStatus(st);
        setCurrentPath(list.currentPath || relPath);
        setEntries(Array.isArray(list.entries) ? list.entries : []);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [termuxConfig]
  );

  useEffect(() => {
    void loadDirectory(currentPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onResume = () => {
      if (document.visibilityState === 'visible') {
        void loadDirectory(currentPath);
      }
    };
    window.addEventListener('focus', onResume);
    document.addEventListener('visibilitychange', onResume);
    return () => {
      window.removeEventListener('focus', onResume);
      document.removeEventListener('visibilitychange', onResume);
    };
  }, [currentPath, loadDirectory]);

  const isGranted = Boolean(status?.granted || window.DroidPyNative?.hasStoragePermission?.());

  const handleRequestPermission = () => {
    window.DroidPyNative?.requestStoragePermission?.();
    window.setTimeout(() => {
      void loadDirectory(currentPath);
    }, 1000);
  };

  const handleGoUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const parent = parts.join('/');
    setConfirmDeletePath(null);
    void loadDirectory(parent);
  };

  const handleOpenEntry = async (entry: SdcardEntry) => {
    if (entry.isDir) {
      setConfirmDeletePath(null);
      await loadDirectory(entry.relPath);
      return;
    }
    setBusyAction(`open:${entry.relPath}`);
    try {
      const res = await readSdcardFile(termuxConfig, entry.relPath);
      onOpenSdcardFile(res.name || entry.name, res.content);
      onNotify(t('sd_toast_loaded', { name: res.name || entry.name }));
    } catch (err) {
      onNotify(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveActiveHere = async () => {
    if (!activeFile) return;
    const targetRel = currentPath ? `${currentPath}/${activeFile.name}` : activeFile.name;
    setBusyAction('save');
    try {
      const res = await writeSdcardFile(termuxConfig, targetRel, activeFile.content);
      onNotify(t('sd_toast_saved', { path: res.path || `/sdcard/${targetRel}` }));
      await loadDirectory(currentPath);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  };

  const handleBackupAllToDroidPy = async () => {
    setBusyAction('backup');
    try {
      const res = await backupWorkspaceToSdcard(termuxConfig, files, 'DroidPy');
      onNotify(t('sd_toast_exported', { count: res.count, path: res.dir }));
      if (currentPath === '' || currentPath === 'DroidPy') {
        await loadDirectory(currentPath);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newFolderName.replace(/[/\\]/g, '').trim();
    if (!clean) return;
    const targetRel = currentPath ? `${currentPath}/${clean}` : clean;
    setBusyAction('mkdir');
    try {
      await createSdcardFolder(termuxConfig, targetRel);
      setNewFolderName('');
      onNotify(t('sd_toast_mkdir', { name: clean }));
      await loadDirectory(currentPath);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteEntry = async (entry: SdcardEntry) => {
    setBusyAction(`del:${entry.relPath}`);
    try {
      await deleteSdcardPath(termuxConfig, entry.relPath);
      setConfirmDeletePath(null);
      onNotify(t('sd_toast_deleted', { name: entry.name }));
      await loadDirectory(currentPath);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  };

  const rootDisplay = status?.rootPath || window.DroidPyNative?.getInternalStoragePath?.() || '/storage/emulated/0';
  const fullDisplayPath = currentPath ? `${rootDisplay}/${currentPath}` : rootDisplay;

  return (
    <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-5 space-y-4">
      {/* Header & Permission Status */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-[var(--ide-text)]">
            <HardDrive className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
            <span>{t('sd_title')}</span>
          </h3>
          <p className="text-xs text-[var(--ide-text-muted)] mt-1 leading-relaxed">
            {t('sd_desc')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span
            className={`text-xs font-semibold inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
              isGranted
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}
          >
            {isGranted ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
            <span>{isGranted ? t('sd_status_ok') : t('sd_status_no')}</span>
          </span>

          <button
            type="button"
            onClick={() => void loadDirectory(currentPath)}
            disabled={loading}
            className="min-h-[36px] px-3 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-xs font-medium inline-flex items-center gap-1.5 hover:border-[var(--ide-accent)] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t('sd_refresh_btn')}</span>
          </button>
        </div>
      </div>

      {/* Permission Warning Callout if not granted */}
      {!isGranted && (
        <div className="rounded-xl border border-amber-400/50 bg-amber-50/70 dark:bg-amber-950/25 p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed min-w-0 flex-1">
            {t('sd_status_no')}
          </div>
          <button
            type="button"
            onClick={handleRequestPermission}
            className="min-h-[38px] px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{t('sd_grant_btn')}</span>
          </button>
        </div>
      )}

      {/* Action Buttons: Save Active & Backup Project */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleSaveActiveHere()}
          disabled={!!busyAction || !isGranted}
          className="min-h-[40px] px-3.5 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-45 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
        >
          {busyAction === 'save' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>{t('sd_save_active_btn')} ({activeFile?.name})</span>
        </button>

        <button
          type="button"
          onClick={() => void handleBackupAllToDroidPy()}
          disabled={!!busyAction || !isGranted}
          className="min-h-[40px] px-3.5 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-accent)] disabled:opacity-45 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
        >
          {busyAction === 'backup' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--ide-accent)]" />
          ) : (
            <FolderSync className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
          )}
          <span>{t('sd_export_proj_btn')}</span>
        </button>

        {isGranted && (
          <button
            type="button"
            onClick={() => void loadDirectory('DroidPy')}
            className="min-h-[40px] px-3 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-accent)] text-xs font-mono text-[var(--ide-accent-text)] transition-colors"
          >
            /sdcard/DroidPy
          </button>
        )}
      </div>

      {/* Path Bar + Mkdir */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={handleGoUp}
            disabled={!currentPath || loading}
            className="min-h-[34px] px-2.5 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] text-xs font-medium inline-flex items-center gap-1 disabled:opacity-40 hover:border-[var(--ide-accent)] shrink-0"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            <span>{t('sd_up_btn')}</span>
          </button>
          <span className="font-mono text-xs text-[var(--ide-text)] truncate" title={fullDisplayPath}>
            {fullDisplayPath}
          </span>
        </div>

        <form onSubmit={(e) => void handleCreateFolder(e)} className="flex items-center gap-1.5 shrink-0">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder={t('sd_mkdir_placeholder')}
            disabled={!isGranted}
            className="w-32 sm:w-40 min-h-[34px] px-2.5 rounded-lg bg-[var(--ide-surface)] border border-[var(--ide-border)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
          />
          <button
            type="submit"
            disabled={!newFolderName.trim() || !isGranted || !!busyAction}
            className="min-h-[34px] px-2.5 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] hover:border-[var(--ide-accent)] disabled:opacity-40 text-xs font-medium inline-flex items-center gap-1"
          >
            <FolderPlus className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
            <span>{t('sd_mkdir_btn')}</span>
          </button>
        </form>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-300 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Directory Listing */}
      <div className="rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] divide-y divide-[var(--ide-border)] max-h-72 overflow-y-auto ide-scroll">
        {loading && entries.length === 0 ? (
          <div className="p-6 flex items-center justify-center gap-2 text-xs text-[var(--ide-text-muted)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading...</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-5 text-center text-xs text-[var(--ide-text-muted)]">
            {t('sd_empty_dir')}
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.relPath}
              className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-[var(--ide-surface)] transition-colors"
            >
              <button
                type="button"
                onClick={() => void handleOpenEntry(entry)}
                disabled={!!busyAction}
                className="flex-1 min-w-0 min-h-[38px] flex items-center gap-2.5 text-left"
              >
                {entry.isDir ? (
                  <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs font-medium text-[var(--ide-text)] truncate">
                    {entry.name}
                  </div>
                  {!entry.isDir && (
                    <div className="text-[11px] text-[var(--ide-text-muted)] tabular-nums">
                      {formatSize(entry.size)}
                    </div>
                  )}
                </div>
              </button>

              {confirmDeletePath === entry.relPath ? (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleDeleteEntry(entry)}
                    disabled={!!busyAction}
                    className="min-h-[32px] px-2.5 rounded-lg bg-red-600 text-white text-[11px] font-medium"
                  >
                    {t('sd_delete_confirm')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeletePath(null)}
                    className="min-h-[32px] px-2 rounded-lg border border-[var(--ide-border)] text-[11px]"
                  >
                    {t('files_cancel')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 shrink-0">
                  {!entry.isDir && (
                    <button
                      type="button"
                      onClick={() => void handleOpenEntry(entry)}
                      className="min-h-[32px] px-2.5 rounded-lg bg-[var(--ide-accent-soft)] text-[var(--ide-accent-text)] text-[11px] font-medium whitespace-nowrap"
                    >
                      {t('sd_open_file')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmDeletePath(entry.relPath)}
                    aria-label={t('files_delete')}
                    className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[var(--ide-text-muted)] hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

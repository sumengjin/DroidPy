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
import {
  AppStorageUsageInfo,
  PythonFile,
  SdcardEntry,
  SdcardStatusInfo,
  TermuxConfig,
} from '../types/ide';
import {
  backupWorkspaceToSdcard,
  cleanupAppStorage,
  createSdcardFolder,
  deleteSdcardPath,
  getAppStorageUsage,
  listSdcardDirectory,
  readSdcardFile,
  writeSdcardFile,
  getSdcardStatus,
} from '../services/termuxBridge';
import { useI18n } from '../services/i18n';

interface InternalStoragePanelProps {
  mode?: 'all' | 'sdcard' | 'cache';
  termuxConfig: TermuxConfig;
  files: PythonFile[];
  activeFile: PythonFile;
  onOpenSdcardFile: (filename: string, content: string, path: string) => void;
  onNotify: (msg: string) => void;
  fullScreen?: boolean;
  initialPath?: string;
  basePath?: string;
  onPathChange?: (path: string) => void;
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const InternalStoragePanel: React.FC<InternalStoragePanelProps> = ({
  mode = 'all',
  termuxConfig,
  files,
  activeFile,
  onOpenSdcardFile,
  onNotify,
  fullScreen = false,
  initialPath = 'DroidPy',
  basePath = 'DroidPy',
  onPathChange,
}) => {
  const { t } = useI18n();
  const [status, setStatus] = useState<SdcardStatusInfo | null>(null);
  const [appUsage, setAppUsage] = useState<AppStorageUsageInfo | null>(null);
  const [cleaningCache, setCleaningCache] = useState(false);
  const [currentPath, setCurrentPath] = useState(initialPath);
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
        const pathParts = relPath.replace(/\\/g, '/').split('/').filter((part) => part && part !== '.');
        if (pathParts.includes('..')) throw new Error(t('sd_path_blocked'));
        const normalizedPath = pathParts.join('/');
        const safePath = normalizedPath || basePath;
        if (safePath !== basePath && !safePath.startsWith(`${basePath}/`)) {
          throw new Error(t('sd_path_blocked'));
        }
        const [st, usage] = await Promise.all([
          getSdcardStatus(termuxConfig),
          getAppStorageUsage(termuxConfig),
        ]);
        setStatus(st);
        if (usage) setAppUsage(usage);
        let list;
        try {
          list = await listSdcardDirectory(termuxConfig, safePath);
        } catch (firstError) {
          if (safePath !== basePath || !st.granted) throw firstError;
          // First launch: create the fixed DroidPy home folder if it does not exist yet.
          try { await createSdcardFolder(termuxConfig, basePath); } catch { /* It may already exist. */ }
          list = await listSdcardDirectory(termuxConfig, safePath);
        }
        const resolvedPath = (list.currentPath || safePath).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        const resolvedParts = resolvedPath.split('/').filter(Boolean);
        if (resolvedParts.includes('..') || (resolvedPath !== basePath && !resolvedPath.startsWith(`${basePath}/`))) {
          throw new Error(t('sd_path_blocked'));
        }
        setCurrentPath(resolvedPath);
        onPathChange?.(resolvedPath);
        setEntries(Array.isArray(list.entries) ? list.entries : []);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [termuxConfig, basePath, onPathChange, t]
  );

  useEffect(() => {
    if (mode === 'all' || mode === 'sdcard') {
      void loadDirectory(currentPath);
    }
    // The cache-only view must not initialize or browse shared storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode !== 'cache') return;
    let cancelled = false;
    void getAppStorageUsage(termuxConfig)
      .then((usage) => {
        if (!cancelled && usage) setAppUsage(usage);
      })
      .catch((err) => {
        if (!cancelled) setErrorMsg(err instanceof Error ? err.message : String(err));
      });
    return () => { cancelled = true; };
  }, [mode, termuxConfig]);

  useEffect(() => {
    const onResume = () => {
      if ((mode === 'all' || mode === 'sdcard') && document.visibilityState === 'visible') {
        void loadDirectory(currentPath);
      }
    };
    window.addEventListener('focus', onResume);
    document.addEventListener('visibilitychange', onResume);
    return () => {
      window.removeEventListener('focus', onResume);
      document.removeEventListener('visibilitychange', onResume);
    };
  }, [currentPath, loadDirectory, mode]);

  const isGranted = Boolean(status?.granted || window.DroidPyNative?.hasStoragePermission?.());

  const handleRequestPermission = () => {
    window.DroidPyNative?.requestStoragePermission?.();
    window.setTimeout(() => {
      void loadDirectory(currentPath);
    }, 1000);
  };

  const handleGoUp = () => {
    if (!currentPath || currentPath === basePath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const candidate = parts.join('/');
    const parent = candidate === basePath || candidate.startsWith(`${basePath}/`) ? candidate : basePath;
    setConfirmDeletePath(null);
    void loadDirectory(parent);
  };

  const isInsideBasePath = (path: string) => {
    const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
    const normalized = parts.join('/');
    return !parts.includes('..') && (normalized === basePath || normalized.startsWith(`${basePath}/`));
  };

  const handleOpenEntry = async (entry: SdcardEntry) => {
    if (!isInsideBasePath(entry.relPath)) {
      onNotify(t('sd_path_blocked'));
      return;
    }
    if (entry.isDir) {
      setConfirmDeletePath(null);
      await loadDirectory(entry.relPath);
      return;
    }
    setBusyAction(`open:${entry.relPath}`);
    try {
      const res = await readSdcardFile(termuxConfig, entry.relPath);
      onOpenSdcardFile(res.name || entry.name, res.content, res.relPath || entry.relPath);
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
    if (!clean || clean === '.' || clean === '..') return;
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
    if (!isInsideBasePath(entry.relPath)) {
      onNotify(t('sd_path_blocked'));
      return;
    }
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

  const handleCleanupAppCache = async () => {
    if (cleaningCache) return;
    setCleaningCache(true);
    try {
      const res = await cleanupAppStorage(termuxConfig);
      if (res?.usageAfter) {
        setAppUsage(res.usageAfter);
      } else {
        const fresh = await getAppStorageUsage(termuxConfig);
        if (fresh) setAppUsage(fresh);
      }
      onNotify(t('sd_app_cache_freed', { size: formatSize(res?.freedBytes ?? 0) }));
    } finally {
      setCleaningCache(false);
    }
  };

  const rootDisplay = status?.rootPath || window.DroidPyNative?.getInternalStoragePath?.() || '/storage/emulated/0';
  const fullDisplayPath = currentPath ? `${rootDisplay}/${currentPath}` : rootDisplay;

  const showSdcard = mode === 'all' || mode === 'sdcard';
  const showCache = mode === 'all' || mode === 'cache';

  return (
    <div className={fullScreen ? "dp-panel p-3.5 sm:p-5 space-y-4 min-w-0 h-full flex flex-col overflow-hidden" : "dp-panel p-3.5 sm:p-5 space-y-4 min-w-0"}>
      {/* Header & Permission Status */}
      {showSdcard && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2.5">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-[var(--ide-text)]">
                <HardDrive className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
                <span className="truncate">{t('sd_title')}</span>
              </h3>
              <p className="text-xs text-[var(--ide-text-muted)] mt-0.5 leading-snug">
                {t('sd_desc')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span
                className={`text-xs font-semibold inline-flex items-center gap-1 ${
                  isGranted
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {isGranted ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                <span>{isGranted ? t('sd_status_ok') : t('sd_status_no')}</span>
              </span>

              <button
                type="button"
                onClick={() => void loadDirectory(currentPath)}
                disabled={loading}
                className="min-h-[38px] px-3 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-xs font-medium inline-flex items-center gap-1.5 hover:border-[var(--ide-accent)] transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{t('sd_refresh_btn')}</span>
              </button>
            </div>
          </div>

          {!isGranted && (
            <div className="rounded-xl border border-amber-400/50 bg-amber-50/70 dark:bg-amber-950/25 p-3 flex flex-wrap items-center justify-between gap-2.5">
              <div className="text-xs text-amber-800 dark:text-amber-200 leading-snug min-w-0 flex-1">
                {t('sd_status_no')}
              </div>
              <button
                type="button"
                onClick={handleRequestPermission}
                className="min-h-[38px] px-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{t('sd_grant_btn')}</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* App Private Runtime & Reclaimable Cache Cleanup */}
      {showCache && (appUsage || mode === 'cache') && (
        <div className="rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-xs font-semibold text-[var(--ide-text)]">
              {t('sd_app_cache_title')}
            </div>
            <p className="text-[11px] text-[var(--ide-text-muted)] leading-snug">
              {t('sd_app_cache_desc')}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono tabular-nums text-[var(--ide-text-muted)]">
              <span>{t('sd_app_cache_usr')}: {formatSize(appUsage?.usrBytes ?? 0)}</span>
              <span className={(appUsage?.reclaimableBytes ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>
                {t('sd_app_cache_reclaimable')}: {formatSize(appUsage?.reclaimableBytes ?? 0)}
              </span>
            </div>
          </div>
          <button
            type="button"
            disabled={cleaningCache || !appUsage}
            onClick={() => void handleCleanupAppCache()}
            className="min-h-[38px] px-3.5 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors"
          >
            {cleaningCache ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span>{cleaningCache ? t('sd_app_cache_cleaning') : t('sd_app_cache_clean_btn')}</span>
          </button>
        </div>
      )}

      {/* Action Buttons: Save Active & Backup Project */}
      {showSdcard && (
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => void handleSaveActiveHere()}
            disabled={!!busyAction || !isGranted}
            className="min-h-[42px] min-w-0 max-w-full overflow-hidden px-3.5 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-45 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            {busyAction === 'save' ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Save className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate">{t('sd_save_active_btn')} ({activeFile?.name})</span>
          </button>

          <button
            type="button"
            onClick={() => void handleBackupAllToDroidPy()}
            disabled={!!busyAction || !isGranted}
            className="min-h-[42px] min-w-0 max-w-full px-3.5 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-accent)] disabled:opacity-45 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            {busyAction === 'backup' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--ide-accent)] shrink-0" />
            ) : (
              <FolderSync className="w-3.5 h-3.5 text-[var(--ide-accent)] shrink-0" />
            )}
            <span className="truncate">{t('sd_export_proj_btn')}</span>
          </button>
        </div>
      )}

      {/* Path Bar + Mkdir */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)]">
        <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto flex-1">
          <button
            type="button"
            onClick={handleGoUp}
            disabled={!currentPath || currentPath === basePath || loading}
            className="min-h-[34px] px-2.5 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] text-xs font-medium inline-flex items-center gap-1 disabled:opacity-40 hover:border-[var(--ide-accent)] shrink-0"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            <span>{t('sd_up_btn')}</span>
          </button>
          <span className="font-mono text-xs text-[var(--ide-text)] truncate" title={fullDisplayPath}>
            {fullDisplayPath}
          </span>
        </div>

        <form onSubmit={(e) => void handleCreateFolder(e)} className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder={t('sd_mkdir_placeholder')}
            disabled={!isGranted}
            className="flex-1 sm:flex-initial min-w-0 sm:w-40 min-h-[34px] px-2.5 rounded-lg bg-[var(--ide-surface)] border border-[var(--ide-border)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
          />
          <button
            type="submit"
            disabled={!newFolderName.trim() || !isGranted || !!busyAction}
            className="min-h-[34px] px-2.5 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] hover:border-[var(--ide-accent)] disabled:opacity-40 text-xs font-medium inline-flex items-center gap-1 shrink-0"
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
      <div className={fullScreen ? "rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] divide-y divide-[var(--ide-border)] overflow-y-auto ide-scroll flex-1 min-h-0" : "rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] divide-y divide-[var(--ide-border)] max-h-72 overflow-y-auto ide-scroll"}>
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
        </>
      )}
    </div>
  );
};

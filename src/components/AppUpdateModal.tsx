import React, { useEffect, useState } from 'react';
import {
  X,
  Download,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Loader2,
  PackageCheck,
} from 'lucide-react';
import {
  AppReleaseInfo,
  AppUpdateCheckResult,
  BUILTIN_LOCAL_RELEASES,
  NativeApkDownloadEvent,
  normalizeVersionStr,
  triggerInAppApkDownload,
} from '../services/appUpdater';
import { useI18n } from '../services/i18n';
import { APP_VERSION, saveGithubRepo } from '../version';
import { formatStorageBytes } from '../services/storageManager';

interface AppUpdateModalProps {
  open: boolean;
  onClose: () => void;
  updateResult: AppUpdateCheckResult | null;
  checking: boolean;
  repoSlug: string;
  onChangeRepoSlug: (repo: string) => void;
  onCheckNow: (repoOverride?: string) => Promise<void>;
  onNotify: (msg: string) => void;
}

export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({
  open,
  onClose,
  updateResult,
  checking,
  repoSlug,
  onChangeRepoSlug,
  onCheckNow,
  onNotify,
}) => {
  const { t } = useI18n();
  const [repoInput, setRepoInput] = useState(repoSlug);
  const [dlState, setDlState] = useState<NativeApkDownloadEvent | null>(null);

  useEffect(() => {
    setRepoInput(repoSlug);
  }, [repoSlug, open]);

  useEffect(() => {
    const onProgress = (ev: Event) => {
      const detail = (ev as CustomEvent<NativeApkDownloadEvent>).detail;
      if (!detail) return;
      setDlState(detail);
      if (detail.status === 'error' && detail.message) {
        onNotify(detail.message);
      }
    };
    window.addEventListener('droidpy-apk-download', onProgress);
    return () => window.removeEventListener('droidpy-apk-download', onProgress);
  }, [onNotify]);

  if (!open) return null;

  const currentVersion = updateResult?.currentVersion || APP_VERSION;
  const latest: AppReleaseInfo | null = updateResult?.latest ?? null;
  const hasUpdate = Boolean(updateResult?.hasUpdate && latest);
  const releases = updateResult?.releases ?? [];
  const primaryApk = latest?.apkAssets[0] ?? null;
  const currentNorm = normalizeVersionStr(currentVersion);
  const currentRelease: AppReleaseInfo | null =
    releases.find((r) => normalizeVersionStr(r.version) === currentNorm) ??
    BUILTIN_LOCAL_RELEASES.find((r) => normalizeVersionStr(r.version) === currentNorm) ??
    BUILTIN_LOCAL_RELEASES[0] ??
    null;

  const handleSaveAndCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = saveGithubRepo(repoInput);
    onChangeRepoSlug(cleaned);
    await onCheckNow(cleaned);
  };

  const handleDownloadApk = (apkUrl: string, fileName: string) => {
    setDlState({ status: 'downloading', progress: 0, fileName });
    const mode = triggerInAppApkDownload(apkUrl, fileName);
    if (mode === 'browser') {
      setDlState(null);
      onNotify(t('upd_dl_browser', { name: fileName }));
    } else {
      onNotify(t('upd_dl_started', { name: fileName }));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('upd_modal_title')}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-xl max-h-[88dvh] md-sheet rounded-b-none sm:rounded-b-[1.75rem] flex flex-col overflow-hidden text-[var(--ide-text)]"
      >
        <div className="w-10 h-1 bg-[var(--ide-border)] rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--ide-border)] flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold flex items-center gap-2">
              <PackageCheck className="w-4.5 h-4.5 text-[var(--ide-accent)] shrink-0" />
              <span className="truncate">{t('upd_modal_title')}</span>
            </h3>
            <p className="text-xs text-[var(--ide-text-muted)] mt-0.5 font-mono tabular-nums">
              {t('upd_current_ver', { ver: currentVersion })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('btn_done')}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto ide-scroll p-5 space-y-5">
          {/* Repo Source Config */}
          <form onSubmit={handleSaveAndCheck} className="space-y-2">
            <label className="block text-xs font-medium text-[var(--ide-text-muted)]">
              {t('upd_repo_label')}
            </label>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <input
                type="text"
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                placeholder="owner/DroidPy"
                className="flex-1 min-w-[160px] min-h-[42px] px-3.5 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
              />
              <button
                type="submit"
                disabled={checking}
                className="min-h-[42px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                {checking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>{checking ? t('upd_checking') : t('upd_check_btn')}</span>
              </button>
            </div>
            <p className="text-[11px] text-[var(--ide-text-muted)] leading-relaxed">
              {t('upd_repo_hint')}
            </p>
          </form>

          {/* Error Banner */}
          {updateResult?.error && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-3.5 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              {t('upd_fetch_err', { msg: updateResult.error })}
            </div>
          )}

          {/* Download Progress Bar */}
          {dlState && (
            <div className="rounded-2xl border border-[var(--ide-accent)]/40 bg-[var(--ide-accent-soft)] p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[var(--ide-accent-text)]">
                <span className="truncate min-w-0">
                  {dlState.status === 'installing'
                    ? t('upd_dl_installing')
                    : dlState.status === 'error'
                    ? dlState.message || t('upd_dl_err')
                    : t('upd_dl_progress', {
                        pct: dlState.progress >= 0 ? `${dlState.progress}%` : '...',
                      })}
                </span>
                {dlState.totalBytes && dlState.totalBytes > 0 ? (
                  <span className="font-mono tabular-nums shrink-0">
                    {formatStorageBytes(dlState.downloadedBytes ?? 0)} / {formatStorageBytes(dlState.totalBytes)}
                  </span>
                ) : null}
              </div>
              {dlState.status === 'downloading' && (
                <div className="h-2 rounded-full bg-[var(--ide-bg)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--ide-accent)] transition-all duration-150"
                    style={{ width: `${Math.max(4, Math.min(100, dlState.progress || 8))}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* New Version Available Card + Changelog */}
          {hasUpdate && latest ? (
            <div className="md-card-tonal border-[var(--ide-accent)] p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--ide-accent-text)]">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>{t('upd_found_title', { ver: latest.version })}</span>
                  </div>
                  <div className="text-[11px] text-[var(--ide-text-muted)] mt-0.5 tabular-nums break-words">
                    {latest.publishedAt ? latest.publishedAt.slice(0, 10) : ''}
                    {primaryApk ? ` · ${primaryApk.name} (${formatStorageBytes(primaryApk.size)})` : ''}
                  </div>
                </div>
                {primaryApk && (
                  <button
                    type="button"
                    disabled={dlState?.status === 'downloading'}
                    onClick={() => handleDownloadApk(primaryApk.downloadUrl, primaryApk.name)}
                    className="min-h-[44px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t('upd_download_install')}</span>
                  </button>
                )}
              </div>

              <div className="rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] p-3.5 space-y-1.5">
                <div className="text-[11px] font-semibold text-[var(--ide-text-muted)]">
                  {t('upd_changelog_title')}
                </div>
                <pre className="selectable-text text-xs text-[var(--ide-text)] whitespace-pre-wrap font-sans leading-relaxed max-h-56 overflow-y-auto ide-scroll">
                  {latest.body || t('upd_no_notes')}
                </pre>
              </div>

              {latest.htmlUrl && (
                <a
                  href={latest.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-[var(--ide-accent-text)] inline-flex items-center gap-1 hover:underline"
                >
                  <span>{t('upd_open_release')}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          ) : (
            <div className="md-card p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-[var(--ide-accent)] shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold">
                    {repoSlug ? t('upd_up_to_date') : t('upd_need_repo')}
                  </div>
                  <div className="text-[11px] text-[var(--ide-text-muted)] truncate mt-0.5">
                    v{currentVersion}
                    {updateResult?.checkedAt
                      ? ` · ${new Date(updateResult.checkedAt).toLocaleTimeString()}`
                      : ''}
                  </div>
                </div>
              </div>
              {releases[0]?.apkAssets[0] && (
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadApk(releases[0].apkAssets[0].downloadUrl, releases[0].apkAssets[0].name)
                  }
                  className="min-h-[38px] px-3 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)] text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:border-[var(--ide-accent)]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('upd_redownload')}</span>
                </button>
              )}
            </div>
          )}

          {/* Current Installed Version Changelog Only (shown when already up to date) */}
          {!hasUpdate && currentRelease && (
            <div className="rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold flex items-center gap-2">
                    <span>{t('upd_current_changelog_title')}</span>
                    <span className="font-mono text-[var(--ide-accent-text)]">v{currentVersion}</span>
                  </div>
                  {currentRelease.publishedAt && (
                    <div className="text-[11px] text-[var(--ide-text-muted)] tabular-nums mt-0.5">
                      {currentRelease.publishedAt.slice(0, 10)}
                    </div>
                  )}
                </div>
                {currentRelease.apkAssets[0] && (
                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadApk(
                        currentRelease.apkAssets[0].downloadUrl,
                        currentRelease.apkAssets[0].name
                      )
                    }
                    className="min-h-[34px] px-3 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] hover:border-[var(--ide-accent)] text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
                    <span>APK</span>
                  </button>
                )}
              </div>
              <pre className="selectable-text text-xs text-[var(--ide-text)] whitespace-pre-wrap font-sans leading-relaxed max-h-60 overflow-y-auto ide-scroll">
                {currentRelease.body || t('upd_no_notes')}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import {
  Terminal,
  PlugZap,
  Copy,
  Check,
  Download,
  Play,
  PackagePlus,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Loader2,
  Cpu,
  ArrowUpCircle,
  Search,
  Trash2,
} from 'lucide-react';
import {
  ExecutionEngine,
  PackageBackupStatus,
  PythonFile,
  TermuxConfig,
  TermuxConnectionState,
  TermuxHealthInfo,
} from '../types/ide';
import {
  CORE_TERMUX_PIP_PACKAGES,
  CORE_TERMUX_PKG_PACKAGES,
  TermuxOutdatedPipItem,
  buildTermuxBridgeScript,
  buildTermuxOneLineCommand,
  normalizeTermuxPkgName,
} from '../services/termuxBridge';
import { TranslationKey, useI18n } from '../services/i18n';
import { downloadBlob } from '../utils/downloadBlob';
import { copyTextReliable } from '../utils/clipboard';
import {
  PACKAGE_CATALOG,
  PACKAGE_CATEGORIES,
  PackageCategoryId,
  PackageTier,
  TERMUX_PKG_NAME_HINTS,
  fuzzyMatchPackages,
} from '../data/packageCatalog';

interface TermuxIntegrationPanelProps {
  engine: ExecutionEngine;
  onChangeEngine: (engine: ExecutionEngine) => void;
  config: TermuxConfig;
  onUpdateConfig: (patch: Partial<TermuxConfig>) => void;
  connectionState: TermuxConnectionState;
  connectionError: string | null;
  healthInfo: TermuxHealthInfo | null;
  activeFile: PythonFile;
  onTestConnection: () => Promise<void>;
  onInstallInTermux: (mode: 'pip' | 'pkg', target: string) => Promise<void>;
  onRunInTermux: () => Promise<void>;
  onRunShellInTermux: (cmd: string) => Promise<boolean | void>;
  onInitializeEmbeddedEnv: (includeBaseSystem: boolean) => Promise<void>;
  onUpgradeAllTermux?: (kind: 'pip' | 'pkg') => Promise<void>;
  onUpgradeSinglePip?: (pkg: string) => Promise<void>;
  onUpgradeAllPackages?: () => Promise<void>;
  outdatedTermuxPips?: TermuxOutdatedPipItem[];
  checkingTermuxOutdated?: boolean;
  onCheckTermuxOutdated?: () => Promise<void>;
  onUninstallInTermux?: (mode: 'pip' | 'pkg', target: string) => Promise<void>;
  upgradingTermux?: boolean;
  enableSandboxAddon?: boolean;
  backupStatus?: PackageBackupStatus | null;
  onRestoreBackedUpPackages?: () => Promise<void>;
  restoringBackup?: boolean;
  onNotify: (msg: string) => void;
}

export const TermuxIntegrationPanel: React.FC<TermuxIntegrationPanelProps> = ({
  engine,
  onChangeEngine,
  config,
  onUpdateConfig,
  connectionState,
  connectionError,
  healthInfo,
  activeFile,
  onTestConnection,
  onInstallInTermux,
  onRunInTermux,
  onRunShellInTermux,
  onInitializeEmbeddedEnv,
  onUpgradeAllTermux,
  onUpgradeSinglePip,
  onUpgradeAllPackages,
  outdatedTermuxPips = [],
  checkingTermuxOutdated = false,
  onCheckTermuxOutdated,
  onUninstallInTermux,
  upgradingTermux = false,
  enableSandboxAddon = false,
  backupStatus = null,
  onRestoreBackedUpPackages,
  restoringBackup = false,
  onNotify,
}) => {
  const { t } = useI18n();
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [installMode, setInstallMode] = useState<'pip' | 'pkg'>('pip');
  const [pkgTarget, setPkgTarget] = useState('');
  const [shellCmd, setShellCmd] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<'all' | PackageTier>('all');
  const [catFilter, setCatFilter] = useState<PackageCategoryId>('all');

  const oneLineCmd = buildTermuxOneLineCommand(config.token);

  const termuxCatalogItems = useMemo(
    () => PACKAGE_CATALOG.filter((item) => Boolean(item.termux)),
    []
  );

  const filteredCatalog = useMemo(
    () =>
      termuxCatalogItems.filter((item) => {
        if (tierFilter !== 'all' && item.tier !== tierFilter) return false;
        if (catFilter !== 'all' && item.category !== catFilter) return false;
        return true;
      }),
    [termuxCatalogItems, tierFilter, catFilter]
  );

  const fuzzyResults = useMemo(() => {
    const q = pkgTarget.trim();
    if (!q) return [];
    return fuzzyMatchPackages(q, termuxCatalogItems, { runtime: 'all', limit: 6 });
  }, [pkgTarget, termuxCatalogItems]);

  const termuxNameHint = useMemo(() => {
    const key = pkgTarget.trim().toLowerCase();
    return key ? TERMUX_PKG_NAME_HINTS[key] ?? null : null;
  }, [pkgTarget]);

  const outdatedPipMap = useMemo(() => {
    const map = new Map<string, TermuxOutdatedPipItem>();
    for (const item of outdatedTermuxPips) {
      map.set(normalizeTermuxPkgName(item.name), item);
    }
    return map;
  }, [outdatedTermuxPips]);

  const handleCopyBootstrap = async () => {
    const ok = await copyTextReliable(oneLineCmd);
    if (ok) {
      setCopiedCmd(true);
      onNotify(t('tmx_copied_cmd'));
      setTimeout(() => setCopiedCmd(false), 2000);
    } else {
      onNotify(t('files_clipboard_err'));
    }
  };

  const handleDownloadBridgePy = async () => {
    const content = buildTermuxBridgeScript(config.token);
    const blob = new Blob([content], { type: 'text/x-python;charset=utf-8' });
    await downloadBlob(blob, 'droidpy_bridge.py');
    onNotify('droidpy_bridge.py');
  };

  const handleInstallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pkgTarget.trim();
    if (!clean || busyAction || upgradingTermux) return;
    setBusyAction(`install:${clean}`);
    try {
      await onInstallInTermux(installMode, clean);
      setPkgTarget('');
    } finally {
      setBusyAction(null);
    }
  };

  const handleQuickInstall = async (mode: 'pkg' | 'pip', target: string) => {
    if (busyAction || upgradingTermux) return;
    setBusyAction(`install:${target}`);
    try {
      await onInstallInTermux(mode, target);
      setPkgTarget('');
    } finally {
      setBusyAction(null);
    }
  };

  const handleUninstallTarget = async (mode: 'pkg' | 'pip', target: string) => {
    const clean = target.trim();
    if (!clean || !onUninstallInTermux || busyAction || upgradingTermux) return;
    setBusyAction(`uninstall:${clean}`);
    try {
      await onUninstallInTermux(mode, clean);
      if (pkgTarget.trim() === clean) setPkgTarget('');
    } finally {
      setBusyAction(null);
    }
  };

  const handleShellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = shellCmd.trim();
    if (!clean || busyAction || upgradingTermux) return;
    setBusyAction('shell');
    try {
      await onRunShellInTermux(clean);
      setShellCmd('');
    } finally {
      setBusyAction(null);
    }
  };

  const handleInitEmbedded = async (includeBaseSystem: boolean) => {
    if (busyAction || upgradingTermux) return;
    setBusyAction(includeBaseSystem ? 'init:full' : 'init:crawler');
    try {
      await onInitializeEmbeddedEnv(includeBaseSystem);
    } finally {
      setBusyAction(null);
    }
  };

  const isConnected = connectionState === 'connected';
  const isChecking = connectionState === 'checking';

  return (
    <section className="space-y-5">
      {/* Section Header + Engine Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Terminal className="w-5 h-5 text-[var(--ide-accent)]" />
            <span>{t('tmx_title')}</span>
          </h2>
          <p className="text-xs text-[var(--ide-text-muted)] mt-0.5">
            {t('tmx_desc')}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--ide-surface-alt)] border border-[var(--ide-border)]">
          {(enableSandboxAddon || engine === 'pyodide') && (
            <button
              type="button"
              onClick={() => onChangeEngine('pyodide')}
              className={`min-h-[38px] px-3.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                engine === 'pyodide'
                  ? 'bg-[var(--ide-surface)] text-[var(--ide-text)] shadow-sm'
                  : 'text-[var(--ide-text-muted)]'
              }`}
            >
              {t('tmx_engine_py')}
            </button>
          )}
          <button
            type="button"
            onClick={() => onChangeEngine('termux')}
            className={`min-h-[38px] px-3.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              engine === 'termux'
                ? 'bg-[var(--ide-accent)] text-white shadow-sm'
                : 'text-[var(--ide-text-muted)]'
            }`}
          >
            {t('tmx_engine_tmx')}
          </button>
        </div>
      </div>

      {/* Package Backup Restore Banner (when reinstall/update cleared missing packages) */}
      {backupStatus?.hasBackup &&
        ((backupStatus.missingPipPackages?.length ?? 0) > 0 ||
          (backupStatus.missingPkgPackages?.length ?? 0) > 0) &&
        onRestoreBackedUpPackages && (
          <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/35 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-sm font-semibold text-amber-900 dark:text-amber-200 flex flex-wrap items-center gap-2">
                <PackagePlus className="w-4 h-4 shrink-0" />
                <span>{t('backup_banner_title')}</span>
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-md bg-amber-200/70 dark:bg-amber-900/60">
                  {t('backup_saved_badge', {
                    pip: backupStatus.pipPackages.length,
                    pkg: backupStatus.pkgPackages.length,
                  })}
                </span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                {t('backup_banner_desc', {
                  pipCount: backupStatus.missingPipPackages.length,
                  pkgCount: backupStatus.missingPkgPackages.length,
                })}
              </p>
              <div className="text-[11px] font-mono text-amber-900/90 dark:text-amber-200/90 break-words">
                {[...backupStatus.missingPkgPackages, ...backupStatus.missingPipPackages].join(', ')}
              </div>
            </div>
            <button
              type="button"
              disabled={restoringBackup || !!busyAction || upgradingTermux}
              onClick={() => void onRestoreBackedUpPackages()}
              className="min-h-[42px] px-4 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 text-center shrink-0 transition-colors max-w-full"
            >
              {restoringBackup ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>
                {restoringBackup ? t('backup_restoring_btn') : t('backup_restore_btn')}
              </span>
            </button>
          </div>
        )}

      {/* Connection Config & Live Health Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-3.5 sm:p-5 space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-2 min-w-0">
              <PlugZap className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
              <span>{t('tmx_conn_title')}</span>
            </h3>
            <span
              className={`text-xs font-medium whitespace-nowrap ${
                isConnected
                  ? 'text-[var(--ide-accent-text)]'
                  : connectionState === 'error'
                  ? 'text-red-500'
                  : 'text-[var(--ide-text-muted)]'
              }`}
            >
              {isConnected
                ? t('tmx_state_ok')
                : isChecking
                ? t('tmx_state_checking')
                : connectionState === 'error'
                ? t('tmx_state_err')
                : t('tmx_state_off')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="min-w-0">
              <label className="block text-[11px] font-medium text-[var(--ide-text-muted)] mb-1">
                {t('tmx_endpoint_label')}
              </label>
              <input
                type="url"
                value={config.endpointUrl}
                onChange={(e) => onUpdateConfig({ endpointUrl: e.target.value })}
                className="w-full min-w-0 min-h-[40px] px-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-xs font-mono"
              />
            </div>
            <div className="min-w-0">
              <label className="block text-[11px] font-medium text-[var(--ide-text-muted)] mb-1">
                {t('tmx_token_label')}
              </label>
              <input
                type="text"
                value={config.token}
                onChange={(e) => onUpdateConfig({ token: e.target.value })}
                className="w-full min-w-0 min-h-[40px] px-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-xs font-mono"
              />
            </div>
          </div>

          {connectionError && (
            <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="min-w-0 break-words">{connectionError}</span>
            </div>
          )}

          {healthInfo && isConnected && (
            <div className="selectable-text rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] p-3 text-xs space-y-1 font-mono tabular-nums min-w-0">
              <div className="text-[var(--ide-accent-text)] font-sans font-medium">
                {healthInfo.embedded ? t('tmx_env_embedded') : t('tmx_env_external')}
                <span aria-hidden="true"> · </span>
                {healthInfo.hasPython === false ? t('tmx_py_missing') : t('tmx_py_ready')}
              </div>
              <div className="break-words">Python : {healthInfo.pythonVersion} ({healthInfo.arch})</div>
              <div>Clang  : {healthInfo.hasClang ? t('tmx_ready') : t('tmx_not_installed')}</div>
              <div>FFmpeg : {healthInfo.hasFfmpeg ? t('tmx_ready') : t('tmx_not_installed')}</div>
              <div className="break-all sm:truncate">{t('tmx_dir')} : {healthInfo.workspaceDir}</div>

              {/* Always render installed pip & pkg section when connected so user never sees blank area */}
              <div className="pt-2 mt-2 border-t border-[var(--ide-border)] font-sans space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-[var(--ide-text-muted)]">
                    {t('tmx_installed_pkgs')} ({healthInfo.installedPipPackages?.length ?? 0})
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isChecking || !!busyAction || upgradingTermux}
                      onClick={() => void onTestConnection()}
                      className="min-h-[30px] px-2.5 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] hover:border-[var(--ide-accent)] text-[11px] font-medium inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 text-[var(--ide-accent)] ${isChecking ? 'animate-spin' : ''}`} />
                      <span>{t('pkg_refresh')}</span>
                    </button>
                    {onCheckTermuxOutdated && (
                      <button
                        type="button"
                        disabled={!!busyAction || upgradingTermux || checkingTermuxOutdated}
                        onClick={() => void onCheckTermuxOutdated()}
                        className="min-h-[30px] px-2.5 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] hover:border-[var(--ide-accent)] text-[11px] font-medium inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 text-[var(--ide-accent)] ${checkingTermuxOutdated ? 'animate-spin' : ''}`} />
                        <span>{t('tmx_check_outdated_btn')}</span>
                      </button>
                    )}
                    {onUpgradeAllTermux && (
                      <button
                        type="button"
                        disabled={!!busyAction || upgradingTermux}
                        onClick={() => void onUpgradeAllTermux('pip')}
                        className="min-h-[30px] px-2.5 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] hover:border-[var(--ide-accent)] text-[11px] font-medium inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        {upgradingTermux ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <ArrowUpCircle className="w-3 h-3 text-[var(--ide-accent)]" />
                        )}
                        <span>{t('tmx_upgrade_pip_btn')}</span>
                      </button>
                    )}
                  </div>
                </div>

                {healthInfo.installedPipPackages && healthInfo.installedPipPackages.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto ide-scroll pr-0.5">
                    {healthInfo.installedPipPackages.map((pipPkg) => {
                      const normPip = normalizeTermuxPkgName(pipPkg);
                      const outdatedItem = outdatedPipMap.get(normPip);
                      const isCorePip = CORE_TERMUX_PIP_PACKAGES.has(pipPkg.toLowerCase());
                      const isUninstalling = busyAction === `uninstall:${pipPkg}`;
                      return (
                        <div
                          key={pipPkg}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] text-[11px] font-mono text-[var(--ide-text)] max-w-full"
                        >
                          <span className="truncate">{pipPkg}</span>
                          {outdatedItem && onUpgradeSinglePip && (
                            <button
                              type="button"
                              disabled={!!busyAction || upgradingTermux}
                              onClick={() => void onUpgradeSinglePip(pipPkg)}
                              title={`${pipPkg} ${outdatedItem.currentVersion} → ${outdatedItem.latestVersion}`}
                              className="text-[var(--ide-accent-text)] hover:underline font-sans font-semibold disabled:opacity-40 shrink-0"
                            >
                              ↑
                            </button>
                          )}
                          {!isCorePip && onUninstallInTermux && (
                            <button
                              type="button"
                              disabled={!!busyAction || upgradingTermux}
                              onClick={() => void handleUninstallTarget('pip', pipPkg)}
                              title={`${t('tmx_uninstall_btn')} ${pipPkg}`}
                              aria-label={`${t('tmx_uninstall_btn')} ${pipPkg}`}
                              className="text-[var(--ide-text-muted)] hover:text-red-500 font-sans font-semibold disabled:opacity-40 ml-0.5 shrink-0"
                            >
                              {isUninstalling ? '…' : '×'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[11px] text-[var(--ide-text-muted)] leading-relaxed">
                    {t('tmx_installed_pkgs_empty')}
                  </div>
                )}

                {healthInfo.installedPkgPackages && healthInfo.installedPkgPackages.length > 0 && (
                  <div className="pt-2 border-t border-[var(--ide-border)] space-y-1.5">
                    <div className="text-[11px] font-medium text-[var(--ide-text-muted)]">
                      {t('tmx_installed_sys_pkgs')} ({healthInfo.installedPkgPackages.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto ide-scroll pr-0.5">
                      {healthInfo.installedPkgPackages.map((sysPkg) => {
                        const isCoreSys = CORE_TERMUX_PKG_PACKAGES.has(sysPkg.toLowerCase());
                        const isUninstalling = busyAction === `uninstall:${sysPkg}`;
                        return (
                          <div
                            key={sysPkg}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--ide-border)] bg-[var(--ide-surface)] text-[11px] font-mono text-[var(--ide-text-muted)] max-w-full"
                          >
                            <span className="truncate">{sysPkg}</span>
                            {!isCoreSys && onUninstallInTermux && (
                              <button
                                type="button"
                                disabled={!!busyAction || upgradingTermux}
                                onClick={() => void handleUninstallTarget('pkg', sysPkg)}
                                title={`${t('tmx_uninstall_btn')} ${sysPkg}`}
                                aria-label={`${t('tmx_uninstall_btn')} ${sysPkg}`}
                                className="hover:text-red-500 font-sans font-semibold disabled:opacity-40 shrink-0"
                              >
                                {isUninstalling ? '…' : '×'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onTestConnection}
              disabled={isChecking}
              className="min-h-[42px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-50 text-white text-xs font-medium inline-flex items-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{t('tmx_test_btn')}</span>
            </button>
            <button
              type="button"
              onClick={onRunInTermux}
              disabled={!!busyAction || upgradingTermux}
              className="min-h-[42px] px-4 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-xs font-medium inline-flex items-center gap-2 hover:border-[var(--ide-accent)] transition-colors max-w-full"
            >
              <Play className="w-3.5 h-3.5 text-[var(--ide-accent)] shrink-0" />
              <span className="truncate">{t('tmx_run_file_btn', { name: activeFile.name })}</span>
            </button>
          </div>
        </div>

        {/* One-line Bootstrap Setup Card */}
        <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-3.5 sm:p-5 space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{t('tmx_bootstrap_title')}</h3>
            <a
              href="termux://"
              className="text-xs font-medium text-[var(--ide-accent-text)] inline-flex items-center gap-1 hover:underline shrink-0"
            >
              <span>{t('tmx_open_app')}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <ol className="text-xs text-[var(--ide-text-muted)] space-y-1.5 list-decimal pl-4 leading-relaxed">
            <li>{t('tmx_step1')}</li>
            <li>{t('tmx_step2')}</li>
            <li>{t('tmx_step3')}</li>
          </ol>

          <div className="selectable-text rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] p-3 font-mono text-[11px] text-[var(--ide-text-muted)] break-all max-h-24 overflow-y-auto ide-scroll">
            {oneLineCmd}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopyBootstrap}
              className="min-h-[42px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-2 transition-colors"
            >
              {copiedCmd ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCmd ? t('tmx_copied_cmd') : t('tmx_copy_cmd')}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadBridgePy}
              className="min-h-[42px] px-4 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-xs font-medium inline-flex items-center gap-2 hover:border-[var(--ide-accent)] transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>{t('tmx_dl_bridge')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* One-Tap Embedded APK Python + Crawler Initialization Card */}
      <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-3.5 sm:p-5 space-y-4 min-w-0">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
            <span>{t('tmx_init_title')}</span>
          </h3>
          <p className="text-xs text-[var(--ide-text-muted)] leading-relaxed">
            {t('tmx_init_desc')}
          </p>
        </div>

        <div className="selectable-text rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] px-3.5 py-2.5 font-mono text-[11px] text-[var(--ide-text-muted)] overflow-x-auto no-scrollbar whitespace-nowrap">
          pkg update -y && pkg install -y python clang libxml2 libxslt && pip install requests beautifulsoup4 lxml httpx
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={!!busyAction || upgradingTermux}
            onClick={() => void handleInitEmbedded(true)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-2 text-left max-w-full transition-colors"
          >
            {busyAction === 'init:full' ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Download className="w-4 h-4 shrink-0" />
            )}
            <span>
              {busyAction === 'init:full' ? t('tmx_init_running') : t('tmx_init_btn_full')}
            </span>
          </button>

          <button
            type="button"
            disabled={!!busyAction || upgradingTermux}
            onClick={() => void handleInitEmbedded(false)}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-accent)] disabled:opacity-50 text-xs font-medium inline-flex items-center gap-2 text-left max-w-full transition-colors"
          >
            {busyAction === 'init:crawler' ? (
              <Loader2 className="w-4 h-4 animate-spin text-[var(--ide-accent)] shrink-0" />
            ) : (
              <PackagePlus className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
            )}
            <span>{t('tmx_init_btn_crawler')}</span>
          </button>
        </div>
      </div>

      {/* Termux Remote Package & Tool Installer */}
      <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-3.5 sm:p-5 space-y-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <PackagePlus className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
              <span>{t('tmx_pkg_title')}</span>
            </h3>
            <p className="text-xs text-[var(--ide-text-muted)] mt-0.5">
              {t('tmx_pkg_desc')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 max-w-full">
            {onUpgradeAllPackages && (
              <button
                type="button"
                disabled={!!busyAction || upgradingTermux}
                onClick={() => void onUpgradeAllPackages()}
                className="min-h-[36px] px-3 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
              >
                {upgradingTermux ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <ArrowUpCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{t('tmx_upgrade_all_btn')}</span>
              </button>
            )}
            {onUpgradeAllTermux && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={!!busyAction || upgradingTermux}
                  onClick={() => void onUpgradeAllTermux('pip')}
                  className="min-h-[36px] px-3 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-accent)] text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                >
                  {upgradingTermux ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--ide-accent)] shrink-0" />
                  ) : (
                    <ArrowUpCircle className="w-3.5 h-3.5 text-[var(--ide-accent)] shrink-0" />
                  )}
                  <span>{t('tmx_upgrade_pip_btn')}</span>
                </button>
                <button
                  type="button"
                  disabled={!!busyAction || upgradingTermux}
                  onClick={() => void onUpgradeAllTermux('pkg')}
                  className="min-h-[36px] px-3 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-accent)] text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[var(--ide-accent)] shrink-0" />
                  <span>{t('tmx_upgrade_pkg_btn')}</span>
                </button>
              </div>
            )}

            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--ide-surface-alt)] border border-[var(--ide-border)]">
              <button
                type="button"
                onClick={() => setInstallMode('pip')}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-mono font-medium transition-colors ${
                  installMode === 'pip'
                    ? 'bg-[var(--ide-surface)] text-[var(--ide-text)] shadow-sm'
                    : 'text-[var(--ide-text-muted)]'
                }`}
              >
                pip
              </button>
              <button
                type="button"
                onClick={() => setInstallMode('pkg')}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-mono font-medium transition-colors ${
                  installMode === 'pkg'
                    ? 'bg-[var(--ide-surface)] text-[var(--ide-text)] shadow-sm'
                    : 'text-[var(--ide-text-muted)]'
                }`}
              >
                pkg
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <form onSubmit={handleInstallSubmit} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <div className="relative flex-1 min-w-0 w-full sm:w-auto">
              <Search className="w-4 h-4 text-[var(--ide-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={pkgTarget}
                onChange={(e) => setPkgTarget(e.target.value)}
                placeholder={
                  installMode === 'pkg'
                    ? t('tmx_pkg_placeholder_pkg')
                    : t('tmx_pkg_placeholder_pip')
                }
                className="w-full min-w-0 min-h-[44px] pl-10 pr-4 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="submit"
                disabled={!pkgTarget.trim() || !!busyAction || upgradingTermux}
                className="min-h-[44px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-sm font-medium disabled:opacity-40 flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              >
                {busyAction?.startsWith('install:') ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>{t('tmx_install_btn')}</span>
              </button>
              {onUninstallInTermux && (
                <button
                  type="button"
                  disabled={!pkgTarget.trim() || !!busyAction || upgradingTermux}
                  onClick={() => void handleUninstallTarget(installMode, pkgTarget)}
                  className="min-h-[44px] px-3.5 rounded-xl border border-red-300 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-sm font-medium disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  {busyAction?.startsWith('uninstall:') ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>{t('tmx_uninstall_btn')}</span>
                </button>
              )}
            </div>
          </form>

          {/* Termux Prebuilt APT Naming Hint */}
          {termuxNameHint && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="min-w-0 flex-1 text-amber-900 dark:text-amber-200">
                <span className="font-semibold">{t('pkg_termux_hint_title')}</span>
                <span>{termuxNameHint.reason}</span>
              </div>
              <button
                type="button"
                disabled={!!busyAction || upgradingTermux}
                onClick={() => void handleQuickInstall(termuxNameHint.suggestedMode, termuxNameHint.suggestedTarget)}
                className="min-h-[34px] px-3 rounded-lg bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-semibold shrink-0 max-w-full text-center transition-colors"
              >
                {t('pkg_termux_hint_btn', { target: termuxNameHint.suggestedTarget })}
              </button>
            </div>
          )}

          {/* Fuzzy Autocomplete Suggestions */}
          {pkgTarget.trim().length > 0 && fuzzyResults.length > 0 && (
            <div className="rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] overflow-hidden divide-y divide-[var(--ide-border)]">
              <div className="px-3.5 py-2 bg-[var(--ide-surface-alt)] text-[11px] font-medium text-[var(--ide-text-muted)]">
                {t('pkg_fuzzy_header')}
              </div>
              {fuzzyResults.map(({ item, matchedAlias }) => {
                const tmx = item.termux!;
                const isBusy = busyAction === `install:${tmx.targetName}`;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-[var(--ide-surface)] transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setInstallMode(tmx.mode);
                        setPkgTarget(tmx.targetName);
                      }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[var(--ide-text)]">
                        <span>{tmx.mode} {tmx.targetName}</span>
                        {matchedAlias && (
                          <span className="font-sans font-normal text-[11px] text-[var(--ide-accent-text)]">
                            · {t('pkg_fuzzy_alias', { alias: matchedAlias })}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[var(--ide-text-muted)] truncate mt-0.5">
                        {item.desc}
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={!!busyAction || upgradingTermux}
                      onClick={() => void handleQuickInstall(tmx.mode, tmx.targetName)}
                      className="min-h-[34px] px-3 rounded-lg bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-40 text-white text-xs font-medium whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
                    >
                      {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      <span>{t('pkg_install_short')}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Popular/Niche Tier Toggle + Category Strip */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--ide-surface-alt)] border border-[var(--ide-border)]">
              {(['all', 'popular', 'niche'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setTierFilter(tier)}
                  className={`min-h-[32px] px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    tierFilter === tier
                      ? 'bg-[var(--ide-surface)] text-[var(--ide-accent-text)] font-semibold shadow-xs'
                      : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
                  }`}
                >
                  {t(`pkg_tier_${tier}` as TranslationKey)}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-[var(--ide-text-muted)] tabular-nums">
              {t('pkg_loaded_count', { count: filteredCatalog.length })}
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {PACKAGE_CATEGORIES.map((cat) => {
              const active = catFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCatFilter(cat.id)}
                  className={`min-h-[34px] px-3 rounded-xl border text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'border-[var(--ide-accent)] bg-[var(--ide-accent-soft)] text-[var(--ide-accent-text)] font-semibold'
                      : 'border-[var(--ide-border)] bg-[var(--ide-bg)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
                  }`}
                >
                  {t(cat.labelKey as TranslationKey)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto ide-scroll pr-0.5">
          {filteredCatalog.map((item) => {
            const tmx = item.termux!;
            const isBusyInstall = busyAction === `install:${tmx.targetName}`;
            const isBusyUninstall = busyAction === `uninstall:${tmx.targetName}`;
            const normTarget = normalizeTermuxPkgName(tmx.targetName);
            const pipInstalled =
              tmx.mode === 'pip' &&
              Boolean(
                healthInfo?.installedPipPackages?.some(
                  (p) => normalizeTermuxPkgName(p) === normTarget
                )
              );
            const pkgInstalled =
              tmx.mode === 'pkg' &&
              ((tmx.targetName === 'clang' && Boolean(healthInfo?.hasClang)) ||
                (tmx.targetName === 'ffmpeg' && Boolean(healthInfo?.hasFfmpeg)) ||
                Boolean(
                  healthInfo?.installedPkgPackages?.some(
                    (p) => p.toLowerCase() === tmx.targetName.toLowerCase()
                  )
                ));
            const alreadyInstalled = pipInstalled || pkgInstalled;
            const isCorePkg =
              tmx.mode === 'pip'
                ? CORE_TERMUX_PIP_PACKAGES.has(tmx.targetName.toLowerCase())
                : CORE_TERMUX_PKG_PACKAGES.has(tmx.targetName.toLowerCase());
            return (
              <div
                key={item.id}
                className={`p-3 rounded-xl border flex flex-col justify-between gap-2 transition-colors ${
                  alreadyInstalled
                    ? 'border-[var(--ide-accent)]/50 bg-[var(--ide-accent-soft)]/50'
                    : 'border-[var(--ide-border)] bg-[var(--ide-bg)]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-[var(--ide-text)] truncate">
                      {tmx.mode} {tmx.targetName}
                    </span>
                    {alreadyInstalled && (
                      <Check className="w-3.5 h-3.5 text-[var(--ide-accent)] shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--ide-text-muted)] mt-1 line-clamp-2 leading-relaxed">
                    {item.desc}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[10px] text-[var(--ide-text-muted)] truncate">
                    {item.tier === 'popular' ? t('pkg_tier_popular') : t('pkg_tier_niche')} · {item.runtimeHint}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {alreadyInstalled && !isCorePkg && onUninstallInTermux && (
                      <button
                        type="button"
                        disabled={!!busyAction || upgradingTermux}
                        onClick={() => void handleUninstallTarget(tmx.mode, tmx.targetName)}
                        className="min-h-[28px] px-2 rounded-lg border border-red-300 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-[11px] font-medium whitespace-nowrap inline-flex items-center gap-1 disabled:opacity-40"
                      >
                        {isBusyUninstall ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        <span>{t('pkg_uninstall_btn')}</span>
                      </button>
                    )}
                    {!alreadyInstalled && (
                      <button
                        type="button"
                        disabled={!!busyAction || upgradingTermux}
                        onClick={() => void handleQuickInstall(tmx.mode, tmx.targetName)}
                        className="min-h-[28px] px-2.5 rounded-lg bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-[11px] font-medium whitespace-nowrap inline-flex items-center gap-1 disabled:opacity-40"
                      >
                        {isBusyInstall ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        <span>{t('pkg_install_short')}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Direct Termux Shell Command Runner */}
        <form onSubmit={handleShellSubmit} className="pt-2 border-t border-[var(--ide-border)] flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-[var(--ide-accent-text)] shrink-0">
            $
          </span>
          <input
            type="text"
            value={shellCmd}
            onChange={(e) => setShellCmd(e.target.value)}
            placeholder={t('tmx_shell_placeholder')}
            className="flex-1 min-w-0 min-h-[42px] px-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
          />
          <button
            type="submit"
            disabled={!shellCmd.trim() || !!busyAction || upgradingTermux}
            className="min-h-[42px] px-4 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-accent)] text-xs font-medium whitespace-nowrap shrink-0 disabled:opacity-40"
          >
            {busyAction === 'shell' ? t('tmx_shell_running') : t('tmx_shell_btn')}
          </button>
        </form>
      </div>
    </section>
  );
};

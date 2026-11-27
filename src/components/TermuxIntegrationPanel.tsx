import React, { useMemo, useState } from 'react';
import {
  Terminal,
  PlugZap,
  Copy,
  Check,
  Download,
  Play,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Loader2,
  Cpu,
  ArrowUpCircle,
  PackagePlus,
  Search,
  Trash2,
  Activity,
  ShieldCheck,
} from 'lucide-react';
import {
  ExecutionEngine,
  PackageBackupStatus,
  ProcessCleanupResult,
  PythonFile,
  TermuxConfig,
  TermuxConnectionState,
  TermuxHealthInfo,
} from '../types/ide';
import {
  CORE_TERMUX_PIP_PACKAGES,
  TermuxOutdatedPipItem,
  buildTermuxBridgeScript,
  buildTermuxOneLineCommand,
  normalizeTermuxPkgName,
} from '../services/termuxBridge';
import { useI18n } from '../services/i18n';
import { downloadBlob } from '../utils/downloadBlob';
import { copyTextReliable } from '../utils/clipboard';
import { TermuxPackageWorkspace } from './TermuxPackageWorkspace';

export type TermuxVisibleSection =
  | 'all'
  | 'conn'
  | 'init'
  | 'shell'
  | 'maintenance'
  | 'bridge'
  | 'packages';

interface TermuxIntegrationPanelProps {
  visibleSection?: TermuxVisibleSection;
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
  onUpgradeAllTermux?: (kind: 'pip' | 'pkg') => Promise<void>;
  onUpgradeSinglePip?: (pkg: string) => Promise<void>;
  onUpgradeAllPackages?: () => Promise<void>;
  outdatedTermuxPips?: TermuxOutdatedPipItem[];
  checkingTermuxOutdated?: boolean;
  onCheckTermuxOutdated?: () => Promise<void>;
  onUninstallInTermux?: (mode: 'pip' | 'pkg', target: string) => Promise<void>;
  upgradingTermux?: boolean;
  termuxRunning?: boolean;
  activeTermuxTask?: string | null;
  enableSandboxAddon?: boolean;
  backupStatus?: PackageBackupStatus | null;
  onRestoreBackedUpPackages?: () => Promise<void>;
  restoringBackup?: boolean;
  onCleanupProcesses?: (manual?: boolean) => Promise<void>;
  cleaningProcesses?: boolean;
  lastCleanupResult?: ProcessCleanupResult | null;
  onRebuildPipCertifi?: () => Promise<void>;
  pipTrustedHostEmergency?: boolean;
  onToggleTrustedHost?: (next: boolean) => void;
  onNotify: (msg: string) => void;
}

export const TermuxIntegrationPanel: React.FC<TermuxIntegrationPanelProps> = ({
  visibleSection = 'all',
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
  onUpgradeAllTermux,
  onUpgradeSinglePip,
  onUpgradeAllPackages,
  outdatedTermuxPips = [],
  checkingTermuxOutdated = false,
  onCheckTermuxOutdated,
  onUninstallInTermux,
  upgradingTermux = false,
  termuxRunning = false,
  activeTermuxTask = null,
  enableSandboxAddon = false,
  backupStatus = null,
  onRestoreBackedUpPackages,
  restoringBackup = false,
  onCleanupProcesses,
  cleaningProcesses = false,
  lastCleanupResult = null,
  onRebuildPipCertifi,
  pipTrustedHostEmergency = false,
  onToggleTrustedHost,
  onNotify,
}) => {
  const { t } = useI18n();
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [shellCmd, setShellCmd] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const oneLineCmd = buildTermuxOneLineCommand(config.token, window.location.origin);

  const outdatedPipMap = useMemo(() => {
    const map = new Map<string, TermuxOutdatedPipItem>();
    for (const item of outdatedTermuxPips) {
      map.set(normalizeTermuxPkgName(item.name), item);
    }
    return map;
  }, [outdatedTermuxPips]);

  const handleUninstallTarget = async (mode: 'pkg' | 'pip', target: string) => {
    const clean = target.trim();
    if (!clean || !onUninstallInTermux || busyAction || termuxRunning || upgradingTermux) return;
    setBusyAction(`uninstall:${clean}`);
    try {
      await onUninstallInTermux(mode, clean);
    } finally {
      setBusyAction(null);
    }
  };

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
    const content = buildTermuxBridgeScript(config.token, window.location.origin);
    const blob = new Blob([content], { type: 'text/x-python;charset=utf-8' });
    await downloadBlob(blob, 'droidpy_bridge.py');
    onNotify('droidpy_bridge.py');
  };

  const handleShellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = shellCmd.trim();
    if (!clean || busyAction || termuxRunning || upgradingTermux) return;
    setBusyAction('shell');
    try {
      await onRunShellInTermux(clean);
      setShellCmd('');
    } finally {
      setBusyAction(null);
    }
  };

  const isConnected = connectionState === 'connected';
  const isChecking = connectionState === 'checking';
  const isAll = visibleSection === 'all';
  const showConn = isAll || visibleSection === 'conn';
  const showBridge = isAll || visibleSection === 'bridge';
  const showInit = isAll || visibleSection === 'init';
  const showMaintenance = isAll || visibleSection === 'maintenance';
  const showPackages = isAll || visibleSection === 'packages';
  const showShell = isAll || visibleSection === 'shell';

  return (
    <section className="space-y-4">
      {/* Section Header + Engine Switcher (in full view or when sandbox toggle applies in conn) */}
      {(isAll || (showConn && (enableSandboxAddon || engine === 'pyodide'))) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {isAll && (
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
                <span className="truncate">{t('tmx_title')}</span>
              </h2>
              <p className="text-xs text-[var(--ide-text-muted)] mt-0.5 leading-snug">
                {t('tmx_desc')}
              </p>
            </div>
          )}

          {(enableSandboxAddon || engine === 'pyodide') && (
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--ide-surface-alt)] border border-[var(--ide-border)] shrink-0">
              <button
                type="button"
                onClick={() => onChangeEngine('pyodide')}
                className={`min-h-[44px] px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  engine === 'pyodide'
                    ? 'bg-[var(--ide-surface)] text-[var(--ide-text)] shadow-sm'
                    : 'text-[var(--ide-text-muted)]'
                }`}
              >
                {t('tmx_engine_py')}
              </button>
              <button
                type="button"
                onClick={() => onChangeEngine('termux')}
                className={`min-h-[44px] px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  engine === 'termux'
                    ? 'bg-[var(--ide-accent)] text-white shadow-sm'
                    : 'text-[var(--ide-text-muted)]'
                }`}
              >
                {t('tmx_engine_tmx')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Package Backup Restore Banner (when reinstall/update cleared missing packages) */}
      {(isAll || showConn || showPackages) &&
        backupStatus?.hasBackup &&
        ((backupStatus.missingPipPackages?.length ?? 0) > 0 ||
          (backupStatus.missingPkgPackages?.length ?? 0) > 0) &&
        onRestoreBackedUpPackages && (
          <div className="dp-callout border-l-2 border-amber-400/70 p-3.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-sm font-semibold text-amber-900 dark:text-amber-200 flex flex-wrap items-center gap-2">
                <PackagePlus className="w-4 h-4 shrink-0" />
                <span>{t('backup_banner_title')}</span>
                <span aria-hidden="true">·</span>
                <span className="text-xs font-medium tabular-nums">
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
              disabled={restoringBackup || !!busyAction || termuxRunning || upgradingTermux}
              onClick={() => void onRestoreBackedUpPackages()}
              className="min-h-[44px] px-4 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 text-center shrink-0 transition-colors max-w-full"
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
      {(showConn || showBridge) && (
      <div className={`grid grid-cols-1 ${isAll ? 'lg:grid-cols-2' : ''} gap-4`}>
        {showConn && (
        <div className="dp-panel p-3.5 sm:p-5 space-y-4 min-w-0">
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
                className="w-full min-w-0 min-h-[44px] px-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-xs font-mono"
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
                className="w-full min-w-0 min-h-[44px] px-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-xs font-mono"
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
                      disabled={isChecking || !!busyAction || termuxRunning || upgradingTermux}
                      onClick={() => void onTestConnection()}
                      className="min-h-[44px] px-2.5 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] hover:border-[var(--ide-accent)] text-[11px] font-medium inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 text-[var(--ide-accent)] ${isChecking ? 'animate-spin' : ''}`} />
                      <span>{t('pkg_refresh')}</span>
                    </button>
                    {onCheckTermuxOutdated && (
                      <button
                        type="button"
                        disabled={!!busyAction || termuxRunning || upgradingTermux || checkingTermuxOutdated}
                        onClick={() => void onCheckTermuxOutdated()}
                        className="min-h-[44px] px-2.5 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] hover:border-[var(--ide-accent)] text-[11px] font-medium inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 text-[var(--ide-accent)] ${checkingTermuxOutdated ? 'animate-spin' : ''}`} />
                        <span>{t('tmx_check_outdated_btn')}</span>
                      </button>
                    )}
                    {onUpgradeAllTermux && (
                      <button
                        type="button"
                        disabled={!!busyAction || termuxRunning || upgradingTermux}
                        onClick={() => void onUpgradeAllTermux('pip')}
                        className="min-h-[44px] px-2.5 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] hover:border-[var(--ide-accent)] text-[11px] font-medium inline-flex items-center gap-1 disabled:opacity-50"
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
                              disabled={!!busyAction || termuxRunning || upgradingTermux}
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
                              disabled={!!busyAction || termuxRunning || upgradingTermux}
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
                                disabled={!!busyAction || termuxRunning || upgradingTermux}
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
              className="min-h-[44px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-50 text-white text-xs font-medium inline-flex items-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{t('tmx_test_btn')}</span>
            </button>
            <button
              type="button"
              onClick={onRunInTermux}
              disabled={!!busyAction || termuxRunning || upgradingTermux}
              className="min-h-[44px] min-w-0 max-w-full overflow-hidden px-4 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-xs font-medium inline-flex items-center gap-2 hover:border-[var(--ide-accent)] transition-colors"
            >
              <Play className="w-3.5 h-3.5 text-[var(--ide-accent)] shrink-0" />
              <span className="truncate">{t('tmx_run_file_btn', { name: activeFile.name })}</span>
            </button>
          </div>
        </div>
        )}

        {/* One-line Bootstrap Setup Card */}
        {showBridge && (
        <div className="dp-panel p-3.5 sm:p-5 space-y-4 min-w-0">
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
              className="min-h-[44px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-2 transition-colors"
            >
              {copiedCmd ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCmd ? t('tmx_copied_cmd') : t('tmx_copy_cmd')}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadBridgePy}
              className="min-h-[44px] px-4 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-xs font-medium inline-flex items-center gap-2 hover:border-[var(--ide-accent)] transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>{t('tmx_dl_bridge')}</span>
            </button>
          </div>
        </div>
        )}
      </div>
      )}

      {/* One-Tap Embedded APK Python + Crawler Initialization Card */}
      {showInit && (
      <div className="dp-panel p-3.5 sm:p-5 space-y-4 min-w-0">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
            <span>{t('tmx_init_title')}</span>
          </h3>
          <p className="text-xs text-[var(--ide-text-muted)] leading-relaxed">
            {t('tmx_init_desc')}
          </p>
        </div>

      </div>
      )}

      {/* 30-Min Python Watchdog & pip SSL (certifi / truststore) Maintenance Grid */}
      {showMaintenance && (
      <div className={`grid grid-cols-1 ${isAll ? 'lg:grid-cols-2' : ''} gap-4`}>
        <div className="dp-panel p-3.5 sm:p-5 space-y-3 min-w-0">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
              <span>{t('tmx_cleanup_title')}</span>
            </h3>
            <p className="text-xs text-[var(--ide-text-muted)] leading-relaxed">
              {t('tmx_cleanup_desc')}
            </p>
          </div>

          {lastCleanupResult && (
            <div className="text-[11px] font-mono tabular-nums text-[var(--ide-text-muted)] rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] px-3 py-2">
              {t('tmx_cleanup_last', {
                time: new Date(lastCleanupResult.checkedAt).toLocaleTimeString(),
                scanned: lastCleanupResult.scannedCount,
                killed: lastCleanupResult.killedCount,
              })}
            </div>
          )}

          <button
            type="button"
            disabled={isChecking || !isConnected || termuxRunning || Boolean(cleaningProcesses)}
            onClick={() => void onCleanupProcesses?.(true)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors"
          >
            {cleaningProcesses ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Activity className="w-4 h-4 shrink-0" />
            )}
            <span>{cleaningProcesses ? t('tmx_cleanup_running') : t('tmx_cleanup_btn')}</span>
          </button>
        </div>

        <div className="dp-panel p-3.5 sm:p-5 space-y-3 min-w-0">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
              <span>{t('tmx_pip_ssl_title')}</span>
            </h3>
            <p className="text-xs text-[var(--ide-text-muted)] leading-relaxed">
              {t('tmx_pip_ssl_desc')}
            </p>
          </div>

          <button
            type="button"
            disabled={!isConnected || !!busyAction || termuxRunning || upgradingTermux}
            onClick={async () => {
              if (!onRebuildPipCertifi || busyAction) return;
              setBusyAction('pip-ssl');
              try {
                await onRebuildPipCertifi();
              } finally {
                setBusyAction(null);
              }
            }}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-accent)] disabled:opacity-50 text-xs font-medium inline-flex items-center gap-2 transition-colors"
          >
            {busyAction === 'pip-ssl' ? (
              <Loader2 className="w-4 h-4 animate-spin text-[var(--ide-accent)] shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
            )}
            <span>{t('tmx_pip_ssl_btn')}</span>
          </button>

          {onToggleTrustedHost && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)]">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-[var(--ide-text)]">
                  {t('tmx_trusted_host_title')}
                </div>
                <p className="text-[11px] text-[var(--ide-text-muted)] mt-0.5 leading-relaxed">
                  {t('tmx_trusted_host_desc')}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(pipTrustedHostEmergency)}
                onClick={() => onToggleTrustedHost(!pipTrustedHostEmergency)}
                className={`min-h-[44px] w-14 rounded-full p-1 transition-colors flex items-center shrink-0 ${
                  pipTrustedHostEmergency
                    ? 'bg-amber-600 justify-end'
                    : 'bg-slate-300 dark:bg-slate-700 justify-start'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-white shadow-sm" />
              </button>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Termux Remote Package & Tool Installer */}
      {(showPackages || showShell) && (
      <div className="dp-panel p-3.5 sm:p-5 space-y-4 min-w-0">
        {showPackages && (
          <TermuxPackageWorkspace
            healthInfo={healthInfo}
            onInstallInTermux={onInstallInTermux}
            onUpgradeAllTermux={onUpgradeAllTermux}
            onUpgradeAllPackages={onUpgradeAllPackages}
            onUninstallInTermux={onUninstallInTermux}
            upgradingTermux={upgradingTermux}
            termuxRunning={termuxRunning}
            activeTermuxTask={activeTermuxTask}
          />
        )}

        {/* Direct Termux Shell Command Runner */}
        {showShell && (
          <div className={showPackages ? 'pt-2 border-t border-[var(--ide-border)] space-y-3' : 'space-y-3'}>
            <form onSubmit={handleShellSubmit} className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-[var(--ide-accent-text)] shrink-0">
                $
              </span>
              <input
                type="text"
                value={shellCmd}
                onChange={(e) => setShellCmd(e.target.value)}
                placeholder={t('tmx_shell_placeholder')}
                className="flex-1 min-w-0 min-h-[44px] px-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
              />
              <button
                type="submit"
                disabled={!shellCmd.trim() || !!busyAction || termuxRunning || upgradingTermux}
                className="min-h-[44px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-medium whitespace-nowrap shrink-0 disabled:opacity-40 transition-colors"
              >
                {busyAction === 'shell' ? t('tmx_shell_running') : t('tmx_shell_btn')}
              </button>
            </form>

            {visibleSection === 'shell' && (
              <div className="flex flex-wrap gap-1.5">
                {['python3 --version', 'pip list', 'pip list --outdated', 'pkg list-installed', 'df -h'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={!!busyAction || termuxRunning || upgradingTermux}
                    onClick={() => {
                      setBusyAction('shell');
                      void onRunShellInTermux(preset).finally(() => setBusyAction(null));
                    }}
                    className="min-h-[44px] px-2.5 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-accent)] font-mono text-[11px] text-[var(--ide-text)] disabled:opacity-40 transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </section>
  );
};

import React from 'react';
import { HardDrive, Package, Sliders, Terminal, X } from 'lucide-react';
import {
  EditorSettings,
  ExecutionEngine,
  InstalledPackage,
  NegativeScreenSection,
  PackageBackupStatus,
  ProcessCleanupResult,
  PyodideStatus,
  PythonFile,
  TermuxConfig,
  TermuxConnectionState,
  TermuxHealthInfo,
} from '../types/ide';
import { ToolsAndPackages } from './ToolsAndPackages';
import { useI18n } from '../services/i18n';
import { OutdatedPackageInfo } from '../services/pyodideRuntime';
import { TermuxOutdatedPipItem } from '../services/termuxBridge';

declare global {
  interface Window { __droidpySettingsBack?: () => boolean; __droidpyToolsBack?: () => boolean; }
}
import { AppUpdateCheckResult } from '../services/appUpdater';

interface NegativeScreenDrawerProps {
  open: boolean;
  section: NegativeScreenSection;
  onChangeSection: (section: NegativeScreenSection) => void;
  onClose: () => void;
  files: PythonFile[];
  activeFile: PythonFile;
  settings: EditorSettings;
  onUpdateSettings: (patch: Partial<EditorSettings>) => void;
  onResetWorkspace: () => void;
  pyodideStatus: PyodideStatus;
  installedPackages: InstalledPackage[];
  onInstallPackage: (pkg: string) => Promise<void>;
  onRefreshPackages: () => Promise<void>;
  outdatedPackages?: OutdatedPackageInfo[];
  checkingOutdated?: boolean;
  upgradingPackages?: boolean;
  onUpgradePackage?: (pkg: string) => Promise<void>;
  onUninstallPackage?: (pkg: string) => Promise<void>;
  onCheckAndUpgradeAll?: () => Promise<void>;
  onUpgradeAllPackages?: () => Promise<void>;
  onUpgradeAllTermux?: (kind: 'pip' | 'pkg') => Promise<void>;
  onUpgradeSingleTermuxPip?: (pkg: string) => Promise<void>;
  outdatedTermuxPips?: TermuxOutdatedPipItem[];
  checkingTermuxOutdated?: boolean;
  onCheckTermuxOutdated?: () => Promise<void>;
  onUninstallInTermux?: (mode: 'pip' | 'pkg', target: string) => Promise<void>;
  upgradingTermux?: boolean;
  termuxRunning?: boolean;
  termuxActiveTask?: string | null;
  activePyodidePackage?: string | null;
  appUpdateResult?: AppUpdateCheckResult | null;
  checkingAppUpdate?: boolean;
  onOpenUpdateModal?: () => void;
  linkedDirName: string | null;
  onLinkDirectory: () => Promise<void>;
  onImportFromDirectory: () => Promise<void>;
  onSaveToDirectory: () => Promise<void>;
  engine: ExecutionEngine;
  onChangeEngine: (engine: ExecutionEngine) => void;
  termuxConfig: TermuxConfig;
  onUpdateTermuxConfig: (patch: Partial<TermuxConfig>) => void;
  termuxConnectionState: TermuxConnectionState;
  termuxError: string | null;
  termuxHealth: TermuxHealthInfo | null;
  onTestTermuxConnection: () => Promise<void>;
  onInstallInTermux: (mode: 'pip' | 'pkg', target: string) => Promise<void>;
  onRunInTermux: () => Promise<void>;
  onRunShellInTermux: (cmd: string) => Promise<boolean | void>;
  onGenerateRequirements: () => void;
  onInstallRequirements: () => Promise<void>;
  onSaveWorkspaceFile: (filename: string, content: string, openInEditor?: boolean) => void;
  onOpenHelp: () => void;
  onOpenLogs: () => void;
  backupStatus?: PackageBackupStatus | null;
  onRestoreBackedUpPackages?: () => Promise<void>;
  restoringBackup?: boolean;
  onCleanupProcesses?: (manual?: boolean) => Promise<void>;
  cleaningProcesses?: boolean;
  lastCleanupResult?: ProcessCleanupResult | null;
  onRebuildPipCertifi?: () => Promise<void>;
  onNotify: (msg: string) => void;
}

export const NegativeScreenDrawer: React.FC<NegativeScreenDrawerProps> = ({
  open,
  section,
  onChangeSection,
  onClose,
  files,
  activeFile,
  settings,
  onUpdateSettings,
  onResetWorkspace,
  pyodideStatus,
  installedPackages,
  onInstallPackage,
  onRefreshPackages,
  outdatedPackages,
  checkingOutdated,
  upgradingPackages,
  onUpgradePackage,
  onUninstallPackage,
  onCheckAndUpgradeAll,
  onUpgradeAllPackages,
  onUpgradeAllTermux,
  onUpgradeSingleTermuxPip,
  outdatedTermuxPips,
  checkingTermuxOutdated,
  onCheckTermuxOutdated,
  onUninstallInTermux,
  upgradingTermux,
  termuxRunning = false,
  termuxActiveTask = null,
  activePyodidePackage = null,
  appUpdateResult,
  checkingAppUpdate,
  onOpenUpdateModal,
  linkedDirName,
  onLinkDirectory,
  onImportFromDirectory,
  onSaveToDirectory,
  engine,
  onChangeEngine,
  termuxConfig,
  onUpdateTermuxConfig,
  termuxConnectionState,
  termuxError,
  termuxHealth,
  onTestTermuxConnection,
  onInstallInTermux,
  onRunInTermux,
  onRunShellInTermux,
  onGenerateRequirements,
  onInstallRequirements,
  onSaveWorkspaceFile,
  onOpenHelp,
  onOpenLogs,
  backupStatus,
  onRestoreBackedUpPackages,
  restoringBackup,
  onCleanupProcesses,
  cleaningProcesses,
  lastCleanupResult,
  onRebuildPipCertifi,
  onNotify,
}) => {
  const { t } = useI18n();
  const backdropTouchRef = React.useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [showCategories, setShowCategories] = React.useState(true);
  React.useEffect(() => {
    window.__droidpySettingsBack = () => {
      if (window.__droidpyToolsBack?.()) return true;
      if (!showCategories) { setShowCategories(true); return true; }
      return false;
    };
    return () => { delete window.__droidpySettingsBack; };
  }, [showCategories]);
  React.useEffect(() => {
    if (open) setShowCategories(true);
  }, [open]);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex bg-[var(--ide-bg)]"
      onTouchStart={(e) => {
        const touch = e.touches[0];
        if (!touch) return;
        backdropTouchRef.current = { x: touch.clientX, y: touch.clientY, moved: false };
      }}
      onTouchMove={(e) => {
        const start = backdropTouchRef.current;
        const touch = e.touches[0];
        if (!start || !touch) return;
        if (Math.abs(touch.clientX - start.x) > 12 || Math.abs(touch.clientY - start.y) > 12) {
          start.moved = true;
        }
      }}
      onClick={(e) => {
        const touch = backdropTouchRef.current;
        backdropTouchRef.current = null;
        if (touch?.moved || e.target !== e.currentTarget) return;
        onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('neg_title')}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="w-full h-full rounded-none bg-[var(--ide-bg)] text-[var(--ide-text)] flex flex-col overflow-hidden"
      >
        {/* Drawer Header */}
        <div className="px-4 py-3.5 pt-safe border-b border-[var(--ide-border)] bg-[var(--md-surface-container-low)] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/icon.svg"
              alt="DroidPy"
              className="w-9 h-9 rounded-xl shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <h2 className="text-base font-bold truncate">{t('neg_title')}</h2>
              <p className="text-xs text-[var(--ide-text-muted)] truncate mt-0.5">{t('neg_subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('btn_done')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full border border-[var(--ide-border)] bg-[var(--ide-bg)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {showCategories ? (
          <div className="flex-1 min-h-0 overflow-y-auto ide-scroll px-3 py-3 pb-safe">
            <div className="mb-3 px-1">
              <h3 className="text-base font-semibold text-[var(--ide-text)]">{t('neg_category_heading')}</h3>
              <p className="mt-1 text-xs text-[var(--ide-text-muted)]">{t('neg_category_hint')}</p>
            </div>
            <div className="divide-y divide-[var(--ide-border)] rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] overflow-hidden">
              {[
                { id: 'termux' as const, label: t('neg_category_termux'), Icon: Terminal, desc: t('neg_category_termux_desc') },
                { id: 'packages' as const, label: t('neg_category_packages'), Icon: Package, desc: t('neg_category_packages_desc') },
                { id: 'android' as const, label: t('neg_category_android'), Icon: HardDrive, desc: t('neg_category_android_desc') },
                { id: 'settings' as const, label: t('neg_category_personalization'), Icon: Sliders, desc: t('neg_category_personalization_desc') },
              ].map(({ id, label, Icon, desc }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { onChangeSection(id); setShowCategories(false); }}
                  className="w-full min-h-[76px] px-3.5 py-3 flex items-center gap-3 text-left active:bg-[var(--ide-surface-alt)]"
                >
                  <span className="w-11 h-11 rounded-2xl bg-[var(--ide-accent-soft)] text-[var(--ide-accent)] flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[var(--ide-text)]">{label}</span>
                    <span className="block text-xs text-[var(--ide-text-muted)] mt-1">{desc}</span>
                  </span>
                  <span className="relative shrink-0">
                    <span className="text-[var(--ide-text-muted)] text-lg">›</span>
                    {id === 'settings' && appUpdateResult?.hasUpdate && <span className="absolute -right-1 -top-1 w-2 h-2 rounded-full bg-[var(--ide-accent)]" />}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-[var(--ide-border)] shrink-0">
              <button
                type="button"
                onClick={() => setShowCategories(true)}
                className="min-h-[44px] px-2 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ide-accent-text)]"
              >
                <span aria-hidden="true">‹</span>
                <span>返回設定</span>
              </button>
            </div>
        {/* Selected settings category */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ToolsAndPackages
            activeSubView={section}
            compactDrawer
            files={files}
            activeFile={activeFile}
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            onResetWorkspace={onResetWorkspace}
            pyodideStatus={pyodideStatus}
            installedPackages={installedPackages}
            activePyodidePackage={activePyodidePackage}
            onInstallPackage={onInstallPackage}
            onRefreshPackages={onRefreshPackages}
            outdatedPackages={outdatedPackages}
            checkingOutdated={checkingOutdated}
            upgradingPackages={upgradingPackages}
            onUpgradePackage={onUpgradePackage}
            onUninstallPackage={onUninstallPackage}
            onCheckAndUpgradeAll={onCheckAndUpgradeAll}
            onUpgradeAllPackages={onUpgradeAllPackages}
            onUpgradeAllTermux={onUpgradeAllTermux}
            onUpgradeSingleTermuxPip={onUpgradeSingleTermuxPip}
            outdatedTermuxPips={outdatedTermuxPips}
            checkingTermuxOutdated={checkingTermuxOutdated}
            onCheckTermuxOutdated={onCheckTermuxOutdated}
            onUninstallInTermux={onUninstallInTermux}
            upgradingTermux={upgradingTermux}
            termuxRunning={termuxRunning}
            termuxActiveTask={termuxActiveTask}
            appUpdateResult={appUpdateResult}
            checkingAppUpdate={checkingAppUpdate}
            onOpenUpdateModal={
              onOpenUpdateModal
                ? () => {
                    onClose();
                    onOpenUpdateModal();
                  }
                : undefined
            }
            linkedDirName={linkedDirName}
            onLinkDirectory={onLinkDirectory}
            onImportFromDirectory={onImportFromDirectory}
            onSaveToDirectory={onSaveToDirectory}
            engine={engine}
            onChangeEngine={onChangeEngine}
            termuxConfig={termuxConfig}
            onUpdateTermuxConfig={onUpdateTermuxConfig}
            termuxConnectionState={termuxConnectionState}
            termuxError={termuxError}
            termuxHealth={termuxHealth}
            onTestTermuxConnection={onTestTermuxConnection}
            onInstallInTermux={onInstallInTermux}
            onRunInTermux={async () => {
              onClose();
              await onRunInTermux();
            }}
            onRunShellInTermux={async (cmd) => {
              onClose();
              await onRunShellInTermux(cmd);
            }}
            onGenerateRequirements={onGenerateRequirements}
            onInstallRequirements={async () => {
              onClose();
              await onInstallRequirements();
            }}
            onSaveWorkspaceFile={onSaveWorkspaceFile}
            onOpenHelp={() => {
              onClose();
              onOpenHelp();
            }}
            onOpenLogs={() => {
              onClose();
              onOpenLogs();
            }}
            backupStatus={backupStatus}
            onRestoreBackedUpPackages={
              onRestoreBackedUpPackages
                ? async () => {
                    onClose();
                    await onRestoreBackedUpPackages();
                  }
                : undefined
            }
            restoringBackup={restoringBackup}
            onCleanupProcesses={onCleanupProcesses}
            cleaningProcesses={cleaningProcesses}
            lastCleanupResult={lastCleanupResult}
            onRebuildPipCertifi={onRebuildPipCertifi}
            onNotify={onNotify}
          />
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};

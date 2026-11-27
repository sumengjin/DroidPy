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

interface SettingsWorkspaceProps {
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

export const SettingsWorkspace: React.FC<SettingsWorkspaceProps> = ({
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
      className="fixed inset-0 z-50 flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)]"
      role="region"
      aria-label={t('neg_title')}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="w-full h-full flex flex-col overflow-hidden"
      >
        {/* Independent settings workspace header */}
        <header className="px-5 py-3 pt-safe flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight truncate">{t('neg_title')}</h1>
            <p className="text-xs text-[var(--ide-text-muted)] truncate mt-0.5">{t('neg_subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('btn_done')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-transparent bg-transparent text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col md:flex-row">
        <div className={`${showCategories ? 'flex' : 'hidden'} md:flex flex-1 min-h-0 overflow-y-auto ide-scroll px-3 py-3 pb-safe md:flex-none md:w-64 md:border-r md:border-[var(--ide-border)] flex-col gap-2`}>
          
            <div className="mb-3 px-1">
              <h3 className="text-base font-semibold text-[var(--ide-text)]">{t('neg_category_heading')}</h3>
              <p className="mt-1 text-xs text-[var(--ide-text-muted)]">{t('neg_category_hint')}</p>
            </div>
            <div className="flex flex-col gap-1">
              {[
                { id: 'termux' as const, label: t('neg_category_termux'), Icon: Terminal, desc: t('neg_category_termux_desc') },
                { id: 'packages' as const, label: t('neg_category_packages'), Icon: Package, desc: t('neg_category_packages_desc') },
                { id: 'android' as const, label: t('neg_category_android'), Icon: HardDrive, desc: t('neg_category_android_desc') },
                { id: 'settings' as const, label: t('neg_category_personalization'), Icon: Sliders, desc: t('neg_category_personalization_desc') },
              ].map(({ id, label, Icon, desc }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onChangeSection(id);
                    // Keep the category rail logically open on wide layouts; it remains visible beside the detail pane.
                    setShowCategories(window.matchMedia('(min-width: 768px)').matches);
                  }}
                  aria-current={section === id ? 'page' : undefined}
                  className={`w-full min-h-[68px] px-3 py-2.5 flex items-center gap-3 text-left rounded-xl border transition-colors ${
                    section === id
                      ? 'border-[var(--ide-accent)]/75 text-[var(--ide-accent-text)]'
                      : 'border-transparent bg-transparent text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
                  }`}
                >
                  <span className="w-10 h-10 flex items-center justify-center shrink-0 text-current">
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-current">{label}</span>
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
          <div className={`${showCategories ? 'hidden' : 'flex'} md:flex flex-1 min-w-0 min-h-0 overflow-hidden flex-col`}>
            <div className="px-3 py-2 border-b border-[var(--ide-border)] shrink-0 md:hidden">
              <button
                type="button"
                onClick={() => setShowCategories(true)}
                className="min-h-[44px] px-2 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ide-accent-text)]"
              >
                <span aria-hidden="true">‹</span>
                <span>{t('neg_back_categories')}</span>
              </button>
            </div>
        {/* Selected settings category */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ToolsAndPackages
            activeSubView={section}
            workspaceMode
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
        </div>
      </aside>
    </div>
  );
};

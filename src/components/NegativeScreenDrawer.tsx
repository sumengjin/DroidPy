import React from 'react';
import { HardDrive, Package, Sliders, Terminal, X } from 'lucide-react';
import {
  EditorSettings,
  ExecutionEngine,
  InstalledPackage,
  NegativeScreenSection,
  PackageBackupStatus,
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
  onInitializeEmbeddedEnv: (includeBaseSystem: boolean) => Promise<void>;
  onGenerateRequirements: () => void;
  onInstallRequirements: () => Promise<void>;
  onSaveWorkspaceFile: (filename: string, content: string, openInEditor?: boolean) => void;
  onOpenHelp: () => void;
  onOpenLogs: () => void;
  backupStatus?: PackageBackupStatus | null;
  onRestoreBackedUpPackages?: () => Promise<void>;
  restoringBackup?: boolean;
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
  onInitializeEmbeddedEnv,
  onGenerateRequirements,
  onInstallRequirements,
  onSaveWorkspaceFile,
  onOpenHelp,
  onOpenLogs,
  backupStatus,
  onRestoreBackedUpPackages,
  restoringBackup,
  onNotify,
}) => {
  const { t } = useI18n();
  const touchStartX = React.useRef<number | null>(null);
  const touchStartY = React.useRef<number | null>(null);

  if (!open) return null;

  const tabs: { id: NegativeScreenSection; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'termux', label: t('neg_tab_termux'), Icon: Terminal },
    { id: 'packages', label: t('neg_tab_packages'), Icon: Package },
    { id: 'android', label: t('neg_tab_storage'), Icon: HardDrive },
    { id: 'settings', label: t('neg_tab_system'), Icon: Sliders },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/50 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('neg_title')}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          touchStartX.current = touch.clientX;
          touchStartY.current = touch.clientY;
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null || touchStartY.current === null) return;
          const touch = e.changedTouches[0];
          const dx = touch.clientX - touchStartX.current;
          const dy = Math.abs(touch.clientY - touchStartY.current);
          touchStartX.current = null;
          touchStartY.current = null;
          // Swipe left on drawer to dismiss
          if (dx < -64 && dy < 60) {
            onClose();
          }
        }}
        className="w-[90vw] max-w-[460px] h-full bg-[var(--ide-bg)] text-[var(--ide-text)] border-r border-[var(--ide-border)] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Drawer Header */}
        <div className="px-4 py-3 pt-safe border-b border-[var(--ide-border)] bg-[var(--ide-surface)] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/icon.svg"
              alt="DroidPy"
              className="w-7 h-7 rounded-lg shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <h2 className="text-sm font-bold truncate">{t('neg_title')}</h2>
              <p className="text-[11px] text-[var(--ide-text-muted)] truncate">{t('neg_subtitle')}</p>
            </div>
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

        {/* Segmented Drawer Tabs */}
        <div className="px-2.5 sm:px-3 py-2 border-b border-[var(--ide-border)] bg-[var(--ide-surface-alt)] shrink-0">
          <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)]">
            {tabs.map(({ id, label, Icon }) => {
              const active = section === id;
              const showDot = id === 'settings' && Boolean(appUpdateResult?.hasUpdate);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChangeSection(id)}
                  className={`relative min-h-[38px] min-w-0 px-1.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 transition-colors ${
                    active
                      ? 'bg-[var(--ide-accent)] text-white font-semibold shadow-xs'
                      : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{label}</span>
                  {showDot && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        active ? 'bg-white' : 'bg-[var(--ide-accent)]'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Drawer Content */}
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
            onInitializeEmbeddedEnv={async (includeBase) => {
              onClose();
              await onInitializeEmbeddedEnv(includeBase);
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
            onNotify={onNotify}
          />
        </div>
      </aside>
    </div>
  );
};

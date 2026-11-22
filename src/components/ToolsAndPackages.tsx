import React, { useEffect, useMemo, useState } from 'react';
import {
  Package,
  Download,
  Smartphone,
  Sliders,
  Terminal,
  RefreshCw,
  Check,
  Loader2,
  Cpu,
  HardDrive,
  FolderSync,
  ShieldCheck,
  Palette,
  Languages,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  ArrowUpCircle,
  Search,
  Sparkles,
  PackageCheck,
} from 'lucide-react';
import JSZip from 'jszip';
import {
  EditorSettings,
  ExecutionEngine,
  InstalledPackage,
  PythonFile,
  PyodideStatus,
  SdcardStatusInfo,
  TermuxConfig,
  TermuxConnectionState,
  TermuxHealthInfo,
} from '../types/ide';
import { PWAInstallButton } from './PWAInstallButton';
import { TermuxIntegrationPanel } from './TermuxIntegrationPanel';
import { InternalStoragePanel } from './InternalStoragePanel';
import { IDE_THEMES } from '../services/themes';
import { LOCALE_OPTIONS, TranslationKey, getLocalizedThemeText, useI18n } from '../services/i18n';
import { generateGitHubApkProjectZip } from '../services/androidApkBuilder';
import { downloadBlob } from '../utils/downloadBlob';
import { getSdcardStatus } from '../services/termuxBridge';
import {
  StorageEstimateInfo,
  formatStorageBytes,
  getStorageStatus,
  requestPersistentStorage,
  supportsDirectoryAccess,
} from '../services/storageManager';
import {
  PACKAGE_CATALOG,
  PACKAGE_CATEGORIES,
  PackageCategoryId,
  PackageTier,
  fuzzyMatchPackages,
} from '../data/packageCatalog';
import { OutdatedPackageInfo } from '../services/pyodideRuntime';
import { AppUpdateCheckResult, getInstalledAppVersion } from '../services/appUpdater';

interface ToolsAndPackagesProps {
  activeSubView?: 'termux' | 'packages' | 'android' | 'settings' | 'all';
  compactDrawer?: boolean;
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
  onCheckAndUpgradeAll?: () => Promise<void>;
  onUpgradeAllTermux?: (kind: 'pip' | 'pkg') => Promise<void>;
  onUpgradeSingleTermuxPip?: (pkg: string) => Promise<void>;
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
  onRunShellInTermux: (cmd: string) => Promise<void>;
  onInitializeEmbeddedEnv: (includeBaseSystem: boolean) => Promise<void>;
  onGenerateRequirements: () => void;
  onInstallRequirements: () => Promise<void>;
  onSaveWorkspaceFile: (filename: string, content: string, openInEditor?: boolean) => void;
  onOpenHelp?: () => void;
  onOpenLogs?: () => void;
  onNotify: (msg: string) => void;
}

export const ToolsAndPackages: React.FC<ToolsAndPackagesProps> = ({
  activeSubView = 'all',
  compactDrawer = false,
  files,
  activeFile,
  settings,
  onUpdateSettings,
  onResetWorkspace,
  pyodideStatus,
  installedPackages,
  onInstallPackage,
  onRefreshPackages,
  outdatedPackages = [],
  checkingOutdated = false,
  upgradingPackages = false,
  onUpgradePackage,
  onCheckAndUpgradeAll,
  onUpgradeAllTermux,
  onUpgradeSingleTermuxPip,
  upgradingTermux = false,
  appUpdateResult,
  checkingAppUpdate = false,
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
  onNotify,
}) => {
  const { locale, t } = useI18n();
  const [pkgQuery, setPkgQuery] = useState('');
  const [installingPkg, setInstallingPkg] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<'all' | PackageTier>('all');
  const [catFilter, setCatFilter] = useState<PackageCategoryId>('all');
  const [appPackageName, setAppPackageName] = useState('org.droidpy.app');
  const [appTitle, setAppTitle] = useState('DroidPyApp');
  const [confirmReset, setConfirmReset] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageEstimateInfo>({
    supported: false,
    usageBytes: 0,
    quotaBytes: 0,
    persisted: false,
  });
  const [requestingPersist, setRequestingPersist] = useState(false);
  const [refreshingStorage, setRefreshingStorage] = useState(false);
  const [sdcardStatus, setSdcardStatus] = useState<SdcardStatusInfo | null>(null);
  const [showAdvancedExport, setShowAdvancedExport] = useState(!compactDrawer);
  const isNativeApk = Boolean(termuxHealth?.embedded || window.DroidPyNative?.isNativeApp?.());
  const [nativeStorageGranted, setNativeStorageGranted] = useState<boolean>(() =>
    Boolean(window.DroidPyNative?.hasStoragePermission?.())
  );

  const pyodideCatalog = useMemo(
    () => PACKAGE_CATALOG.filter((item) => Boolean(item.pyodide?.supported)),
    []
  );

  const filteredPyCatalog = useMemo(
    () =>
      pyodideCatalog.filter((item) => {
        if (tierFilter !== 'all' && item.tier !== tierFilter) return false;
        if (catFilter !== 'all' && item.category !== catFilter) return false;
        return true;
      }),
    [pyodideCatalog, tierFilter, catFilter]
  );

  const fuzzyPyResults = useMemo(() => {
    const q = pkgQuery.trim();
    if (!q) return [];
    return fuzzyMatchPackages(q, PACKAGE_CATALOG, { runtime: 'pyodide', limit: 6 });
  }, [pkgQuery]);

  const outdatedMap = useMemo(() => {
    const map = new Map<string, OutdatedPackageInfo>();
    for (const item of outdatedPackages) {
      map.set(item.name.toLowerCase(), item);
    }
    return map;
  }, [outdatedPackages]);

  const refreshStorage = async (showNotice = false) => {
    setRefreshingStorage(true);
    try {
      const info = await getStorageStatus();
      setStorageInfo(info);
      let nextSd: SdcardStatusInfo | null = null;
      if (isNativeApk) {
        try {
          nextSd = await getSdcardStatus(termuxConfig);
          setSdcardStatus(nextSd);
          setNativeStorageGranted(nextSd.granted);
        } catch {
          setNativeStorageGranted(Boolean(window.DroidPyNative?.hasStoragePermission?.()));
        }
      }
      if (showNotice) {
        const displayUsed =
          isNativeApk && nextSd?.totalBytes ? (nextSd.usedBytes ?? 0) : info.usageBytes;
        const displayQuota =
          isNativeApk && nextSd?.totalBytes ? nextSd.totalBytes : info.quotaBytes;
        onNotify(
          t('set_quota_refreshed', {
            used: formatStorageBytes(displayUsed),
            quota: formatStorageBytes(displayQuota),
          })
        );
      }
    } finally {
      setRefreshingStorage(false);
    }
  };

  useEffect(() => {
    void refreshStorage(false);
    if (!isNativeApk) return;
    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshStorage(false);
      }
    };
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);
    return () => {
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNativeApk]);

  const handleRequestPersist = async () => {
    setRequestingPersist(true);
    try {
      const granted = await requestPersistentStorage();
      await refreshStorage(false);
      onNotify(granted ? t('set_persist_toast_ok') : t('set_persist_toast_auto'));
    } finally {
      setRequestingPersist(false);
    }
  };

  const handleInstall = async (target: string) => {
    const clean = target.trim();
    if (!clean || installingPkg) return;
    setInstallingPkg(clean);
    try {
      await onInstallPackage(clean);
      setPkgQuery('');
    } finally {
      setInstallingPkg(null);
    }
  };

  const handleExportBuildozerBundle = async () => {
    const zip = new JSZip();
    for (const f of files) {
      zip.file(f.name, f.content);
    }

    const pkgList = installedPackages.map((p) => p.name).filter((n) => n !== 'micropip' && n !== 'packaging');
    const reqs = ['python3', 'kivy', ...pkgList].join(',');
    const perms = settings.androidStoragePermission
      ? 'INTERNET,VIBRATE,READ_EXTERNAL_STORAGE,WRITE_EXTERNAL_STORAGE,MANAGE_EXTERNAL_STORAGE,READ_MEDIA_IMAGES'
      : 'INTERNET,VIBRATE';

    const buildozerSpec = `[app]
title = ${appTitle || 'DroidPyApp'}
package.name = ${appTitle.toLowerCase().replace(/[^a-z0-9]/g, '') || 'droidpyapp'}
package.domain = ${appPackageName.split('.').slice(0, 2).join('.') || 'org.droidpy'}
source.dir = .
source.include_exts = py,png,jpg,kv,atlas,json
version = 0.1.0
requirements = ${reqs}
orientation = portrait
fullscreen = 0
android.permissions = ${perms}
android.api = 34
android.minapi = 24
android.archs = arm64-v8a, armeabi-v7a

[buildozer]
log_level = 2
warn_on_root = 1
`;
    zip.file('buildozer.spec', buildozerSpec);
    zip.file(
      'README_ANDROID.txt',
      `DroidPy Android APK 與儲存權限 / C++ NDK 打包說明
===============================================
1. 儲存管理權限設定：
   ${
     settings.androidStoragePermission
       ? '已啟用外部儲存權限 (READ/WRITE/MANAGE_EXTERNAL_STORAGE)。Android 11+ 若需完整存取 /sdcard，請在程式啟動後呼叫 android.permissions.request_permissions() 並引導開啟「所有檔案存取權」。'
       : '目前僅啟用基本權限 (INTERNET, VIBRATE)。'
   }

2. 安裝 Linux / WSL2 C/C++ 與 Android 編譯相依套件（Ubuntu / Debian）：
   sudo apt update
   sudo apt install -y git zip unzip openjdk-17-jdk python3-pip \\
     autoconf libtool pkg-config zlib1g-dev libncurses5-dev \\
     libncursesw5-dev libtinfo6 cmake libffi-dev libssl-dev \\
     clang build-essential

3. 安裝 Buildozer 與 Cython（用於編譯 Python C/C++ 擴充模組）：
   pip install --upgrade buildozer cython

4. 解壓縮本專案並觸發 NDK + C/C++ 交叉編譯（生成 arm64-v8a / armeabi-v7a APK）：
   buildozer -v android debug

5. 編譯完成後使用 ADB 安裝至 Android 手機：
   adb install -r bin/*.apk
`
    );

    const blob = await zip.generateAsync({ type: 'blob' });
    await downloadBlob(
      blob,
      `${appTitle.toLowerCase().replace(/[^a-z0-9]/g, '') || 'droidpy'}-android-apk-src.zip`
    );
    onNotify('已匯出 Buildozer Android APK 專案包');
  };

  const handleExportTermuxScript = async () => {
    const zip = new JSZip();
    for (const f of files) {
      zip.file(f.name, f.content);
    }
    const entryFile = files.find((f) => f.name === 'main.py')?.name ?? files[0]?.name ?? 'main.py';
    const pkgNames = installedPackages
      .map((p) => p.name)
      .filter((n) => !['micropip', 'packaging', 'pyodide-http'].includes(n));

    const termuxPrebuiltMap: Record<string, string> = {
      numpy: 'python-numpy',
      pillow: 'python-pillow',
      cryptography: 'python-cryptography',
      lxml: 'python-lxml',
    };
    const termuxPkgs = new Set<string>([
      'python',
      'clang',
      'make',
      'cmake',
      'pkg-config',
      'binutils',
      'libffi',
      'openssl',
    ]);
    const pipRemaining: string[] = [];

    for (const pkg of pkgNames) {
      const mapped = termuxPrebuiltMap[pkg.toLowerCase()];
      if (mapped) {
        termuxPkgs.add(mapped);
      } else {
        pipRemaining.push(pkg);
      }
    }

    const script = `#!/data/data/com.termux/files/usr/bin/bash
set -e

${
  settings.androidStoragePermission
    ? 'echo "[DroidPy] 正在申請 Android 外部儲存空間存取權限 (/sdcard)..."\ntermux-setup-storage || true'
    : '# 未勾選外部儲存權限授權'
}

echo "[DroidPy] 正在配置 Android Termux Python 與 C/C++ 編譯環境 (clang / cmake / NDK headers)..."
pkg update -y
pkg install -y ${Array.from(termuxPkgs).join(' ')}

${
  pipRemaining.length > 0
    ? `echo "[DroidPy] 正在透過 pip 安裝其餘套件..."\npip install --upgrade pip\npip install ${pipRemaining.join(' ')}`
    : '# 無額外第三方 pip 套件需安裝'
}

echo "[DroidPy] 啟動 ${entryFile}..."
python ${entryFile}
`;
    zip.file('run_termux.sh', script);
    const blob = await zip.generateAsync({ type: 'blob' });
    await downloadBlob(blob, 'droidpy-termux-bundle.zip');
    onNotify('已匯出含儲存權限與 C/C++ 工具鏈的 Termux 腳本包');
  };

  const handleExportGitHubApkProject = async () => {
    const blob = await generateGitHubApkProjectZip({
      appTitle: appTitle || 'DroidPy',
      packageId: appPackageName || 'org.droidpy.app',
      includeStoragePermission: settings.androidStoragePermission,
      files,
      bridgeToken: termuxConfig.token,
    });
    await downloadBlob(
      blob,
      `${appTitle.toLowerCase().replace(/[^a-z0-9]/g, '') || 'droidpy'}-github-apk-project.zip`
    );
    onNotify('已匯出 GitHub 獨立 APK 自動打包專案（內嵌 Termux 與爬蟲支援）');
  };

  const showTermux = activeSubView === 'all' || activeSubView === 'termux';
  const showPackages = activeSubView === 'all' || activeSubView === 'packages';
  const showAndroid = activeSubView === 'all' || activeSubView === 'android';
  const showSettings = activeSubView === 'all' || activeSubView === 'settings';
  const canPickFolder = supportsDirectoryAccess();
  const displayUsedBytes =
    isNativeApk && sdcardStatus?.totalBytes ? (sdcardStatus.usedBytes ?? 0) : storageInfo.usageBytes;
  const displayQuotaBytes =
    isNativeApk && sdcardStatus?.totalBytes ? sdcardStatus.totalBytes : storageInfo.quotaBytes;
  const usagePercent =
    displayQuotaBytes > 0
      ? Math.min(100, Math.round((displayUsedBytes / displayQuotaBytes) * 100))
      : 0;

  return (
    <div className="h-full overflow-y-auto ide-scroll bg-[var(--ide-bg)] text-[var(--ide-text)]">
      <div className={`${compactDrawer ? 'p-4 space-y-6' : 'max-w-5xl mx-auto p-4 sm:p-6 space-y-8'}`}>
        {(onOpenHelp || onOpenLogs) && (!compactDrawer || showSettings) && (
          <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
                <span>{t('help_title')}</span>
              </div>
              <p className="text-xs text-[var(--ide-text-muted)] mt-0.5">{t('help_subtitle')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {onOpenLogs && (
                <button
                  type="button"
                  onClick={onOpenLogs}
                  className="min-h-[40px] px-3.5 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-accent)] text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap transition-colors"
                >
                  <FileText className="w-4 h-4 text-[var(--ide-accent)]" />
                  <span>{t('logs_view_btn')}</span>
                </button>
              )}
              {onOpenHelp && (
                <button
                  type="button"
                  onClick={onOpenHelp}
                  className="min-h-[40px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>{t('toolbar_help_title')}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* App Version & In-App Update Card */}
        {onOpenUpdateModal && (!compactDrawer || showSettings) && (
          <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold flex flex-wrap items-center gap-2">
                <PackageCheck className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
                <span>{t('upd_card_title')}</span>
                <span className="font-mono text-xs text-[var(--ide-text-muted)]">
                  v{getInstalledAppVersion()}
                </span>
                {appUpdateResult?.hasUpdate && appUpdateResult.latest && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ide-accent-text)]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{t('upd_badge_new', { ver: appUpdateResult.latest.version })}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--ide-text-muted)] mt-0.5">{t('upd_card_desc')}</p>
            </div>
            <button
              type="button"
              onClick={onOpenUpdateModal}
              className="min-h-[40px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              {checkingAppUpdate ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{t('upd_open_btn')}</span>
            </button>
          </div>
        )}

        {/* Termux Native Bridge & Auto Invocation */}
        {showTermux && (
          <TermuxIntegrationPanel
            engine={engine}
            onChangeEngine={onChangeEngine}
            config={termuxConfig}
            onUpdateConfig={onUpdateTermuxConfig}
            connectionState={termuxConnectionState}
            connectionError={termuxError}
            healthInfo={termuxHealth}
            activeFile={activeFile}
            onTestConnection={onTestTermuxConnection}
            onInstallInTermux={onInstallInTermux}
            onRunInTermux={onRunInTermux}
            onRunShellInTermux={onRunShellInTermux}
            onInitializeEmbeddedEnv={onInitializeEmbeddedEnv}
            onUpgradeAllTermux={onUpgradeAllTermux}
            onUpgradeSinglePip={onUpgradeSingleTermuxPip}
            upgradingTermux={upgradingTermux}
            onNotify={onNotify}
          />
        )}

        {/* Language Switcher */}
        {showSettings && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Languages className="w-5 h-5 text-[var(--ide-accent)]" />
                <span>{t('set_lang_title')}</span>
              </h2>
              <p className="text-xs text-[var(--ide-text-muted)] mt-0.5">
                {t('set_lang_desc')}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {LOCALE_OPTIONS.map((langOpt) => {
                const isSelected = settings.locale === langOpt.id;
                return (
                  <button
                    key={langOpt.id}
                    type="button"
                    onClick={() => {
                      onUpdateSettings({ locale: langOpt.id });
                    }}
                    className={`min-h-[68px] p-3.5 rounded-2xl border text-left flex items-center justify-between gap-2 transition-all ${
                      isSelected
                        ? 'border-[var(--ide-accent)] bg-[var(--ide-accent-soft)]'
                        : 'border-[var(--ide-border)] bg-[var(--ide-surface)] hover:border-[var(--ide-accent)]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--ide-text)] truncate">
                        {langOpt.nativeName}
                      </div>
                      <div className="text-[11px] text-[var(--ide-text-muted)] truncate mt-0.5">
                        {langOpt.subtitle}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[var(--ide-accent)] text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Theme Picker (Always prominent in Settings & Mobile Tools) */}
        {showSettings && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Palette className="w-5 h-5 text-[var(--ide-accent)]" />
                <span>{t('set_theme_title')}</span>
              </h2>
              <p className="text-xs text-[var(--ide-text-muted)] mt-0.5">
                {t('set_theme_desc')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {IDE_THEMES.map((themeItem) => {
                const isSelected = settings.theme === themeItem.id;
                const localized = getLocalizedThemeText(themeItem.id, locale);
                return (
                  <button
                    key={themeItem.id}
                    type="button"
                    onClick={() => {
                      onUpdateSettings({ theme: themeItem.id });
                      onNotify(t('toast_theme_applied', { name: localized.name }));
                    }}
                    className={`min-h-[76px] p-4 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all ${
                      isSelected
                        ? 'border-[var(--ide-accent)] bg-[var(--ide-accent-soft)]'
                        : 'border-[var(--ide-border)] bg-[var(--ide-surface)] hover:border-[var(--ide-accent)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* 3-tone tactile color swatch */}
                      <div
                        className="w-11 h-11 rounded-xl border border-black/10 dark:border-white/10 shrink-0 overflow-hidden grid grid-cols-2"
                        style={{ backgroundColor: themeItem.swatchBg }}
                        aria-hidden="true"
                      >
                        <div style={{ backgroundColor: themeItem.swatchSurface }} />
                        <div style={{ backgroundColor: themeItem.swatchAccent }} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--ide-text)] truncate">
                          {localized.name}
                        </div>
                        <div className="text-xs text-[var(--ide-text-muted)] truncate mt-0.5">
                          {themeItem.category === 'feminine' ? t('theme_cat_feminine') : t('theme_cat_classic')} · {localized.subtitle}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-[var(--ide-accent)] text-white flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Storage Management & Permissions */}
        {(showSettings && !compactDrawer || showAndroid) && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-[var(--ide-accent)]" />
                  <span>{t('set_storage_title')}</span>
                </h2>
                <p className="text-xs text-[var(--ide-text-muted)] mt-0.5">
                  {t('set_storage_desc')}
                </p>
              </div>
              <button
                type="button"
                disabled={refreshingStorage}
                onClick={() => void refreshStorage(true)}
                className="min-h-[40px] px-3.5 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)] text-xs font-medium flex items-center gap-2 hover:border-[var(--ide-accent)] disabled:opacity-60 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingStorage ? 'animate-spin text-[var(--ide-accent)]' : ''}`} />
                <span>{t('set_refresh_quota')}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Persistent Storage & Quota Card */}
              <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[var(--ide-accent)]" />
                      <span>{t('set_persist_title')}</span>
                    </h3>
                    <p className="text-xs text-[var(--ide-text-muted)] mt-1 leading-relaxed">
                      {t('set_persist_desc')}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-[var(--ide-accent-text)] whitespace-nowrap shrink-0">
                    {storageInfo.persisted || isNativeApk ? t('set_persist_ok') : t('set_persist_std')}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-[var(--ide-text-muted)] tabular-nums">
                    <span>{t('set_persist_used', { val: formatStorageBytes(displayUsedBytes) })}</span>
                    <span>{t('set_persist_quota', { val: formatStorageBytes(displayQuotaBytes) })}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--ide-surface-alt)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--ide-accent)] transition-all"
                      style={{ width: `${Math.max(2, usagePercent)}%` }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRequestPersist}
                  disabled={requestingPersist || storageInfo.persisted}
                  className="min-h-[42px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-50 text-white text-xs font-medium inline-flex items-center gap-2 transition-colors"
                >
                  {requestingPersist ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>{storageInfo.persisted ? t('set_persist_btn_ok') : t('set_persist_btn')}</span>
                </button>
              </div>

              {/* Local Device Directory Access Card */}
              <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <FolderSync className="w-4 h-4 text-[var(--ide-accent)]" />
                    <span>{t('set_dir_title')}</span>
                  </h3>
                  <p className="text-xs text-[var(--ide-text-muted)] mt-1 leading-relaxed">
                    {isNativeApk
                      ? nativeStorageGranted
                        ? t('set_dir_apk_ok', { path: sdcardStatus?.rootPath || '/storage/emulated/0' })
                        : t('set_dir_apk_need')
                      : canPickFolder
                      ? t('set_dir_desc_ok')
                      : t('set_dir_desc_no')}
                  </p>
                </div>

                <div className="text-xs text-[var(--ide-text-muted)]">
                  {t('set_dir_current')}
                  <span className="font-mono font-semibold text-[var(--ide-text)] ml-1">
                    {isNativeApk
                      ? nativeStorageGranted
                        ? sdcardStatus?.rootPath || '/storage/emulated/0'
                        : t('set_dir_none')
                      : linkedDirName ?? t('set_dir_none')}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void onLinkDirectory().then(() => {
                        if (isNativeApk) {
                          window.setTimeout(() => void refreshStorage(false), 700);
                        }
                      });
                    }}
                    className="min-h-[42px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-2 transition-colors"
                  >
                    <FolderSync className="w-4 h-4" />
                    <span>
                      {isNativeApk
                        ? nativeStorageGranted
                          ? t('sd_status_ok')
                          : t('set_dir_grant')
                        : linkedDirName
                        ? t('set_dir_change')
                        : t('set_dir_grant')}
                    </span>
                  </button>
                  {linkedDirName && (
                    <>
                      <button
                        type="button"
                        onClick={() => void onImportFromDirectory()}
                        className="min-h-[42px] px-3.5 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-xs font-medium hover:border-[var(--ide-accent)]"
                      >
                        {t('set_dir_load')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void onSaveToDirectory()}
                        className="min-h-[42px] px-3.5 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-xs font-medium hover:border-[var(--ide-accent)]"
                      >
                        {t('set_dir_save')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            {/* Android Internal Storage (/sdcard) Full Manager when running in APK */}
            {isNativeApk && (
              <InternalStoragePanel
                termuxConfig={termuxConfig}
                files={files}
                activeFile={activeFile}
                onOpenSdcardFile={(filename, content) => onSaveWorkspaceFile(filename, content, true)}
                onNotify={onNotify}
              />
            )}
          </section>
        )}

        {/* PyPI Package Manager */}
        {showPackages && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Package className="w-5 h-5 text-[var(--ide-accent)]" />
                  <span>{t('pkg_title')}</span>
                </h2>
                <p className="text-xs text-[var(--ide-text-muted)] mt-0.5">
                  {t('pkg_desc')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onCheckAndUpgradeAll && (
                  <button
                    type="button"
                    onClick={() => void onCheckAndUpgradeAll()}
                    disabled={checkingOutdated || upgradingPackages || pyodideStatus === 'loading'}
                    className="min-h-[40px] px-3.5 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-40 text-white text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap"
                  >
                    {checkingOutdated || upgradingPackages ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ArrowUpCircle className="w-3.5 h-3.5" />
                    )}
                    <span>{t('pkg_upgrade_all')}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onGenerateRequirements}
                  className="min-h-[40px] px-3.5 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)] text-xs font-medium flex items-center gap-2 hover:border-[var(--ide-accent)] transition-colors whitespace-nowrap"
                >
                  <HardDrive className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
                  <span>{t('pkg_req_gen')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void onInstallRequirements()}
                  disabled={!!installingPkg}
                  className="min-h-[40px] px-3.5 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)] text-xs font-medium flex items-center gap-2 hover:border-[var(--ide-accent)] disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
                  <span>{t('pkg_req_install')}</span>
                </button>
                <button
                  type="button"
                  onClick={onRefreshPackages}
                  disabled={pyodideStatus === 'loading'}
                  className="min-h-[40px] px-3.5 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)] text-xs font-medium flex items-center gap-2 hover:border-[var(--ide-accent)] transition-colors whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t('pkg_refresh')}</span>
                </button>
              </div>
            </div>

            {/* Install Input + Fuzzy Autocomplete */}
            <div className="space-y-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleInstall(pkgQuery);
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1 min-w-0">
                  <Search className="w-4 h-4 text-[var(--ide-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={pkgQuery}
                    onChange={(e) => setPkgQuery(e.target.value)}
                    placeholder={t('pkg_placeholder')}
                    className="w-full min-w-0 min-h-[44px] pl-10 pr-4 rounded-xl bg-[var(--ide-surface)] border border-[var(--ide-border)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!pkgQuery.trim() || !!installingPkg}
                  className="min-h-[44px] px-5 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-sm font-medium disabled:opacity-40 flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
                >
                  {installingPkg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>{installingPkg ? t('pkg_installing') : t('pkg_install')}</span>
                </button>
              </form>

              {pkgQuery.trim().length > 0 && fuzzyPyResults.length > 0 && (
                <div className="rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)] overflow-hidden divide-y divide-[var(--ide-border)]">
                  <div className="px-3.5 py-2 bg-[var(--ide-surface-alt)] text-[11px] font-medium text-[var(--ide-text-muted)]">
                    {t('pkg_fuzzy_header')}
                  </div>
                  {fuzzyPyResults.map(({ item, matchedAlias }) => {
                    const targetPkg = item.pyodide?.packageName ?? item.name;
                    const isInstalled = installedPackages.some(
                      (p) => p.name.toLowerCase() === targetPkg.toLowerCase()
                    );
                    const isBusy = installingPkg === targetPkg;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-[var(--ide-bg)] transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => setPkgQuery(targetPkg)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[var(--ide-text)]">
                            <span>{targetPkg}</span>
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
                          disabled={isInstalled || !!installingPkg}
                          onClick={() => void handleInstall(targetPkg)}
                          className={`min-h-[34px] px-3 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                            isInstalled
                              ? 'bg-[var(--ide-accent-soft)] text-[var(--ide-accent-text)]'
                              : 'bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white disabled:opacity-40'
                          }`}
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isInstalled ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>{isInstalled ? t('pkg_installed') : t('pkg_install_short')}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Auto-update Packages on Startup Toggle + C/C++ Note */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[var(--ide-text)]">
                    {t('pkg_auto_update_title')}
                  </div>
                  <p className="text-[11px] text-[var(--ide-text-muted)] mt-0.5 leading-relaxed">
                    {t('pkg_auto_update_desc')}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(settings.autoUpdatePackages)}
                  onClick={() =>
                    onUpdateSettings({ autoUpdatePackages: !settings.autoUpdatePackages })
                  }
                  className={`min-h-[32px] w-12 rounded-full p-1 transition-colors flex items-center shrink-0 ${
                    settings.autoUpdatePackages
                      ? 'bg-[var(--ide-accent)] justify-end'
                      : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-4 text-xs text-[var(--ide-text-muted)] space-y-1">
                <div className="font-semibold text-[var(--ide-text)]">
                  {t('pkg_cpp_title')}
                </div>
                <p className="leading-relaxed">
                  {t('pkg_cpp_desc')}
                </p>
              </div>
            </div>

            {/* Categorized Popular & Niche Packages Catalog */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--ide-surface-alt)] border border-[var(--ide-border)]">
                  {(['all', 'popular', 'niche'] as const).map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setTierFilter(tier)}
                      className={`min-h-[34px] px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                        tierFilter === tier
                          ? 'bg-[var(--ide-surface)] text-[var(--ide-accent-text)] font-semibold shadow-xs'
                          : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
                      }`}
                    >
                      {t(`pkg_tier_${tier}` as TranslationKey)}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-[var(--ide-text-muted)] tabular-nums">
                  {t('pkg_loaded_count', { count: filteredPyCatalog.length })}
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
                      className={`min-h-[36px] px-3 rounded-xl border text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                        active
                          ? 'border-[var(--ide-accent)] bg-[var(--ide-accent-soft)] text-[var(--ide-accent-text)] font-semibold'
                          : 'border-[var(--ide-border)] bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
                      }`}
                    >
                      {t(cat.labelKey as TranslationKey)}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto ide-scroll pr-0.5">
                {filteredPyCatalog.map((item) => {
                  const targetName = item.pyodide?.packageName ?? item.name;
                  const isInstalled = installedPackages.some(
                    (p) => p.name.toLowerCase() === targetName.toLowerCase()
                  );
                  const isBusy = installingPkg === targetName;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)]"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-semibold text-[var(--ide-text)] truncate">
                          {targetName}
                        </div>
                        <div className="text-xs text-[var(--ide-text-muted)] line-clamp-2 mt-0.5 leading-relaxed">
                          {item.desc}
                        </div>
                        <div className="text-[11px] text-[var(--ide-text-muted)] truncate mt-1">
                          {item.tier === 'popular' ? t('pkg_tier_popular') : t('pkg_tier_niche')} · {item.runtimeHint}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isInstalled || !!installingPkg}
                        onClick={() => void handleInstall(targetName)}
                        className={`min-h-[40px] px-3 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors ${
                          isInstalled
                            ? 'bg-[var(--ide-accent-soft)] text-[var(--ide-accent-text)]'
                            : 'bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white disabled:opacity-40'
                        }`}
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isInstalled ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : null}
                        <span>
                          {isInstalled ? t('pkg_installed') : isBusy ? t('pkg_installing') : t('pkg_install_short')}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Installed Packages Table with Manual Per-Package Upgrade */}
            <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--ide-border)] flex items-center justify-between text-xs font-medium text-[var(--ide-text-muted)]">
                <span>{t('pkg_loaded_title')}</span>
                <span className="tabular-nums">{t('pkg_loaded_count', { count: installedPackages.length })}</span>
              </div>
              {installedPackages.length === 0 ? (
                <div className="p-4 text-xs text-[var(--ide-text-muted)]">
                  {t('pkg_loaded_empty')}
                </div>
              ) : (
                <div className="divide-y divide-[var(--ide-border)] max-h-64 overflow-y-auto ide-scroll">
                  {installedPackages.map((pkg) => {
                    const outdated = outdatedMap.get(pkg.name.toLowerCase());
                    const isCoreSystem = ['micropip', 'packaging', 'pyodide-http'].includes(
                      pkg.name.toLowerCase()
                    );
                    return (
                      <div key={pkg.name} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                        <div className="min-w-0">
                          <span className="font-mono font-medium text-[var(--ide-text)]">{pkg.name}</span>
                          {outdated && (
                            <span className="ml-2 font-mono text-[11px] text-[var(--ide-accent-text)] font-semibold">
                              {pkg.version} → {outdated.latestVersion}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="font-mono tabular-nums text-[var(--ide-text-muted)]">
                            {pkg.version}
                          </span>
                          {onUpgradePackage && !isCoreSystem && (
                            <button
                              type="button"
                              disabled={upgradingPackages || !!installingPkg}
                              onClick={() => void onUpgradePackage(pkg.name)}
                              className={`min-h-[30px] px-2.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                                outdated
                                  ? 'bg-[var(--ide-accent)] text-white hover:bg-[var(--ide-accent-hover)]'
                                  : 'border border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-accent)] text-[var(--ide-text)]'
                              } disabled:opacity-40`}
                            >
                              {t('pkg_upgrade_btn')}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Android Deployment & Hardware Bridge (collapsible inside drawer so high-frequency storage stays prominent) */}
        {(showAndroid && !compactDrawer || (showSettings && compactDrawer)) && (
          <section className="space-y-4">
            {compactDrawer ? (
              <button
                type="button"
                onClick={() => setShowAdvancedExport((v) => !v)}
                className="w-full min-h-[46px] px-4 rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] flex items-center justify-between gap-3 text-left hover:border-[var(--ide-accent)] transition-colors"
              >
                <span className="text-xs font-semibold flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
                  <span>{t('and_adv_export_toggle')}</span>
                </span>
                {showAdvancedExport ? (
                  <ChevronDown className="w-4 h-4 text-[var(--ide-text-muted)] shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[var(--ide-text-muted)] shrink-0" />
                )}
              </button>
            ) : (
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-[var(--ide-accent)]" />
                  <span>{t('and_title')}</span>
                </h2>
                <p className="text-xs text-[var(--ide-text-muted)] mt-0.5">
                  {t('and_desc')}
                </p>
              </div>
            )}

            {(!compactDrawer || showAdvancedExport) && (
            <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* PWA Install Card */}
              <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-5 flex flex-col justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold">{t('and_pwa_title')}</h3>
                  <p className="text-xs text-[var(--ide-text-muted)] mt-1.5 leading-relaxed">
                    {t('and_pwa_desc')}
                  </p>
                </div>
                <div>
                  <PWAInstallButton />
                </div>
              </div>

              {/* Buildozer APK & Termux Export Card */}
              <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">{t('and_export_title')}</h3>
                  <p className="text-xs text-[var(--ide-text-muted)] mt-1">
                    {t('and_export_desc')}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-[var(--ide-text-muted)] mb-1">
                      {t('and_app_title')}
                    </label>
                    <input
                      type="text"
                      value={appTitle}
                      onChange={(e) => setAppTitle(e.target.value)}
                      className="w-full min-h-[40px] px-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[var(--ide-text-muted)] mb-1">
                      {t('and_pkg_id')}
                    </label>
                    <input
                      type="text"
                      value={appPackageName}
                      onChange={(e) => setAppPackageName(e.target.value)}
                      className="w-full min-h-[40px] px-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Android Storage Permission Toggle */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                  <div className="min-w-0">
                    <div className="text-xs font-medium">{t('and_perm_title')}</div>
                    <div className="text-[11px] text-[var(--ide-text-muted)] truncate">
                      {t('and_perm_desc')}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.androidStoragePermission}
                    onClick={() =>
                      onUpdateSettings({
                        androidStoragePermission: !settings.androidStoragePermission,
                      })
                    }
                    className={`min-h-[32px] w-12 rounded-full p-1 transition-colors flex items-center shrink-0 ${
                      settings.androidStoragePermission
                        ? 'bg-[var(--ide-accent)] justify-end'
                        : 'bg-slate-300 dark:bg-slate-700 justify-start'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleExportGitHubApkProject}
                    className="min-h-[44px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-medium flex items-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t('and_btn_github_apk')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportBuildozerBundle}
                    className="min-h-[44px] px-4 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-xs font-medium flex items-center gap-2 hover:border-[var(--ide-accent)] transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t('and_btn_buildozer')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportTermuxScript}
                    className="min-h-[44px] px-4 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-xs font-medium flex items-center gap-2 hover:border-[var(--ide-accent)] transition-colors"
                  >
                    <Terminal className="w-4 h-4 text-amber-500" />
                    <span>{t('and_btn_termux')}</span>
                  </button>
                </div>
                <p className="text-[11px] text-[var(--ide-text-muted)] leading-relaxed">
                  {t('and_apk_tip')}
                </p>
              </div>
            </div>

            {/* Built-in droid module reference */}
            <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[var(--ide-accent)]" />
                <h3 className="text-sm font-semibold">{t('and_droid_title')}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                  <div className="font-mono font-semibold text-[var(--ide-accent-text)]">
                    droid.vibrate(ms)
                  </div>
                  <div className="text-[var(--ide-text-muted)] mt-1">
                    {t('and_droid_vibrate')}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                  <div className="font-mono font-semibold text-[var(--ide-accent-text)]">
                    droid.device_info()
                  </div>
                  <div className="text-[var(--ide-text-muted)] mt-1">
                    {t('and_droid_device')}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                  <div className="font-mono font-semibold text-[var(--ide-accent-text)]">
                    await droid.storage_info()
                  </div>
                  <div className="text-[var(--ide-text-muted)] mt-1">
                    {t('and_droid_storage')}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                  <div className="font-mono font-semibold text-[var(--ide-accent-text)]">
                    droid.toast(message)
                  </div>
                  <div className="text-[var(--ide-text-muted)] mt-1">
                    {t('and_droid_toast')}
                  </div>
                </div>
              </div>
            </div>
            </>
            )}
          </section>
        )}

        {/* Editor Settings */}
        {showSettings && (
          <section className="space-y-4 pb-8">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[var(--ide-accent)]" />
                <span>{t('ed_title')}</span>
              </h2>
            </div>

            <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] divide-y divide-[var(--ide-border)]">
              {/* Font Size */}
              <div className="flex items-center justify-between gap-4 p-4">
                <div>
                  <div className="text-sm font-medium">{t('ed_font_title')}</div>
                  <div className="text-xs text-[var(--ide-text-muted)] tabular-nums">
                    {t('ed_font_desc', { size: settings.fontSize })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ fontSize: Math.max(11, settings.fontSize - 1) })}
                    className="min-h-[40px] min-w-[40px] rounded-xl border border-[var(--ide-border)] font-mono text-sm font-semibold hover:border-[var(--ide-accent)]"
                  >
                    -
                  </button>
                  <span className="w-10 text-center font-mono text-sm tabular-nums">{settings.fontSize}</span>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ fontSize: Math.min(22, settings.fontSize + 1) })}
                    className="min-h-[40px] min-w-[40px] rounded-xl border border-[var(--ide-border)] font-mono text-sm font-semibold hover:border-[var(--ide-accent)]"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Tab Size */}
              <div className="flex items-center justify-between gap-4 p-4">
                <div>
                  <div className="text-sm font-medium">{t('ed_tab_title')}</div>
                  <div className="text-xs text-[var(--ide-text-muted)]">{t('ed_tab_desc')}</div>
                </div>
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--ide-surface-alt)]">
                  {[2, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onUpdateSettings({ tabSize: n })}
                      className={`min-h-[38px] px-3.5 rounded-lg text-xs font-mono font-medium transition-colors ${
                        settings.tabSize === n
                          ? 'bg-[var(--ide-surface)] text-[var(--ide-text)] shadow-sm'
                          : 'text-[var(--ide-text-muted)]'
                      }`}
                    >
                      {t('ed_tab_unit', { n })}
                    </button>
                  ))}
                </div>
              </div>

              {/* Word Wrap */}
              <div className="flex items-center justify-between gap-4 p-4">
                <div>
                  <div className="text-sm font-medium">{t('ed_wrap_title')}</div>
                  <div className="text-xs text-[var(--ide-text-muted)]">{t('ed_wrap_desc')}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.wordWrap}
                  onClick={() => onUpdateSettings({ wordWrap: !settings.wordWrap })}
                  className={`min-h-[36px] w-14 rounded-full p-1 transition-colors flex items-center ${
                    settings.wordWrap ? 'bg-[var(--ide-accent)] justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              {/* Android Symbol Bar */}
              <div className="flex items-center justify-between gap-4 p-4">
                <div>
                  <div className="text-sm font-medium">{t('ed_sym_title')}</div>
                  <div className="text-xs text-[var(--ide-text-muted)]">{t('ed_sym_desc')}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.showSymbolBar}
                  onClick={() => onUpdateSettings({ showSymbolBar: !settings.showSymbolBar })}
                  className={`min-h-[36px] w-14 rounded-full p-1 transition-colors flex items-center ${
                    settings.showSymbolBar ? 'bg-[var(--ide-accent)] justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              {/* Reset Workspace */}
              <div className="flex items-center justify-between gap-4 p-4">
                <div>
                  <div className="text-sm font-medium">{t('ed_reset_title')}</div>
                  <div className="text-xs text-[var(--ide-text-muted)]">{t('ed_reset_desc')}</div>
                </div>
                {confirmReset ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onResetWorkspace();
                        setConfirmReset(false);
                      }}
                      className="min-h-[40px] px-3.5 rounded-xl bg-red-600 text-white text-xs font-medium"
                    >
                      {t('ed_reset_confirm')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="min-h-[40px] px-3 rounded-xl bg-[var(--ide-surface-alt)] text-xs font-medium"
                    >
                      {t('files_cancel')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="min-h-[40px] px-3.5 rounded-xl border border-red-300 dark:border-red-900/60 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    {t('ed_reset_btn')}
                  </button>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

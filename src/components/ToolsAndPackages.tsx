import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowUpCircle,
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  CloudRain,
  Cpu,
  Download,
  FileText,
  Flower2,
  FolderSync,
  HardDrive,
  Languages,
  Loader2,
  Package,
  PackageCheck,
  Palette,
  PlugZap,
  RefreshCw,
  Search,
  ShieldCheck,
  Sliders,
  Smartphone,
  Snowflake,
  Sparkles,
  Terminal,
  Trash2,
  Wrench,
} from 'lucide-react';
import JSZip from 'jszip';
import {
  Atmosphere3dMode,
  EditorSettings,
  ExecutionEngine,
  InstalledPackage,
  PackageBackupStatus,
  ProcessCleanupResult,
  PythonFile,
  PyodideStatus,
  SdcardStatusInfo,
  TermuxConfig,
  TermuxConnectionState,
  TermuxHealthInfo,
} from '../types/ide';
import { PWAInstallButton } from './PWAInstallButton';
import { TermuxIntegrationPanel, TermuxVisibleSection } from './TermuxIntegrationPanel';
import { InternalStoragePanel } from './InternalStoragePanel';
import { getActiveAtmosphereState } from './DynamicAtmosphere3D';
import { IDE_THEMES } from '../services/themes';
import type { ThemeId } from '../services/themes';
import { LOCALE_OPTIONS, TranslationKey, getLocalizedThemeText, useI18n } from '../services/i18n';
import { generateGitHubApkProjectZip } from '../services/androidApkBuilder';
import { downloadBlob } from '../utils/downloadBlob';
import {
  CORE_TERMUX_PIP_PACKAGES,
  CORE_TERMUX_PKG_PACKAGES,
  getSdcardStatus,
  normalizeTermuxPkgName,
  TermuxOutdatedPipItem,
} from '../services/termuxBridge';
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
import {
  OutdatedPackageInfo,
  PYODIDE_CORE_PACKAGES,
  normalizePyPkgName,
} from '../services/pyodideRuntime';
import { AppUpdateCheckResult, getInstalledAppVersion } from '../services/appUpdater';

const THEME_CARD_NAMES: Record<ThemeId, { 'zh-TW': string; 'zh-CN': string }> = {
  rose: { 'zh-TW': '櫻花蜜桃', 'zh-CN': '樱花蜜桃' },
  lavender: { 'zh-TW': '薰衣草紫', 'zh-CN': '薰衣草紫' },
  milktea: { 'zh-TW': '焦糖奶茶', 'zh-CN': '焦糖奶茶' },
  matcha: { 'zh-TW': '抹茶生乳', 'zh-CN': '抹茶生乳' },
  sky: { 'zh-TW': '海鹽蘇打', 'zh-CN': '海盐苏打' },
  berry: { 'zh-TW': '絲絨莓果', 'zh-CN': '丝绒莓果' },
  rosegold: { 'zh-TW': '黑曜玫金', 'zh-CN': '黑曜玫金' },
  starry: { 'zh-TW': '星夜紫夢', 'zh-CN': '星夜紫梦' },
  dark: { 'zh-TW': '極夜深灰', 'zh-CN': '极夜深灰' },
  light: { 'zh-TW': '晨光純白', 'zh-CN': '晨光纯白' },
  peony: { 'zh-TW': '胭脂牡丹', 'zh-CN': '胭脂牡丹' },
  champagne: { 'zh-TW': '香檳珍珠', 'zh-CN': '香槟珍珠' },
  moonrose: { 'zh-TW': '月影薔薇', 'zh-CN': '月影蔷薇' },
  aurorapink: { 'zh-TW': '極光粉霧', 'zh-CN': '极光粉雾' },
};

type ToolWindowId =
  | 'py_conn'
  | 'py_init'
  | 'py_shell'
  | 'py_maint'
  | 'py_bridge'
  | 'pkg_native'
  | 'pkg_sandbox'
  | 'st_sdcard'
  | 'st_cache'
  | 'st_dir'
  | 'set_theme'
  | 'set_bg3d'
  | 'set_lang'
  | 'set_editor'
  | 'set_app'
  | 'set_apk';

interface HubOptionItem {
  id: ToolWindowId;
  title: string;
  desc: string;
  badge?: string;
  Icon: React.ComponentType<{ className?: string }>;
}

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
  onOpenHelp?: () => void;
  onOpenLogs?: () => void;
  backupStatus?: PackageBackupStatus | null;
  onRestoreBackedUpPackages?: () => Promise<void>;
  restoringBackup?: boolean;
  onCleanupProcesses?: (manual?: boolean) => Promise<void>;
  cleaningProcesses?: boolean;
  lastCleanupResult?: ProcessCleanupResult | null;
  onRebuildPipCertifi?: () => Promise<void>;
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
  onUninstallPackage,
  onCheckAndUpgradeAll,
  onUpgradeAllPackages,
  onUpgradeAllTermux,
  onUpgradeSingleTermuxPip,
  outdatedTermuxPips = [],
  checkingTermuxOutdated = false,
  onCheckTermuxOutdated,
  onUninstallInTermux,
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
  backupStatus = null,
  onRestoreBackedUpPackages,
  restoringBackup = false,
  onCleanupProcesses,
  cleaningProcesses = false,
  lastCleanupResult = null,
  onRebuildPipCertifi,
  onNotify,
}) => {
  const { locale, t } = useI18n();
  const [activeWindow, setActiveWindow] = useState<ToolWindowId | null>(null);
  const [pkgQuery, setPkgQuery] = useState('');
  const [installingPkg, setInstallingPkg] = useState<string | null>(null);
  const [uninstallingPkg, setUninstallingPkg] = useState<string | null>(null);
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
  const isNativeApk = Boolean(termuxHealth?.embedded || window.DroidPyNative?.isNativeApp?.());
  const [nativeStorageGranted, setNativeStorageGranted] = useState<boolean>(() =>
    Boolean(window.DroidPyNative?.hasStoragePermission?.())
  );

  // Open the native package manager immediately when the user enters Packages.
  // The runtime selector below keeps the sandbox manager one tap away.
  useEffect(() => {
    setActiveWindow(activeSubView === 'packages' ? 'pkg_native' : null);
  }, [activeSubView]);

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
      map.set(normalizePyPkgName(item.name), item);
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
    if (!clean || installingPkg || uninstallingPkg) return;
    setInstallingPkg(clean);
    try {
      await onInstallPackage(clean);
      setPkgQuery('');
    } finally {
      setInstallingPkg(null);
    }
  };

  const handleUninstall = async (target: string) => {
    const clean = target.trim();
    if (!clean || !onUninstallPackage || installingPkg || uninstallingPkg) return;
    setUninstallingPkg(clean);
    try {
      await onUninstallPackage(clean);
    } finally {
      setUninstallingPkg(null);
    }
  };

  const handleExportBuildozerBundle = async () => {
    const zip = new JSZip();
    for (const f of files) {
      zip.file(f.name, f.content);
    }

    const pkgList = installedPackages.map((p) => p.name).filter((n) => n !== 'micropip' && n !== 'packaging');
    const reqs = ['python3', 'kivy', ...pkgList].join(',');
    const perms =
      'INTERNET,VIBRATE,READ_EXTERNAL_STORAGE,WRITE_EXTERNAL_STORAGE,MANAGE_EXTERNAL_STORAGE,READ_MEDIA_IMAGES,READ_MEDIA_VIDEO,READ_MEDIA_AUDIO';

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
1. 儲存管理權限設定（全面開放）：
   已全面開放外部儲存權限 (READ/WRITE/MANAGE_EXTERNAL_STORAGE 與 READ_MEDIA_*)。Android 11+ 若需完整存取 /sdcard，請在程式啟動後呼叫 android.permissions.request_permissions() 並引導開啟「所有檔案存取權」。

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
      pandas: 'python-pandas',
      pillow: 'python-pillow',
      pil: 'python-pillow',
      cryptography: 'python-cryptography',
      matplotlib: 'matplotlib',
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

echo "[DroidPy] 正在申請 Android 外部儲存空間存取權限 (/sdcard)..."
termux-setup-storage || true

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
      includeStoragePermission: true,
      files,
    });
    await downloadBlob(
      blob,
      `${appTitle.toLowerCase().replace(/[^a-z0-9]/g, '') || 'droidpy'}-github-apk-project.zip`
    );
    onNotify('已匯出 GitHub 獨立 APK 自動打包專案（內嵌 Termux 與爬蟲支援）');
  };

  const canPickFolder = supportsDirectoryAccess();
  const displayUsedBytes =
    isNativeApk && sdcardStatus?.totalBytes ? (sdcardStatus.usedBytes ?? 0) : storageInfo.usageBytes;
  const displayQuotaBytes =
    isNativeApk && sdcardStatus?.totalBytes ? sdcardStatus.totalBytes : storageInfo.quotaBytes;
  const usagePercent =
    displayQuotaBytes > 0
      ? Math.min(100, Math.round((displayUsedBytes / displayQuotaBytes) * 100))
      : 0;
  const atmoState = getActiveAtmosphereState(settings.atmosphere3dMode ?? 'auto');
  const currentThemeName = getLocalizedThemeText(settings.theme, locale).name;
  const currentLocaleName =
    LOCALE_OPTIONS.find((item) => item.id === settings.locale)?.nativeName ?? settings.locale;

  const pythonHubOptions: HubOptionItem[] = [
    {
      id: 'py_conn',
      title: t('hub_py_conn'),
      desc: t('hub_py_conn_desc'),
      badge:
        termuxConnectionState === 'connected'
          ? termuxHealth?.pythonVersion || t('term_status_termux_ok')
          : t('tmx_state_off'),
      Icon: Activity,
    },
    {
      id: 'py_init',
      title: t('hub_py_init'),
      desc: t('hub_py_init_desc'),
      Icon: Download,
    },
    {
      id: 'py_shell',
      title: t('hub_py_shell'),
      desc: t('hub_py_shell_desc'),
      Icon: Terminal,
    },
    {
      id: 'py_maint',
      title: t('hub_py_maint'),
      desc: t('hub_py_maint_desc'),
      Icon: Wrench,
    },
    {
      id: 'py_bridge',
      title: t('hub_py_bridge'),
      desc: t('hub_py_bridge_desc'),
      Icon: PlugZap,
    },
  ];

  const packageHubOptions: HubOptionItem[] = [
    {
      id: 'pkg_native',
      title: t('hub_pkg_native'),
      desc: t('hub_pkg_native_desc'),
      badge:
        termuxConnectionState === 'connected' && termuxHealth
          ? `${termuxHealth.installedPipPackages?.length ?? 0} pip · ${termuxHealth.installedPkgPackages?.length ?? 0} pkg`
          : undefined,
      Icon: Package,
    },
    {
      id: 'pkg_sandbox',
      title: t('hub_pkg_sandbox'),
      desc: t('hub_pkg_sandbox_desc'),
      badge:
        settings.enableSandboxAddon || engine === 'pyodide'
          ? `${installedPackages.length}`
          : undefined,
      Icon: Cpu,
    },
  ];

  const storageHubOptions: HubOptionItem[] = [
    {
      id: 'st_sdcard',
      title: t('hub_st_sdcard'),
      desc: t('hub_st_sdcard_desc'),
      badge: isNativeApk
        ? nativeStorageGranted
          ? t('sd_status_ok')
          : t('sd_status_no')
        : undefined,
      Icon: HardDrive,
    },
    {
      id: 'st_cache',
      title: t('hub_st_cache'),
      desc: t('hub_st_cache_desc'),
      badge: displayQuotaBytes > 0 ? formatStorageBytes(displayUsedBytes) : undefined,
      Icon: Trash2,
    },
    {
      id: 'st_dir',
      title: t('hub_st_dir'),
      desc: t('hub_st_dir_desc'),
      badge: linkedDirName ?? undefined,
      Icon: FolderSync,
    },
  ];

  const settingsHubOptions: HubOptionItem[] = [
    {
      id: 'set_theme',
      title: t('set_theme_title'),
      desc: t('set_theme_desc'),
      badge: currentThemeName,
      Icon: Palette,
    },
    {
      id: 'set_bg3d',
      title: t('bg3d_title'),
      desc: t('bg3d_desc'),
      badge: t(atmoState.phaseKey),
      Icon: Sparkles,
    },
    {
      id: 'set_lang',
      title: t('set_lang_title'),
      desc: t('set_lang_desc'),
      badge: currentLocaleName,
      Icon: Languages,
    },
    {
      id: 'set_editor',
      title: t('hub_set_editor'),
      desc: t('hub_set_editor_desc'),
      badge: `${settings.fontSize}px`,
      Icon: Sliders,
    },
    {
      id: 'set_app',
      title: t('hub_set_app'),
      desc: t('hub_set_app_desc'),
      badge:
        appUpdateResult?.hasUpdate && appUpdateResult.latest
          ? t('upd_badge_new', { ver: appUpdateResult.latest.version })
          : `v${getInstalledAppVersion()}`,
      Icon: PackageCheck,
    },
    {
      id: 'set_apk',
      title: t('hub_set_apk'),
      desc: t('hub_set_apk_desc'),
      Icon: Smartphone,
    },
  ];

  const allHubOptions = [
    ...pythonHubOptions,
    ...packageHubOptions,
    ...storageHubOptions,
    ...settingsHubOptions,
  ];
  const activeOptionMeta = activeWindow
    ? allHubOptions.find((item) => item.id === activeWindow) ?? null
    : null;

  const renderHubOptionList = (items: HubOptionItem[], groupLabel?: string) => (
    <div className="space-y-2.5">
      {groupLabel && (
        <div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ide-text-muted)]">
          {groupLabel}
        </div>
      )}
      {items.map(({ id, title, desc, badge, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => setActiveWindow(id)}
          className="w-full min-h-[88px] px-4 py-4 rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] hover:border-[var(--ide-accent)] active:scale-[0.99] flex items-center justify-between gap-3 text-left transition-all min-w-0"
        >
          <div className="w-10 h-10 rounded-xl bg-[var(--ide-accent-soft)] text-[var(--ide-accent)] flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-sm font-semibold text-[var(--ide-text)] truncate">{title}</span>
              {badge && (
                <span className="text-[11px] font-medium text-[var(--ide-accent-text)] truncate max-w-[44%] shrink-0">
                  {badge}
                </span>
              )}
            </div>
            <div className="text-xs text-[var(--ide-text-muted)] line-clamp-2 mt-1 leading-relaxed">{desc}</div>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--ide-text-muted)] shrink-0" />
        </button>
      ))}
    </div>
  );

  const renderBackupBanner = () => {
    if (
      !backupStatus?.hasBackup ||
      ((backupStatus.missingPipPackages?.length ?? 0) === 0 &&
        (backupStatus.missingPkgPackages?.length ?? 0) === 0) ||
      !onRestoreBackedUpPackages
    ) {
      return null;
    }
    return (
      <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/35 p-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="text-xs font-semibold text-amber-900 dark:text-amber-200">
            {t('backup_banner_title')}
          </div>
          <div className="text-[11px] text-amber-800 dark:text-amber-300/90">
            {t('backup_banner_desc', {
              pipCount: backupStatus.missingPipPackages.length,
              pkgCount: backupStatus.missingPkgPackages.length,
            })}
          </div>
        </div>
        <button
          type="button"
          disabled={restoringBackup || upgradingTermux}
          onClick={() => void onRestoreBackedUpPackages()}
          className="min-h-[36px] px-3.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
        >
          {restoringBackup ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          <span>{restoringBackup ? t('backup_restoring_btn') : t('backup_restore_btn')}</span>
        </button>
      </div>
    );
  };

  const renderTermuxSubWindow = (visibleSection: TermuxVisibleSection) => (
    <TermuxIntegrationPanel
      visibleSection={visibleSection}
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
      onUpgradeAllPackages={onUpgradeAllPackages}
      outdatedTermuxPips={outdatedTermuxPips}
      checkingTermuxOutdated={checkingTermuxOutdated}
      onCheckTermuxOutdated={onCheckTermuxOutdated}
      onUninstallInTermux={onUninstallInTermux}
      upgradingTermux={upgradingTermux}
      enableSandboxAddon={Boolean(settings.enableSandboxAddon)}
      backupStatus={backupStatus}
      onRestoreBackedUpPackages={onRestoreBackedUpPackages}
      restoringBackup={restoringBackup}
      onCleanupProcesses={onCleanupProcesses}
      cleaningProcesses={cleaningProcesses}
      lastCleanupResult={lastCleanupResult}
      onRebuildPipCertifi={onRebuildPipCertifi}
      pipTrustedHostEmergency={Boolean(settings.pipTrustedHostEmergency)}
      onToggleTrustedHost={(next) => onUpdateSettings({ pipTrustedHostEmergency: next })}
      onNotify={onNotify}
    />
  );

  const renderDedicatedWindow = () => {
    switch (activeWindow) {
      case 'py_conn':
        return renderTermuxSubWindow('conn');
      case 'py_init':
        return renderTermuxSubWindow('init');
      case 'py_shell':
        return renderTermuxSubWindow('shell');
      case 'py_maint':
        return renderTermuxSubWindow('maintenance');
      case 'py_bridge':
        return renderTermuxSubWindow('bridge');

      case 'pkg_native':
        return (
          <div className="space-y-4">
            <section className="md-card p-3.5 sm:p-5 space-y-4 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Package className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
                    <span className="truncate">{t('tmx_native_pkg_mgr_title')}</span>
                  </h2>
                  <p className="text-xs text-[var(--ide-text-muted)] mt-1 leading-relaxed">
                    {t('tmx_native_pkg_mgr_desc')}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0 max-w-full">
                  <button
                    type="button"
                    onClick={() => void onTestTermuxConnection()}
                    className="min-h-[36px] px-3 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-accent)] text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-[var(--ide-accent)] ${
                        termuxConnectionState === 'checking' ? 'animate-spin' : ''
                      }`}
                    />
                    <span>{t('pkg_refresh')}</span>
                  </button>
                  {onCheckTermuxOutdated && termuxConnectionState === 'connected' && (
                    <button
                      type="button"
                      disabled={checkingTermuxOutdated || upgradingTermux}
                      onClick={() => void onCheckTermuxOutdated()}
                      className="min-h-[36px] px-3 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-accent)] text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 text-[var(--ide-accent)] ${
                          checkingTermuxOutdated ? 'animate-spin' : ''
                        }`}
                      />
                      <span>{t('tmx_check_outdated_btn')}</span>
                    </button>
                  )}
                  {onUpgradeAllPackages && termuxConnectionState === 'connected' && (
                    <button
                      type="button"
                      disabled={upgradingTermux}
                      onClick={() => void onUpgradeAllPackages()}
                      className="min-h-[36px] px-3.5 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                    >
                      {upgradingTermux ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowUpCircle className="w-3.5 h-3.5" />
                      )}
                      <span>{t('tmx_upgrade_all_btn')}</span>
                    </button>
                  )}
                </div>
              </div>

              {renderBackupBanner()}

              {termuxConnectionState === 'connected' && termuxHealth ? (
                <div className="space-y-3 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] p-3">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-[var(--ide-text-muted)]">
                      {t('tmx_installed_pkgs')} ({termuxHealth.installedPipPackages?.length ?? 0})
                    </div>
                    {termuxHealth.installedPipPackages &&
                    termuxHealth.installedPipPackages.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto ide-scroll pr-0.5">
                        {termuxHealth.installedPipPackages.map((pipPkg) => {
                          const normPip = normalizeTermuxPkgName(pipPkg);
                          const outdatedItem = outdatedTermuxPips.find(
                            (item) => normalizeTermuxPkgName(item.name) === normPip
                          );
                          const isCorePip = CORE_TERMUX_PIP_PACKAGES.has(pipPkg.toLowerCase());
                          return (
                            <div
                              key={pipPkg}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] text-[11px] font-mono text-[var(--ide-text)] max-w-full"
                            >
                              <span className="truncate">{pipPkg}</span>
                              {outdatedItem && onUpgradeSingleTermuxPip && (
                                <button
                                  type="button"
                                  disabled={upgradingTermux}
                                  onClick={() => void onUpgradeSingleTermuxPip(pipPkg)}
                                  title={`${pipPkg} ${outdatedItem.currentVersion} → ${outdatedItem.latestVersion}`}
                                  className="text-[var(--ide-accent-text)] hover:underline font-sans font-semibold disabled:opacity-40 shrink-0"
                                >
                                  ↑
                                </button>
                              )}
                              {!isCorePip && onUninstallInTermux && (
                                <button
                                  type="button"
                                  disabled={upgradingTermux}
                                  onClick={() => void onUninstallInTermux('pip', pipPkg)}
                                  title={`${t('tmx_uninstall_btn')} ${pipPkg}`}
                                  aria-label={`${t('tmx_uninstall_btn')} ${pipPkg}`}
                                  className="text-[var(--ide-text-muted)] hover:text-red-500 font-sans font-semibold disabled:opacity-40 ml-0.5 shrink-0"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-[var(--ide-text-muted)] leading-relaxed">
                        {t('tmx_installed_pkgs_empty')}
                      </div>
                    )}
                  </div>

                  {termuxHealth.installedPkgPackages &&
                    termuxHealth.installedPkgPackages.length > 0 && (
                      <div className="pt-2.5 border-t border-[var(--ide-border)] space-y-1.5">
                        <div className="text-xs font-medium text-[var(--ide-text-muted)]">
                          {t('tmx_installed_sys_pkgs')} ({termuxHealth.installedPkgPackages.length})
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto ide-scroll pr-0.5">
                          {termuxHealth.installedPkgPackages.map((sysPkg) => {
                            const isCoreSys = CORE_TERMUX_PKG_PACKAGES.has(sysPkg.toLowerCase());
                            return (
                              <div
                                key={sysPkg}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--ide-border)] bg-[var(--ide-surface)] text-[11px] font-mono text-[var(--ide-text-muted)] max-w-full"
                              >
                                <span className="truncate">{sysPkg}</span>
                                {!isCoreSys && onUninstallInTermux && (
                                  <button
                                    type="button"
                                    disabled={upgradingTermux}
                                    onClick={() => void onUninstallInTermux('pkg', sysPkg)}
                                    title={`${t('tmx_uninstall_btn')} ${sysPkg}`}
                                    aria-label={`${t('tmx_uninstall_btn')} ${sysPkg}`}
                                    className="hover:text-red-500 font-sans font-semibold disabled:opacity-40 shrink-0"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>
              ) : (
                <div className="text-xs text-[var(--ide-text-muted)] rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] p-3">
                  {termuxError || t('tmx_state_off')}
                </div>
              )}
            </section>

            {renderTermuxSubWindow('packages')}
          </div>
        );

      case 'pkg_sandbox':
        return (
          <div className="space-y-4">
            {/* Sandbox Add-on Enable / Disable Switch */}
            <div className="md-card p-3.5 sm:p-4 flex items-center justify-between gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{t('addon_sandbox_title')}</div>
                <div className="text-xs text-[var(--ide-text-muted)] mt-0.5 leading-relaxed">
                  {t('addon_sandbox_desc')}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(settings.enableSandboxAddon)}
                onClick={() => {
                  const nextVal = !settings.enableSandboxAddon;
                  onUpdateSettings({ enableSandboxAddon: nextVal });
                  if (!nextVal && engine === 'pyodide') {
                    onChangeEngine('termux');
                  }
                }}
                className={`min-h-[36px] w-14 rounded-full p-1 transition-colors flex items-center shrink-0 ${
                  settings.enableSandboxAddon
                    ? 'bg-[var(--ide-accent)] justify-end'
                    : 'bg-slate-300 dark:bg-slate-700 justify-start'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-white shadow-sm" />
              </button>
            </div>

            {!settings.enableSandboxAddon && engine !== 'pyodide' ? (
              <p className="px-1 text-xs text-[var(--ide-text-muted)]">
                {t('pkg_sandbox_disabled_desc')}
              </p>
            ) : (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {(onUpgradeAllPackages || onCheckAndUpgradeAll) && (
                    <button
                      type="button"
                      onClick={() => void (onUpgradeAllPackages ?? onCheckAndUpgradeAll)!()}
                      disabled={
                        checkingOutdated ||
                        upgradingPackages ||
                        upgradingTermux ||
                        pyodideStatus === 'loading'
                      }
                      className="min-h-[40px] px-3.5 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-40 text-white text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap"
                    >
                      {checkingOutdated || upgradingPackages || upgradingTermux ? (
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
                    disabled={!!installingPkg || !!uninstallingPkg}
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
                      className="min-h-[50px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-sm font-semibold disabled:opacity-40 flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
                    >
                      {installingPkg ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
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
                        const normTarget = normalizePyPkgName(targetPkg);
                        const isInstalled = installedPackages.some(
                          (p) => normalizePyPkgName(p.name) === normTarget
                        );
                        const isCoreSystem = PYODIDE_CORE_PACKAGES.has(normTarget);
                        const isBusyInstall = installingPkg === targetPkg;
                        const isBusyUninstall = uninstallingPkg === targetPkg;
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
                                <span className="truncate">{targetPkg}</span>
                                {matchedAlias && (
                                  <span className="font-sans font-normal text-[11px] text-[var(--ide-accent-text)] shrink-0">
                                    · {t('pkg_fuzzy_alias', { alias: matchedAlias })}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[var(--ide-text-muted)] truncate mt-0.5">
                                {item.desc}
                              </div>
                            </button>
                            {isInstalled && !isCoreSystem && onUninstallPackage ? (
                              <button
                                type="button"
                                disabled={!!installingPkg || !!uninstallingPkg}
                                onClick={() => void handleUninstall(targetPkg)}
                                className="min-h-[34px] px-3 rounded-lg border border-red-300 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-medium whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 disabled:opacity-40"
                              >
                                {isBusyUninstall ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                                <span>{t('pkg_uninstall_btn')}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isInstalled || !!installingPkg || !!uninstallingPkg}
                                onClick={() => void handleInstall(targetPkg)}
                                className={`min-h-[34px] px-3 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                                  isInstalled
                                    ? 'bg-[var(--ide-accent-soft)] text-[var(--ide-accent-text)]'
                                    : 'bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white disabled:opacity-40'
                                }`}
                              >
                                {isBusyInstall ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : isInstalled ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                                <span>
                                  {isInstalled ? t('pkg_installed') : t('pkg_install_short')}
                                </span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Auto-update Packages on Startup Toggle + C/C++ Note */}
                <div className="grid grid-cols-1 gap-3">
                  <div className="md-card p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
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
                      className={`min-h-[36px] w-14 rounded-full p-1 transition-colors flex items-center shrink-0 ${
                        settings.autoUpdatePackages
                          ? 'bg-[var(--ide-accent)] justify-end'
                          : 'bg-slate-300 dark:bg-slate-700 justify-start'
                      }`}
                    >
                      <span className="w-6 h-6 rounded-full bg-white shadow-sm" />
                    </button>
                  </div>

                  <div className="md-card p-4 text-xs text-[var(--ide-text-muted)] space-y-1">
                    <div className="font-semibold text-[var(--ide-text)]">{t('pkg_cpp_title')}</div>
                    <p className="leading-relaxed">{t('pkg_cpp_desc')}</p>
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-0.5">
                    {filteredPyCatalog.map((item) => {
                      const targetName = item.pyodide?.packageName ?? item.name;
                      const normTarget = normalizePyPkgName(targetName);
                      const isInstalled = installedPackages.some(
                        (p) => normalizePyPkgName(p.name) === normTarget
                      );
                      const isCoreSystem = PYODIDE_CORE_PACKAGES.has(normTarget);
                      const isBusyInstall = installingPkg === targetName;
                      const isBusyUninstall = uninstallingPkg === targetName;
                      return (
                        <div
                          key={item.id}
                          className="md-card flex items-center justify-between gap-3 p-3.5"
                        >
                          <div className="min-w-0">
                            <div className="font-mono text-sm font-semibold text-[var(--ide-text)] truncate flex items-center gap-1.5">
                              <span className="truncate">{targetName}</span>
                              {isInstalled && (
                                <Check className="w-3.5 h-3.5 text-[var(--ide-accent)] shrink-0" />
                              )}
                            </div>
                            <div className="text-xs text-[var(--ide-text-muted)] line-clamp-2 mt-0.5 leading-relaxed">
                              {item.desc}
                            </div>
                            <div className="text-[11px] text-[var(--ide-text-muted)] truncate mt-1">
                              {item.tier === 'popular'
                                ? t('pkg_tier_popular')
                                : t('pkg_tier_niche')}{' '}
                              · {item.runtimeHint}
                            </div>
                          </div>
                          {isInstalled && !isCoreSystem && onUninstallPackage ? (
                            <button
                              type="button"
                              disabled={!!installingPkg || !!uninstallingPkg}
                              onClick={() => void handleUninstall(targetName)}
                              className="min-h-[38px] px-3 rounded-xl border border-red-300 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors disabled:opacity-40"
                            >
                              {isBusyUninstall ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              <span>{t('pkg_uninstall_btn')}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isInstalled || !!installingPkg || !!uninstallingPkg}
                              onClick={() => void handleInstall(targetName)}
                              className={`min-h-[40px] px-3 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors ${
                                isInstalled
                                  ? 'bg-[var(--ide-accent-soft)] text-[var(--ide-accent-text)]'
                                  : 'bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white disabled:opacity-40'
                              }`}
                            >
                              {isBusyInstall ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : isInstalled ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : null}
                              <span>
                                {isInstalled
                                  ? t('pkg_installed')
                                  : isBusyInstall
                                  ? t('pkg_installing')
                                  : t('pkg_install_short')}
                              </span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Installed Packages Table */}
                <div className="md-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--ide-border)] flex items-center justify-between text-xs font-medium text-[var(--ide-text-muted)]">
                    <span>{t('pkg_loaded_title')}</span>
                    <span className="tabular-nums">
                      {t('pkg_loaded_count', { count: installedPackages.length })}
                    </span>
                  </div>
                  {installedPackages.length === 0 ? (
                    <div className="p-4 text-xs text-[var(--ide-text-muted)]">
                      {t('pkg_loaded_empty')}
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--ide-border)] max-h-64 overflow-y-auto ide-scroll">
                      {installedPackages.map((pkg) => {
                        const normName = normalizePyPkgName(pkg.name);
                        const outdated = outdatedMap.get(normName);
                        const isCoreSystem = PYODIDE_CORE_PACKAGES.has(normName);
                        const isBusyUninstall = uninstallingPkg === pkg.name;
                        return (
                          <div
                            key={pkg.name}
                            className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-mono font-medium text-[var(--ide-text)] truncate block">
                                {pkg.name}
                              </span>
                              {outdated && (
                                <span className="font-mono text-[11px] text-[var(--ide-accent-text)] font-semibold">
                                  {pkg.version} → {outdated.latestVersion}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono tabular-nums text-[var(--ide-text-muted)]">
                                {pkg.version}
                              </span>
                              {outdated && onUpgradePackage ? (
                                <button
                                  type="button"
                                  disabled={upgradingPackages || !!installingPkg || !!uninstallingPkg}
                                  onClick={() => void onUpgradePackage(pkg.name)}
                                  className="min-h-[30px] px-2.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors bg-[var(--ide-accent)] text-white hover:bg-[var(--ide-accent-hover)] disabled:opacity-40"
                                >
                                  {t('pkg_upgrade_btn')}
                                </button>
                              ) : !isCoreSystem ? (
                                <span className="text-[11px] text-[var(--ide-text-muted)] whitespace-nowrap">
                                  {t('pkg_status_latest')}
                                </span>
                              ) : null}
                              {!isCoreSystem && onUninstallPackage && (
                                <button
                                  type="button"
                                  disabled={upgradingPackages || !!installingPkg || !!uninstallingPkg}
                                  onClick={() => void handleUninstall(pkg.name)}
                                  aria-label={`${t('pkg_uninstall_btn')} ${pkg.name}`}
                                  className="min-h-[30px] px-2.5 rounded-lg border border-red-300 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-[11px] font-medium whitespace-nowrap inline-flex items-center gap-1 transition-colors disabled:opacity-40"
                                >
                                  {isBusyUninstall ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3 h-3" />
                                  )}
                                  <span>{t('pkg_uninstall_btn')}</span>
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
          </div>
        );

      case 'st_sdcard':
        return isNativeApk ? (
          <InternalStoragePanel
            mode="sdcard"
            termuxConfig={termuxConfig}
            files={files}
            activeFile={activeFile}
            onOpenSdcardFile={(filename, content) => onSaveWorkspaceFile(filename, content, true)}
            onNotify={onNotify}
          />
        ) : (
          <div className="md-card p-4 space-y-3 min-w-0">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
              <span>{t('sd_title')}</span>
            </h3>
            <p className="text-xs text-[var(--ide-text-muted)] leading-relaxed">
              {canPickFolder ? t('set_dir_desc_ok') : t('set_dir_desc_no')}
            </p>
            <button
              type="button"
              onClick={() => void onLinkDirectory()}
              className="min-h-[42px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-2 transition-colors max-w-full overflow-hidden"
            >
              <FolderSync className="w-4 h-4 shrink-0" />
              <span className="truncate">{linkedDirName ? t('set_dir_change') : t('set_dir_grant')}</span>
            </button>
          </div>
        );

      case 'st_cache':
        return (
          <div className="space-y-4">
            <div className="md-card p-3.5 sm:p-4 space-y-4 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
                    <span>{t('set_persist_title')}</span>
                  </h3>
                  <p className="text-xs text-[var(--ide-text-muted)] mt-1 leading-relaxed">
                    {t('set_persist_desc')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={refreshingStorage}
                  onClick={() => void refreshStorage(true)}
                  className="min-h-[36px] px-3 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-xs font-medium flex items-center gap-1.5 hover:border-[var(--ide-accent)] disabled:opacity-60 transition-colors shrink-0"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${refreshingStorage ? 'animate-spin text-[var(--ide-accent)]' : ''}`}
                  />
                  <span>{t('set_refresh_quota')}</span>
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-[var(--ide-text-muted)] tabular-nums">
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

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-[var(--ide-accent-text)]">
                  {storageInfo.persisted || isNativeApk ? t('set_persist_ok') : t('set_persist_std')}
                </span>
                <button
                  type="button"
                  onClick={handleRequestPersist}
                  disabled={requestingPersist || storageInfo.persisted}
                  className="min-h-[40px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-50 text-white text-xs font-medium inline-flex items-center gap-2 transition-colors max-w-full overflow-hidden"
                >
                  {requestingPersist ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                  )}
                  <span className="truncate">
                    {storageInfo.persisted ? t('set_persist_btn_ok') : t('set_persist_btn')}
                  </span>
                </button>
              </div>
            </div>

            {isNativeApk && (
              <InternalStoragePanel
                mode="cache"
                termuxConfig={termuxConfig}
                files={files}
                activeFile={activeFile}
                onOpenSdcardFile={(filename, content) =>
                  onSaveWorkspaceFile(filename, content, true)
                }
                onNotify={onNotify}
              />
            )}
          </div>
        );

      case 'st_dir':
        return (
          <div className="md-card p-3.5 sm:p-5 space-y-4 min-w-0">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <FolderSync className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
                <span>{t('set_dir_title')}</span>
              </h3>
              <p className="text-xs text-[var(--ide-text-muted)] mt-1 leading-relaxed break-words">
                {isNativeApk
                  ? nativeStorageGranted
                    ? t('set_dir_apk_ok', { path: sdcardStatus?.rootPath || '/storage/emulated/0' })
                    : t('set_dir_apk_need')
                  : canPickFolder
                  ? t('set_dir_desc_ok')
                  : t('set_dir_desc_no')}
              </p>
            </div>

            <div className="text-xs text-[var(--ide-text-muted)] break-all">
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
                className="min-h-[42px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-2 transition-colors max-w-full overflow-hidden"
              >
                <FolderSync className="w-4 h-4 shrink-0" />
                <span className="truncate">
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
        );

      case 'set_theme':
        return (
          <div className="space-y-3">
            <p className="text-xs text-[var(--ide-text-muted)] px-0.5">{t('set_theme_desc')}</p>
            <div className="grid grid-cols-2 gap-2.5">
              {IDE_THEMES.map((themeItem) => {
                const isSelected = settings.theme === themeItem.id;
                const localized = getLocalizedThemeText(themeItem.id, locale);
                const cardName = locale === 'zh-CN'
                  ? THEME_CARD_NAMES[themeItem.id]['zh-CN']
                  : locale === 'zh-TW'
                  ? THEME_CARD_NAMES[themeItem.id]['zh-TW']
                  : localized.name;
                return (
                  <button
                    key={themeItem.id}
                    type="button"
                    onClick={() => {
                      onUpdateSettings({ theme: themeItem.id });
                      onNotify(t('toast_theme_applied', { name: localized.name }));
                    }}
                    aria-pressed={isSelected}
                    className={`min-h-[88px] p-3 rounded-xl border text-left flex flex-col gap-2 transition-all ${
                      isSelected
                        ? 'border-[var(--ide-accent)] bg-[var(--ide-accent-soft)]'
                        : 'border-[var(--ide-border)] bg-[var(--ide-surface)] hover:border-[var(--ide-accent)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="text-sm font-semibold text-[var(--ide-text)] truncate" title={localized.name}>
                        {cardName}
                      </span>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-[var(--ide-accent)] text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div
                      className="h-8 w-full rounded-lg border border-black/10 dark:border-white/10 overflow-hidden grid grid-cols-3"
                      style={{ backgroundColor: themeItem.swatchBg }}
                      aria-hidden="true"
                    >
                      <span style={{ backgroundColor: themeItem.swatchBg }} />
                      <span style={{ backgroundColor: themeItem.swatchSurface }} />
                      <span style={{ backgroundColor: themeItem.swatchAccent }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'set_bg3d':
        return (
          <div className="space-y-4">
            {/* Live Season + Time-of-day indicator */}
            <div className="md-card p-3.5 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ide-accent-text)]">
                <Flower2 className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
                <span>{t(atmoState.seasonKey)}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ide-text-muted)]">
                <Clock className="w-3.5 h-3.5 text-[var(--ide-accent)] shrink-0" />
                <span>{t(atmoState.phaseKey)}</span>
              </div>
            </div>

            <div className="md-card divide-y divide-[var(--ide-border)] overflow-hidden">
              <div className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{t('bg3d_enable_label')}</div>
                  <div className="text-xs text-[var(--ide-text-muted)] mt-0.5 leading-relaxed">
                    {t('bg3d_enable_desc')}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.enable3dBg !== false}
                  onClick={() => onUpdateSettings({ enable3dBg: !(settings.enable3dBg !== false) })}
                  className={`min-h-[36px] w-14 rounded-full p-1 transition-colors flex items-center shrink-0 ${
                    settings.enable3dBg !== false
                      ? 'bg-[var(--ide-accent)] justify-end'
                      : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              <div className="p-4 space-y-2.5">
                <div className="text-sm font-medium">{t('bg3d_mode_label')}</div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'auto', labelKey: 'bg3d_mode_auto', Icon: Clock },
                      { id: 'petals', labelKey: 'bg3d_mode_petals', Icon: Flower2 },
                      { id: 'snow', labelKey: 'bg3d_mode_snow', Icon: Snowflake },
                      { id: 'rain', labelKey: 'bg3d_mode_rain', Icon: CloudRain },
                      { id: 'starlight', labelKey: 'bg3d_mode_starlight', Icon: Sparkles },
                    ] as {
                      id: Atmosphere3dMode;
                      labelKey: TranslationKey;
                      Icon: React.ComponentType<{ className?: string }>;
                    }[]
                  ).map(({ id, labelKey, Icon }) => {
                    const active = (settings.atmosphere3dMode ?? 'auto') === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={settings.enable3dBg === false}
                        onClick={() => onUpdateSettings({ atmosphere3dMode: id })}
                        className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all disabled:opacity-45 min-w-0 ${
                          active
                            ? 'border-[var(--ide-accent)] bg-[var(--ide-accent-soft)] text-[var(--ide-accent-text)] font-semibold'
                            : 'border-[var(--ide-border)] bg-[var(--ide-bg)] text-[var(--ide-text)] hover:border-[var(--ide-accent)]'
                        }`}
                      >
                        <Icon className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
                        <span className="truncate">{t(labelKey)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );

      case 'set_lang':
        return (
          <div className="space-y-3">
            <p className="text-xs text-[var(--ide-text-muted)] px-0.5">{t('set_lang_desc')}</p>
            <div className="grid grid-cols-2 gap-3">
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
          </div>
        );

      case 'set_editor':
        return (
          <div className="md-card divide-y divide-[var(--ide-border)] overflow-hidden">
            {/* Font Size */}
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{t('ed_font_title')}</div>
                <div className="text-xs text-[var(--ide-text-muted)] tabular-nums">
                  {t('ed_font_desc', { size: settings.fontSize })}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ fontSize: Math.max(11, settings.fontSize - 1) })
                  }
                  className="min-h-[40px] min-w-[40px] rounded-xl border border-[var(--ide-border)] font-mono text-sm font-semibold hover:border-[var(--ide-accent)]"
                >
                  -
                </button>
                <span className="w-10 text-center font-mono text-sm tabular-nums">
                  {settings.fontSize}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ fontSize: Math.min(22, settings.fontSize + 1) })
                  }
                  className="min-h-[40px] min-w-[40px] rounded-xl border border-[var(--ide-border)] font-mono text-sm font-semibold hover:border-[var(--ide-accent)]"
                >
                  +
                </button>
              </div>
            </div>

            {/* Tab Size */}
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{t('ed_tab_title')}</div>
                <div className="text-xs text-[var(--ide-text-muted)]">{t('ed_tab_desc')}</div>
              </div>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--ide-surface-alt)] shrink-0">
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
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{t('ed_wrap_title')}</div>
                <div className="text-xs text-[var(--ide-text-muted)]">{t('ed_wrap_desc')}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.wordWrap}
                onClick={() => onUpdateSettings({ wordWrap: !settings.wordWrap })}
                className={`min-h-[36px] w-14 rounded-full p-1 transition-colors flex items-center shrink-0 ${
                  settings.wordWrap
                    ? 'bg-[var(--ide-accent)] justify-end'
                    : 'bg-slate-300 dark:bg-slate-700 justify-start'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-white shadow-sm" />
              </button>
            </div>

            {/* Android Symbol Bar */}
            <div className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{t('ed_sym_title')}</div>
                <div className="text-xs text-[var(--ide-text-muted)]">{t('ed_sym_desc')}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.showSymbolBar}
                onClick={() => onUpdateSettings({ showSymbolBar: !settings.showSymbolBar })}
                className={`min-h-[36px] w-14 rounded-full p-1 transition-colors flex items-center shrink-0 ${
                  settings.showSymbolBar
                    ? 'bg-[var(--ide-accent)] justify-end'
                    : 'bg-slate-300 dark:bg-slate-700 justify-start'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-white shadow-sm" />
              </button>
            </div>

            {/* Reset Workspace */}
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{t('ed_reset_title')}</div>
                <div className="text-xs text-[var(--ide-text-muted)]">{t('ed_reset_desc')}</div>
              </div>
              {confirmReset ? (
                <div className="flex items-center gap-2 shrink-0">
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
                  className="min-h-[40px] px-3.5 rounded-xl border border-red-300 dark:border-red-900/60 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
                >
                  {t('ed_reset_btn')}
                </button>
              )}
            </div>
          </div>
        );

      case 'set_app':
        return (
          <div className="space-y-4">
            {onOpenUpdateModal && (
              <div className="md-card p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
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
                    <p className="text-xs text-[var(--ide-text-muted)] mt-1">{t('upd_card_desc')}</p>
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
              </div>
            )}

            {(onOpenLogs || onOpenHelp) && (
              <div className="md-card p-4 space-y-3">
                <div>
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
                    <span>{t('help_title')}</span>
                  </div>
                  <p className="text-xs text-[var(--ide-text-muted)] mt-1">{t('help_subtitle')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
          </div>
        );

      case 'set_apk':
        return (
          <div className="space-y-4">
            {/* PWA Install Card */}
            <div className="md-card p-4 flex flex-col justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{t('and_pwa_title')}</h3>
                <p className="text-xs text-[var(--ide-text-muted)] mt-1 leading-relaxed">
                  {t('and_pwa_desc')}
                </p>
              </div>
              <div>
                <PWAInstallButton />
              </div>
            </div>

            {/* Buildozer APK & Termux Export Card */}
            <div className="md-card p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold">{t('and_export_title')}</h3>
                <p className="text-xs text-[var(--ide-text-muted)] mt-1">{t('and_export_desc')}</p>
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

              <div className="md-card-tonal flex items-start gap-3 p-3.5">
                <ShieldCheck className="w-4 h-4 text-[var(--ide-accent)] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-[var(--ide-text)]">
                    {t('and_perm_open_title')}
                  </div>
                  <p className="text-[11px] text-[var(--ide-text-muted)] mt-0.5 leading-relaxed">
                    {t('and_perm_open_desc')}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExportGitHubApkProject}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-medium flex items-center gap-2 text-left max-w-full overflow-hidden transition-colors"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span className="truncate">{t('and_btn_github_apk')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportBuildozerBundle}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-xs font-medium flex items-center gap-2 text-left max-w-full overflow-hidden hover:border-[var(--ide-accent)] transition-colors"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span className="truncate">{t('and_btn_buildozer')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportTermuxScript}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-xs font-medium flex items-center gap-2 text-left max-w-full overflow-hidden hover:border-[var(--ide-accent)] transition-colors"
                >
                  <Terminal className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="truncate">{t('and_btn_termux')}</span>
                </button>
              </div>
              <p className="text-[11px] text-[var(--ide-text-muted)] leading-relaxed">
                {t('and_apk_tip')}
              </p>
            </div>

            {/* Built-in droid module reference */}
            <div className="md-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[var(--ide-accent)]" />
                <h3 className="text-sm font-semibold">{t('and_droid_title')}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                  <div className="font-mono font-semibold text-[var(--ide-accent-text)]">
                    droid.vibrate(ms)
                  </div>
                  <div className="text-[var(--ide-text-muted)] mt-1">{t('and_droid_vibrate')}</div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                  <div className="font-mono font-semibold text-[var(--ide-accent-text)]">
                    droid.device_info()
                  </div>
                  <div className="text-[var(--ide-text-muted)] mt-1">{t('and_droid_device')}</div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                  <div className="font-mono font-semibold text-[var(--ide-accent-text)]">
                    await droid.storage_info()
                  </div>
                  <div className="text-[var(--ide-text-muted)] mt-1">{t('and_droid_storage')}</div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                  <div className="font-mono font-semibold text-[var(--ide-accent-text)]">
                    droid.toast(message)
                  </div>
                  <div className="text-[var(--ide-text-muted)] mt-1">{t('and_droid_toast')}</div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderHubHome = () => {
    if (activeSubView === 'termux') {
      return renderHubOptionList(pythonHubOptions);
    }
    if (activeSubView === 'packages') {
      return (
        <div className="space-y-3">
          {renderBackupBanner()}
          {renderHubOptionList(packageHubOptions)}
        </div>
      );
    }
    if (activeSubView === 'android') {
      return renderHubOptionList(storageHubOptions);
    }
    if (activeSubView === 'settings') {
      return renderHubOptionList(settingsHubOptions);
    }
    return (
      <div className="space-y-6">
        {renderBackupBanner()}
        {renderHubOptionList(pythonHubOptions, t('neg_tab_termux'))}
        {renderHubOptionList(packageHubOptions, t('neg_tab_packages'))}
        {renderHubOptionList(storageHubOptions, t('neg_tab_storage'))}
        {renderHubOptionList(settingsHubOptions, t('neg_tab_system'))}
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto ide-scroll bg-[var(--ide-bg)] text-[var(--ide-text)]">
      {activeWindow && activeOptionMeta ? (
        <>
          <div className="sticky top-0 z-10 bg-[var(--ide-bg)]/95 border-b border-[var(--ide-border)] px-3.5 py-2.5 space-y-2.5">
            {activeSubView === 'packages' ? (
              <>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
                  <span className="text-sm font-semibold text-[var(--ide-text)]">{t('neg_tab_packages')}</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--ide-surface-alt)] border border-[var(--ide-border)]">
                  <button
                    type="button"
                    onClick={() => setActiveWindow('pkg_native')}
                    aria-pressed={activeWindow === 'pkg_native'}
                    className={`min-h-[44px] rounded-lg px-2 text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
                      activeWindow === 'pkg_native'
                        ? 'bg-[var(--ide-accent)] text-white shadow-sm'
                        : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    <span className="truncate">{t('hub_pkg_native')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveWindow('pkg_sandbox')}
                    aria-pressed={activeWindow === 'pkg_sandbox'}
                    className={`min-h-[44px] rounded-lg px-2 text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
                      activeWindow === 'pkg_sandbox'
                        ? 'bg-[var(--ide-accent)] text-white shadow-sm'
                        : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
                    }`}
                  >
                    <Cpu className="w-4 h-4" />
                    <span className="truncate">{t('hub_pkg_sandbox')}</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveWindow(null)}
                  className="min-h-[44px] px-3 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)] hover:border-[var(--ide-accent)] text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 text-[var(--ide-accent)]" />
                  <span>{t('win_back')}</span>
                </button>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <activeOptionMeta.Icon className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
                  <span className="text-sm font-semibold text-[var(--ide-text)] truncate">
                    {activeOptionMeta.title}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div
            className={`${
              compactDrawer ? 'p-3.5 pb-6 space-y-4' : 'max-w-4xl mx-auto p-4 sm:p-6 space-y-5'
            }`}
          >
            {renderDedicatedWindow()}
          </div>
        </>
      ) : (
        <div
          className={`${
            compactDrawer ? 'p-3.5 pb-6 space-y-4' : 'max-w-4xl mx-auto p-4 sm:p-6 space-y-6'
          }`}
        >
          {renderHubHome()}
        </div>
      )}
    </div>
  );
};

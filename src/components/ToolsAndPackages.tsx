import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import JSZip from 'jszip';
import {
  EditorSettings,
  ExecutionEngine,
  InstalledPackage,
  PythonFile,
  PyodideStatus,
  TermuxConfig,
  TermuxConnectionState,
  TermuxHealthInfo,
} from '../types/ide';
import { PWAInstallButton } from './PWAInstallButton';
import { TermuxIntegrationPanel } from './TermuxIntegrationPanel';
import { IDE_THEMES } from '../services/themes';
import { LOCALE_OPTIONS, getLocalizedThemeText, useI18n } from '../services/i18n';
import { generateGitHubApkProjectZip } from '../services/androidApkBuilder';
import { downloadBlob } from '../utils/downloadBlob';
import {
  StorageEstimateInfo,
  formatStorageBytes,
  getStorageStatus,
  requestPersistentStorage,
  supportsDirectoryAccess,
} from '../services/storageManager';

interface ToolsAndPackagesProps {
  activeSubView?: 'termux' | 'packages' | 'android' | 'settings' | 'all';
  files: PythonFile[];
  activeFile: PythonFile;
  settings: EditorSettings;
  onUpdateSettings: (patch: Partial<EditorSettings>) => void;
  onResetWorkspace: () => void;
  pyodideStatus: PyodideStatus;
  installedPackages: InstalledPackage[];
  onInstallPackage: (pkg: string) => Promise<void>;
  onRefreshPackages: () => Promise<void>;
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
  onOpenHelp?: () => void;
  onNotify: (msg: string) => void;
}

const POPULAR_PACKAGES = [
  { name: 'numpy', desc: '高效能矩陣與數值運算', kind: 'C/C++ WASM 預編譯' },
  { name: 'matplotlib', desc: '資料視覺化與圖表繪製', kind: 'C/C++ WASM 預編譯' },
  { name: 'pandas', desc: '表格式資料清洗與分析', kind: 'C/C++ WASM 預編譯' },
  { name: 'scipy', desc: '科學計算與統計工具庫', kind: 'C/Fortran WASM 預編譯' },
  { name: 'pillow', desc: '影像處理與格式轉換', kind: 'C WASM 預編譯' },
  { name: 'scikit-learn', desc: '機器學習與分類迴歸模型', kind: 'C/Cython WASM 預編譯' },
  { name: 'cryptography', desc: '密碼學與金鑰加解密', kind: 'Rust/C WASM 預編譯' },
  { name: 'sympy', desc: '符號代數與微積分計算', kind: '純 Python' },
  { name: 'beautifulsoup4', desc: 'HTML / XML 結構解析', kind: '純 Python' },
];

export const ToolsAndPackages: React.FC<ToolsAndPackagesProps> = ({
  activeSubView = 'all',
  files,
  activeFile,
  settings,
  onUpdateSettings,
  onResetWorkspace,
  pyodideStatus,
  installedPackages,
  onInstallPackage,
  onRefreshPackages,
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
  onOpenHelp,
  onNotify,
}) => {
  const { locale, t } = useI18n();
  const [pkgQuery, setPkgQuery] = useState('');
  const [installingPkg, setInstallingPkg] = useState<string | null>(null);
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

  const refreshStorage = async () => {
    const info = await getStorageStatus();
    setStorageInfo(info);
  };

  useEffect(() => {
    void refreshStorage();
  }, []);

  const handleRequestPersist = async () => {
    setRequestingPersist(true);
    try {
      const granted = await requestPersistentStorage();
      await refreshStorage();
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
  const usagePercent =
    storageInfo.quotaBytes > 0
      ? Math.min(100, Math.round((storageInfo.usageBytes / storageInfo.quotaBytes) * 100))
      : 0;

  return (
    <div className="h-full overflow-y-auto ide-scroll bg-[var(--ide-bg)] text-[var(--ide-text)]">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-8">
        {onOpenHelp && (
          <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
                <span>{t('help_title')}</span>
              </div>
              <p className="text-xs text-[var(--ide-text-muted)] mt-0.5">{t('help_subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={onOpenHelp}
              className="min-h-[40px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              <span>{t('toolbar_help_title')}</span>
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
        {(showSettings || showAndroid) && (
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
                onClick={refreshStorage}
                className="min-h-[40px] px-3.5 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)] text-xs font-medium flex items-center gap-2 hover:border-[var(--ide-accent)] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
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
                    {storageInfo.persisted ? t('set_persist_ok') : t('set_persist_std')}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-[var(--ide-text-muted)] tabular-nums">
                    <span>{t('set_persist_used', { val: formatStorageBytes(storageInfo.usageBytes) })}</span>
                    <span>{t('set_persist_quota', { val: formatStorageBytes(storageInfo.quotaBytes) })}</span>
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
                    {canPickFolder ? t('set_dir_desc_ok') : t('set_dir_desc_no')}
                  </p>
                </div>

                <div className="text-xs text-[var(--ide-text-muted)]">
                  {t('set_dir_current')}
                  <span className="font-mono font-semibold text-[var(--ide-text)] ml-1">
                    {linkedDirName ?? t('set_dir_none')}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canPickFolder}
                    onClick={onLinkDirectory}
                    className="min-h-[42px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-40 text-white text-xs font-medium inline-flex items-center gap-2 transition-colors"
                  >
                    <FolderSync className="w-4 h-4" />
                    <span>{linkedDirName ? t('set_dir_change') : t('set_dir_grant')}</span>
                  </button>
                  {linkedDirName && (
                    <>
                      <button
                        type="button"
                        onClick={onImportFromDirectory}
                        className="min-h-[42px] px-3.5 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-xs font-medium hover:border-[var(--ide-accent)]"
                      >
                        {t('set_dir_load')}
                      </button>
                      <button
                        type="button"
                        onClick={onSaveToDirectory}
                        className="min-h-[42px] px-3.5 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-xs font-medium hover:border-[var(--ide-accent)]"
                      >
                        {t('set_dir_save')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
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

            {/* Install Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleInstall(pkgQuery);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={pkgQuery}
                onChange={(e) => setPkgQuery(e.target.value)}
                placeholder={t('pkg_placeholder')}
                className="flex-1 min-w-0 min-h-[44px] px-4 rounded-xl bg-[var(--ide-surface)] border border-[var(--ide-border)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
              />
              <button
                type="submit"
                disabled={!pkgQuery.trim() || !!installingPkg}
                className="min-h-[44px] px-5 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-sm font-medium disabled:opacity-40 flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              >
                {installingPkg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>{installingPkg ? t('pkg_installing') : t('pkg_install')}</span>
              </button>
            </form>

            {/* C/C++ Native Extension Environment Note */}
            <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-4 text-xs text-[var(--ide-text-muted)] space-y-1.5">
              <div className="font-semibold text-[var(--ide-text)]">
                {t('pkg_cpp_title')}
              </div>
              <p className="leading-relaxed">
                {t('pkg_cpp_desc')}
              </p>
            </div>

            {/* Quick Install Popular Packages */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {POPULAR_PACKAGES.map((item) => {
                const isInstalled = installedPackages.some(
                  (p) => p.name.toLowerCase() === item.name.toLowerCase()
                );
                const isBusy = installingPkg === item.name;
                return (
                  <div
                    key={item.name}
                    className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)]"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-semibold text-[var(--ide-text)]">
                        {item.name}
                      </div>
                      <div className="text-xs text-[var(--ide-text-muted)] truncate mt-0.5">
                        {item.desc} · {item.kind}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isInstalled || !!installingPkg}
                      onClick={() => handleInstall(item.name)}
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

            {/* Installed Packages Table */}
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
                <div className="divide-y divide-[var(--ide-border)] max-h-60 overflow-y-auto ide-scroll">
                  {installedPackages.map((pkg) => (
                    <div key={pkg.name} className="flex items-center justify-between px-4 py-2.5 text-xs">
                      <span className="font-mono font-medium text-[var(--ide-text)]">{pkg.name}</span>
                      <span className="font-mono tabular-nums text-[var(--ide-text-muted)]">
                        {pkg.version}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Android Deployment & Hardware Bridge */}
        {showAndroid && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[var(--ide-accent)]" />
                <span>{t('and_title')}</span>
              </h2>
              <p className="text-xs text-[var(--ide-text-muted)] mt-0.5">
                {t('and_desc')}
              </p>
            </div>

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

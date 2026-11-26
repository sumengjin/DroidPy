import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Square,
  Loader2,
  Code2,
  Terminal as TerminalIcon,
  FolderOpen,
  Search,
  WifiOff,
  Keyboard,
  Palette,
  Languages,
  Check,
  AlignLeft,
  Plus,
  X,
  Globe,
  Maximize2,
  PanelLeft,
  Columns2,
  Menu,
  Sparkles,
  Download,
  Package,
} from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';
import { DEFAULT_FILES } from './data/defaultFiles';
import {
  CrawlerSessionData,
  EditorSettings,
  ExecutionEngine,
  InstalledPackage,
  MobileTab,
  NegativeScreenSection,
  PackageBackupStatus,
  ProcessCleanupResult,
  PyodideStatus,
  PythonFile,
  ScriptBackupSnapshot,
  TabletPaneTab,
  TerminalEntry,
  TermuxConfig,
  TermuxConnectionState,
  TermuxHealthInfo,
} from './types/ide';
import { CodeEditor, CodeEditorHandle } from './components/CodeEditor';
import { AndroidSymbolBar } from './components/AndroidSymbolBar';
import { TerminalPanel } from './components/TerminalPanel';
import { FileExplorer } from './components/FileExplorer';
import { NegativeScreenDrawer } from './components/NegativeScreenDrawer';
import { CrawlerBrowserPanel } from './components/CrawlerBrowserPanel';
import { HelpTutorialModal } from './components/HelpTutorialModal';
import { AppExecutionLogModal } from './components/AppExecutionLogModal';
import { AppUpdateModal } from './components/AppUpdateModal';
import { DynamicAtmosphere3D } from './components/DynamicAtmosphere3D';
import { appLog } from './services/appLogger';
import {
  getAutoUpdatePackagesPref,
  getSavedGithubRepo,
  saveGithubRepo,
  setAutoUpdatePackagesPref,
} from './version';
import { AppUpdateCheckResult, checkForAppUpdates } from './services/appUpdater';
import { createScriptBackup, exportScriptBackupJson } from './services/scriptBackup';
import {
  DEFAULT_CRAWLER_SESSION,
  buildCookiesJsonContent,
  mergeCookieLists,
  parseCookieHeaderPairs,
} from './utils/crawlerSession';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useDeviceLayout } from './hooks/useDeviceLayout';
import { getThemeMeta } from './services/themes';
import {
  I18nProvider,
  LOCALE_OPTIONS,
  TranslationKey,
  translate,
} from './services/i18n';
import { formatDurationHMS } from './utils/formatDuration';
import { createAnsiStreamBuffer, stripAnsi } from './utils/ansiParser';
import {
  DEFAULT_TERMUX_CONFIG,
  createSecureBridgeToken,
  isSecureBridgeToken,
  CORE_TERMUX_PIP_PACKAGES,
  TermuxOutdatedPipItem,
  abortActiveTermuxStream,
  backupWorkspaceToSdcard,
  buildTermuxAptUpgradeCommand,
  buildTermuxPipUpgradeCommand,
  buildTermuxUninstallCommand,
  checkTermuxHealth,
  cleanupTermuxProcesses,
  execTermuxShell,
  fetchTermuxWorkspaceFiles,
  getBackupStatus,
  getSdcardStatus,
  normalizeTermuxPkgName,
  resolveTermuxInstallTarget,
  parseOutdatedPipJson,
  sendTermuxStdin,
  stopTermuxProcess,
  pauseTermuxProcess,
  resumeTermuxProcess,
  streamInstallInTermux,
  streamRestoreBackedUpPackages,
  streamRunInTermux,
  streamShellInTermux,
  writeSdcardFile,
} from './services/termuxBridge';
import {
  DirectoryHandleLike,
  pickDirectoryFilesViaInput,
  readPythonFilesFromDirectory,
  requestLinkedDirectory,
  supportsDirectoryAccess,
  writeFilesToDirectory,
} from './services/storageManager';
import {
  OutdatedPackageInfo,
  PYODIDE_CORE_PACKAGES,
  checkOutdatedPyPackages,
  executePythonFile,
  executeReplLine,
  initPyodide,
  installPyPackage,
  listPyPackages,
  normalizePyPkgName,
  RuntimeCallbacks,
  uninstallPyPackage,
  upgradeAllPyPackages,
  upgradePyPackage,
} from './services/pyodideRuntime';

const STORAGE_FILES_KEY = 'droidpy_files_v1';
const STORAGE_ACTIVE_ID_KEY = 'droidpy_active_file_v1';
const STORAGE_SETTINGS_KEY = 'droidpy_settings_v2';
const STORAGE_ENGINE_KEY = 'droidpy_engine_v1';
const STORAGE_TERMUX_CFG_KEY = 'droidpy_termux_cfg_v1';
const STORAGE_CRAWLER_SESSION_KEY = 'droidpy_crawler_session_v1';
const STORAGE_PY_PKGS_KEY = 'droidpy_sandbox_pkgs_v1';

const MAX_TERMINAL_ENTRIES = 250;
const MAX_TERMINAL_ENTRY_CHARS = 100_000;
let startupBootLoggedInModule = false;

const DEFAULT_SETTINGS: EditorSettings = {
  fontSize: 14,
  tabSize: 4,
  wordWrap: true,
  showSymbolBar: true,
  theme: 'dark',
  locale: 'zh-TW',
  androidStoragePermission: true,
  autoUpdatePackages: getAutoUpdatePackagesPref(),
  githubRepo: getSavedGithubRepo(),
  enableSandboxAddon: false,
  pipTrustedHostEmergency: false,
  enable3dBg: true,
  atmosphere3dMode: 'auto',
};

interface PersistedIdeSnapshot {
  files?: PythonFile[];
  activeFileId?: string;
  settings?: Partial<EditorSettings>;
  executionEngine?: ExecutionEngine;
  termuxConfig?: Partial<TermuxConfig>;
  crawlerSession?: Partial<CrawlerSessionData>;
  sandboxPackages?: string[];
}

declare global {
  interface Window {
    __droidpyHandleBack?: () => boolean;
  }
}

function upgradeLegacyDefaultFiles(list: PythonFile[]): PythonFile[] {
  const defaultUtils = DEFAULT_FILES.find((f) => f.id === 'utils-py');
  const defaultChart = DEFAULT_FILES.find((f) => f.id === 'chart-demo-py');
  let changed = false;
  const next = list.map((f) => {
    if (
      defaultUtils &&
      (f.id === 'utils-py' || f.name === 'utils.py') &&
      f.content.includes('def format_device_report') &&
      !f.content.includes('__name__') &&
      !f.content.includes('print(')
    ) {
      changed = true;
      return { ...f, content: defaultUtils.content };
    }
    if (
      defaultChart &&
      (f.id === 'chart-demo-py' || f.name === 'chart_demo.py') &&
      f.content.includes('Android Sensor Waveform') &&
      !f.content.includes('ModuleNotFoundError')
    ) {
      changed = true;
      return { ...f, content: defaultChart.content };
    }
    return f;
  });
  return changed ? next : list;
}

let cachedNativeSnapshot: PersistedIdeSnapshot | null | undefined;
function getInitialNativeSnapshot(): PersistedIdeSnapshot | null {
  if (cachedNativeSnapshot !== undefined) return cachedNativeSnapshot;
  try {
    const raw = window.DroidPyNative?.readPersistedState?.();
    if (raw && raw.trim()) {
      cachedNativeSnapshot = JSON.parse(raw) as PersistedIdeSnapshot;
      return cachedNativeSnapshot;
    }
  } catch {
    // ignore corrupted native JSON
  }
  cachedNativeSnapshot = null;
  return null;
}

function formatTime(): string {
  const now = new Date();
  return now.toTimeString().slice(0, 8);
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function sanitizeFileName(raw: string): string {
  const stripped = raw.replace(/[/\\]/g, '').trim();
  if (!stripped || stripped === '.' || stripped === '..') return '';
  return stripped;
}

function mergeTerminalChunk(prev: string, chunk: string): string {
  const normalized = chunk
    .replace(/\r\n/g, '\n')
    .replace(/(?:\x1b\[|\x9b)2K/g, '\r')
    .replace(/(?:\x1b\[|\x9b)[01]?K/g, '');
  let out = prev;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '\r') {
      const nextCh = normalized[i + 1];
      if (nextCh !== undefined && nextCh !== '\n' && nextCh !== '\r') {
        const lastNl = out.lastIndexOf('\n');
        out = lastNl === -1 ? '' : out.slice(0, lastNl + 1);
      }
    } else {
      out += ch;
    }
  }
  if (out.length > MAX_TERMINAL_ENTRY_CHARS) {
    out = out.slice(-MAX_TERMINAL_ENTRY_CHARS);
  }
  return out;
}

export default function App() {
  const { deviceClass, isLandscape } = useDeviceLayout();
  const [files, setFiles] = useState<PythonFile[]>(() => {
    const nativeSnap = getInitialNativeSnapshot();
    if (nativeSnap?.files && Array.isArray(nativeSnap.files) && nativeSnap.files.length > 0) {
      return upgradeLegacyDefaultFiles(nativeSnap.files);
    }
    try {
      const saved = localStorage.getItem(STORAGE_FILES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as PythonFile[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return upgradeLegacyDefaultFiles(parsed);
        }
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_FILES;
  });

  const [activeFileId, setActiveFileId] = useState<string>(() => {
    const nativeSnap = getInitialNativeSnapshot();
    if (nativeSnap?.activeFileId && files.some((f) => f.id === nativeSnap.activeFileId)) {
      return nativeSnap.activeFileId;
    }
    try {
      const saved = localStorage.getItem(STORAGE_ACTIVE_ID_KEY);
      if (saved && files.some((f) => f.id === saved)) return saved;
    } catch {
      // ignore
    }
    return files[0]?.id ?? DEFAULT_FILES[0].id;
  });

  const [settings, setSettings] = useState<EditorSettings>(() => {
    const nativeSnap = getInitialNativeSnapshot();
    if (nativeSnap?.settings) {
      return { ...DEFAULT_SETTINGS, ...nativeSnap.settings };
    }
    try {
      const saved = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...(JSON.parse(saved) as Partial<EditorSettings>) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  const [mobileTab, setMobileTab] = useState<MobileTab>('editor');
  const [negativeOpen, setNegativeOpen] = useState(false);
  const [negativeSection, setNegativeSection] = useState<NegativeScreenSection>('termux');
  const [tabletSplit, setTabletSplit] = useState(true);
  const [tabletPaneTab, setTabletPaneTab] = useState<TabletPaneTab>('terminal');
  const [crawlerSession, setCrawlerSession] = useState<CrawlerSessionData>(() => {
    const nativeSnap = getInitialNativeSnapshot();
    if (nativeSnap?.crawlerSession) {
      return { ...DEFAULT_CRAWLER_SESSION, ...nativeSnap.crawlerSession };
    }
    try {
      const saved = localStorage.getItem(STORAGE_CRAWLER_SESSION_KEY);
      if (saved) {
        return { ...DEFAULT_CRAWLER_SESSION, ...(JSON.parse(saved) as Partial<CrawlerSessionData>) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_CRAWLER_SESSION;
  });
  const [sandboxPackages, setSandboxPackages] = useState<string[]>(() => {
    const nativeSnap = getInitialNativeSnapshot();
    if (nativeSnap?.sandboxPackages && Array.isArray(nativeSnap.sandboxPackages)) {
      return nativeSnap.sandboxPackages.filter((p): p is string => typeof p === 'string');
    }
    try {
      const saved = localStorage.getItem(STORAGE_PY_PKGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((p): p is string => typeof p === 'string');
        }
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [pyodideStatus, setPyodideStatus] = useState<PyodideStatus>('idle');
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [installedPackages, setInstalledPackages] = useState<InstalledPackage[]>([]);
  const [activePyodidePackage, setActivePyodidePackage] = useState<string | null>(null);
  // Synchronous guard serializes all Pyodide package mutations across rapid taps and drawer remounts.
  const pyodidePackageOperationLockRef = useRef(false);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [pendingInputPrompt, setPendingInputPrompt] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [appUpdateResult, setAppUpdateResult] = useState<AppUpdateCheckResult | null>(null);
  const [checkingAppUpdate, setCheckingAppUpdate] = useState(false);
  const [updateBannerDismissed, setUpdateBannerDismissed] = useState(false);
  const [githubRepo, setGithubRepo] = useState<string>(() => getSavedGithubRepo());
  const [outdatedPyPackages, setOutdatedPyPackages] = useState<OutdatedPackageInfo[]>([]);
  const [checkingOutdatedPkgs, setCheckingOutdatedPkgs] = useState(false);
  const [upgradingPyPackages, setUpgradingPyPackages] = useState(false);
  const [outdatedTermuxPips, setOutdatedTermuxPips] = useState<TermuxOutdatedPipItem[]>([]);
  const [checkingTermuxOutdated, setCheckingTermuxOutdated] = useState(false);
  const [upgradingTermux, setUpgradingTermux] = useState(false);
  const [mobileNewFileOpen, setMobileNewFileOpen] = useState(false);
  const [mobileNewFileName, setMobileNewFileName] = useState('');
  const [linkedDirHandle, setLinkedDirHandle] = useState<DirectoryHandleLike | null>(null);
  const [executionEngine, setExecutionEngine] = useState<ExecutionEngine>(() => {
    const nativeSnap = getInitialNativeSnapshot();
    const sandboxEnabled = Boolean(settings.enableSandboxAddon);
    if (nativeSnap?.executionEngine === 'termux') return 'termux';
    if (nativeSnap?.executionEngine === 'pyodide') {
      return sandboxEnabled ? 'pyodide' : 'termux';
    }
    try {
      const saved = localStorage.getItem(STORAGE_ENGINE_KEY);
      if (saved === 'termux') return 'termux';
      if (saved === 'pyodide') return sandboxEnabled ? 'pyodide' : 'termux';
    } catch {
      // ignore
    }
    return 'termux';
  });
  const [termuxConfig, setTermuxConfig] = useState<TermuxConfig>(() => {
    const nativeSnap = getInitialNativeSnapshot();
    let savedConfig: Partial<TermuxConfig> = nativeSnap?.termuxConfig ?? {};
    if (!nativeSnap?.termuxConfig) {
      try {
        const saved = localStorage.getItem(STORAGE_TERMUX_CFG_KEY);
        if (saved) savedConfig = JSON.parse(saved) as Partial<TermuxConfig>;
      } catch {
        // Ignore malformed local preferences; generate a fresh token below.
      }
    }

    let nativeToken = '';
    let nativeEndpoint = '';
    try {
      nativeToken = window.DroidPyNative?.getBridgeToken?.() ?? '';
      nativeEndpoint = window.DroidPyNative?.getBridgeEndpoint?.() ?? '';
    } catch {
      // Older native builds may not expose per-install Bridge settings yet.
    }
    const token = isSecureBridgeToken(nativeToken)
      ? nativeToken
      : isSecureBridgeToken(savedConfig.token)
      ? savedConfig.token
      : createSecureBridgeToken();

    return {
      ...DEFAULT_TERMUX_CONFIG,
      ...savedConfig,
      // Native APKs obtain their port from Android; web/PWA builds keep the default.
      endpointUrl: nativeEndpoint || savedConfig.endpointUrl || DEFAULT_TERMUX_CONFIG.endpointUrl,
      token,
    };
  });
  const [termuxConnectionState, setTermuxConnectionState] =
    useState<TermuxConnectionState>('disconnected');
  const [termuxError, setTermuxError] = useState<string | null>(null);
  const [termuxHealth, setTermuxHealth] = useState<TermuxHealthInfo | null>(null);
  const [termuxRunning, setTermuxRunning] = useState(false);
  const [termuxActiveTask, setTermuxActiveTask] = useState<string | null>(null);
  const termuxScriptStartLockRef = useRef(false);
  // Synchronous guard prevents overlapping native Termux operations across drawer remounts.
  const termuxOperationLockRef = useRef(false);
  const [termuxPaused, setTermuxPaused] = useState(false);
  const [termuxScriptRunning, setTermuxScriptRunning] = useState(false);
  const [backupStatus, setBackupStatus] = useState<PackageBackupStatus | null>(null);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [dismissedBackupBanner, setDismissedBackupBanner] = useState(false);
  const backupAlertedRef = useRef(false);
  const [cleaningProcesses, setCleaningProcesses] = useState(false);
  const [lastCleanupResult, setLastCleanupResult] = useState<ProcessCleanupResult | null>(null);
  const ansiStreamBuffersRef = useRef<Map<string, ReturnType<typeof createAnsiStreamBuffer>>>(
    new Map()
  );
  const pendingStreamChunksRef = useRef<Map<string, string>>(new Map());
  const streamRafRef = useRef<number | null>(null);

  const editorRef = useRef<CodeEditorHandle | null>(null);
  const filesRef = useRef(files);
  filesRef.current = files;
  const activeFileIdRef = useRef(activeFileId);
  activeFileIdRef.current = activeFileId;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const executionEngineRef = useRef(executionEngine);
  executionEngineRef.current = executionEngine;
  const termuxConfigRef = useRef(termuxConfig);
  termuxConfigRef.current = termuxConfig;
  const crawlerSessionRef = useRef(crawlerSession);
  crawlerSessionRef.current = crawlerSession;
  const sandboxPackagesRef = useRef(sandboxPackages);
  sandboxPackagesRef.current = sandboxPackages;
  const pyodideStatusRef = useRef(pyodideStatus);
  pyodideStatusRef.current = pyodideStatus;
  const autoUpdatePyRanRef = useRef(false);
  const autoUpdateTermuxRanRef = useRef(false);
  const startupAutoUpdateEnabledRef = useRef(Boolean(settings.autoUpdatePackages));
  const appLaunchedAtRef = useRef(Date.now());
  const edgeSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const overlayStateRef = useRef({
    showHelpModal,
    showLogsModal,
    showUpdateModal,
    negativeOpen,
    mobileNewFileOpen,
  });
  overlayStateRef.current = {
    showHelpModal,
    showLogsModal,
    showUpdateModal,
    negativeOpen,
    mobileNewFileOpen,
  };
  const inputResolverRef = useRef<{
    resolve: (val: string) => void;
    reject: (err: Error) => void;
  } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    const isNativeApp = Boolean(window.DroidPyNative?.isNativeApp?.());
    if (!isNativeApp) {
      registerSW({ immediate: true });
    }
    let alreadyLogged = startupBootLoggedInModule;
    try {
      if (!alreadyLogged && sessionStorage.getItem('droidpy_boot_logged_v1') === '1') {
        alreadyLogged = true;
      }
      if (!alreadyLogged) {
        sessionStorage.setItem('droidpy_boot_logged_v1', '1');
      }
    } catch {
      // ignore sessionStorage errors
    }
    if (!alreadyLogged) {
      startupBootLoggedInModule = true;
      appLog(
        'lifecycle',
        `DroidPy started (layout=${deviceClass}, engine=${executionEngineRef.current}, files=${filesRef.current.length}, sandboxPkgs=${sandboxPackagesRef.current.length})`
      );
    }
    const onWinErr = (ev: ErrorEvent) => {
      appLog('lifecycle', `Uncaught error: ${ev.message}`, {
        level: 'error',
        detail: ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : undefined,
      });
    };
    const onUnhandled = (ev: PromiseRejectionEvent) => {
      const reason = ev.reason;
      const msg = reason instanceof Error ? reason.message : String(reason ?? 'Unknown rejection');
      const stack = reason instanceof Error ? reason.stack : undefined;
      appLog('lifecycle', `Unhandled rejection: ${msg || 'Unknown error'}`, {
        level: 'error',
        detail: stack,
      });
    };
    window.addEventListener('error', onWinErr);
    window.addEventListener('unhandledrejection', onUnhandled);
    return () => {
      window.removeEventListener('error', onWinErr);
      window.removeEventListener('unhandledrejection', onUnhandled);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FILES_KEY, JSON.stringify(files));
    } catch {
      // ignore quota error
    }
  }, [files]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ACTIVE_ID_KEY, activeFileId);
    } catch {
      // ignore
    }
  }, [activeFileId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
    const meta = getThemeMeta(settings.theme);
    const root = document.documentElement;
    root.dataset.theme = meta.id;
    const langMeta = LOCALE_OPTIONS.find((item) => item.id === settings.locale);
    if (langMeta) {
      root.lang = langMeta.htmlLang;
    }
    if (meta.isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.classList.toggle('has-3d-bg', settings.enable3dBg !== false);
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', meta.themeColorMeta);
    }
  }, [settings]);

  useEffect(() => {
    if (!settings.enableSandboxAddon && executionEngine === 'pyodide') {
      setExecutionEngine('termux');
    }
  }, [settings.enableSandboxAddon, executionEngine]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ENGINE_KEY, executionEngine);
    } catch {
      // ignore
    }
  }, [executionEngine]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TERMUX_CFG_KEY, JSON.stringify(termuxConfig));
    } catch {
      // ignore
    }
  }, [termuxConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CRAWLER_SESSION_KEY, JSON.stringify(crawlerSession));
    } catch {
      // ignore
    }
  }, [crawlerSession]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PY_PKGS_KEY, JSON.stringify(sandboxPackages));
    } catch {
      // ignore
    }
  }, [sandboxPackages]);

  const flushNativeStateNow = useCallback(() => {
    const writer = window.DroidPyNative?.writePersistedState;
    if (!writer) return;
    try {
      writer(
        JSON.stringify({
          files: filesRef.current,
          activeFileId: activeFileIdRef.current,
          settings: settingsRef.current,
          executionEngine: executionEngineRef.current,
          termuxConfig: termuxConfigRef.current,
          crawlerSession: crawlerSessionRef.current,
          sandboxPackages: sandboxPackagesRef.current,
        })
      );
    } catch {
      // ignore bridge errors
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      flushNativeStateNow();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [
    files,
    activeFileId,
    settings,
    executionEngine,
    termuxConfig,
    crawlerSession,
    sandboxPackages,
    flushNativeStateNow,
  ]);

  useEffect(() => {
    window.__droidpyHandleBack = () => {
      const ov = overlayStateRef.current;
      if (ov.showUpdateModal) {
        setShowUpdateModal(false);
        return true;
      }
      if (ov.showLogsModal) {
        setShowLogsModal(false);
        return true;
      }
      if (ov.showHelpModal) {
        setShowHelpModal(false);
        return true;
      }
      if (ov.negativeOpen) {
        setNegativeOpen(false);
        return true;
      }
      if (ov.mobileNewFileOpen) {
        setMobileNewFileOpen(false);
        return true;
      }
      return false;
    };
    return () => {
      delete window.__droidpyHandleBack;
    };
  }, []);

  useEffect(() => {
    const onPauseOrHide = () => {
      if (document.visibilityState === 'hidden') {
        flushNativeStateNow();
      }
    };
    window.addEventListener('pagehide', flushNativeStateNow);
    window.addEventListener('beforeunload', flushNativeStateNow);
    window.addEventListener('droidpy-flush-state', flushNativeStateNow);
    document.addEventListener('visibilitychange', onPauseOrHide);
    return () => {
      window.removeEventListener('pagehide', flushNativeStateNow);
      window.removeEventListener('beforeunload', flushNativeStateNow);
      window.removeEventListener('droidpy-flush-state', flushNativeStateNow);
      document.removeEventListener('visibilitychange', onPauseOrHide);
    };
  }, [flushNativeStateNow]);

  const activeFile = useMemo(
    () => files.find((f) => f.id === activeFileId) ?? files[0],
    [files, activeFileId]
  );

  useEffect(() => {
    setCursorPos({ line: 1, col: 1 });
  }, [activeFile?.id]);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) =>
      translate(settings.locale, key, vars),
    [settings.locale]
  );

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg(null);
    }, 2600);
  }, []);

  const appendEntry = useCallback(
    (type: TerminalEntry['type'], content: string, imageDataUrl?: string) => {
      const cappedContent =
        content.length > MAX_TERMINAL_ENTRY_CHARS
          ? content.slice(-MAX_TERMINAL_ENTRY_CHARS)
          : content;
      setEntries((prev) => {
        const next = [
          ...prev,
          {
            id: makeId(),
            type,
            content: cappedContent,
            timestamp: formatTime(),
            imageDataUrl,
          },
        ];
        return next.length > MAX_TERMINAL_ENTRIES
          ? next.slice(-MAX_TERMINAL_ENTRIES)
          : next;
      });
    },
    []
  );

  const commitPendingStreamChunks = useCallback(() => {
    streamRafRef.current = null;
    const pending = pendingStreamChunksRef.current;
    if (pending.size === 0) return;
    const batch = Array.from(pending.entries());
    pending.clear();
    setEntries((prev) => {
      let next = prev;
      let cloned = false;
      for (const [streamId, text] of batch) {
        if (!text) continue;
        const idx = next.findIndex((e) => e.id === streamId);
        if (idx === -1) {
          if (!cloned) {
            next = [...prev];
            cloned = true;
          }
          next.push({
            id: streamId,
            type: 'stdout',
            content: mergeTerminalChunk('', text),
            timestamp: formatTime(),
          });
        } else {
          if (!cloned) {
            next = [...prev];
            cloned = true;
          }
          next[idx] = {
            ...next[idx],
            content: mergeTerminalChunk(next[idx].content, text),
          };
        }
      }
      if (!cloned) return prev;
      return next.length > MAX_TERMINAL_ENTRIES
        ? next.slice(-MAX_TERMINAL_ENTRIES)
        : next;
    });
  }, []);

  const appendStreamChunk = useCallback(
    (streamId: string, chunk: string) => {
      let buf = ansiStreamBuffersRef.current.get(streamId);
      if (!buf) {
        buf = createAnsiStreamBuffer();
        ansiStreamBuffersRef.current.set(streamId, buf);
      }
      const processed = buf.push(chunk);
      if (!processed) return;
      const prevPending = pendingStreamChunksRef.current.get(streamId) ?? '';
      const combined = prevPending + processed;
      pendingStreamChunksRef.current.set(
        streamId,
        combined.length > MAX_TERMINAL_ENTRY_CHARS
          ? combined.slice(-MAX_TERMINAL_ENTRY_CHARS)
          : combined
      );
      if (streamRafRef.current === null) {
        streamRafRef.current = window.requestAnimationFrame(commitPendingStreamChunks);
      }
    },
    [commitPendingStreamChunks]
  );

  const flushStreamChunk = useCallback(
    (streamId: string) => {
      const buf = ansiStreamBuffersRef.current.get(streamId);
      const rem = buf ? buf.flush() : '';
      ansiStreamBuffersRef.current.delete(streamId);
      const queued = pendingStreamChunksRef.current.get(streamId) ?? '';
      pendingStreamChunksRef.current.delete(streamId);
      const combined = queued + rem;
      if (!combined) return;
      setEntries((prev) => {
        const idx = prev.findIndex((e) => e.id === streamId);
        if (idx === -1) {
          const next = [
            ...prev,
            {
              id: streamId,
              type: 'stdout' as const,
              content: mergeTerminalChunk('', combined),
              timestamp: formatTime(),
            },
          ];
          return next.length > MAX_TERMINAL_ENTRIES
            ? next.slice(-MAX_TERMINAL_ENTRIES)
            : next;
        }
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          content: mergeTerminalChunk(next[idx].content, combined),
        };
        return next;
      });
    },
    []
  );

  const handleClearTerminal = useCallback(() => {
    if (streamRafRef.current !== null) {
      window.cancelAnimationFrame(streamRafRef.current);
      streamRafRef.current = null;
    }
    pendingStreamChunksRef.current.clear();
    ansiStreamBuffersRef.current.clear();
    setEntries([]);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRafRef.current !== null) {
        window.cancelAnimationFrame(streamRafRef.current);
        streamRafRef.current = null;
      }
    };
  }, []);

  const callbacksRef = useRef<RuntimeCallbacks>({
    onStdout: (text) => appendEntry('stdout', text),
    onStderr: (text) => appendEntry('stderr', text),
    onSystem: (text) => appendEntry('system', text),
    onPlot: (dataUrl) => appendEntry('plot', t('log_plot_output'), dataUrl),
    onToast: (msg) => showToast(msg),
    onInputRequest: (promptText) =>
      new Promise<string>((resolve, reject) => {
        setPendingInputPrompt(promptText);
        inputResolverRef.current = { resolve, reject };
      }),
  });

  callbacksRef.current = {
    onStdout: (text) => appendEntry('stdout', text),
    onStderr: (text) => appendEntry('stderr', text),
    onSystem: (text) => appendEntry('system', text),
    onPlot: (dataUrl) => appendEntry('plot', t('log_plot_output'), dataUrl),
    onToast: (msg) => showToast(msg),
    onInputRequest: (promptText) =>
      new Promise<string>((resolve, reject) => {
        setPendingInputPrompt(promptText);
        setMobileTab('console');
        inputResolverRef.current = { resolve, reject };
      }),
  };

  useEffect(() => {
    if (!settings.enableSandboxAddon || executionEngine === 'termux') return;
    if (pyodideStatusRef.current === 'ready' || pyodideStatusRef.current === 'loading') return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      setPyodideStatus('loading');
      try {
        await initPyodide(callbacksRef.current);
        if (cancelled) return;
        setPyodideStatus('ready');
        appLog('python', 'Pyodide WASM runtime initialized');

        const savedPkgs = sandboxPackagesRef.current;
        if (savedPkgs.length > 0) {
          pyodidePackageOperationLockRef.current = true;
          try {
            const currentList = await listPyPackages(callbacksRef.current);
            if (cancelled) return;
            setInstalledPackages(currentList);
            const installedNames = new Set(currentList.map((p) => p.name.toLowerCase()));
            const missing = savedPkgs.filter((p) => !installedNames.has(p.toLowerCase()));
            if (missing.length > 0) {
              appendEntry('system', translate(settingsRef.current.locale, 'pkg_restoring', { count: missing.length }));
              appLog('package', `Auto-restoring ${missing.length} sandbox package(s): ${missing.join(', ')}`);
              for (const pkg of missing) {
                if (cancelled) break;
                try {
                  const updated = await installPyPackage(pkg, callbacksRef.current);
                  if (!cancelled) setInstalledPackages(updated);
                } catch {
                  // ignore individual restore failures
                }
              }
            }
          } catch {
            // ignore restore list failures
          } finally {
            pyodidePackageOperationLockRef.current = false;
          }
        }
      } catch (err) {
        if (!cancelled) {
          const isNative = Boolean(window.DroidPyNative?.isNativeApp?.());
          if (isNative) {
            setPyodideStatus('idle');
            return;
          }
          const msg = err instanceof Error ? err.message : String(err);
          setPyodideStatus('error');
          appendEntry('stderr', msg);
          appLog('python', `Pyodide init failed: ${msg}`, { level: 'error' });
        }
      }
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [appendEntry, executionEngine, settings.enableSandboxAddon]);

  const handleLinkDirectory = useCallback(async () => {
    const isNativeApk = Boolean(termuxHealth?.embedded || window.DroidPyNative?.isNativeApp?.());
    if (isNativeApk) {
      const granted = Boolean(window.DroidPyNative?.hasStoragePermission?.());
      if (!granted && window.DroidPyNative?.requestStoragePermission) {
        window.DroidPyNative.requestStoragePermission();
        showToast(t('toast_dir_opening_sys'));
        return;
      }
      try {
        const status = await getSdcardStatus(termuxConfig);
        if (!status.granted && window.DroidPyNative?.requestStoragePermission) {
          window.DroidPyNative.requestStoragePermission();
          showToast(t('toast_dir_opening_sys'));
          return;
        }
        showToast(`${t('sd_status_ok')} (${status.rootPath})`);
      } catch {
        const root = window.DroidPyNative?.getInternalStoragePath?.() || '/storage/emulated/0';
        showToast(granted ? `${t('sd_status_ok')} (${root})` : t('toast_dir_opening_sys'));
        if (!granted) {
          window.DroidPyNative?.requestStoragePermission?.();
        }
      }
      return;
    }

    const importFromFallbackPicker = async () => {
      const picked = await pickDirectoryFilesViaInput();
      if (!picked) {
        showToast(t('toast_dir_cancelled'));
        return;
      }
      if (picked.files.length === 0) {
        showToast(t('toast_dir_no_py'));
        return;
      }
      setFiles((prev) => {
        const next = [...prev];
        for (const incoming of picked.files) {
          const idx = next.findIndex((f) => f.name.toLowerCase() === incoming.name.toLowerCase());
          if (idx === -1) {
            next.push(incoming);
          } else {
            next[idx] = { ...next[idx], content: incoming.content, updatedAt: incoming.updatedAt };
          }
        }
        return next;
      });
      const firstPy = picked.files.find((f) => f.name.toLowerCase().endsWith('.py')) ?? picked.files[0];
      if (firstPy) {
        setActiveFileId(firstPy.id);
      }
      showToast(t('toast_dir_loaded', { name: picked.folderName, count: picked.files.length }));
    };

    try {
      if (supportsDirectoryAccess()) {
        const handle = await requestLinkedDirectory();
        if (handle) {
          setLinkedDirHandle(handle);
          showToast(t('toast_dir_linked', { name: handle.name }));
          return;
        }
      }
      await importFromFallbackPicker();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        showToast(t('toast_dir_cancelled'));
        return;
      }
      const msg = err instanceof Error ? err.message : '';
      if (
        err instanceof DOMException ||
        /security|frame|gesture|not allowed|unsupported|not a function/i.test(msg)
      ) {
        await importFromFallbackPicker();
        return;
      }
      showToast(msg || t('toast_dir_unsupported'));
    }
  }, [termuxHealth, termuxConfig, showToast, t]);

  const handleImportFromDirectory = useCallback(async () => {
    if (!linkedDirHandle) return;
    try {
      const imported = await readPythonFilesFromDirectory(linkedDirHandle);
      if (imported.length === 0) {
        showToast(t('toast_dir_no_py'));
        return;
      }
      setFiles(imported);
      setActiveFileId(imported[0].id);
      showToast(t('toast_dir_loaded', { name: linkedDirHandle.name, count: imported.length }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('toast_dir_unsupported'));
    }
  }, [linkedDirHandle, showToast, t]);

  const handleSaveToDirectory = useCallback(async () => {
    if (!linkedDirHandle) return;
    try {
      const count = await writeFilesToDirectory(linkedDirHandle, files);
      showToast(t('toast_dir_written', { count, name: linkedDirHandle.name }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('toast_dir_unsupported'));
    }
  }, [linkedDirHandle, files, showToast, t]);

  const handleUpdateTermuxConfig = useCallback((patch: Partial<TermuxConfig>) => {
    setTermuxConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const refreshBackupStatus = useCallback(async (cfg?: TermuxConfig) => {
    try {
      const st = await getBackupStatus(cfg ?? termuxConfigRef.current);
      if (st) {
        setBackupStatus(st);
        const missingCount =
          (st.missingPipPackages?.length ?? 0) + (st.missingPkgPackages?.length ?? 0);
        if (st.hasBackup && missingCount > 0) {
          if (!backupAlertedRef.current) {
            backupAlertedRef.current = true;
            setDismissedBackupBanner(false);
            const list = [...(st.missingPkgPackages ?? []), ...(st.missingPipPackages ?? [])];
            appLog('package', `Detected ${missingCount} missing backed-up package(s): ${list.join(', ')}`);
          }
        } else {
          backupAlertedRef.current = false;
        }
      }
    } catch {
      // ignore backup status probe error
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    const probe = async (): Promise<boolean> => {
      try {
        const health = await checkTermuxHealth(termuxConfig);
        if (cancelled) return true;
        setTermuxHealth(health);
        setTermuxConnectionState('connected');
        appLog(
          'bridge',
          `Termux bridge connected (${health.embedded ? 'embedded' : 'external'}, python=${health.hasPython}, pipPkgs=${health.installedPipPackages?.length ?? 0}, pkgPkgs=${health.installedPkgPackages?.length ?? 0})`
        );
        if (health.embedded) {
          setExecutionEngine('termux');
          showToast(t('toast_termux_auto_embedded'));
        }
        void refreshBackupStatus(termuxConfig);
        return true;
      } catch {
        // Silent probe on startup — keep retrying briefly in case APK bridge is still initializing
        return false;
      }
    };
    void (async () => {
      const ok = await probe();
      if (ok || cancelled) return;
      for (const delay of [1500, 4000]) {
        await new Promise<void>((resolve) => {
          const id = window.setTimeout(resolve, delay);
          timers.push(id);
        });
        if (cancelled) return;
        const retryOk = await probe();
        if (retryOk || cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
    // Run once on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTestTermuxConnection = useCallback(async () => {
    setTermuxConnectionState('checking');
    setTermuxError(null);
    try {
      const health = await checkTermuxHealth(termuxConfig);
      setTermuxHealth(health);
      setTermuxConnectionState('connected');
      appLog('bridge', `Manual health check OK: ${health.pythonVersion}`, {
        detail: `embedded=${Boolean(health.embedded)}, hasPython=${health.hasPython}, pip=${(health.installedPipPackages ?? []).join(', ')}`,
      });
      void refreshBackupStatus(termuxConfig);
      showToast(t('toast_termux_connected', { ver: health.pythonVersion }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('toast_termux_disconnected');
      setTermuxError(msg);
      setTermuxConnectionState('error');
      appLog('bridge', `Manual health check failed: ${msg}`, { level: 'warn' });
      showToast(t('toast_termux_disconnected'));
    }
  }, [termuxConfig, refreshBackupStatus, showToast, t]);

  const syncFilesFromTermux = useCallback(
    async (showEmptyToast: boolean) => {
      try {
        const remoteFiles = await fetchTermuxWorkspaceFiles(termuxConfig);
        if (remoteFiles.length === 0) {
          if (showEmptyToast) showToast(t('toast_termux_no_new_files'));
          return;
        }
        let changedCount = 0;
        setFiles((prev) => {
          const next = [...prev];
          for (const rf of remoteFiles) {
            const idx = next.findIndex((f) => f.name === rf.name);
            if (idx === -1) {
              next.push(rf);
              changedCount++;
            } else if (next[idx].content !== rf.content) {
              next[idx] = { ...next[idx], content: rf.content, updatedAt: rf.updatedAt };
              changedCount++;
            }
          }
          return changedCount > 0 ? next : prev;
        });
        if (changedCount > 0) {
          showToast(t('toast_termux_files_synced', { count: changedCount }));
        } else if (showEmptyToast) {
          showToast(t('toast_termux_no_new_files'));
        }
      } catch {
        if (showEmptyToast) {
          showToast(t('toast_termux_disconnected'));
        }
      }
    },
    [termuxConfig, showToast, t]
  );

  const resolveRunnableEntry = useCallback((): PythonFile | null => {
    if (!activeFile) return null;
    if (activeFile.name.toLowerCase().endsWith('.py')) return activeFile;
    const fallback =
      files.find((f) => f.name.toLowerCase() === 'main.py') ??
      files.find((f) => f.name.toLowerCase().endsWith('.py'));
    if (!fallback) {
      showToast(t('toast_no_py_entry'));
      return null;
    }
    showToast(t('toast_run_entry_fallback', { name: fallback.name }));
    return fallback;
  }, [activeFile, files, showToast, t]);

  const focusOutputPane = useCallback(
    (pane: 'terminal' | 'browser' = 'terminal') => {
      setTabletSplit(true);
      setTabletPaneTab(pane);
      setMobileTab(pane === 'browser' ? 'browser' : 'console');
    },
    []
  );

  // Install only the Python runtime essentials on first actual use.
  // Optional libraries and native build toolchains remain opt-in.
  const ensureEmbeddedPythonEnvironment = useCallback(async (): Promise<boolean> => {
    let health = termuxHealth;
    if (!health || (health.embedded && health.hasPython === false)) {
      try {
        health = await checkTermuxHealth(termuxConfig);
        setTermuxHealth(health);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setTermuxError(message);
        appLog('termux', `Unable to verify Python before first use: ${message}`, { level: 'error' });
        appendEntry('stderr', message);
        showToast(t('toast_termux_disconnected'));
        return false;
      }
    }
    if (!health?.embedded || health.hasPython !== false) return true;

    const command = 'pkg update -y && pkg install -y python python-pip';
    const streamId = makeId();
    appLog('termux', 'First-use Python bootstrap started (python, python-pip only)');
    appendEntry('system', t('log_termux_init', { cmd: command }));
    try {
      const result = await streamShellInTermux(termuxConfig, command, {
        onChunk: (chunk) => appendStreamChunk(streamId, chunk),
      });
      flushStreamChunk(streamId);
      setTermuxConnectionState('connected');
      setLastDurationMs(result.durationMs);
      if (result.exitCode !== 0) {
        appendEntry('stderr', t('log_termux_exit', { code: result.exitCode }));
        appLog('termux', `First-use Python bootstrap failed (exit=${result.exitCode})`, { level: 'error' });
        showToast(t('toast_termux_init_err', { code: result.exitCode }));
        return false;
      }
      const verified = await checkTermuxHealth(termuxConfig);
      setTermuxHealth(verified);
      if (verified.embedded && verified.hasPython === false) {
        appendEntry('stderr', t('tmx_need_init_hint'));
        appLog('termux', 'First-use Python bootstrap completed but Python is still unavailable', { level: 'error' });
        showToast(t('tmx_need_init_hint'));
        return false;
      }
      appLog('termux', 'First-use Python bootstrap completed');
      showToast(t('toast_termux_init_ok'));
      return true;
    } catch (err) {
      flushStreamChunk(streamId);
      const message = err instanceof Error ? err.message : String(err);
      setTermuxError(message);
      appendEntry('stderr', message);
      appLog('termux', `First-use Python bootstrap exception: ${message}`, { level: 'error' });
      showToast(t('toast_termux_install_fail'));
      return false;
    }
  }, [termuxHealth, termuxConfig, appendEntry, appendStreamChunk, flushStreamChunk, showToast, t]);

  const handleRunInTermux = useCallback(async () => {
    if (termuxRunning || termuxOperationLockRef.current || termuxScriptStartLockRef.current) {
      showToast(t('cta_running'));
      return;
    }
    const entryFile = resolveRunnableEntry();
    if (!entryFile) return;
    // React state updates are asynchronous; lock synchronously to ignore rapid double taps.
    termuxScriptStartLockRef.current = true;
    focusOutputPane('terminal');
    setTermuxPaused(false);
    setTermuxScriptRunning(true);
    setTermuxRunning(true);
    setTermuxActiveTask(`run:${entryFile.name}`);
    setRunStartedAt(Date.now());
    setTermuxError(null);

    const streamId = makeId();

    try {
      const pythonReady = await ensureEmbeddedPythonEnvironment();
      if (!pythonReady) return;

      appendEntry('system', t('log_termux_run', { name: entryFile.name }));
      appLog('termux', `Run script in Termux: ${entryFile.name}`);
      let hasOutput = false;
      let outputTail = '';
      const outputTailAnsiBuf = createAnsiStreamBuffer();

      const res = await streamRunInTermux(termuxConfig, entryFile, files, {
        onChunk: (chunk) => {
          if (chunk.length > 0) {
            hasOutput = true;
            const cleanChunk = stripAnsi(outputTailAnsiBuf.push(chunk));
            if (cleanChunk) {
              outputTail = (outputTail + cleanChunk).slice(-500);
            }
          }
          appendStreamChunk(streamId, chunk);
        },
      });
      const outputRem = stripAnsi(outputTailAnsiBuf.flush());
      if (outputRem) {
        outputTail = (outputTail + outputRem).slice(-500);
      }
      flushStreamChunk(streamId);
      setTermuxConnectionState('connected');
      setLastDurationMs(res.durationMs);
      if (res.exitCode === 0) {
        appendEntry(
          'system',
          t(hasOutput ? 'log_run_done_output' : 'log_run_done_empty', {
            name: entryFile.name,
            duration: formatDurationHMS(res.durationMs),
          })
        );
        appLog('termux', `Finished ${entryFile.name} (exit=0, ${formatDurationHMS(res.durationMs)})`, {
          detail: outputTail.trim() || '(no stdout)',
        });
      } else if (res.exitCode !== -1) {
        appendEntry('stderr', t('log_termux_exit', { code: res.exitCode }));
        appLog('termux', `${entryFile.name} exited with code ${res.exitCode}`, {
          level: 'error',
          detail: outputTail.trim() || undefined,
        });
      }
      await syncFilesFromTermux(false);
    } catch (err) {
      flushStreamChunk(streamId);
      const msg = err instanceof Error ? err.message : String(err);
      const isAborted = /abort|中止/i.test(msg);
      if (!isAborted) {
        setTermuxConnectionState('error');
        setTermuxError(msg);
        appendEntry('stderr', msg);
        appLog('termux', `Termux run failed (${entryFile.name}): ${msg}`, { level: 'error' });
      } else {
        appLog('termux', `Aborted execution of ${entryFile.name}`, { level: 'warn' });
      }
    } finally {
      termuxScriptStartLockRef.current = false;
      setTermuxScriptRunning(false);
      setTermuxPaused(false);
      setRunStartedAt(null);
      setTermuxActiveTask(null);
      setTermuxRunning(false);
    }
  }, [
    resolveRunnableEntry,
    focusOutputPane,
    files,
    termuxConfig,
    termuxHealth,
    termuxRunning,
    ensureEmbeddedPythonEnvironment,
    appendEntry,
    appendStreamChunk,
    flushStreamChunk,
    syncFilesFromTermux,
    showToast,
    t,
  ]);

  const handleInstallInTermux = useCallback(
    async (mode: 'pip' | 'pkg', target: string) => {
      if (termuxRunning || termuxOperationLockRef.current || termuxScriptStartLockRef.current) {
        showToast(t('cta_running'));
        return;
      }
      termuxOperationLockRef.current = true;
      let label = `${mode} install ${target}`;
      focusOutputPane('terminal');
      setTermuxRunning(true);
      setTermuxActiveTask(`install:${target.trim()}`);
      setRunStartedAt(Date.now());
      setTermuxError(null);
      const streamId = makeId();
      let tailBuf = '';
      const tailAnsiBuf = createAnsiStreamBuffer();
      try {
        const resolvedInstall = resolveTermuxInstallTarget(mode, target);
        const installMode = resolvedInstall.mode;
        const installTarget = resolvedInstall.target;
        label = installMode === 'pkg'
          ? `pkg install -y ${installTarget}${resolvedInstall.routedFromPip ? ` (native Termux package for ${target})` : ''}`
          : `pip install ${installTarget}`;
        appendEntry('system', t('log_termux_install', { cmd: label }));
        appLog('package', `Termux install start: ${label}`);
        const pythonReady = await ensureEmbeddedPythonEnvironment();
        if (!pythonReady) return;
        const res = await streamInstallInTermux(
          termuxConfig,
          installMode,
          installTarget,
          {
            onChunk: (chunk) => {
              appendStreamChunk(streamId, chunk);
              const cleanChunk = stripAnsi(tailAnsiBuf.push(chunk));
              if (cleanChunk) {
                tailBuf = (tailBuf + cleanChunk).slice(-1200);
              }
            },
          },
          { trustedHost: Boolean(settingsRef.current.pipTrustedHostEmergency) }
        );
        const remTail = stripAnsi(tailAnsiBuf.flush());
        if (remTail) {
          tailBuf = (tailBuf + remTail).slice(-1200);
        }
        flushStreamChunk(streamId);
        setTermuxConnectionState('connected');
        setLastDurationMs(res.durationMs);
        if (res.exitCode === 0) {
          if (mode === 'pip') {
            const installedNorms = new Set(
              target
                .split(/\s+/)
                .map((s) => normalizeTermuxPkgName(s.split(/[=<>!~]/)[0] || ''))
                .filter(Boolean)
            );
            setOutdatedTermuxPips((prev) =>
              prev.filter((item) => !installedNorms.has(normalizeTermuxPkgName(item.name)))
            );
          }
          appLog('package', `Termux install succeeded: ${label} (${formatDurationHMS(res.durationMs)})`);
          showToast(t('toast_termux_install_ok', { pkg: target }));
        } else {
          appendEntry('stderr', t('log_termux_exit', { code: res.exitCode }));
          appLog('package', `Termux install failed: ${label} (exit=${res.exitCode})`, {
            level: 'error',
            detail: tailBuf.trim() || undefined,
          });
          showToast(t('toast_termux_install_err', { pkg: target, code: res.exitCode }));
        }
      } catch (err) {
        flushStreamChunk(streamId);
        const msg = err instanceof Error ? err.message : String(err);
        setTermuxConnectionState('error');
        setTermuxError(msg);
        appendEntry('stderr', msg);
        appLog('package', `Termux install exception (${label}): ${msg}`, {
          level: 'error',
          detail: tailBuf.trim() || undefined,
        });
        showToast(t('toast_termux_install_fail'));
      } finally {
        try {
          const health = await checkTermuxHealth(termuxConfig);
          setTermuxHealth(health);
          void refreshBackupStatus(termuxConfig);
        } catch {
          // ignore health refresh failure
        }
        setRunStartedAt(null);
        setTermuxActiveTask(null);
        setTermuxRunning(false);
        termuxOperationLockRef.current = false;
      }
    },
    [termuxConfig, termuxRunning, ensureEmbeddedPythonEnvironment, focusOutputPane, appendEntry, appendStreamChunk, flushStreamChunk, refreshBackupStatus, showToast, t]
  );

  const handleRunShellInTermux = useCallback(
    async (command: string, operationLockAlreadyHeld = false): Promise<boolean> => {
      if (
        (operationLockAlreadyHeld && !termuxOperationLockRef.current) ||
        (!operationLockAlreadyHeld && (termuxRunning || termuxOperationLockRef.current || termuxScriptStartLockRef.current))
      ) {
        showToast(t('cta_running'));
        return false;
      }
      if (!operationLockAlreadyHeld) termuxOperationLockRef.current = true;
      focusOutputPane('terminal');
      setTermuxRunning(true);
      setRunStartedAt(Date.now());
      setTermuxError(null);
      appendEntry('repl-in', `$ ${command}`);
      appLog('termux', `Shell command: ${command}`);
      const streamId = makeId();
      let tailBuf = '';
      const tailAnsiBuf = createAnsiStreamBuffer();
      let succeeded = false;
      try {
        const res = await streamShellInTermux(termuxConfig, command, {
          onChunk: (chunk) => {
            appendStreamChunk(streamId, chunk);
            const cleanChunk = stripAnsi(tailAnsiBuf.push(chunk));
            if (cleanChunk) {
              tailBuf = (tailBuf + cleanChunk).slice(-1200);
            }
          },
        });
        const remTail = stripAnsi(tailAnsiBuf.flush());
        if (remTail) {
          tailBuf = (tailBuf + remTail).slice(-1200);
        }
        flushStreamChunk(streamId);
        setTermuxConnectionState('connected');
        setLastDurationMs(res.durationMs);
        if (res.exitCode !== 0) {
          appendEntry('stderr', t('log_termux_exit', { code: res.exitCode }));
          appLog('termux', `Shell exited with code ${res.exitCode}`, {
            level: 'warn',
            detail: tailBuf.trim() ? `${command}\n\n${tailBuf.trim()}` : command,
          });
        } else {
          succeeded = true;
          appLog('termux', `Shell finished (${formatDurationHMS(res.durationMs)})`);
        }
      } catch (err) {
        flushStreamChunk(streamId);
        const msg = err instanceof Error ? err.message : String(err);
        setTermuxConnectionState('error');
        setTermuxError(msg);
        appendEntry('stderr', msg);
        appLog('termux', `Shell exception: ${msg}`, {
          level: 'error',
          detail: tailBuf.trim() ? `${command}\n\n${tailBuf.trim()}` : command,
        });
      } finally {
        if (/\b(pkg|apt|apt-get|pip|pip3)\b/i.test(command)) {
          try {
            const health = await checkTermuxHealth(termuxConfig);
            setTermuxHealth(health);
            void refreshBackupStatus(termuxConfig);
          } catch {
            // ignore
          }
        }
        setRunStartedAt(null);
        setTermuxRunning(false);
        if (!operationLockAlreadyHeld) termuxOperationLockRef.current = false;
      }
      return succeeded;
    },
    [termuxConfig, termuxRunning, focusOutputPane, appendEntry, appendStreamChunk, flushStreamChunk, refreshBackupStatus, showToast, t]
  );

  const handleRestoreBackedUpPackages = useCallback(async () => {
    if (termuxRunning || termuxOperationLockRef.current || termuxScriptStartLockRef.current || restoringBackup) {
      showToast(t('cta_running'));
      return;
    }
    termuxOperationLockRef.current = true;
    setExecutionEngine('termux');
    focusOutputPane('terminal');
    setRestoringBackup(true);
    setTermuxRunning(true);
    setRunStartedAt(Date.now());
    setTermuxError(null);
    appendEntry('system', t('backup_restore_btn'));
    appLog('package', 'Restoring backed-up packages from /sdcard/DroidPy/.droidpy_backup');
    const streamId = makeId();
    let tailBuf = '';
    const tailAnsiBuf = createAnsiStreamBuffer();
    try {
      const res = await streamRestoreBackedUpPackages(termuxConfig, {
        onChunk: (chunk) => {
          appendStreamChunk(streamId, chunk);
          const cleanChunk = stripAnsi(tailAnsiBuf.push(chunk));
          if (cleanChunk) {
            tailBuf = (tailBuf + cleanChunk).slice(-1200);
          }
        },
      });
      const remTail = stripAnsi(tailAnsiBuf.flush());
      if (remTail) {
        tailBuf = (tailBuf + remTail).slice(-1200);
      }
      flushStreamChunk(streamId);
      setTermuxConnectionState('connected');
      setLastDurationMs(res.durationMs);
      if (res.exitCode === 0) {
        appLog('package', `Backed-up packages restored (${formatDurationHMS(res.durationMs)})`);
        showToast(t('backup_restore_done'));
      } else {
        appendEntry('stderr', t('log_termux_exit', { code: res.exitCode }));
        appLog('package', `Backed-up package restore exited ${res.exitCode}`, {
          level: 'warn',
          detail: tailBuf.trim() || undefined,
        });
        showToast(t('backup_restore_err', { msg: `exit ${res.exitCode}` }));
      }
    } catch (err) {
      flushStreamChunk(streamId);
      const msg = err instanceof Error ? err.message : String(err);
      appendEntry('stderr', msg);
      appLog('package', `Backed-up package restore failed: ${msg}`, { level: 'error' });
      showToast(t('backup_restore_err', { msg }));
    } finally {
      try {
        const health = await checkTermuxHealth(termuxConfig);
        setTermuxHealth(health);
        await refreshBackupStatus(termuxConfig);
      } catch {
        // ignore refresh failure
      }
      flushNativeStateNow();
      setRestoringBackup(false);
      setRunStartedAt(null);
      setTermuxRunning(false);
      termuxOperationLockRef.current = false;
    }
  }, [
    termuxRunning,
    restoringBackup,
    termuxConfig,
    focusOutputPane,
    appendEntry,
    appendStreamChunk,
    flushStreamChunk,
    refreshBackupStatus,
    flushNativeStateNow,
    showToast,
    t,
  ]);

  const handleSendTermuxStdin = useCallback(
    async (text: string) => {
      try {
        await sendTermuxStdin(termuxConfig, text);
      } catch (err) {
        appendEntry('stderr', err instanceof Error ? err.message : '傳送輸入失敗');
      }
    },
    [termuxConfig, appendEntry]
  );

  const handleToggleTermuxPause = useCallback(async () => {
    if (!termuxScriptRunning) return;
    try {
      if (termuxPaused) {
        await resumeTermuxProcess(termuxConfig);
        setTermuxPaused(false);
        appendEntry('system', '腳本已繼續執行');
      } else {
        await pauseTermuxProcess(termuxConfig);
        setTermuxPaused(true);
        appendEntry('system', '腳本已暫停');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      appendEntry('stderr', message);
      showToast(message);
    }
  }, [termuxConfig, termuxPaused, termuxScriptRunning, appendEntry, showToast]);

  const handleStopTermux = useCallback(async () => {
    abortActiveTermuxStream();
    appLog('termux', 'User stopped running Termux process', { level: 'warn' });
    try {
      await stopTermuxProcess(termuxConfig);
      appendEntry('system', t('log_termux_stop'));
      showToast(t('toast_termux_stopped'));
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('toast_termux_disconnected'));
    } finally {
      setTermuxPaused(false);
      setTermuxRunning(false);
    }
  }, [termuxConfig, appendEntry, showToast, t]);

  const handleBackupToSdcard = useCallback(async () => {
    try {
      const res = await backupWorkspaceToSdcard(termuxConfig, files, 'DroidPy');
      appLog('storage', `Backed up ${res.count} file(s) to ${res.dir}`);
      showToast(t('sd_toast_exported', { count: res.count, path: res.dir }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appLog('storage', `Backup to /sdcard failed: ${msg}`, { level: 'error' });
      showToast(msg);
      if (msg.includes('權限')) {
        window.DroidPyNative?.requestStoragePermission?.();
      }
    }
  }, [termuxConfig, files, showToast, t]);

  const handleCleanupStuckProcesses = useCallback(
    async (manual = false) => {
      if (
        cleaningProcesses ||
        termuxRunning ||
        termuxOperationLockRef.current ||
        termuxScriptStartLockRef.current
      ) return;
      termuxOperationLockRef.current = true;
      setCleaningProcesses(true);
      try {
        const res = await cleanupTermuxProcesses(termuxConfigRef.current, manual);
        setLastCleanupResult(res);
        appLog(
          'termux',
          `Python process read-only scan (manual=${manual}): scanned=${res.scannedCount}, killed=${res.killedCount}`
        );
        if (res.killedCount > 0) {
          const list = res.killed
            .map((k) => `${k.pid}(${Math.round(k.elapsedSec / 60)}m)`)
            .join(', ');
          const msg = t('tmx_cleanup_killed', { count: res.killedCount, list });
          appendEntry('system', msg);
          showToast(msg);
        } else if (manual) {
          const msg = t('tmx_cleanup_none', { scanned: res.scannedCount });
          appendEntry('system', msg);
          showToast(msg);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appLog('termux', `Python watchdog check failed: ${msg}`, { level: 'warn' });
        if (manual) {
          appendEntry('stderr', msg);
          showToast(msg);
        }
      } finally {
        setCleaningProcesses(false);
        termuxOperationLockRef.current = false;
      }
    },
    [cleaningProcesses, termuxRunning, appendEntry, showToast, t]
  );

  const handleRebuildPipCertifi = useCallback(async () => {
    if (termuxRunning) {
      showToast(t('cta_running'));
      return;
    }
    const cmd = [
      'mkdir -p "$PREFIX/tmp" "$HOME/.droidpy_lib" "$HOME/.config/pip" "$PREFIX/etc"',
      "python3 - <<'EOF'",
      'import os, shutil, ssl, sys',
      'base = os.environ.get("PREFIX", "") or os.path.dirname(os.path.dirname(sys.executable))',
      'home = os.environ.get("HOME", os.path.expanduser("~"))',
      'cands = []',
      'for modname in ("certifi", "pip._vendor.certifi"):',
      '    try:',
      '        m = __import__(modname, fromlist=["where"])',
      '        p = m.where()',
      '        if p and os.path.isfile(p): cands.append(p)',
      '    except Exception:',
      '        pass',
      'for c in (os.path.join(base, "etc/tls/cert.pem"), os.path.join(base, "etc/ssl/certs/ca-certificates.crt"), "/etc/ssl/certs/ca-certificates.crt"):',
      '    if os.path.isfile(c): cands.append(c)',
      'src = next((p for p in cands if os.path.isfile(p) and os.path.getsize(p) > 0), None)',
      'dst_dir = os.path.join(base, "tmp")',
      'os.makedirs(dst_dir, exist_ok=True)',
      'dst = os.path.join(dst_dir, "cacert.pem")',
      'if src:',
      '    shutil.copyfile(src, dst)',
      '    os.chmod(dst, 0o644)',
      '    print("SSL_CERT_FILE=" + dst)',
      '    import stat',
      '    def update_pip_config_preserving_existing_settings(cfg_path):',
      '        try:',
      '            with open(cfg_path, "r", encoding="utf-8") as fp: lines = fp.readlines()',
      '        except FileNotFoundError:',
      '            lines = []',
      '        except Exception:',
      '            return',
      '        out = []',
      '        in_global = False',
      '        global_seen = False',
      '        cert_written = False',
      '        for line in lines:',
      '            stripped = line.strip()',
      '            if stripped.startswith("[") and stripped.endswith("]"):',
      '                if in_global and not cert_written:',
      '                    out.append("cert = " + dst + "\\n")',
      '                    cert_written = True',
      '                in_global = stripped[1:-1].strip().lower() == "global"',
      '                global_seen = global_seen or in_global',
      '                out.append(line)',
      '                continue',
      '            if in_global and "=" in stripped and stripped.split("=", 1)[0].strip().lower() == "cert":',
      '                if not cert_written:',
      '                    out.append("cert = " + dst + "\\n")',
      '                    cert_written = True',
      '                continue',
      '            out.append(line)',
      '        if in_global and not cert_written:',
      '            out.append("cert = " + dst + "\\n")',
      '            cert_written = True',
      '        if not global_seen:',
      '            if out and not out[-1].endswith("\\n"): out[-1] += "\\n"',
      '            if out and out[-1].strip(): out.append("\\n")',
      '            out.extend(["[global]\\n", "cert = " + dst + "\\n"])',
      '        try:',
      '            mode = stat.S_IMODE(os.stat(cfg_path).st_mode) if os.path.exists(cfg_path) else 0o600',
      '            tmp_path = cfg_path + ".droidpy.tmp"',
      '            with open(tmp_path, "w", encoding="utf-8") as fp: fp.writelines(out)',
      '            os.chmod(tmp_path, mode)',
      '            os.replace(tmp_path, cfg_path)',
      '        except Exception:',
      '            try: os.unlink(tmp_path)',
      '            except Exception: pass',
      '    for cfg_path in (os.path.join(base, "etc/pip.conf"), os.path.join(home, ".config/pip/pip.conf")):',
      '        try:',
      '            os.makedirs(os.path.dirname(cfg_path), exist_ok=True)',
      '            update_pip_config_preserving_existing_settings(cfg_path)',
      '        except Exception:',
      '            pass',
      'else:',
      '    print("NO_CERT_SOURCE_FOUND")',
      'EOF',
      'if [ -f "$HOME/.droidpy_lib/sitecustomize.py" ]; then for sp in "$PREFIX"/lib/python3.*/site-packages; do [ -d "$sp" ] && cp -f "$HOME/.droidpy_lib/sitecustomize.py" "$sp/sitecustomize.py" 2>/dev/null || true; done; fi',
      'chmod -R u+rwX,go+rX "$PREFIX/etc" "$PREFIX/tmp" "$PREFIX"/lib/python3.*/site-packages/certifi "$PREFIX"/lib/python3.*/site-packages/pip/_vendor/certifi 2>/dev/null || true',
      'python3 -m pip --version',
    ].join('\n');
    const ok = await handleRunShellInTermux(cmd);
    if (ok) {
      appLog('package', 'Rebuilt writable certifi CA bundle, permissions & truststore hook');
      showToast(t('tmx_pip_ssl_done'));
    }
  }, [termuxRunning, handleRunShellInTermux, showToast, t]);

  const handleRestoreScriptBackup = useCallback(
    (nextFiles: PythonFile[], label: string) => {
      if (!nextFiles || nextFiles.length === 0) return;
      try {
        // A restore must not replace the current workspace unless its rollback
        // snapshot was durably persisted first.
        createScriptBackup(filesRef.current, undefined, 'pre-restore');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        appLog('storage', `Restore blocked: pre-restore backup failed (${message})`, { level: 'error' });
        showToast(t('bak_restore_blocked'));
        return;
      }
      setFiles(nextFiles);
      setActiveFileId(nextFiles[0].id);
      setMobileTab('editor');
      appLog('storage', `Restored script snapshot "${label}" (${nextFiles.length} file(s))`);
      showToast(t('bak_restored_toast', { label }));
    },
    [showToast, t]
  );

  const handleSyncBackupToSdcard = useCallback(
    async (snapshot: ScriptBackupSnapshot) => {
      try {
        const relPath = `DroidPy/backups/${snapshot.id}.json`;
        await writeSdcardFile(termuxConfigRef.current, relPath, exportScriptBackupJson(snapshot));
        appLog('storage', `Synced script backup to /sdcard/${relPath}`);
        showToast(t('bak_exported_toast', { name: `/sdcard/${relPath}` }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appLog('storage', `Sync script backup to /sdcard failed: ${msg}`, { level: 'error' });
        showToast(msg);
      }
    },
    [showToast, t]
  );

  const handleRunCode = useCallback(async () => {
    if (!activeFile || pyodideStatus === 'running' || termuxRunning) return;

    if (executionEngine === 'termux') {
      await handleRunInTermux();
      return;
    }

    const entryFile = resolveRunnableEntry();
    if (!entryFile) return;

    if (pyodideStatus === 'loading') {
      showToast(t('toast_core_loading'));
      return;
    }

    focusOutputPane('terminal');
    setPyodideStatus('running');
    setRunStartedAt(Date.now());
    appendEntry('system', t('log_exec_py', { name: entryFile.name }));
    appLog('python', `Run script in Pyodide sandbox: ${entryFile.name}`);

    let hasOutput = false;
    let outputTail = '';
    const baseCallbacks = callbacksRef.current;
    const trackedCallbacks: RuntimeCallbacks = {
      ...baseCallbacks,
      onStdout: (text) => {
        if (text.length > 0) {
          hasOutput = true;
          outputTail = stripAnsi(outputTail + text).slice(-500);
        }
        baseCallbacks.onStdout(text);
      },
      onStderr: (text) => {
        if (text.length > 0) {
          hasOutput = true;
          outputTail = stripAnsi(outputTail + text).slice(-500);
        }
        baseCallbacks.onStderr(text);
      },
      onPlot: (dataUrl) => {
        hasOutput = true;
        baseCallbacks.onPlot(dataUrl);
      },
    };

    try {
      const result = await executePythonFile(entryFile, files, trackedCallbacks);
      setLastDurationMs(result.durationMs);
      setPyodideStatus('ready');
      appendEntry(
        'system',
        t(hasOutput ? 'log_run_done_output' : 'log_run_done_empty', {
          name: entryFile.name,
          duration: formatDurationHMS(result.durationMs),
        })
      );
      appLog('python', `Pyodide finished ${entryFile.name} (${formatDurationHMS(result.durationMs)})`, {
        detail: outputTail.trim() || '(no stdout)',
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setPyodideStatus('ready');
      appendEntry('stderr', errMsg);
      appLog('python', `Pyodide execution error (${entryFile.name}): ${errMsg}`, { level: 'error' });
    } finally {
      setRunStartedAt(null);
      setPendingInputPrompt(null);
      inputResolverRef.current = null;
    }
  }, [
    activeFile,
    resolveRunnableEntry,
    focusOutputPane,
    files,
    pyodideStatus,
    termuxRunning,
    executionEngine,
    handleRunInTermux,
    appendEntry,
    showToast,
    t,
  ]);

  const handleCancelInput = useCallback(() => {
    if (inputResolverRef.current) {
      inputResolverRef.current.reject(new Error('KeyboardInterrupt'));
      inputResolverRef.current = null;
      setPendingInputPrompt(null);
    }
  }, []);

  const handleSubmitInput = useCallback((value: string) => {
    if (inputResolverRef.current) {
      inputResolverRef.current.resolve(value);
      inputResolverRef.current = null;
      setPendingInputPrompt(null);
    }
  }, []);

  const handleRunRepl = useCallback(
    async (statement: string) => {
      if (executionEngine === 'termux') {
        await handleRunShellInTermux(statement);
        return;
      }
      if (pyodideStatus === 'running') {
        showToast(t('cta_running'));
        return;
      }
      if (pyodideStatus !== 'ready') {
        showToast(t('toast_core_loading'));
        return;
      }
      appendEntry('repl-in', statement);
      setPyodideStatus('running');
      setRunStartedAt(Date.now());
      try {
        const result = await executeReplLine(statement, files, callbacksRef.current);
        if (result !== null) {
          appendEntry('repl-out', result);
        }
        if (/^[!%]?\s*pip\s+install\b/i.test(statement.trim())) {
          const tokens = statement
            .trim()
            .replace(/^[!%]?\s*pip\s+install\s+/i, '')
            .split(/\s+/)
            .filter((tok) => tok && !tok.startsWith('-'))
            .map((tok) => tok.split(/[=<>!~]/)[0].trim())
            .filter(Boolean);
          if (tokens.length > 0) {
            setSandboxPackages((prev) => Array.from(new Set([...prev, ...tokens])));
          }
          try {
            const list = await listPyPackages(callbacksRef.current);
            setInstalledPackages(list);
          } catch {
            // ignore refresh errors
          }
        } else if (/^[!%]?\s*pip\s+uninstall\b/i.test(statement.trim())) {
          const tokens = statement
            .trim()
            .replace(/^[!%]?\s*pip\s+uninstall\s+/i, '')
            .split(/\s+/)
            .filter((tok) => tok && !tok.startsWith('-'))
            .map((tok) => normalizePyPkgName(tok.split(/[=<>!~]/)[0].trim()))
            .filter(Boolean);
          if (tokens.length > 0) {
            const removed = new Set(tokens);
            setSandboxPackages((prev) =>
              prev.filter((p) => !removed.has(normalizePyPkgName(p)))
            );
            setOutdatedPyPackages((prev) =>
              prev.filter((p) => !removed.has(normalizePyPkgName(p.name)))
            );
          }
          try {
            const list = await listPyPackages(callbacksRef.current);
            setInstalledPackages(list);
          } catch {
            // ignore refresh errors
          }
        }
      } finally {
        setRunStartedAt(null);
        setPyodideStatus('ready');
        setPendingInputPrompt(null);
        inputResolverRef.current = null;
      }
    },
    [executionEngine, handleRunShellInTermux, pyodideStatus, files, appendEntry, showToast, t]
  );

  const handleCodeChange = useCallback(
    (nextContent: string) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === activeFile.id ? { ...f, content: nextContent, updatedAt: Date.now() } : f
        )
      );
    },
    [activeFile.id]
  );

  const handleCreateFile = useCallback((name: string, content = '') => {
    const clean = sanitizeFileName(name);
    if (!clean) return;
    const newFile: PythonFile = {
      id: makeId(),
      name: clean,
      content,
      updatedAt: Date.now(),
    };
    setFiles((prev) => [...prev, newFile]);
    setActiveFileId(newFile.id);
    setMobileTab('editor');
  }, []);

  const handleRenameFile = useCallback((id: string, nextName: string) => {
    const clean = sanitizeFileName(nextName);
    if (!clean) return;
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name: clean, updatedAt: Date.now() } : f))
    );
  }, []);

  const handleDeleteFile = useCallback(
    (id: string) => {
      if (filesRef.current.length <= 1) return;
      setFiles((prev) => {
        if (prev.length <= 1) return prev;
        const filtered = prev.filter((f) => f.id !== id);
        if (filtered.length > 0 && activeFileId === id) {
          setActiveFileId(filtered[0].id);
        }
        return filtered;
      });
      showToast(t('toast_deleted_file'));
    },
    [activeFileId, showToast, t]
  );

  const handleSaveWorkspaceFile = useCallback(
    (filename: string, content: string, openInEditor = false) => {
      const cleanName = sanitizeFileName(filename);
      if (!cleanName) return;
      const existing = filesRef.current.find(
        (f) => f.name.toLowerCase() === cleanName.toLowerCase()
      );
      const targetId = existing?.id ?? makeId();
      setFiles((prev) => {
        const idx = prev.findIndex((f) => f.name.toLowerCase() === cleanName.toLowerCase());
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], content, updatedAt: Date.now() };
          return next;
        }
        return [...prev, { id: targetId, name: cleanName, content, updatedAt: Date.now() }];
      });
      if (openInEditor) {
        setActiveFileId(targetId);
        setMobileTab('editor');
      }
    },
    []
  );

  useEffect(() => {
    const onNativeCookies = (ev: Event) => {
      const detail = (ev as CustomEvent<{
        url?: string;
        userAgent?: string;
        cookieHeader?: string;
        capturedAt?: number;
      }>).detail;
      if (!detail) return;
      const incomingCookies = detail.cookieHeader ? parseCookieHeaderPairs(detail.cookieHeader) : [];
      const prev = crawlerSessionRef.current;
      const nextSession: CrawlerSessionData = {
        url: detail.url || prev.url,
        userAgent: detail.userAgent || prev.userAgent,
        cookies: mergeCookieLists(prev.cookies, incomingCookies),
        extraHeaders: prev.extraHeaders,
        capturedAt: detail.capturedAt || Date.now(),
      };
      setCrawlerSession(nextSession);
      handleSaveWorkspaceFile('cookies.json', buildCookiesJsonContent(nextSession), false);
      showToast(t('brw_toast_native_captured', { count: incomingCookies.length }));
    };

    window.addEventListener('droidpy-native-cookies', onNativeCookies);
    return () => window.removeEventListener('droidpy-native-cookies', onNativeCookies);
  }, [handleSaveWorkspaceFile, showToast, t]);

  const handleUpdateSettings = useCallback((patch: Partial<EditorSettings>) => {
    if (patch.autoUpdatePackages !== undefined) {
      setAutoUpdatePackagesPref(patch.autoUpdatePackages);
    }
    if (patch.githubRepo !== undefined) {
      const cleaned = saveGithubRepo(patch.githubRepo);
      setGithubRepo(cleaned);
    }
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleResetWorkspace = useCallback(() => {
    setFiles(DEFAULT_FILES);
    setActiveFileId(DEFAULT_FILES[0].id);
    showToast(t('toast_workspace_reset'));
  }, [showToast, t]);

  const handleInstallPackage = useCallback(
    async (pkgName: string) => {
      if (pyodidePackageOperationLockRef.current) {
        showToast(t('cta_running'));
        return;
      }
      pyodidePackageOperationLockRef.current = true;
      setActivePyodidePackage(pkgName);
      appLog('package', `Installing Pyodide package: ${pkgName}`);
      try {
        const list = await installPyPackage(pkgName, callbacksRef.current);
        setInstalledPackages(list);
        const cleanPkg = pkgName.split(/[=<>!~]/)[0].trim();
        if (cleanPkg) {
          const normInstalled = normalizePyPkgName(cleanPkg);
          setSandboxPackages((prev) => (prev.includes(cleanPkg) ? prev : [...prev, cleanPkg]));
          setOutdatedPyPackages((prev) =>
            prev.filter((p) => normalizePyPkgName(p.name) !== normInstalled)
          );
        }
        appLog('package', `Installed Pyodide package: ${pkgName}`);
        showToast(t('toast_pkg_ok', { pkg: pkgName }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appendEntry('stderr', `${t('toast_pkg_fail', { pkg: pkgName })}: ${msg}`);
        appLog('package', `Failed installing Pyodide package ${pkgName}: ${msg}`, { level: 'error' });
        showToast(t('toast_pkg_fail', { pkg: pkgName }));
      } finally {
        setActivePyodidePackage(null);
        pyodidePackageOperationLockRef.current = false;
      }
    },
    [appendEntry, showToast, t]
  );

  const handleUninstallPyPackage = useCallback(
    async (pkgName: string) => {
      const norm = normalizePyPkgName(pkgName);
      if (!norm || PYODIDE_CORE_PACKAGES.has(norm)) {
        showToast(t('pkg_uninstall_core_err'));
        return;
      }
      if (pyodidePackageOperationLockRef.current) {
        showToast(t('cta_running'));
        return;
      }
      pyodidePackageOperationLockRef.current = true;
      appLog('package', `Uninstalling Pyodide package: ${pkgName}`);
      try {
        const list = await uninstallPyPackage(pkgName, callbacksRef.current);
        setInstalledPackages(list);
        setSandboxPackages((prev) => prev.filter((p) => normalizePyPkgName(p) !== norm));
        setOutdatedPyPackages((prev) => prev.filter((p) => normalizePyPkgName(p.name) !== norm));
        appLog('package', `Uninstalled Pyodide package: ${pkgName}`);
        showToast(t('pkg_uninstalled_toast', { pkg: pkgName }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appendEntry('stderr', msg);
        appLog('package', `Failed uninstalling Pyodide package ${pkgName}: ${msg}`, { level: 'error' });
        showToast(msg);
      } finally {
        pyodidePackageOperationLockRef.current = false;
      }
    },
    [appendEntry, showToast, t]
  );

  const handleRefreshPackages = useCallback(async () => {
    if (pyodidePackageOperationLockRef.current) return;
    pyodidePackageOperationLockRef.current = true;
    try {
      const list = await listPyPackages(callbacksRef.current);
      setInstalledPackages(list);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('pkg_loaded_empty'));
    } finally {
      pyodidePackageOperationLockRef.current = false;
    }
  }, [showToast, t]);

  const handleUpgradePyPackage = useCallback(
    async (pkgName: string) => {
      if (pyodidePackageOperationLockRef.current) {
        showToast(t('cta_running'));
        return;
      }
      pyodidePackageOperationLockRef.current = true;
      setUpgradingPyPackages(true);
      appLog('package', `Upgrading Pyodide package: ${pkgName}`);
      try {
        const normPkg = normalizePyPkgName(pkgName);
        const targetInfo = outdatedPyPackages.find(
          (p) => normalizePyPkgName(p.name) === normPkg
        );
        const list = await upgradePyPackage(pkgName, callbacksRef.current, targetInfo?.latestVersion);
        setInstalledPackages(list);
        setOutdatedPyPackages((prev) =>
          prev.filter((p) => normalizePyPkgName(p.name) !== normPkg)
        );
        appLog('package', `Upgraded Pyodide package: ${pkgName}`);
        showToast(t('pkg_upgraded_toast', { count: 1 }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appendEntry('stderr', `${t('toast_pkg_fail', { pkg: pkgName })}: ${msg}`);
        appLog('package', `Upgrade failed (${pkgName}): ${msg}`, { level: 'error' });
        showToast(t('toast_pkg_fail', { pkg: pkgName }));
      } finally {
        setUpgradingPyPackages(false);
        pyodidePackageOperationLockRef.current = false;
      }
    },
    [outdatedPyPackages, appendEntry, showToast, t]
  );

  const handleCheckAndUpgradeAllPy = useCallback(async () => {
    if (checkingOutdatedPkgs || upgradingPyPackages || pyodidePackageOperationLockRef.current) return;
    pyodidePackageOperationLockRef.current = true;
    setCheckingOutdatedPkgs(true);
    try {
      const currentList = await listPyPackages(callbacksRef.current);
      setInstalledPackages(currentList);
      const outdated = await checkOutdatedPyPackages(currentList);
      setOutdatedPyPackages(outdated);
      if (outdated.length === 0) {
        showToast(t('pkg_up_to_date'));
        appLog('package', 'Checked Pyodide packages: all up to date');
        return;
      }
      setUpgradingPyPackages(true);
      appLog('package', `Upgrading ${outdated.length} outdated Pyodide package(s): ${outdated.map((o) => o.name).join(', ')}`);
      const nextList = await upgradeAllPyPackages(outdated, callbacksRef.current);
      setInstalledPackages(nextList);
      setOutdatedPyPackages([]);
      showToast(t('pkg_upgraded_toast', { count: outdated.length }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendEntry('stderr', msg);
      showToast(msg);
    } finally {
      setCheckingOutdatedPkgs(false);
      setUpgradingPyPackages(false);
      pyodidePackageOperationLockRef.current = false;
    }
  }, [checkingOutdatedPkgs, upgradingPyPackages, appendEntry, showToast, t]);

  const handleCheckTermuxOutdated = useCallback(async () => {
    if (
      termuxConnectionState !== 'connected' ||
      termuxHealth?.hasPython === false ||
      checkingTermuxOutdated ||
      termuxRunning ||
      termuxOperationLockRef.current ||
      termuxScriptStartLockRef.current
    ) {
      return;
    }
    termuxOperationLockRef.current = true;
    setCheckingTermuxOutdated(true);
    try {
      const res = await execTermuxShell(termuxConfigRef.current, 'pip list --outdated --format=json');
      const outdated = parseOutdatedPipJson(res.stdout || '', termuxHealth?.installedPkgPackages);
      setOutdatedTermuxPips(outdated);
      appLog('package', `Checked Termux pip outdated packages: ${outdated.length}`);
      if (outdated.length === 0) {
        showToast(t('pkg_up_to_date'));
      }
    } catch {
      // ignore check error
    } finally {
      setCheckingTermuxOutdated(false);
      termuxOperationLockRef.current = false;
    }
  }, [termuxConnectionState, termuxHealth?.hasPython, termuxHealth?.installedPkgPackages, checkingTermuxOutdated, termuxRunning, showToast, t]);

  const handleUninstallInTermux = useCallback(
    async (mode: 'pip' | 'pkg', target: string) => {
      if (termuxRunning || termuxOperationLockRef.current || termuxScriptStartLockRef.current) {
        showToast(t('cta_running'));
        return;
      }
      const cmd = buildTermuxUninstallCommand(mode, target, termuxHealth?.installedPkgPackages);
      if (!cmd) {
        showToast(t('pkg_uninstall_core_err'));
        return;
      }
      termuxOperationLockRef.current = true;
      focusOutputPane('terminal');
      setTermuxRunning(true);
      setRunStartedAt(Date.now());
      setTermuxError(null);
      appendEntry('repl-in', `$ ${cmd}`);
      appLog('package', `Termux uninstall start: ${cmd}`);
      const streamId = makeId();
      let tailBuf = '';
      const tailAnsiBuf = createAnsiStreamBuffer();
      try {
        const res = await streamShellInTermux(termuxConfig, cmd, {
          onChunk: (chunk) => {
            appendStreamChunk(streamId, chunk);
            const cleanChunk = stripAnsi(tailAnsiBuf.push(chunk));
            if (cleanChunk) {
              tailBuf = (tailBuf + cleanChunk).slice(-1200);
            }
          },
        });
        const remTail = stripAnsi(tailAnsiBuf.flush());
        if (remTail) {
          tailBuf = (tailBuf + remTail).slice(-1200);
        }
        flushStreamChunk(streamId);
        setTermuxConnectionState('connected');
        setLastDurationMs(res.durationMs);
        if (res.exitCode === 0) {
          if (mode === 'pip') {
            const removedNorms = new Set(
              target
                .split(/\s+/)
                .map((s) => normalizeTermuxPkgName(s))
                .filter(Boolean)
            );
            setOutdatedTermuxPips((prev) =>
              prev.filter((item) => !removedNorms.has(normalizeTermuxPkgName(item.name)))
            );
          }
          appLog('package', `Termux uninstall succeeded: ${cmd} (${formatDurationHMS(res.durationMs)})`);
          showToast(t('pkg_uninstalled_toast', { pkg: target }));
        } else {
          appendEntry('stderr', t('log_termux_exit', { code: res.exitCode }));
          appLog('package', `Termux uninstall failed: ${cmd} (exit=${res.exitCode})`, {
            level: 'error',
            detail: tailBuf.trim() || undefined,
          });
          showToast(t('toast_termux_install_err', { pkg: target, code: res.exitCode }));
        }
      } catch (err) {
        flushStreamChunk(streamId);
        const msg = err instanceof Error ? err.message : String(err);
        setTermuxConnectionState('error');
        setTermuxError(msg);
        appendEntry('stderr', msg);
        appLog('package', `Termux uninstall error (${cmd}): ${msg}`, { level: 'error' });
        showToast(msg);
      } finally {
        try {
          const health = await checkTermuxHealth(termuxConfig);
          setTermuxHealth(health);
          void refreshBackupStatus(termuxConfig);
        } catch {
          // ignore health refresh failure
        }
        setRunStartedAt(null);
        setTermuxRunning(false);
        termuxOperationLockRef.current = false;
      }
    },
    [termuxRunning, termuxConfig, focusOutputPane, appendEntry, appendStreamChunk, flushStreamChunk, refreshBackupStatus, showToast, t]
  );

  const handleUpgradeAllTermux = useCallback(
    async (kind: 'pip' | 'pkg') => {
      if (termuxRunning || termuxOperationLockRef.current || termuxScriptStartLockRef.current || upgradingTermux) {
        showToast(t('cta_running'));
        return;
      }
      termuxOperationLockRef.current = true;
      setUpgradingTermux(true);
      try {
        if (kind === 'pip') {
          setCheckingTermuxOutdated(true);
          let outdatedTargets: string[] = [];
          try {
            const outRes = await execTermuxShell(
              termuxConfigRef.current,
              'pip list --outdated --format=json'
            );
            const outdated = parseOutdatedPipJson(outRes.stdout || '', termuxHealth?.installedPkgPackages);
            setOutdatedTermuxPips(outdated);
            outdatedTargets = outdated
              .map((item) => item.name)
              .filter((n) => !CORE_TERMUX_PIP_PACKAGES.has(normalizeTermuxPkgName(n)));
          } catch {
            // ignore outdated check failure
          } finally {
            setCheckingTermuxOutdated(false);
          }
          if (outdatedTargets.length === 0) {
            showToast(t('pkg_up_to_date'));
            return;
          }
          const ok = await handleRunShellInTermux(
            buildTermuxPipUpgradeCommand(
              outdatedTargets,
              Boolean(settingsRef.current.pipTrustedHostEmergency),
              termuxHealth?.installedPkgPackages
            ),
            true
          );
          if (ok) {
            setOutdatedTermuxPips([]);
            showToast(t('pkg_upgraded_toast', { count: outdatedTargets.length }));
          }
          return;
        }
        await handleRunShellInTermux(buildTermuxAptUpgradeCommand(), true);
      } finally {
        setUpgradingTermux(false);
        termuxOperationLockRef.current = false;
      }
    },
    [termuxRunning, upgradingTermux, termuxHealth?.installedPkgPackages, handleRunShellInTermux, showToast, t]
  );

  const handleUpgradeSingleTermuxPip = useCallback(
    async (pkg: string) => {
      if (termuxRunning || termuxOperationLockRef.current || termuxScriptStartLockRef.current || upgradingTermux) {
        showToast(t('cta_running'));
        return;
      }
      const clean = pkg.replace(/[^a-zA-Z0-9_.-]/g, '').trim();
      if (!clean) return;
      setUpgradingTermux(true);
      try {
        const hostFlags = settingsRef.current.pipTrustedHostEmergency
          ? ' --trusted-host pypi.org --trusted-host files.pythonhosted.org'
          : '';
        const ok = await handleRunShellInTermux(`pip install --upgrade${hostFlags} ${clean}`);
        if (ok) {
          const normClean = normalizeTermuxPkgName(clean);
          setOutdatedTermuxPips((prev) =>
            prev.filter((item) => normalizeTermuxPkgName(item.name) !== normClean)
          );
        }
      } finally {
        setUpgradingTermux(false);
      }
    },
    [termuxRunning, upgradingTermux, handleRunShellInTermux, showToast, t]
  );

  const handleUpgradeAllPackages = useCallback(async () => {
    if (
      checkingOutdatedPkgs ||
      upgradingPyPackages ||
      pyodidePackageOperationLockRef.current ||
      upgradingTermux ||
      termuxRunning ||
      termuxOperationLockRef.current ||
      termuxScriptStartLockRef.current
    ) {
      showToast(t('cta_running'));
      return;
    }
    let upgradedCount = 0;

    if (pyodideStatus === 'ready') {
      pyodidePackageOperationLockRef.current = true;
      setCheckingOutdatedPkgs(true);
      try {
        const currentList = await listPyPackages(callbacksRef.current);
        setInstalledPackages(currentList);
        const outdated = await checkOutdatedPyPackages(currentList);
        setOutdatedPyPackages(outdated);
        if (outdated.length > 0) {
          setUpgradingPyPackages(true);
          appLog(
            'package',
            `Upgrading ${outdated.length} Pyodide package(s): ${outdated.map((o) => o.name).join(', ')}`
          );
          const nextList = await upgradeAllPyPackages(outdated, callbacksRef.current);
          setInstalledPackages(nextList);
          setOutdatedPyPackages([]);
          upgradedCount += outdated.length;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appendEntry('stderr', msg);
      } finally {
        setCheckingOutdatedPkgs(false);
        setUpgradingPyPackages(false);
        pyodidePackageOperationLockRef.current = false;
      }
    }

    if (termuxConnectionState === 'connected') {
      if (termuxRunning || termuxOperationLockRef.current || termuxScriptStartLockRef.current) {
        showToast(t('cta_running'));
        return;
      }
      termuxOperationLockRef.current = true;
      setUpgradingTermux(true);
      try {
        let pipTargets: string[] = [];
        if (termuxHealth?.hasPython !== false) {
          setCheckingTermuxOutdated(true);
          try {
            const outRes = await execTermuxShell(
              termuxConfigRef.current,
              'pip list --outdated --format=json'
            );
            const outdatedPips = parseOutdatedPipJson(outRes.stdout || '', termuxHealth?.installedPkgPackages);
            setOutdatedTermuxPips(outdatedPips);
            pipTargets = outdatedPips
              .map((item) => item.name)
              .filter((n) => !CORE_TERMUX_PIP_PACKAGES.has(normalizeTermuxPkgName(n)));
          } catch {
            // ignore pip outdated check failure and continue apt upgrade
          } finally {
            setCheckingTermuxOutdated(false);
          }
        }
        const cmds: string[] = [];
        if (pipTargets.length > 0) {
          cmds.push(
            buildTermuxPipUpgradeCommand(
              pipTargets,
              Boolean(settingsRef.current.pipTrustedHostEmergency),
              termuxHealth?.installedPkgPackages
            )
          );
        }
        cmds.push(buildTermuxAptUpgradeCommand());
        const ok = await handleRunShellInTermux(cmds.join(' && '), true);
        if (ok) {
          if (pipTargets.length > 0) {
            upgradedCount += pipTargets.length;
          }
          setOutdatedTermuxPips([]);
        }
      } finally {
        setUpgradingTermux(false);
        termuxOperationLockRef.current = false;
      }
    }

    if (upgradedCount > 0) {
      showToast(t('pkg_upgraded_toast', { count: upgradedCount }));
    } else {
      showToast(t('pkg_up_to_date'));
    }
  }, [
    checkingOutdatedPkgs,
    upgradingPyPackages,
    upgradingTermux,
    termuxRunning,
    pyodideStatus,
    termuxConnectionState,
    termuxHealth?.hasPython,
    termuxHealth?.installedPkgPackages,
    handleRunShellInTermux,
    appendEntry,
    showToast,
    t,
  ]);

  const handleCheckAppUpdates = useCallback(
    async (repoOverride?: string, silent = false) => {
      setCheckingAppUpdate(true);
      try {
        const result = await checkForAppUpdates(
          repoOverride ?? githubRepo,
          termuxConfigRef.current,
          termuxConnectionState === 'connected'
        );
        setAppUpdateResult(result);
        if (result.hasUpdate && result.latest) {
          setUpdateBannerDismissed(false);
          appLog('lifecycle', `New DroidPy version detected: v${result.latest.version}`);
          if (!silent) {
            showToast(t('upd_found_title', { ver: result.latest.version }));
          }
        } else if (!silent) {
          if (result.error) {
            showToast(t('upd_fetch_err', { msg: result.error }));
          } else if (result.repoSlug) {
            showToast(t('upd_up_to_date'));
          }
        }
      } finally {
        setCheckingAppUpdate(false);
      }
    },
    [githubRepo, termuxConnectionState, showToast, t]
  );

  useEffect(() => {
    if (!isOnline || !githubRepo) return;
    const timer = window.setTimeout(() => {
      void handleCheckAppUpdates(githubRepo, true);
    }, 2200);
    return () => window.clearTimeout(timer);
    // Run silent version check on initial startup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      pyodideStatus !== 'ready' ||
      !startupAutoUpdateEnabledRef.current ||
      !isOnline ||
      autoUpdatePyRanRef.current ||
      Date.now() - appLaunchedAtRef.current > 90_000
    ) {
      return;
    }
    autoUpdatePyRanRef.current = true;
    const timer = window.setTimeout(async () => {
      try {
        const list = await listPyPackages(callbacksRef.current);
        setInstalledPackages(list);
        const outdated = await checkOutdatedPyPackages(list);
        setOutdatedPyPackages(outdated);
        if (outdated.length > 0) {
          appLog('package', `Startup auto-updating ${outdated.length} Pyodide package(s): ${outdated.map((o) => o.name).join(', ')}`);
          setUpgradingPyPackages(true);
          const next = await upgradeAllPyPackages(outdated, callbacksRef.current);
          setInstalledPackages(next);
          setOutdatedPyPackages([]);
          showToast(t('pkg_upgraded_toast', { count: outdated.length }));
        }
      } catch {
        // silent background check
      } finally {
        setUpgradingPyPackages(false);
      }
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [pyodideStatus, isOnline, showToast, t]);

  useEffect(() => {
    if (
      termuxConnectionState !== 'connected' ||
      termuxHealth?.hasPython === false ||
      !startupAutoUpdateEnabledRef.current ||
      !isOnline ||
      autoUpdateTermuxRanRef.current ||
      Date.now() - appLaunchedAtRef.current > 90_000
    ) {
      return;
    }
    const userPips = (termuxHealth?.installedPipPackages ?? []).filter(
      (p) => !CORE_TERMUX_PIP_PACKAGES.has(normalizeTermuxPkgName(p))
    );
    if (userPips.length === 0) return;
    autoUpdateTermuxRanRef.current = true;
    const timer = window.setTimeout(async () => {
      if (termuxRunning || termuxOperationLockRef.current || termuxScriptStartLockRef.current) return;
      termuxOperationLockRef.current = true;
      setUpgradingTermux(true);
      const streamId = makeId();
      try {
        const outRes = await execTermuxShell(
          termuxConfigRef.current,
          'pip list --outdated --format=json'
        );
        const outdated = parseOutdatedPipJson(outRes.stdout || '', termuxHealth?.installedPkgPackages);
        setOutdatedTermuxPips(outdated);
        const targetNames = outdated
          .map((item) => item.name)
          .filter((name) => !CORE_TERMUX_PIP_PACKAGES.has(normalizeTermuxPkgName(name)));
        if (targetNames.length === 0) {
          appLog('package', 'Startup Termux pip check: all packages are already latest');
          return;
        }
        const cmd = buildTermuxPipUpgradeCommand(
          targetNames,
          Boolean(settingsRef.current.pipTrustedHostEmergency),
          termuxHealth?.installedPkgPackages
        );
        appLog('package', `Startup auto-updating Termux pip packages: ${targetNames.join(', ')}`);
        const res = await streamShellInTermux(termuxConfigRef.current, cmd, {
          onChunk: (chunk) => appendStreamChunk(streamId, chunk),
        });
        flushStreamChunk(streamId);
        if (res.exitCode === 0) {
          setOutdatedTermuxPips([]);
          appLog('package', `Startup Termux pip upgrade finished (${formatDurationHMS(res.durationMs)})`);
          const nextHealth = await checkTermuxHealth(termuxConfigRef.current).catch(() => null);
          if (nextHealth) setTermuxHealth(nextHealth);
          void refreshBackupStatus(termuxConfigRef.current);
        }
      } catch {
        flushStreamChunk(streamId);
        // silent background failure
      } finally {
        setUpgradingTermux(false);
        termuxOperationLockRef.current = false;
      }
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [termuxConnectionState, termuxHealth, isOnline, termuxRunning, appendStreamChunk, flushStreamChunk, refreshBackupStatus]);

  const handleFormatActiveFile = useCallback(() => {
    const ok = editorRef.current?.formatCode();
    if (ok) {
      showToast(t('toast_formatted', { name: activeFile.name }));
    }
  }, [activeFile.name, showToast, t]);

  const handleGenerateRequirements = useCallback(() => {
    const ignored = new Set(['micropip', 'packaging', 'pyodide-http', 'pyodide', 'droid', 'sys', 'os', 'math', 'json', 'time', 'random', 'asyncio', 'urllib']);
    const userMods = new Set(
      files.filter((f) => f.name.endsWith('.py')).map((f) => f.name.slice(0, -3).toLowerCase())
    );
    const lines = new Set<string>();
    for (const pkg of installedPackages) {
      if (!ignored.has(pkg.name.toLowerCase())) {
        lines.add(`${pkg.name}==${pkg.version}`);
      }
    }
    const importAlias: Record<string, string> = { bs4: 'beautifulsoup4', PIL: 'pillow', cv2: 'opencv-python', sklearn: 'scikit-learn' };
    for (const f of files) {
      if (!f.name.endsWith('.py')) continue;
      const matches = f.content.matchAll(/^(?:from|import)\s+([a-zA-Z0-9_]+)/gm);
      for (const m of matches) {
        const mod = m[1];
        if (ignored.has(mod.toLowerCase()) || userMods.has(mod.toLowerCase())) continue;
        const pkgName = importAlias[mod] ?? mod;
        const alreadyPinned = Array.from(lines).some((l) => l.toLowerCase().startsWith(`${pkgName.toLowerCase()}==`));
        if (!alreadyPinned && ['requests', 'beautifulsoup4', 'httpx', 'lxml', 'numpy', 'pandas', 'matplotlib', 'scipy', 'sympy', 'pillow', 'fastapi'].includes(pkgName.toLowerCase())) {
          lines.add(pkgName);
        }
      }
    }
    const content = Array.from(lines).sort().join('\n') + (lines.size > 0 ? '\n' : '');
    setFiles((prev) => {
      const idx = prev.findIndex((f) => f.name.toLowerCase() === 'requirements.txt');
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], content, updatedAt: Date.now() };
        return next;
      }
      return [...prev, { id: makeId(), name: 'requirements.txt', content, updatedAt: Date.now() }];
    });
    showToast(t('toast_req_generated', { count: lines.size }));
  }, [files, installedPackages, showToast, t]);

  const handleInstallRequirements = useCallback(async () => {
    const reqFile = files.find((f) => f.name.toLowerCase() === 'requirements.txt');
    if (!reqFile) {
      showToast(t('toast_req_missing'));
      return;
    }
    const pkgs = reqFile.content
      .split('\n')
      .map((l) => l.replace(/#.*$/, '').trim())
      .filter(Boolean);
    if (pkgs.length === 0) {
      showToast(t('toast_req_missing'));
      return;
    }
    showToast(t('toast_req_installing', { count: pkgs.length }));
    if (executionEngine === 'termux' || termuxConnectionState === 'connected') {
      await handleInstallInTermux('pip', pkgs.join(' '));
      return;
    }
    for (const pkg of pkgs) {
      const bare = pkg.split(/[=<>!~]/)[0].trim();
      if (bare) {
        await handleInstallPackage(bare);
      }
    }
  }, [files, executionEngine, termuxConnectionState, handleInstallInTermux, handleInstallPackage, showToast, t]);

  useEffect(() => {
    if (
      negativeOpen &&
      negativeSection === 'packages' &&
      pyodideStatus === 'ready' &&
      installedPackages.length === 0
    ) {
      void handleRefreshPackages();
    }
  }, [negativeOpen, negativeSection, pyodideStatus, installedPackages.length, handleRefreshPackages]);

  const isRunning = pyodideStatus === 'running' || termuxRunning;
  const isCoreLoading = executionEngine === 'pyodide' && pyodideStatus === 'loading';

  const openNegativeDrawer = useCallback((sec: NegativeScreenSection = 'termux') => {
    setNegativeSection(sec);
    setNegativeOpen(true);
  }, []);

  const renderInlineNewFileBar = () => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        let name = sanitizeFileName(mobileNewFileName);
        if (!name) return;
        if (!name.includes('.')) name += '.py';
        if (files.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
          showToast(t('files_exists', { name }));
          return;
        }
        const starter = name.toLowerCase().endsWith('.json')
          ? '{\n  "app": "DroidPy"\n}\n'
          : name.toLowerCase().endsWith('.py')
          ? `# ${name}\n\ndef main():\n    print("Hello from ${name}")\n\nif __name__ == "__main__":\n    main()\n`
          : '';
        handleCreateFile(name, starter);
        setMobileNewFileName('');
        setMobileNewFileOpen(false);
      }}
      className="flex items-center gap-1.5 px-2.5 py-2 border-b border-[var(--ide-border)] bg-[var(--md-surface-container-low)] shrink-0"
    >
      <input
        type="text"
        autoFocus
        value={mobileNewFileName}
        onChange={(e) => setMobileNewFileName(e.target.value)}
        placeholder={t('files_new_placeholder')}
        className="flex-1 min-w-0 min-h-[44px] px-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
      />
      <button
        type="submit"
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[var(--ide-accent)] text-white"
        aria-label={t('files_new_btn')}
      >
        <Check className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => setMobileNewFileOpen(false)}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[var(--ide-border)] text-[var(--ide-text-muted)]"
        aria-label={t('files_cancel')}
      >
        <X className="w-4 h-4" />
      </button>
    </form>
  );

  const activeThemeMeta = getThemeMeta(settings.theme);
  const is3dBgActive = settings.enable3dBg !== false;

  return (
    <I18nProvider
      locale={settings.locale}
      onChangeLocale={(loc) => handleUpdateSettings({ locale: loc })}
    >
      <div
        onTouchStart={(e) => {
          if (e.touches.length !== 1) return;
          const touch = e.touches[0];
          if (touch.clientX <= 28) {
            edgeSwipeStartRef.current = { x: touch.clientX, y: touch.clientY };
          } else {
            edgeSwipeStartRef.current = null;
          }
        }}
        onTouchEnd={(e) => {
          if (!edgeSwipeStartRef.current) return;
          const touch = e.changedTouches[0];
          const dx = touch.clientX - edgeSwipeStartRef.current.x;
          const dy = Math.abs(touch.clientY - edgeSwipeStartRef.current.y);
          edgeSwipeStartRef.current = null;
          if (dx > 52 && dy < 50) {
            setNegativeOpen(true);
          }
        }}
        className={`h-dvh flex flex-col ${
          is3dBgActive ? 'bg-transparent' : 'bg-[var(--ide-bg)]'
        } text-[var(--ide-text)] overflow-hidden relative`}
      >
      <DynamicAtmosphere3D
        enabled={is3dBgActive}
        mode={settings.atmosphere3dMode ?? 'auto'}
        themeId={settings.theme}
        isDarkTheme={activeThemeMeta.isDark}
        accentHex={activeThemeMeta.swatchAccent}
        bgHex={activeThemeMeta.swatchBg}
      />

      {/* Tablet Top Bar: Negative Screen Trigger + File Tabs + Split Toggle + Primary CTA */}
      {deviceClass === 'tablet' && (
      <header className="relative z-10 flex items-center justify-between gap-3 h-13 px-3 pt-safe border-b border-[var(--ide-border)] bg-[var(--md-surface-container-low)] shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setNegativeOpen(true)}
            aria-label={t('neg_open_aria')}
            className="min-h-[40px] px-2.5 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-[var(--ide-text)] hover:border-[var(--ide-accent)] inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0"
          >
            <PanelLeft className="w-4 h-4 text-[var(--ide-accent)]" />
            <span>{t('neg_title')}</span>
          </button>
          <img
            src="/icon.svg"
            alt="DroidPy"
            className="w-6 h-6 rounded-md shrink-0"
            referrerPolicy="no-referrer"
          />
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0">
            {files.map((file) => {
              const isActive = file.id === activeFile.id;
              return (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => setActiveFileId(file.id)}
                  className={`min-h-[34px] px-2.5 rounded-lg font-mono text-xs transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-[var(--ide-accent-soft)] text-[var(--ide-accent-text)] font-semibold border border-[var(--ide-accent)]/30'
                      : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
                  }`}
                >
                  {file.name}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setMobileNewFileOpen((v) => !v)}
              aria-label={t('files_new_btn')}
              className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-accent)] shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setTabletSplit((v) => !v)}
            className={`min-h-[40px] px-3 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              tabletSplit
                ? 'border-[var(--ide-accent)]/50 bg-[var(--ide-accent-soft)] text-[var(--ide-accent-text)]'
                : 'border-[var(--ide-border)] bg-[var(--ide-bg)] text-[var(--ide-text-muted)]'
            }`}
          >
            {tabletSplit ? <Maximize2 className="w-3.5 h-3.5" /> : <Columns2 className="w-3.5 h-3.5" />}
            <span>{tabletSplit ? t('tab_focus_editor') : t('tab_split_view')}</span>
          </button>

          {pendingInputPrompt !== null ? (
            <button
              type="button"
              onClick={handleCancelInput}
              className="min-h-[40px] px-4 rounded-xl bg-red-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{t('cta_abort_input')}</span>
            </button>
          ) : termuxRunning ? (
            <button
              type="button"
              onClick={() => void handleStopTermux()}
              className="min-h-[40px] px-4 rounded-xl bg-red-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{t('cta_stop_run')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunCode}
              disabled={isRunning || isCoreLoading}
              className="min-h-[40px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              {isRunning || isCoreLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>
                {isCoreLoading ? t('cta_loading_core') : isRunning ? t('cta_running') : t('cta_run_program')}
              </span>
            </button>
          )}
        </div>
      </header>
      )}

      {/* Phone Compact MD3 Top App Bar (Negative Screen drawer trigger + Title/File + Conditional CTA outside editor/console) */}
      {deviceClass === 'phone' && (
      <header className="relative z-10 flex items-center justify-between gap-2 h-13 px-2.5 pt-safe border-b border-[var(--ide-border)] bg-[var(--md-surface-container-low)] shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setNegativeOpen(true)}
            aria-label={t('neg_open_aria')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full border border-[var(--ide-border)] bg-[var(--ide-bg)] text-[var(--ide-text)] active:scale-95 transition-transform shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          <img
            src="/icon.svg"
            alt="DroidPy"
            className="w-6 h-6 rounded-md shrink-0"
            referrerPolicy="no-referrer"
          />
          <span className="text-sm font-bold whitespace-nowrap shrink-0">DroidPy</span>
          <span className="text-[var(--ide-border)] shrink-0" aria-hidden="true">/</span>
          <span className="font-mono text-xs text-[var(--ide-text-muted)] truncate min-w-0">
            {activeFile?.name}
          </span>
        </div>

        {(
          <div className="flex items-center gap-1.5 shrink-0">
            {pendingInputPrompt !== null ? (
              <button
                type="button"
                onClick={handleCancelInput}
                className="min-h-[44px] px-4 rounded-full bg-red-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>{t('cta_abort_short')}</span>
              </button>
            ) : termuxRunning ? (
              <button
                type="button"
                onClick={() => void handleStopTermux()}
                className="min-h-[44px] px-4 rounded-full bg-red-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>{t('cta_stop_short')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRunCode}
                disabled={isRunning || isCoreLoading}
                className="min-h-[44px] px-4 rounded-full bg-[var(--ide-accent)] active:scale-[0.98] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-transform"
              >
                {isRunning || isCoreLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>
                  {isCoreLoading ? t('cta_loading_short') : isRunning ? t('cta_running') : t('cta_run_short')}
                </span>
              </button>
            )}
          </div>
        )}
      </header>
      )}

      {/* Missing Backed-up Packages Quick Restore Bar */}
      {!dismissedBackupBanner &&
        backupStatus?.hasBackup &&
        ((backupStatus.missingPipPackages?.length ?? 0) > 0 ||
          (backupStatus.missingPkgPackages?.length ?? 0) > 0) && (
          <div className="relative z-10 flex items-center justify-between gap-2 px-3 py-2 border-b border-amber-300/70 dark:border-amber-800/70 bg-amber-50/95 dark:bg-amber-950/60 text-amber-950 dark:text-amber-100 shrink-0">
            <div className="min-w-0 flex-1 text-xs leading-snug">
              <span className="font-semibold">{t('backup_banner_title')}</span>
              <span className="ml-1.5 font-mono text-[11px] opacity-85 truncate inline-block max-w-full align-bottom">
                {[...backupStatus.missingPkgPackages, ...backupStatus.missingPipPackages].join(', ')}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={restoringBackup || termuxRunning}
                onClick={() => void handleRestoreBackedUpPackages()}
                className="min-h-[34px] px-3 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                {restoringBackup ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>{restoringBackup ? t('backup_restoring_btn') : t('backup_restore_btn')}</span>
              </button>
              <button
                type="button"
                onClick={() => setDismissedBackupBanner(true)}
                aria-label={t('files_cancel')}
                className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-amber-800 dark:text-amber-200 hover:bg-amber-200/50 dark:hover:bg-amber-900/40"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

      {/* Main Content Area (Mobile & Tablet Only) */}
      <main className="relative z-10 flex-1 min-h-0 flex overflow-hidden">
        {deviceClass === 'tablet' ? (
          <div className={`flex-1 min-h-0 flex ${isLandscape ? 'flex-row' : 'flex-col'} overflow-hidden`}>
            {/* Tablet Primary Editor Pane */}
            <section
              className={`${
                tabletSplit
                  ? isLandscape
                    ? 'w-[56%] border-r border-[var(--ide-border)]'
                    : 'h-[56%] border-b border-[var(--ide-border)]'
                  : 'flex-1'
              } min-w-0 min-h-0 flex flex-col overflow-hidden bg-[var(--ide-surface)]`}
            >
              <div className="flex items-center justify-between gap-2 px-3 h-10 border-b border-[var(--ide-border)] bg-[var(--ide-surface-alt)] shrink-0">
                <div className="flex items-center gap-2 text-xs text-[var(--ide-text-muted)] font-mono truncate">
                  <span className="font-semibold text-[var(--ide-text)]">{activeFile.name}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {t('status_cursor', { line: cursorPos.line, col: cursorPos.col })}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleFormatActiveFile}
                    aria-label={t('toolbar_format_title')}
                    className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                  >
                    <AlignLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => editorRef.current?.openSearch()}
                    aria-label={t('toolbar_search_title')}
                    className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateSettings({ showSymbolBar: !settings.showSymbolBar })}
                    aria-label={t('toolbar_symbol_bar_title')}
                    className={`min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg ${
                      settings.showSymbolBar
                        ? 'text-[var(--ide-accent-text)] bg-[var(--ide-accent-soft)]'
                        : 'text-[var(--ide-text-muted)]'
                    }`}
                  >
                    <Keyboard className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {mobileNewFileOpen && renderInlineNewFileBar()}

              <div className="flex-1 min-h-0 overflow-hidden">
                <CodeEditor
                  key={activeFile.id}
                  ref={editorRef}
                  value={activeFile.content}
                  filename={activeFile.name}
                  onChange={handleCodeChange}
                  onRunShortcut={handleRunCode}
                  onCursorChange={(line, col) => setCursorPos({ line, col })}
                  fontSize={settings.fontSize}
                  tabSize={settings.tabSize}
                  wordWrap={settings.wordWrap}
                  theme={settings.theme}
                  pyodideReady={pyodideStatus === 'ready'}
                  transparentBg={is3dBgActive}
                />
              </div>

              {settings.showSymbolBar && (
                <AndroidSymbolBar
                  tabSize={settings.tabSize}
                  onInsert={(txt, offset) => editorRef.current?.insertText(txt, offset)}
                  onMoveCursor={(delta) => editorRef.current?.moveCursor(delta)}
                  onUndo={() => editorRef.current?.undo()}
                  onRedo={() => editorRef.current?.redo()}
                />
              )}
            </section>

            {/* Tablet Secondary Output / Files / Browser Split Pane */}
            {tabletSplit && (
              <aside className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-[var(--ide-bg)]">
                <div className="flex items-center justify-between gap-2 px-3 h-10 border-b border-[var(--ide-border)] bg-[var(--ide-surface-alt)] shrink-0">
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                    {(
                      [
                        { id: 'terminal', label: t('mob_console'), Icon: TerminalIcon },
                        { id: 'files', label: t('mob_files'), Icon: FolderOpen },
                        { id: 'browser', label: t('mob_browser'), Icon: Globe },
                      ] as const
                    ).map(({ id, label, Icon }) => {
                      const active = tabletPaneTab === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setTabletPaneTab(id)}
                          className={`min-h-[30px] px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                            active
                              ? 'bg-[var(--ide-surface)] text-[var(--ide-accent-text)] font-semibold shadow-xs'
                              : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden">
                  <div className={tabletPaneTab === 'terminal' ? 'h-full' : 'hidden'}>
                    <TerminalPanel
                      entries={entries}
                      status={termuxRunning ? 'running' : pyodideStatus}
                      engine={executionEngine}
                      onChangeEngine={setExecutionEngine}
                      termuxConnected={termuxConnectionState === 'connected'}
                      embeddedMissingPython={Boolean(termuxHealth?.embedded && termuxHealth.hasPython === false)}
                      runStartedAt={runStartedAt}
                      lastDurationMs={lastDurationMs}
                      pendingInputPrompt={pendingInputPrompt}
                      onSubmitInput={handleSubmitInput}
                      onRunRepl={handleRunRepl}
                      onSendTermuxStdin={handleSendTermuxStdin}
                      paused={termuxPaused}
                      canPause={termuxScriptRunning}
                      onTogglePause={handleToggleTermuxPause}
                      onOpenLogs={() => setShowLogsModal(true)}
                      enableSandboxAddon={Boolean(settings.enableSandboxAddon)}
                      isDark={getThemeMeta(settings.theme).isDark}
                      onClear={handleClearTerminal}
                    />
                  </div>
                  <div className={tabletPaneTab === 'files' ? 'h-full' : 'hidden'}>
                    <FileExplorer
                      files={files}
                      activeFileId={activeFile.id}
                      linkedDirName={linkedDirHandle?.name ?? null}
                      termuxConnected={termuxConnectionState === 'connected'}
                      termuxEmbedded={Boolean(termuxHealth?.embedded)}
                      onOpenSdcardManager={() => openNegativeDrawer('android')}
                      onBackupToSdcard={handleBackupToSdcard}
                      onPullFromTermux={() => syncFilesFromTermux(true)}
                      onLinkDirectory={handleLinkDirectory}
                      onSaveToDirectory={handleSaveToDirectory}
                      onSelectFile={(id) => setActiveFileId(id)}
                      onCreateFile={handleCreateFile}
                      onRenameFile={handleRenameFile}
                      onDeleteFile={handleDeleteFile}
                      onRestoreFiles={handleRestoreScriptBackup}
                      onSyncBackupSdcard={handleSyncBackupToSdcard}
                      onNotify={showToast}
                    />
                  </div>
                  <div className={tabletPaneTab === 'browser' ? 'h-full' : 'hidden'}>
                    <CrawlerBrowserPanel
                      session={crawlerSession}
                      onChangeSession={setCrawlerSession}
                      termuxConfig={termuxConfig}
                      termuxConnected={termuxConnectionState === 'connected'}
                      onSaveWorkspaceFile={handleSaveWorkspaceFile}
                      onNotify={showToast}
                    />
                  </div>
                </div>
              </aside>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div
              className={
                mobileTab === 'editor'
                  ? 'flex-1 min-h-0 flex flex-col overflow-hidden bg-[var(--ide-surface)]'
                  : 'hidden'
              }
            >
                {/* Mobile Quick File Switcher + Quick Actions */}
                <div className="flex items-center justify-between gap-1.5 px-2 py-1.5 border-b border-[var(--ide-border)] bg-[var(--ide-surface-alt)] shrink-0">
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0">
                    {files.map((file) => {
                      const isActive = file.id === activeFile.id;
                      return (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => setActiveFileId(file.id)}
                          className={`min-h-[36px] px-3 rounded-lg font-mono text-xs whitespace-nowrap shrink-0 transition-colors ${
                            isActive
                              ? 'bg-[var(--ide-surface)] text-[var(--ide-accent-text)] font-semibold border border-[var(--ide-border)]'
                              : 'text-[var(--ide-text-muted)]'
                          }`}
                        >
                          {file.name}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setMobileNewFileOpen((v) => !v)}
                      aria-label={t('files_new_btn')}
                      className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg ${
                        mobileNewFileOpen
                          ? 'text-[var(--ide-accent-text)] bg-[var(--ide-accent-soft)]'
                          : 'text-[var(--ide-text-muted)]'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleFormatActiveFile}
                      aria-label={t('toolbar_format_title')}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[var(--ide-text-muted)]"
                    >
                      <AlignLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => editorRef.current?.openSearch()}
                      aria-label={t('toolbar_search_title')}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[var(--ide-text-muted)]"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateSettings({ showSymbolBar: !settings.showSymbolBar })}
                      aria-label={t('toolbar_symbol_bar_title')}
                      className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg ${
                        settings.showSymbolBar
                          ? 'text-[var(--ide-accent-text)] bg-[var(--ide-accent-soft)]'
                          : 'text-[var(--ide-text-muted)]'
                      }`}
                    >
                      <Keyboard className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {mobileNewFileOpen && renderInlineNewFileBar()}

                <div className="flex-1 min-h-0 overflow-hidden">
                  <CodeEditor
                    key={activeFile.id}
                    ref={editorRef}
                    value={activeFile.content}
                    filename={activeFile.name}
                    onChange={handleCodeChange}
                    onRunShortcut={handleRunCode}
                    onCursorChange={(line, col) => setCursorPos({ line, col })}
                    fontSize={settings.fontSize}
                    tabSize={settings.tabSize}
                    wordWrap={settings.wordWrap}
                    theme={settings.theme}
                    pyodideReady={pyodideStatus === 'ready'}
                    transparentBg={is3dBgActive}
                  />
                </div>

                {settings.showSymbolBar && (
                  <AndroidSymbolBar
                    tabSize={settings.tabSize}
                    onInsert={(txt, offset) => editorRef.current?.insertText(txt, offset)}
                    onMoveCursor={(delta) => editorRef.current?.moveCursor(delta)}
                    onUndo={() => editorRef.current?.undo()}
                    onRedo={() => editorRef.current?.redo()}
                  />
                )}
            </div>

            {mobileTab === 'console' && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <TerminalPanel
                  entries={entries}
                  status={termuxRunning ? 'running' : pyodideStatus}
                  engine={executionEngine}
                  onChangeEngine={setExecutionEngine}
                  termuxConnected={termuxConnectionState === 'connected'}
                  embeddedMissingPython={Boolean(termuxHealth?.embedded && termuxHealth.hasPython === false)}
                  runStartedAt={runStartedAt}
                  lastDurationMs={lastDurationMs}
                  pendingInputPrompt={pendingInputPrompt}
                  onSubmitInput={handleSubmitInput}
                  onRunRepl={handleRunRepl}
                  onSendTermuxStdin={handleSendTermuxStdin}
                  onOpenLogs={() => setShowLogsModal(true)}
                  enableSandboxAddon={Boolean(settings.enableSandboxAddon)}
                  isDark={getThemeMeta(settings.theme).isDark}
                  onClear={handleClearTerminal}
                />
              </div>
            )}

            <div className={mobileTab === 'browser' ? 'flex-1 min-h-0 overflow-hidden' : 'hidden'}>
              <CrawlerBrowserPanel
                session={crawlerSession}
                onChangeSession={setCrawlerSession}
                termuxConfig={termuxConfig}
                termuxConnected={termuxConnectionState === 'connected'}
                onSaveWorkspaceFile={handleSaveWorkspaceFile}
                onNotify={showToast}
              />
            </div>

            {mobileTab === 'files' && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <FileExplorer
                  files={files}
                  activeFileId={activeFile.id}
                  linkedDirName={linkedDirHandle?.name ?? null}
                  termuxConnected={termuxConnectionState === 'connected'}
                  termuxEmbedded={Boolean(termuxHealth?.embedded)}
                  onOpenSdcardManager={() => openNegativeDrawer('android')}
                  onBackupToSdcard={handleBackupToSdcard}
                  onPullFromTermux={() => syncFilesFromTermux(true)}
                  onLinkDirectory={handleLinkDirectory}
                  onSaveToDirectory={handleSaveToDirectory}
                  onSelectFile={(id) => {
                    setActiveFileId(id);
                    setMobileTab('editor');
                  }}
                  onCreateFile={handleCreateFile}
                  onRenameFile={handleRenameFile}
                  onDeleteFile={handleDeleteFile}
                  onRestoreFiles={handleRestoreScriptBackup}
                  onSyncBackupSdcard={handleSyncBackupToSdcard}
                  onNotify={showToast}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Mobile workspace navigation: direct access to the five everyday destinations */}
      {deviceClass === 'phone' && (
      <nav
        aria-label={t('nav_workspace')}
        className="relative z-10 shrink-0 h-[70px] pb-safe bg-[var(--md-surface-container-low)] border-t border-[var(--ide-border)] grid grid-cols-5"
      >
        {(
          [
            { id: 'editor', label: t('mob_editor'), Icon: Code2 },
            { id: 'packages', label: t('neg_tab_packages'), Icon: Package },
            { id: 'console', label: t('mob_console'), Icon: TerminalIcon },
            { id: 'files', label: t('mob_files'), Icon: FolderOpen },
            { id: 'browser', label: t('mob_browser'), Icon: Globe },
          ] as const
        ).map(({ id, label, Icon }) => {
          const active = mobileTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (id === 'packages') {
                  setMobileTab('packages');
                  openNegativeDrawer('packages');
                } else {
                  setMobileTab(id);
                }
              }}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={`min-h-[52px] min-w-0 flex flex-col items-center justify-center gap-1 transition-colors active:scale-[0.97] ${
                active ? 'text-[var(--ide-accent-text)]' : 'text-[var(--ide-text-muted)]'
              }`}
            >
              <span
                className={`w-12 h-7 rounded-full flex items-center justify-center transition-colors ${
                  active ? 'md-nav-pill' : ''
                }`}
              >
                <Icon className="w-5 h-5" />
              </span>
              <span className="text-[10px] font-semibold tracking-tight truncate max-w-full px-0.5">{label}</span>
            </button>
          );
        })}
      </nav>
      )}

      {/* Negative Screen Slide-Over Drawer for Phone & Tablet (Termux, Packages, Storage, System & Export) */}
      <NegativeScreenDrawer
        open={negativeOpen}
        section={negativeSection}
        onChangeSection={setNegativeSection}
        onClose={() => {
          setNegativeOpen(false);
          if (mobileTab === 'packages') setMobileTab('editor');
        }}
        files={files}
        activeFile={activeFile}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onResetWorkspace={handleResetWorkspace}
        pyodideStatus={pyodideStatus}
        installedPackages={installedPackages}
        activePyodidePackage={activePyodidePackage}
        onInstallPackage={handleInstallPackage}
        onRefreshPackages={handleRefreshPackages}
        outdatedPackages={outdatedPyPackages}
        checkingOutdated={checkingOutdatedPkgs}
        upgradingPackages={upgradingPyPackages}
        onUpgradePackage={handleUpgradePyPackage}
        onUninstallPackage={handleUninstallPyPackage}
        onCheckAndUpgradeAll={handleCheckAndUpgradeAllPy}
        onUpgradeAllPackages={handleUpgradeAllPackages}
        onUpgradeAllTermux={handleUpgradeAllTermux}
        onUpgradeSingleTermuxPip={handleUpgradeSingleTermuxPip}
        outdatedTermuxPips={outdatedTermuxPips}
        checkingTermuxOutdated={checkingTermuxOutdated}
        onCheckTermuxOutdated={handleCheckTermuxOutdated}
        onUninstallInTermux={handleUninstallInTermux}
        upgradingTermux={upgradingTermux}
        termuxRunning={termuxRunning}
        termuxActiveTask={termuxActiveTask}
        appUpdateResult={appUpdateResult}
        checkingAppUpdate={checkingAppUpdate}
        onOpenUpdateModal={() => {
          setShowUpdateModal(true);
          if (!appUpdateResult && githubRepo) {
            void handleCheckAppUpdates(githubRepo, true);
          }
        }}
        linkedDirName={linkedDirHandle?.name ?? null}
        onLinkDirectory={handleLinkDirectory}
        onImportFromDirectory={handleImportFromDirectory}
        onSaveToDirectory={handleSaveToDirectory}
        engine={executionEngine}
        onChangeEngine={setExecutionEngine}
        termuxConfig={termuxConfig}
        onUpdateTermuxConfig={handleUpdateTermuxConfig}
        termuxConnectionState={termuxConnectionState}
        termuxError={termuxError}
        termuxHealth={termuxHealth}
        onTestTermuxConnection={handleTestTermuxConnection}
        onInstallInTermux={handleInstallInTermux}
        onRunInTermux={handleRunInTermux}
        onRunShellInTermux={handleRunShellInTermux}
        onGenerateRequirements={handleGenerateRequirements}
        onInstallRequirements={handleInstallRequirements}
        onSaveWorkspaceFile={handleSaveWorkspaceFile}
        onOpenHelp={() => setShowHelpModal(true)}
        onOpenLogs={() => setShowLogsModal(true)}
        backupStatus={backupStatus}
        onRestoreBackedUpPackages={handleRestoreBackedUpPackages}
        restoringBackup={restoringBackup}
        onCleanupProcesses={handleCleanupStuckProcesses}
        cleaningProcesses={cleaningProcesses}
        lastCleanupResult={lastCleanupResult}
        onRebuildPipCertifi={handleRebuildPipCertifi}
        onNotify={showToast}
      />

      {/* In-App User Guide & Interactive Tutorials */}
      <HelpTutorialModal
        open={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        onInsertSampleFile={(filename, content) => handleSaveWorkspaceFile(filename, content, true)}
        onNavigateBrowser={() => {
          setTabletSplit(true);
          setTabletPaneTab('browser');
          setMobileTab('browser');
        }}
        onNavigateAndroid={() => {
          openNegativeDrawer('android');
        }}
        onNotify={showToast}
      />

      {/* Full Application & Native Android Execution Logs Modal */}
      <AppExecutionLogModal
        open={showLogsModal}
        onClose={() => setShowLogsModal(false)}
        termuxConfig={termuxConfig}
        termuxConnected={termuxConnectionState === 'connected'}
        onNotify={showToast}
      />

      {/* In-App Version Update & Changelog Modal */}
      <AppUpdateModal
        open={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        updateResult={appUpdateResult}
        checking={checkingAppUpdate}
        repoSlug={githubRepo}
        onChangeRepoSlug={(next) => {
          setGithubRepo(next);
          handleUpdateSettings({ githubRepo: next });
        }}
        onCheckNow={(override) => handleCheckAppUpdates(override, false)}
        onNotify={showToast}
      />

      {/* Compact Dismissible New Version Banner */}
      {appUpdateResult?.hasUpdate && appUpdateResult.latest && !updateBannerDismissed && !showUpdateModal && (
        <div className="fixed bottom-20 sm:bottom-5 right-3 sm:right-4 z-40 flex items-center gap-2 rounded-2xl border border-[var(--ide-accent)] bg-[var(--ide-sheet-bg)] px-3 py-2 text-xs shadow-xl max-w-[calc(100vw-24px)]">
          <Sparkles className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
          <span className="font-semibold text-[var(--ide-text)] truncate">
            {t('upd_banner_text', { ver: appUpdateResult.latest.version })}
          </span>
          <button
            type="button"
            onClick={() => setShowUpdateModal(true)}
            className="min-h-[32px] px-2.5 rounded-lg bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors"
          >
            {t('upd_banner_cta')}
          </button>
          <button
            type="button"
            onClick={() => setUpdateBannerDismissed(true)}
            aria-label={t('btn_done')}
            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Offline Status Banner */}
      {!isOnline && (
        <div className="fixed bottom-20 sm:bottom-5 left-3 right-3 sm:right-auto z-50 flex items-center gap-2 rounded-xl bg-amber-600 text-white px-3.5 py-2 text-xs font-medium shadow-lg max-w-[calc(100vw-24px)]">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span className="min-w-0 break-words">{t('offline_banner')}</span>
        </div>
      )}

      {/* Native-Style Android Toast */}
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-4 py-2.5 rounded-2xl bg-slate-900/95 dark:bg-slate-100/95 text-white dark:text-slate-900 text-xs font-medium shadow-xl max-w-[calc(100vw-24px)] text-center break-words"
        >
          {toastMsg}
        </div>
      )}
      </div>
    </I18nProvider>
  );
}

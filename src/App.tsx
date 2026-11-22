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
  Minimize2,
  BookOpen,
  PanelLeft,
  Columns2,
  Menu,
  Sparkles,
} from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';
import { DEFAULT_FILES } from './data/defaultFiles';
import {
  CrawlerSessionData,
  DesktopRightPane,
  DesktopSection,
  EditorSettings,
  ExecutionEngine,
  InstalledPackage,
  MobileTab,
  NegativeScreenSection,
  PyodideStatus,
  PythonFile,
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
import { ToolsAndPackages } from './components/ToolsAndPackages';
import { NegativeScreenDrawer } from './components/NegativeScreenDrawer';
import { PWAInstallButton } from './components/PWAInstallButton';
import { CrawlerBrowserPanel } from './components/CrawlerBrowserPanel';
import { HelpTutorialModal } from './components/HelpTutorialModal';
import { AppExecutionLogModal } from './components/AppExecutionLogModal';
import { AppUpdateModal } from './components/AppUpdateModal';
import { appLog } from './services/appLogger';
import {
  getAutoUpdatePackagesPref,
  getSavedGithubRepo,
  saveGithubRepo,
  setAutoUpdatePackagesPref,
} from './version';
import { AppUpdateCheckResult, checkForAppUpdates } from './services/appUpdater';
import {
  DEFAULT_CRAWLER_SESSION,
  buildCookiesJsonContent,
  mergeCookieLists,
  parseCookieHeaderPairs,
} from './utils/crawlerSession';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useDeviceLayout } from './hooks/useDeviceLayout';
import { IDE_THEMES, getThemeMeta } from './services/themes';
import {
  I18nProvider,
  LOCALE_OPTIONS,
  TranslationKey,
  getLocalizedThemeText,
  translate,
} from './services/i18n';
import { formatDurationHMS } from './utils/formatDuration';
import {
  DEFAULT_TERMUX_CONFIG,
  CORE_TERMUX_PIP_PACKAGES,
  TermuxOutdatedPipItem,
  abortActiveTermuxStream,
  backupWorkspaceToSdcard,
  buildTermuxAptUpgradeCommand,
  buildTermuxPipUpgradeCommand,
  buildTermuxUninstallCommand,
  checkTermuxHealth,
  execTermuxShell,
  fetchTermuxWorkspaceFiles,
  getSdcardStatus,
  normalizeTermuxPkgName,
  parseOutdatedPipJson,
  sendTermuxStdin,
  stopTermuxProcess,
  streamInstallInTermux,
  streamRunInTermux,
  streamShellInTermux,
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

const DEFAULT_SETTINGS: EditorSettings = {
  fontSize: 14,
  tabSize: 4,
  wordWrap: true,
  showSymbolBar: true,
  theme: 'rose',
  locale: 'zh-TW',
  androidStoragePermission: true,
  autoUpdatePackages: getAutoUpdatePackagesPref(),
  githubRepo: getSavedGithubRepo(),
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
  const normalized = chunk.replace(/\r\n/g, '\n');
  let out = prev;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '\r') {
      const lastNl = out.lastIndexOf('\n');
      out = lastNl === -1 ? '' : out.slice(0, lastNl + 1);
    } else {
      out += ch;
    }
  }
  return out;
}

export default function App() {
  const { deviceClass, isLandscape } = useDeviceLayout();
  const isDesktop = deviceClass === 'desktop';
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
  const [desktopSection, setDesktopSection] = useState<DesktopSection>('workspace');
  const [desktopRightPane, setDesktopRightPane] = useState<DesktopRightPane>('terminal');
  const [browserWide, setBrowserWide] = useState<boolean>(false);
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
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [pendingInputPrompt, setPendingInputPrompt] = useState<string | null>(null);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
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
    if (nativeSnap?.executionEngine === 'termux' || nativeSnap?.executionEngine === 'pyodide') {
      return nativeSnap.executionEngine;
    }
    try {
      const saved = localStorage.getItem(STORAGE_ENGINE_KEY);
      if (saved === 'termux' || saved === 'pyodide') return saved;
    } catch {
      // ignore
    }
    return 'pyodide';
  });
  const [termuxConfig, setTermuxConfig] = useState<TermuxConfig>(() => {
    const nativeSnap = getInitialNativeSnapshot();
    if (nativeSnap?.termuxConfig) {
      return { ...DEFAULT_TERMUX_CONFIG, ...nativeSnap.termuxConfig };
    }
    try {
      const saved = localStorage.getItem(STORAGE_TERMUX_CFG_KEY);
      if (saved) {
        return { ...DEFAULT_TERMUX_CONFIG, ...(JSON.parse(saved) as Partial<TermuxConfig>) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_TERMUX_CONFIG;
  });
  const [termuxConnectionState, setTermuxConnectionState] =
    useState<TermuxConnectionState>('disconnected');
  const [termuxError, setTermuxError] = useState<string | null>(null);
  const [termuxHealth, setTermuxHealth] = useState<TermuxHealthInfo | null>(null);
  const [termuxRunning, setTermuxRunning] = useState(false);

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
    showThemePicker,
    showLangPicker,
    negativeOpen,
    mobileNewFileOpen,
  });
  overlayStateRef.current = {
    showHelpModal,
    showLogsModal,
    showUpdateModal,
    showThemePicker,
    showLangPicker,
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
    registerSW({ immediate: true });
    appLog(
      'lifecycle',
      `DroidPy started (layout=${deviceClass}, engine=${executionEngineRef.current}, files=${filesRef.current.length}, sandboxPkgs=${sandboxPackagesRef.current.length})`
    );
    const onWinErr = (ev: ErrorEvent) => {
      appLog('lifecycle', `Uncaught error: ${ev.message}`, {
        level: 'error',
        detail: ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : undefined,
      });
    };
    const onUnhandled = (ev: PromiseRejectionEvent) => {
      const msg = ev.reason instanceof Error ? ev.reason.message : String(ev.reason);
      appLog('lifecycle', `Unhandled rejection: ${msg}`, { level: 'error' });
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
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', meta.themeColorMeta);
    }
  }, [settings]);

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
    }, 200);
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
      if (ov.showThemePicker) {
        setShowThemePicker(false);
        return true;
      }
      if (ov.showLangPicker) {
        setShowLangPicker(false);
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
      setEntries((prev) => [
        ...prev,
        {
          id: makeId(),
          type,
          content,
          timestamp: formatTime(),
          imageDataUrl,
        },
      ]);
    },
    []
  );

  const appendStreamChunk = useCallback((streamId: string, chunk: string) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === streamId);
      if (idx === -1) {
        return [
          ...prev,
          {
            id: streamId,
            type: 'stdout',
            content: mergeTerminalChunk('', chunk),
            timestamp: formatTime(),
          },
        ];
      }
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        content: mergeTerminalChunk(next[idx].content, chunk),
      };
      return next;
    });
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
    if (executionEngine === 'termux') return;
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
  }, [appendEntry, executionEngine]);

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
      showToast(t('toast_termux_connected', { ver: health.pythonVersion }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('toast_termux_disconnected');
      setTermuxError(msg);
      setTermuxConnectionState('error');
      appLog('bridge', `Manual health check failed: ${msg}`, { level: 'warn' });
      showToast(t('toast_termux_disconnected'));
    }
  }, [termuxConfig, showToast, t]);

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
      setDesktopSection('workspace');
      setDesktopRightPane(pane);
      setTabletSplit(true);
      setTabletPaneTab(pane);
      setMobileTab(pane === 'browser' ? 'browser' : 'console');
    },
    []
  );

  const handleRunInTermux = useCallback(async () => {
    if (termuxRunning) {
      showToast(t('cta_running'));
      return;
    }
    const entryFile = resolveRunnableEntry();
    if (!entryFile) return;
    focusOutputPane('terminal');
    setTermuxRunning(true);
    setRunStartedAt(Date.now());
    setTermuxError(null);

    try {
      let currentHealth = termuxHealth;
      if (currentHealth?.embedded && currentHealth.hasPython === false) {
        try {
          currentHealth = await checkTermuxHealth(termuxConfig);
          setTermuxHealth(currentHealth);
        } catch {
          // proceed to run so server error message or connection check catches it
        }
      }
      if (currentHealth?.embedded && currentHealth.hasPython === false) {
        appendEntry('stderr', t('tmx_need_init_hint'));
        showToast(t('tmx_need_init_hint'));
        return;
      }

      appendEntry('system', t('log_termux_run', { name: entryFile.name }));
      appLog('termux', `Run script in Termux: ${entryFile.name}`);
      const streamId = makeId();
      let hasOutput = false;
      let outputTail = '';

      const res = await streamRunInTermux(termuxConfig, entryFile, files, {
        onChunk: (chunk) => {
          if (chunk.length > 0) {
            hasOutput = true;
            outputTail = (outputTail + chunk).slice(-500);
          }
          appendStreamChunk(streamId, chunk);
        },
      });
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
      setRunStartedAt(null);
      setTermuxRunning(false);
    }
  }, [
    resolveRunnableEntry,
    focusOutputPane,
    files,
    termuxConfig,
    termuxHealth,
    termuxRunning,
    appendEntry,
    appendStreamChunk,
    syncFilesFromTermux,
    showToast,
    t,
  ]);

  const handleInstallInTermux = useCallback(
    async (mode: 'pip' | 'pkg', target: string) => {
      if (termuxRunning) {
        showToast(t('cta_running'));
        return;
      }
      const label = mode === 'pkg' ? `pkg install -y ${target}` : `pip install ${target}`;
      focusOutputPane('terminal');
      setTermuxRunning(true);
      setRunStartedAt(Date.now());
      setTermuxError(null);
      appendEntry('system', t('log_termux_install', { cmd: label }));
      appLog('package', `Termux install start: ${label}`);
      const streamId = makeId();
      let tailBuf = '';
      try {
        const res = await streamInstallInTermux(termuxConfig, mode, target, {
          onChunk: (chunk) => {
            appendStreamChunk(streamId, chunk);
            tailBuf = (tailBuf + chunk).slice(-1200);
          },
        });
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
        } catch {
          // ignore health refresh failure
        }
        setRunStartedAt(null);
        setTermuxRunning(false);
      }
    },
    [termuxConfig, termuxRunning, focusOutputPane, appendEntry, appendStreamChunk, showToast, t]
  );

  const handleRunShellInTermux = useCallback(
    async (command: string) => {
      if (termuxRunning) {
        showToast(t('cta_running'));
        return;
      }
      focusOutputPane('terminal');
      setTermuxRunning(true);
      setRunStartedAt(Date.now());
      setTermuxError(null);
      appendEntry('repl-in', `$ ${command}`);
      appLog('termux', `Shell command: ${command}`);
      const streamId = makeId();
      let tailBuf = '';
      try {
        const res = await streamShellInTermux(termuxConfig, command, {
          onChunk: (chunk) => {
            appendStreamChunk(streamId, chunk);
            tailBuf = (tailBuf + chunk).slice(-1200);
          },
        });
        setTermuxConnectionState('connected');
        setLastDurationMs(res.durationMs);
        if (res.exitCode !== 0) {
          appendEntry('stderr', t('log_termux_exit', { code: res.exitCode }));
          appLog('termux', `Shell exited with code ${res.exitCode}`, {
            level: 'warn',
            detail: tailBuf.trim() ? `${command}\n\n${tailBuf.trim()}` : command,
          });
        } else {
          appLog('termux', `Shell finished (${formatDurationHMS(res.durationMs)})`);
        }
      } catch (err) {
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
          } catch {
            // ignore
          }
        }
        setRunStartedAt(null);
        setTermuxRunning(false);
      }
    },
    [termuxConfig, termuxRunning, focusOutputPane, appendEntry, appendStreamChunk, showToast, t]
  );

  const handleInitializeEmbeddedEnv = useCallback(
    async (includeBaseSystem: boolean) => {
      if (termuxRunning) {
        showToast(t('cta_running'));
        return;
      }
      const cmd = includeBaseSystem
        ? '(pkg update -y || true) && pkg install -y python python-pip python-lxml libxml2 libxslt clang && pip install --no-cache-dir requests beautifulsoup4 httpx'
        : 'pip install --no-cache-dir requests beautifulsoup4 httpx';
      setExecutionEngine('termux');
      focusOutputPane('terminal');
      setTermuxRunning(true);
      setRunStartedAt(Date.now());
      setTermuxError(null);
      appendEntry('system', t('log_termux_init', { cmd }));
      appLog('termux', `One-tap env initialization started (includeBaseSystem=${includeBaseSystem})`);
      const streamId = makeId();
      let tailBuf = '';
      try {
        const res = await streamShellInTermux(termuxConfig, cmd, {
          onChunk: (chunk) => {
            appendStreamChunk(streamId, chunk);
            tailBuf = (tailBuf + chunk).slice(-1200);
          },
        });
        setTermuxConnectionState('connected');
        setLastDurationMs(res.durationMs);
        if (res.exitCode === 0) {
          appLog('termux', `One-tap env initialization completed (${formatDurationHMS(res.durationMs)})`);
          showToast(t('toast_termux_init_ok'));
        } else {
          appendEntry('stderr', t('log_termux_exit', { code: res.exitCode }));
          appLog('termux', `One-tap env initialization exited ${res.exitCode}`, {
            level: 'error',
            detail: tailBuf.trim() || undefined,
          });
          showToast(t('toast_termux_init_err', { code: res.exitCode }));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setTermuxConnectionState('error');
        setTermuxError(msg);
        appendEntry('stderr', msg);
        appLog('termux', `One-tap env initialization error: ${msg}`, {
          level: 'error',
          detail: tailBuf.trim() || undefined,
        });
        showToast(t('toast_termux_install_fail'));
      } finally {
        try {
          const health = await checkTermuxHealth(termuxConfig);
          setTermuxHealth(health);
        } catch {
          // ignore background health refresh error
        }
        flushNativeStateNow();
        setRunStartedAt(null);
        setTermuxRunning(false);
      }
    },
    [termuxConfig, termuxRunning, focusOutputPane, appendEntry, appendStreamChunk, flushNativeStateNow, showToast, t]
  );

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
          outputTail = (outputTail + text).slice(-500);
        }
        baseCallbacks.onStdout(text);
      },
      onStderr: (text) => {
        if (text.length > 0) {
          hasOutput = true;
          outputTail = (outputTail + text).slice(-500);
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
    setDesktopSection('workspace');
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
      setFiles((prev) => {
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
        setDesktopSection('workspace');
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
      }
    },
    [appendEntry, showToast, t]
  );

  const handleRefreshPackages = useCallback(async () => {
    try {
      const list = await listPyPackages(callbacksRef.current);
      setInstalledPackages(list);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('pkg_loaded_empty'));
    }
  }, [showToast, t]);

  const handleUpgradePyPackage = useCallback(
    async (pkgName: string) => {
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
      }
    },
    [outdatedPyPackages, appendEntry, showToast, t]
  );

  const handleCheckAndUpgradeAllPy = useCallback(async () => {
    if (checkingOutdatedPkgs || upgradingPyPackages) return;
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
    }
  }, [checkingOutdatedPkgs, upgradingPyPackages, appendEntry, showToast, t]);

  const handleCheckTermuxOutdated = useCallback(async () => {
    if (
      termuxConnectionState !== 'connected' ||
      termuxHealth?.hasPython === false ||
      checkingTermuxOutdated
    ) {
      return;
    }
    setCheckingTermuxOutdated(true);
    try {
      const res = await execTermuxShell(termuxConfigRef.current, 'pip list --outdated --format=json');
      const outdated = parseOutdatedPipJson(res.stdout || '');
      setOutdatedTermuxPips(outdated);
      appLog('package', `Checked Termux pip outdated packages: ${outdated.length}`);
      if (outdated.length === 0) {
        showToast(t('pkg_up_to_date'));
      }
    } catch {
      // ignore check error
    } finally {
      setCheckingTermuxOutdated(false);
    }
  }, [termuxConnectionState, termuxHealth?.hasPython, checkingTermuxOutdated, showToast, t]);

  const handleUninstallInTermux = useCallback(
    async (mode: 'pip' | 'pkg', target: string) => {
      if (termuxRunning) {
        showToast(t('cta_running'));
        return;
      }
      const cmd = buildTermuxUninstallCommand(mode, target);
      if (!cmd) {
        showToast(t('pkg_uninstall_core_err'));
        return;
      }
      focusOutputPane('terminal');
      setTermuxRunning(true);
      setRunStartedAt(Date.now());
      setTermuxError(null);
      appendEntry('repl-in', `$ ${cmd}`);
      appLog('package', `Termux uninstall start: ${cmd}`);
      const streamId = makeId();
      let tailBuf = '';
      try {
        const res = await streamShellInTermux(termuxConfig, cmd, {
          onChunk: (chunk) => {
            appendStreamChunk(streamId, chunk);
            tailBuf = (tailBuf + chunk).slice(-1200);
          },
        });
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
        } catch {
          // ignore health refresh failure
        }
        setRunStartedAt(null);
        setTermuxRunning(false);
      }
    },
    [termuxRunning, termuxConfig, focusOutputPane, appendEntry, appendStreamChunk, showToast, t]
  );

  const handleUpgradeAllTermux = useCallback(
    async (kind: 'pip' | 'pkg') => {
      if (termuxRunning || upgradingTermux) {
        showToast(t('cta_running'));
        return;
      }
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
            const outdated = parseOutdatedPipJson(outRes.stdout || '');
            setOutdatedTermuxPips(outdated);
            outdatedTargets = outdated
              .map((item) => item.name)
              .filter((n) => !CORE_TERMUX_PIP_PACKAGES.has(normalizeTermuxPkgName(n)));
          } finally {
            setCheckingTermuxOutdated(false);
          }
          if (outdatedTargets.length === 0) {
            showToast(t('pkg_up_to_date'));
            return;
          }
          await handleRunShellInTermux(buildTermuxPipUpgradeCommand(outdatedTargets));
          setOutdatedTermuxPips([]);
          showToast(t('pkg_upgraded_toast', { count: outdatedTargets.length }));
          return;
        }
        await handleRunShellInTermux(buildTermuxAptUpgradeCommand());
      } finally {
        setUpgradingTermux(false);
      }
    },
    [termuxRunning, upgradingTermux, handleRunShellInTermux, showToast, t]
  );

  const handleUpgradeSingleTermuxPip = useCallback(
    async (pkg: string) => {
      if (termuxRunning || upgradingTermux) {
        showToast(t('cta_running'));
        return;
      }
      const clean = pkg.replace(/[^a-zA-Z0-9_.-]/g, '').trim();
      if (!clean) return;
      setUpgradingTermux(true);
      try {
        await handleRunShellInTermux(`pip install --upgrade ${clean}`);
        const normClean = normalizeTermuxPkgName(clean);
        setOutdatedTermuxPips((prev) =>
          prev.filter((item) => normalizeTermuxPkgName(item.name) !== normClean)
        );
      } finally {
        setUpgradingTermux(false);
      }
    },
    [termuxRunning, upgradingTermux, handleRunShellInTermux, showToast, t]
  );

  const handleUpgradeAllPackages = useCallback(async () => {
    if (checkingOutdatedPkgs || upgradingPyPackages || upgradingTermux || termuxRunning) {
      showToast(t('cta_running'));
      return;
    }
    let upgradedCount = 0;

    if (pyodideStatus === 'ready') {
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
      }
    }

    if (termuxConnectionState === 'connected') {
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
            const outdatedPips = parseOutdatedPipJson(outRes.stdout || '');
            setOutdatedTermuxPips(outdatedPips);
            pipTargets = outdatedPips
              .map((item) => item.name)
              .filter((n) => !CORE_TERMUX_PIP_PACKAGES.has(normalizeTermuxPkgName(n)));
          } finally {
            setCheckingTermuxOutdated(false);
          }
        }
        const cmds: string[] = [];
        if (pipTargets.length > 0) {
          cmds.push(buildTermuxPipUpgradeCommand(pipTargets));
          upgradedCount += pipTargets.length;
        }
        cmds.push(buildTermuxAptUpgradeCommand());
        await handleRunShellInTermux(cmds.join(' && '));
        setOutdatedTermuxPips([]);
      } finally {
        setUpgradingTermux(false);
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
      if (termuxRunning) return;
      setUpgradingTermux(true);
      const streamId = makeId();
      try {
        const outRes = await execTermuxShell(
          termuxConfigRef.current,
          'pip list --outdated --format=json'
        );
        const outdated = parseOutdatedPipJson(outRes.stdout || '');
        setOutdatedTermuxPips(outdated);
        const targetNames = outdated
          .map((item) => item.name)
          .filter((name) => !CORE_TERMUX_PIP_PACKAGES.has(normalizeTermuxPkgName(name)));
        if (targetNames.length === 0) {
          appLog('package', 'Startup Termux pip check: all packages are already latest');
          return;
        }
        const cmd = buildTermuxPipUpgradeCommand(targetNames);
        appLog('package', `Startup auto-updating Termux pip packages: ${targetNames.join(', ')}`);
        const res = await streamShellInTermux(termuxConfigRef.current, cmd, {
          onChunk: (chunk) => appendStreamChunk(streamId, chunk),
        });
        if (res.exitCode === 0) {
          setOutdatedTermuxPips([]);
          appLog('package', `Startup Termux pip upgrade finished (${formatDurationHMS(res.durationMs)})`);
          const nextHealth = await checkTermuxHealth(termuxConfigRef.current).catch(() => null);
          if (nextHealth) setTermuxHealth(nextHealth);
        }
      } catch {
        // silent background failure
      } finally {
        setUpgradingTermux(false);
      }
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [termuxConnectionState, termuxHealth, isOnline, termuxRunning, appendStreamChunk]);

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
      (desktopSection === 'packages' || (negativeOpen && negativeSection === 'packages')) &&
      pyodideStatus === 'ready' &&
      installedPackages.length === 0
    ) {
      void handleRefreshPackages();
    }
  }, [desktopSection, negativeOpen, negativeSection, pyodideStatus, installedPackages.length, handleRefreshPackages]);

  const isRunning = pyodideStatus === 'running' || termuxRunning;
  const isCoreLoading = executionEngine === 'pyodide' && pyodideStatus === 'loading';
  const activeThemeLabel = getLocalizedThemeText(settings.theme, settings.locale);
  const activeLocaleMeta = LOCALE_OPTIONS.find((item) => item.id === settings.locale) ?? LOCALE_OPTIONS[0];

  const openNegativeDrawer = useCallback((sec: NegativeScreenSection = 'termux') => {
    setNegativeSection(sec);
    setNegativeOpen(true);
  }, []);

  return (
    <I18nProvider
      locale={settings.locale}
      onChangeLocale={(loc) => handleUpdateSettings({ locale: loc })}
    >
      <div
        onTouchStart={(e) => {
          if (isDesktop || e.touches.length !== 1) return;
          const touch = e.touches[0];
          if (touch.clientX <= 28) {
            edgeSwipeStartRef.current = { x: touch.clientX, y: touch.clientY };
          } else {
            edgeSwipeStartRef.current = null;
          }
        }}
        onTouchEnd={(e) => {
          if (!edgeSwipeStartRef.current || isDesktop) return;
          const touch = e.changedTouches[0];
          const dx = touch.clientX - edgeSwipeStartRef.current.x;
          const dy = Math.abs(touch.clientY - edgeSwipeStartRef.current.y);
          edgeSwipeStartRef.current = null;
          if (dx > 52 && dy < 50) {
            setNegativeOpen(true);
          }
        }}
        className="h-dvh flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)] overflow-hidden"
      >
      {/* Desktop Top Bar (3-zone contract: Brand — Nav Links — Primary CTA) */}
      {deviceClass === 'desktop' && (
      <header className="flex items-center justify-between gap-8 h-[52px] px-5 border-b border-[var(--ide-border)] bg-[var(--ide-surface)] shrink-0">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="#workspace"
          onClick={(e) => {
            e.preventDefault();
            setDesktopSection('workspace');
          }}
          className="flex items-center gap-2.5 text-base font-bold tracking-tight text-[var(--ide-text)] whitespace-nowrap shrink-0"
        >
          <img
            src="/icon.svg"
            alt="DroidPy"
            className="w-6 h-6 rounded-md shrink-0"
            referrerPolicy="no-referrer"
          />
          <span>DroidPy</span>
        </a>

        {/* Zone 2: 5 Clean Single-Line Nav Links */}
        <nav className="flex items-center gap-6 text-sm font-medium" aria-label={t('nav_workspace')}>
          {(
            [
              { id: 'workspace', label: t('nav_workspace') },
              { id: 'termux', label: t('nav_termux') },
              { id: 'packages', label: t('nav_packages') },
              { id: 'android', label: t('nav_android') },
              { id: 'settings', label: t('nav_settings') },
            ] as const
          ).map((item) => {
            const active = desktopSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setDesktopSection(item.id)}
                className={`py-3.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-[var(--ide-accent)] text-[var(--ide-accent-text)]'
                    : 'border-transparent text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary CTA */}
        <div className="shrink-0">
          {pendingInputPrompt !== null ? (
            <button
              type="button"
              onClick={handleCancelInput}
              className="min-h-[38px] px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{t('cta_abort_input')}</span>
            </button>
          ) : termuxRunning ? (
            <button
              type="button"
              onClick={() => void handleStopTermux()}
              className="min-h-[38px] px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{t('cta_stop_run')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunCode}
              disabled={isRunning || isCoreLoading}
              className="min-h-[38px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
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

      {/* Tablet Top Bar: Negative Screen Trigger + File Tabs + Split Toggle + Primary CTA */}
      {deviceClass === 'tablet' && (
      <header className="flex items-center justify-between gap-3 h-12 px-3 pt-safe border-b border-[var(--ide-border)] bg-[var(--ide-surface)] shrink-0">
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

      {/* Phone Compact Top App Bar (Negative Screen button + Title/File + Primary Run CTA only) */}
      {deviceClass === 'phone' && (
      <header className="flex items-center justify-between gap-2 h-12 px-2.5 pt-safe border-b border-[var(--ide-border)] bg-[var(--ide-surface)] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setNegativeOpen(true)}
            aria-label={t('neg_open_aria')}
            className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-[var(--ide-text)] active:scale-95 transition-transform shrink-0"
          >
            <Menu className="w-4.5 h-4.5" />
          </button>
          <img
            src="/icon.svg"
            alt="DroidPy"
            className="w-6 h-6 rounded-md shrink-0"
            referrerPolicy="no-referrer"
          />
          <span className="text-sm font-bold whitespace-nowrap shrink-0">DroidPy</span>
          <span className="text-[var(--ide-border)]" aria-hidden="true">/</span>
          <span className="font-mono text-xs text-[var(--ide-text-muted)] truncate">
            {activeFile?.name}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {pendingInputPrompt !== null ? (
            <button
              type="button"
              onClick={handleCancelInput}
              className="min-h-[40px] px-4 rounded-xl bg-red-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{t('cta_abort_short')}</span>
            </button>
          ) : termuxRunning ? (
            <button
              type="button"
              onClick={() => void handleStopTermux()}
              className="min-h-[40px] px-4 rounded-xl bg-red-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{t('cta_stop_short')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunCode}
              disabled={isRunning || isCoreLoading}
              className="min-h-[40px] px-4 rounded-xl bg-[var(--ide-accent)] active:scale-[0.98] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-transform"
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
      </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 flex overflow-hidden">
        {deviceClass === 'desktop' ? (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {desktopSection === 'workspace' ? (
              <>
                {/* Left File Explorer */}
                <aside className="w-64 shrink-0 border-r border-[var(--ide-border)] overflow-hidden">
                  <FileExplorer
                    files={files}
                    activeFileId={activeFile.id}
                    linkedDirName={linkedDirHandle?.name ?? null}
                    termuxConnected={termuxConnectionState === 'connected'}
                    termuxEmbedded={Boolean(termuxHealth?.embedded)}
                    onOpenSdcardManager={() => setDesktopSection('android')}
                    onBackupToSdcard={handleBackupToSdcard}
                    onPullFromTermux={() => syncFilesFromTermux(true)}
                    onLinkDirectory={handleLinkDirectory}
                    onSaveToDirectory={handleSaveToDirectory}
                    onSelectFile={(id) => setActiveFileId(id)}
                    onCreateFile={handleCreateFile}
                    onRenameFile={handleRenameFile}
                    onDeleteFile={handleDeleteFile}
                    onNotify={showToast}
                  />
                </aside>

                {/* Center Code Editor */}
                <section className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[var(--ide-surface)]">
                  {/* Workspace Editor Toolbar */}
                  <div className="flex items-center justify-between gap-4 px-3 h-11 border-b border-[var(--ide-border)] bg-[var(--ide-surface-alt)] shrink-0">
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0">
                      {files.map((file) => {
                        const isActive = file.id === activeFile.id;
                        return (
                          <button
                            key={file.id}
                            type="button"
                            onClick={() => setActiveFileId(file.id)}
                            className={`min-h-[32px] px-3 rounded-lg font-mono text-xs transition-colors whitespace-nowrap shrink-0 ${
                              isActive
                                ? 'bg-[var(--ide-surface)] text-[var(--ide-accent-text)] font-semibold border border-[var(--ide-border)]'
                                : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
                            }`}
                          >
                            {file.name}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <PWAInstallButton compact />
                      <button
                        type="button"
                        onClick={() => setShowHelpModal(true)}
                        aria-label={t('toolbar_help_title')}
                        title={t('toolbar_help_title')}
                        className="min-h-[34px] px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium text-[var(--ide-text)] border border-[var(--ide-border)] bg-[var(--ide-surface)] hover:border-[var(--ide-accent)] transition-colors whitespace-nowrap"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
                        <span>{t('toolbar_help_title')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowLangPicker(true)}
                        aria-label={t('toolbar_choose_lang')}
                        title={t('toolbar_choose_lang')}
                        className="min-h-[34px] px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium text-[var(--ide-text)] border border-[var(--ide-border)] bg-[var(--ide-surface)] hover:border-[var(--ide-accent)] transition-colors whitespace-nowrap"
                      >
                        <Languages className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
                        <span>{activeLocaleMeta.nativeName}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowThemePicker(true)}
                        aria-label={t('toolbar_choose_theme')}
                        title={activeThemeLabel.name}
                        className="min-h-[34px] px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium text-[var(--ide-text)] border border-[var(--ide-border)] bg-[var(--ide-surface)] hover:border-[var(--ide-accent)] transition-colors whitespace-nowrap"
                      >
                        <Palette className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
                        <span>{activeThemeLabel.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleFormatActiveFile}
                        aria-label={t('toolbar_format_title')}
                        title={t('toolbar_format_title')}
                        className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-accent-soft)]"
                      >
                        <AlignLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => editorRef.current?.openSearch()}
                        aria-label={t('toolbar_search_title')}
                        title={t('toolbar_search_title')}
                        className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-accent-soft)]"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateSettings({ showSymbolBar: !settings.showSymbolBar })}
                        aria-label={t('toolbar_symbol_bar_title')}
                        title={t('toolbar_symbol_bar_title')}
                        className={`min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg transition-colors ${
                          settings.showSymbolBar
                            ? 'text-[var(--ide-accent-text)] bg-[var(--ide-accent-soft)]'
                            : 'text-[var(--ide-text-muted)] hover:bg-[var(--ide-accent-soft)]'
                        }`}
                      >
                        <Keyboard className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* CodeMirror Canvas */}
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
                    />
                  </div>

                  {/* Optional Android Quick-Symbol Bar */}
                  {settings.showSymbolBar && (
                    <AndroidSymbolBar
                      tabSize={settings.tabSize}
                      onInsert={(txt, offset) => editorRef.current?.insertText(txt, offset)}
                      onMoveCursor={(delta) => editorRef.current?.moveCursor(delta)}
                      onUndo={() => editorRef.current?.undo()}
                      onRedo={() => editorRef.current?.redo()}
                    />
                  )}

                  {/* Quiet Unboxed Editor Metadata Bar */}
                  <div className="flex items-center justify-between px-4 py-1.5 border-t border-[var(--ide-border)] bg-[var(--ide-surface-alt)] text-[11px] text-[var(--ide-text-muted)] shrink-0">
                    <div className="flex items-center gap-2">
                      <span>Python 3.12</span>
                      <span aria-hidden="true">·</span>
                      <span>{activeThemeLabel.name}</span>
                      <span aria-hidden="true">·</span>
                      <span>{t('status_tab_size', { n: settings.tabSize })}</span>
                    </div>
                    <div className="font-mono tabular-nums">
                      {t('status_cursor', { line: cursorPos.line, col: cursorPos.col })}
                    </div>
                  </div>
                </section>

                {/* Right Pane: Terminal / REPL Output or Crawler Browser */}
                <aside
                  className={`${
                    desktopRightPane === 'browser' && browserWide
                      ? 'w-[580px] xl:w-[680px]'
                      : desktopRightPane === 'browser'
                      ? 'w-[460px] xl:w-[520px]'
                      : 'w-[420px] xl:w-[460px]'
                  } shrink-0 border-l border-[var(--ide-border)] flex flex-col overflow-hidden transition-[width] duration-150`}
                >
                  <div className="flex items-center justify-between gap-2 px-3 h-11 border-b border-[var(--ide-border)] bg-[var(--ide-surface-alt)] shrink-0">
                    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                      <button
                        type="button"
                        onClick={() => setDesktopRightPane('terminal')}
                        className={`min-h-[30px] px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                          desktopRightPane === 'terminal'
                            ? 'bg-[var(--ide-surface)] text-[var(--ide-accent-text)] font-semibold shadow-sm'
                            : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
                        }`}
                      >
                        <TerminalIcon className="w-3.5 h-3.5" />
                        <span>{t('pane_terminal')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDesktopRightPane('browser')}
                        className={`min-h-[30px] px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                          desktopRightPane === 'browser'
                            ? 'bg-[var(--ide-surface)] text-[var(--ide-accent-text)] font-semibold shadow-sm'
                            : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>{t('pane_browser')}</span>
                      </button>
                    </div>
                    {desktopRightPane === 'browser' && (
                      <button
                        type="button"
                        onClick={() => setBrowserWide((v) => !v)}
                        aria-label={browserWide ? t('files_collapse') : t('files_expand')}
                        className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-accent-soft)]"
                      >
                        {browserWide ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  <div className="flex-1 min-h-0 overflow-hidden">
                    <div className={desktopRightPane === 'terminal' ? 'h-full' : 'hidden'}>
                      <TerminalPanel
                        entries={entries}
                        status={termuxRunning ? 'running' : pyodideStatus}
                        engine={executionEngine}
                        onChangeEngine={setExecutionEngine}
                        termuxConnected={termuxConnectionState === 'connected'}
                        embeddedMissingPython={Boolean(termuxHealth?.embedded && termuxHealth.hasPython === false)}
                        onQuickInitEmbedded={() => void handleInitializeEmbeddedEnv(true)}
                        runStartedAt={runStartedAt}
                        lastDurationMs={lastDurationMs}
                        pendingInputPrompt={pendingInputPrompt}
                        onSubmitInput={handleSubmitInput}
                        onRunRepl={handleRunRepl}
                        onSendTermuxStdin={handleSendTermuxStdin}
                        onStopTermux={handleStopTermux}
                        onOpenLogs={() => setShowLogsModal(true)}
                        onClear={() => setEntries([])}
                      />
                    </div>
                    <div className={desktopRightPane === 'browser' ? 'h-full' : 'hidden'}>
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
              </>
            ) : (
              <div className="flex-1 min-h-0 overflow-hidden">
                <ToolsAndPackages
                  activeSubView={desktopSection}
                  files={files}
                  activeFile={activeFile}
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onResetWorkspace={handleResetWorkspace}
                  pyodideStatus={pyodideStatus}
                  installedPackages={installedPackages}
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
                  onInitializeEmbeddedEnv={handleInitializeEmbeddedEnv}
                  onGenerateRequirements={handleGenerateRequirements}
                  onInstallRequirements={handleInstallRequirements}
                  onSaveWorkspaceFile={handleSaveWorkspaceFile}
                  onOpenHelp={() => setShowHelpModal(true)}
                  onOpenLogs={() => setShowLogsModal(true)}
                  onNotify={showToast}
                />
              </div>
            )}
          </div>
        ) : deviceClass === 'tablet' ? (
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

              {mobileNewFileOpen && (
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
                  className="flex items-center gap-1.5 px-2.5 py-2 border-b border-[var(--ide-border)] bg-[var(--ide-surface)] shrink-0"
                >
                  <input
                    type="text"
                    autoFocus
                    value={mobileNewFileName}
                    onChange={(e) => setMobileNewFileName(e.target.value)}
                    placeholder={t('files_new_placeholder')}
                    className="flex-1 min-w-0 min-h-[38px] px-3 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
                  />
                  <button
                    type="submit"
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-[var(--ide-accent)] text-white"
                    aria-label={t('files_new_btn')}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileNewFileOpen(false)}
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-[var(--ide-border)] text-[var(--ide-text-muted)]"
                    aria-label={t('files_cancel')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </form>
              )}

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
                      onQuickInitEmbedded={() => void handleInitializeEmbeddedEnv(true)}
                      runStartedAt={runStartedAt}
                      lastDurationMs={lastDurationMs}
                      pendingInputPrompt={pendingInputPrompt}
                      onSubmitInput={handleSubmitInput}
                      onRunRepl={handleRunRepl}
                      onSendTermuxStdin={handleSendTermuxStdin}
                      onStopTermux={handleStopTermux}
                      onOpenLogs={() => setShowLogsModal(true)}
                      onClear={() => setEntries([])}
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

                {mobileNewFileOpen && (
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
                    className="flex items-center gap-1.5 px-2.5 py-2 border-b border-[var(--ide-border)] bg-[var(--ide-surface)] shrink-0"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={mobileNewFileName}
                      onChange={(e) => setMobileNewFileName(e.target.value)}
                      placeholder={t('files_new_placeholder')}
                      className="flex-1 min-w-0 min-h-[38px] px-3 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
                    />
                    <button
                      type="submit"
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-[var(--ide-accent)] text-white"
                      aria-label={t('files_new_btn')}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileNewFileOpen(false)}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-[var(--ide-border)] text-[var(--ide-text-muted)]"
                      aria-label={t('files_cancel')}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                )}

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
                  onQuickInitEmbedded={() => void handleInitializeEmbeddedEnv(true)}
                  runStartedAt={runStartedAt}
                  lastDurationMs={lastDurationMs}
                  pendingInputPrompt={pendingInputPrompt}
                  onSubmitInput={handleSubmitInput}
                  onRunRepl={handleRunRepl}
                  onSendTermuxStdin={handleSendTermuxStdin}
                  onStopTermux={handleStopTermux}
                  onOpenLogs={() => setShowLogsModal(true)}
                  onClear={() => setEntries([])}
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
                  onNotify={showToast}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Phone Thumb-Zone Bottom Navigation Bar (4 focused workspace tabs; low-frequency tools live in Negative Screen) */}
      {deviceClass === 'phone' && (
      <nav
        aria-label={t('nav_workspace')}
        className="shrink-0 h-14 pb-safe bg-[var(--ide-surface)]/95 backdrop-blur-md border-t border-[var(--ide-border)] grid grid-cols-4"
      >
        {(
          [
            { id: 'editor', label: t('mob_editor'), Icon: Code2 },
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
              onClick={() => setMobileTab(id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-[var(--ide-accent-text)]' : 'text-[var(--ide-text-muted)]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-medium tracking-tight">{label}</span>
            </button>
          );
        })}
      </nav>
      )}

      {/* Negative Screen Slide-Over Drawer for Phone & Tablet (Termux, Packages, Storage, System & Export) */}
      {!isDesktop && (
        <NegativeScreenDrawer
          open={negativeOpen}
          section={negativeSection}
          onChangeSection={setNegativeSection}
          onClose={() => setNegativeOpen(false)}
          files={files}
          activeFile={activeFile}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onResetWorkspace={handleResetWorkspace}
          pyodideStatus={pyodideStatus}
          installedPackages={installedPackages}
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
          onInitializeEmbeddedEnv={handleInitializeEmbeddedEnv}
          onGenerateRequirements={handleGenerateRequirements}
          onInstallRequirements={handleInstallRequirements}
          onSaveWorkspaceFile={handleSaveWorkspaceFile}
          onOpenHelp={() => setShowHelpModal(true)}
          onOpenLogs={() => setShowLogsModal(true)}
          onNotify={showToast}
        />
      )}

      {/* Quick Theme Picker Modal (accessible from Toolbar / Mobile Header) */}
      {showThemePicker && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setShowThemePicker(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-[var(--ide-surface)] border border-[var(--ide-border)] p-5 shadow-xl text-[var(--ide-text)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-[var(--ide-border)] rounded-full mx-auto mb-4 sm:hidden" />
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold">{t('modal_theme_title')}</h3>
                <p className="text-xs text-[var(--ide-text-muted)]">{t('modal_theme_desc')}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowThemePicker(false)}
                className="min-h-[36px] px-3 rounded-lg text-xs font-medium text-[var(--ide-text-muted)] hover:bg-[var(--ide-accent-soft)]"
              >
                {t('btn_done')}
              </button>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto ide-scroll">
              {IDE_THEMES.map((item) => {
                const selected = settings.theme === item.id;
                const themeText = getLocalizedThemeText(item.id, settings.locale);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      handleUpdateSettings({ theme: item.id });
                      showToast(t('toast_theme_applied', { name: themeText.name }));
                      setShowThemePicker(false);
                    }}
                    className={`w-full min-h-[58px] px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 text-left transition-colors ${
                      selected
                        ? 'border-[var(--ide-accent)] bg-[var(--ide-accent-soft)]'
                        : 'border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-accent)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-lg border border-black/10 dark:border-white/10 shrink-0 overflow-hidden grid grid-cols-2"
                        style={{ backgroundColor: item.swatchBg }}
                        aria-hidden="true"
                      >
                        <div style={{ backgroundColor: item.swatchSurface }} />
                        <div style={{ backgroundColor: item.swatchAccent }} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{themeText.name}</div>
                        <div className="text-xs text-[var(--ide-text-muted)] truncate">
                          {item.category === 'feminine'
                            ? t('theme_cat_feminine')
                            : t('theme_cat_classic')}{' '}
                          · {themeText.subtitle}
                        </div>
                      </div>
                    </div>
                    {selected && <Check className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Quick Language Picker Modal (accessible from Toolbar / Mobile Header) */}
      {showLangPicker && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setShowLangPicker(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-[var(--ide-surface)] border border-[var(--ide-border)] p-5 shadow-xl text-[var(--ide-text)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-[var(--ide-border)] rounded-full mx-auto mb-4 sm:hidden" />
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold">{t('modal_lang_title')}</h3>
                <p className="text-xs text-[var(--ide-text-muted)]">{t('modal_lang_desc')}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowLangPicker(false)}
                className="min-h-[36px] px-3 rounded-lg text-xs font-medium text-[var(--ide-text-muted)] hover:bg-[var(--ide-accent-soft)]"
              >
                {t('btn_done')}
              </button>
            </div>
            <div className="space-y-2">
              {LOCALE_OPTIONS.map((lang) => {
                const selected = settings.locale === lang.id;
                return (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => {
                      handleUpdateSettings({ locale: lang.id });
                      showToast(translate(lang.id, 'toast_lang_applied', { name: lang.nativeName }));
                      setShowLangPicker(false);
                    }}
                    className={`w-full min-h-[54px] px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 text-left transition-colors ${
                      selected
                        ? 'border-[var(--ide-accent)] bg-[var(--ide-accent-soft)]'
                        : 'border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-accent)]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{lang.nativeName}</div>
                      <div className="text-xs text-[var(--ide-text-muted)]">{lang.subtitle}</div>
                    </div>
                    {selected && <Check className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* In-App User Guide & Interactive Tutorials */}
      <HelpTutorialModal
        open={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        onInsertSampleFile={(filename, content) => handleSaveWorkspaceFile(filename, content, true)}
        onNavigateBrowser={() => {
          setDesktopSection('workspace');
          setDesktopRightPane('browser');
          setTabletSplit(true);
          setTabletPaneTab('browser');
          setMobileTab('browser');
        }}
        onNavigateAndroid={() => {
          if (isDesktop) {
            setDesktopSection('android');
          } else {
            openNegativeDrawer('android');
          }
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
        <div className="fixed bottom-16 lg:bottom-4 right-3 sm:right-4 z-40 flex items-center gap-2 rounded-2xl border border-[var(--ide-accent)] bg-[var(--ide-surface)]/95 backdrop-blur-md px-3 py-2 text-xs shadow-xl max-w-[calc(100vw-24px)]">
          <Sparkles className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
          <span className="font-semibold text-[var(--ide-text)] truncate">
            {t('upd_banner_text', { ver: appUpdateResult.latest.version })}
          </span>
          <button
            type="button"
            onClick={() => setShowUpdateModal(true)}
            className="min-h-[30px] px-2.5 rounded-lg bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors"
          >
            {t('upd_banner_cta')}
          </button>
          <button
            type="button"
            onClick={() => setUpdateBannerDismissed(true)}
            aria-label={t('btn_done')}
            className="min-h-[28px] min-w-[28px] flex items-center justify-center rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Offline Status Banner */}
      {!isOnline && (
        <div className="fixed bottom-16 lg:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 text-white px-3.5 py-2 text-xs font-medium shadow-lg">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>{t('offline_banner')}</span>
        </div>
      )}

      {/* Native-Style Android Toast */}
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-16 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-4 py-2.5 rounded-full bg-slate-900/95 dark:bg-slate-100/95 text-white dark:text-slate-900 text-xs font-medium shadow-xl whitespace-nowrap"
        >
          {toastMsg}
        </div>
      )}
      </div>
    </I18nProvider>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Square,
  Loader2,
  Code2,
  Terminal as TerminalIcon,
  FolderOpen,
  Wrench,
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
  PyodideStatus,
  PythonFile,
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
import { PWAInstallButton } from './components/PWAInstallButton';
import { CrawlerBrowserPanel } from './components/CrawlerBrowserPanel';
import { HelpTutorialModal } from './components/HelpTutorialModal';
import {
  DEFAULT_CRAWLER_SESSION,
  buildCookiesJsonContent,
  mergeCookieLists,
  parseCookieHeaderPairs,
} from './utils/crawlerSession';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { IDE_THEMES, getThemeMeta } from './services/themes';
import {
  I18nProvider,
  LOCALE_OPTIONS,
  TranslationKey,
  getLocalizedThemeText,
  translate,
} from './services/i18n';
import {
  DEFAULT_TERMUX_CONFIG,
  abortActiveTermuxStream,
  backupWorkspaceToSdcard,
  checkTermuxHealth,
  fetchTermuxWorkspaceFiles,
  getSdcardStatus,
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
  executePythonFile,
  executeReplLine,
  initPyodide,
  installPyPackage,
  listPyPackages,
  RuntimeCallbacks,
} from './services/pyodideRuntime';

const STORAGE_FILES_KEY = 'droidpy_files_v1';
const STORAGE_ACTIVE_ID_KEY = 'droidpy_active_file_v1';
const STORAGE_SETTINGS_KEY = 'droidpy_settings_v2';
const STORAGE_ENGINE_KEY = 'droidpy_engine_v1';
const STORAGE_TERMUX_CFG_KEY = 'droidpy_termux_cfg_v1';
const STORAGE_CRAWLER_SESSION_KEY = 'droidpy_crawler_session_v1';

const DEFAULT_SETTINGS: EditorSettings = {
  fontSize: 14,
  tabSize: 4,
  wordWrap: true,
  showSymbolBar: true,
  theme: 'rose',
  locale: 'zh-TW',
  androidStoragePermission: true,
};

interface PersistedIdeSnapshot {
  files?: PythonFile[];
  activeFileId?: string;
  settings?: Partial<EditorSettings>;
  executionEngine?: ExecutionEngine;
  termuxConfig?: Partial<TermuxConfig>;
  crawlerSession?: Partial<CrawlerSessionData>;
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

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}

export default function App() {
  const isDesktop = useIsDesktop();
  const [files, setFiles] = useState<PythonFile[]>(() => {
    const nativeSnap = getInitialNativeSnapshot();
    if (nativeSnap?.files && Array.isArray(nativeSnap.files) && nativeSnap.files.length > 0) {
      return nativeSnap.files;
    }
    try {
      const saved = localStorage.getItem(STORAGE_FILES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as PythonFile[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
  const [pyodideStatus, setPyodideStatus] = useState<PyodideStatus>('idle');
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [installedPackages, setInstalledPackages] = useState<InstalledPackage[]>([]);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [pendingInputPrompt, setPendingInputPrompt] = useState<string | null>(null);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
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
  const pyodideStatusRef = useRef(pyodideStatus);
  pyodideStatusRef.current = pyodideStatus;
  const inputResolverRef = useRef<{
    resolve: (val: string) => void;
    reject: (err: Error) => void;
  } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    registerSW({ immediate: true });
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
  }, [files, activeFileId, settings, executionEngine, termuxConfig, crawlerSession, flushNativeStateNow]);

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
        if (!cancelled) {
          setPyodideStatus('ready');
        }
      } catch (err) {
        if (!cancelled) {
          const isNative = Boolean(window.DroidPyNative?.isNativeApp?.());
          if (isNative) {
            setPyodideStatus('idle');
            return;
          }
          setPyodideStatus('error');
          appendEntry('stderr', err instanceof Error ? err.message : String(err));
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
      showToast(t('toast_termux_connected', { ver: health.pythonVersion }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('toast_termux_disconnected');
      setTermuxError(msg);
      setTermuxConnectionState('error');
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

  const handleRunInTermux = useCallback(async () => {
    if (termuxRunning) {
      showToast(t('cta_running'));
      return;
    }
    const entryFile = resolveRunnableEntry();
    if (!entryFile) return;
    setDesktopSection('workspace');
    setDesktopRightPane('terminal');
    setMobileTab('console');
    setTermuxRunning(true);
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
      const streamId = makeId();

      const res = await streamRunInTermux(termuxConfig, entryFile, files, {
        onChunk: (chunk) => appendStreamChunk(streamId, chunk),
      });
      setTermuxConnectionState('connected');
      setLastDurationMs(res.durationMs);
      if (res.exitCode !== 0 && res.exitCode !== -1) {
        appendEntry('stderr', t('log_termux_exit', { code: res.exitCode }));
      }
      await syncFilesFromTermux(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isAborted = /abort|中止/i.test(msg);
      if (!isAborted) {
        setTermuxConnectionState('error');
        setTermuxError(msg);
        appendEntry('stderr', msg);
      }
    } finally {
      setTermuxRunning(false);
    }
  }, [resolveRunnableEntry, files, termuxConfig, termuxHealth, termuxRunning, appendEntry, appendStreamChunk, syncFilesFromTermux, showToast, t]);

  const handleInstallInTermux = useCallback(
    async (mode: 'pip' | 'pkg', target: string) => {
      if (termuxRunning) {
        showToast(t('cta_running'));
        return;
      }
      const label = mode === 'pkg' ? `pkg install -y ${target}` : `pip install ${target}`;
      setDesktopSection('workspace');
      setDesktopRightPane('terminal');
      setMobileTab('console');
      setTermuxRunning(true);
      setTermuxError(null);
      appendEntry('system', t('log_termux_install', { cmd: label }));
      const streamId = makeId();
      try {
        const res = await streamInstallInTermux(termuxConfig, mode, target, {
          onChunk: (chunk) => appendStreamChunk(streamId, chunk),
        });
        setTermuxConnectionState('connected');
        setLastDurationMs(res.durationMs);
        if (res.exitCode === 0) {
          showToast(t('toast_termux_install_ok', { pkg: target }));
        } else {
          appendEntry('stderr', t('log_termux_exit', { code: res.exitCode }));
          showToast(t('toast_termux_install_err', { pkg: target, code: res.exitCode }));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setTermuxConnectionState('error');
        setTermuxError(msg);
        appendEntry('stderr', msg);
        showToast(t('toast_termux_install_fail'));
      } finally {
        setTermuxRunning(false);
      }
    },
    [termuxConfig, termuxRunning, appendEntry, appendStreamChunk, showToast, t]
  );

  const handleRunShellInTermux = useCallback(
    async (command: string) => {
      if (termuxRunning) {
        showToast(t('cta_running'));
        return;
      }
      setDesktopSection('workspace');
      setDesktopRightPane('terminal');
      setMobileTab('console');
      setTermuxRunning(true);
      setTermuxError(null);
      appendEntry('repl-in', `$ ${command}`);
      const streamId = makeId();
      try {
        const res = await streamShellInTermux(termuxConfig, command, {
          onChunk: (chunk) => appendStreamChunk(streamId, chunk),
        });
        setTermuxConnectionState('connected');
        setLastDurationMs(res.durationMs);
        if (res.exitCode !== 0) {
          appendEntry('stderr', t('log_termux_exit', { code: res.exitCode }));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setTermuxConnectionState('error');
        setTermuxError(msg);
        appendEntry('stderr', msg);
      } finally {
        setTermuxRunning(false);
      }
    },
    [termuxConfig, termuxRunning, appendEntry, appendStreamChunk, showToast, t]
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
      setDesktopSection('workspace');
      setDesktopRightPane('terminal');
      setMobileTab('console');
      setTermuxRunning(true);
      setTermuxError(null);
      appendEntry('system', t('log_termux_init', { cmd }));
      const streamId = makeId();
      try {
        const res = await streamShellInTermux(termuxConfig, cmd, {
          onChunk: (chunk) => appendStreamChunk(streamId, chunk),
        });
        setTermuxConnectionState('connected');
        setLastDurationMs(res.durationMs);
        if (res.exitCode === 0) {
          showToast(t('toast_termux_init_ok'));
        } else {
          appendEntry('stderr', t('log_termux_exit', { code: res.exitCode }));
          showToast(t('toast_termux_init_err', { code: res.exitCode }));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setTermuxConnectionState('error');
        setTermuxError(msg);
        appendEntry('stderr', msg);
        showToast(t('toast_termux_install_fail'));
      } finally {
        try {
          const health = await checkTermuxHealth(termuxConfig);
          setTermuxHealth(health);
        } catch {
          // ignore background health refresh error
        }
        setTermuxRunning(false);
      }
    },
    [termuxConfig, termuxRunning, appendEntry, appendStreamChunk, showToast, t]
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
      showToast(t('sd_toast_exported', { count: res.count, path: res.dir }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
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

    setDesktopSection('workspace');
    setDesktopRightPane('terminal');
    setMobileTab('console');
    setPyodideStatus('running');
    appendEntry('system', t('log_exec_py', { name: entryFile.name }));

    try {
      const result = await executePythonFile(entryFile, files, callbacksRef.current);
      setLastDurationMs(result.durationMs);
      setPyodideStatus('ready');
    } catch (err) {
      setPyodideStatus('ready');
      appendEntry('stderr', err instanceof Error ? err.message : String(err));
    } finally {
      setPendingInputPrompt(null);
      inputResolverRef.current = null;
    }
  }, [
    activeFile,
    resolveRunnableEntry,
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
      try {
        const result = await executeReplLine(statement, files, callbacksRef.current);
        if (result !== null) {
          appendEntry('repl-out', result);
        }
        if (/^[!%]?\s*pip\s+install\b/i.test(statement.trim())) {
          try {
            const list = await listPyPackages(callbacksRef.current);
            setInstalledPackages(list);
          } catch {
            // ignore refresh errors
          }
        }
      } finally {
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
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleResetWorkspace = useCallback(() => {
    setFiles(DEFAULT_FILES);
    setActiveFileId(DEFAULT_FILES[0].id);
    showToast(t('toast_workspace_reset'));
  }, [showToast, t]);

  const handleInstallPackage = useCallback(
    async (pkgName: string) => {
      try {
        const list = await installPyPackage(pkgName, callbacksRef.current);
        setInstalledPackages(list);
        showToast(t('toast_pkg_ok', { pkg: pkgName }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appendEntry('stderr', `${t('toast_pkg_fail', { pkg: pkgName })}: ${msg}`);
        showToast(t('toast_pkg_fail', { pkg: pkgName }));
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
      (desktopSection === 'packages' || mobileTab === 'tools') &&
      pyodideStatus === 'ready' &&
      installedPackages.length === 0
    ) {
      void handleRefreshPackages();
    }
  }, [desktopSection, mobileTab, pyodideStatus, installedPackages.length, handleRefreshPackages]);

  const isRunning = pyodideStatus === 'running' || termuxRunning;
  const isCoreLoading = executionEngine === 'pyodide' && pyodideStatus === 'loading';
  const activeThemeLabel = getLocalizedThemeText(settings.theme, settings.locale);
  const activeLocaleMeta = LOCALE_OPTIONS.find((item) => item.id === settings.locale) ?? LOCALE_OPTIONS[0];

  return (
    <I18nProvider
      locale={settings.locale}
      onChangeLocale={(loc) => handleUpdateSettings({ locale: loc })}
    >
      <div className="h-dvh flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)] overflow-hidden">
      {/* Desktop Top Bar (3-zone contract: Brand — Nav Links — Primary CTA) */}
      <header className="hidden lg:flex items-center justify-between gap-8 h-[52px] px-5 border-b border-[var(--ide-border)] bg-[var(--ide-surface)] shrink-0">
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

      {/* Mobile Compact Top App Bar (<= 48px to obey 15% sticky cap) */}
      <header className="lg:hidden flex items-center justify-between gap-3 h-12 px-3 pt-safe border-b border-[var(--ide-border)] bg-[var(--ide-surface)] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
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
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            aria-label={t('toolbar_help_title')}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl border border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-accent)]"
          >
            <BookOpen className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowLangPicker(true)}
            aria-label={t('toolbar_choose_lang')}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl border border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-accent)]"
          >
            <Languages className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowThemePicker(true)}
            aria-label={t('toolbar_choose_theme')}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl border border-[var(--ide-border)] text-[var(--ide-accent)]"
          >
            <Palette className="w-4 h-4" />
          </button>
          {pendingInputPrompt !== null ? (
            <button
              type="button"
              onClick={handleCancelInput}
              className="min-h-[38px] px-3.5 rounded-xl bg-red-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{t('cta_abort_short')}</span>
            </button>
          ) : termuxRunning ? (
            <button
              type="button"
              onClick={() => void handleStopTermux()}
              className="min-h-[38px] px-3.5 rounded-xl bg-red-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{t('cta_stop_short')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunCode}
              disabled={isRunning || isCoreLoading}
              className="min-h-[38px] px-3.5 rounded-xl bg-[var(--ide-accent)] active:scale-[0.98] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-transform"
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

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 flex overflow-hidden">
        {isDesktop ? (
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
                        lastDurationMs={lastDurationMs}
                        pendingInputPrompt={pendingInputPrompt}
                        onSubmitInput={handleSubmitInput}
                        onRunRepl={handleRunRepl}
                        onSendTermuxStdin={handleSendTermuxStdin}
                        onStopTermux={handleStopTermux}
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
                  onNotify={showToast}
                />
              </div>
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
                  lastDurationMs={lastDurationMs}
                  pendingInputPrompt={pendingInputPrompt}
                  onSubmitInput={handleSubmitInput}
                  onRunRepl={handleRunRepl}
                  onSendTermuxStdin={handleSendTermuxStdin}
                  onStopTermux={handleStopTermux}
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
                  onOpenSdcardManager={() => setMobileTab('tools')}
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

            {mobileTab === 'tools' && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <ToolsAndPackages
                  activeSubView="all"
                  files={files}
                  activeFile={activeFile}
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onResetWorkspace={handleResetWorkspace}
                  pyodideStatus={pyodideStatus}
                  installedPackages={installedPackages}
                  onInstallPackage={handleInstallPackage}
                  onRefreshPackages={handleRefreshPackages}
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
                  onNotify={showToast}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Mobile Thumb-Zone Bottom Navigation Bar (56px flex footer so keyboard never overlaps) */}
      <nav
        aria-label={t('nav_workspace')}
        className="lg:hidden shrink-0 h-14 pb-safe bg-[var(--ide-surface)]/95 backdrop-blur-md border-t border-[var(--ide-border)] grid grid-cols-5"
      >
        {(
          [
            { id: 'editor', label: t('mob_editor'), Icon: Code2 },
            { id: 'console', label: t('mob_console'), Icon: TerminalIcon },
            { id: 'browser', label: t('mob_browser'), Icon: Globe },
            { id: 'files', label: t('mob_files'), Icon: FolderOpen },
            { id: 'tools', label: t('mob_tools'), Icon: Wrench },
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
          setMobileTab('browser');
        }}
        onNavigateAndroid={() => {
          setDesktopSection('android');
          setMobileTab('tools');
        }}
        onNotify={showToast}
      />

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

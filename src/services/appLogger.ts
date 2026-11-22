export type AppLogLevel = 'info' | 'warn' | 'error' | 'debug';

export type AppLogCategory =
  | 'lifecycle'
  | 'python'
  | 'termux'
  | 'package'
  | 'storage'
  | 'network'
  | 'bridge';

export interface AppExecutionLogEntry {
  id: string;
  timestamp: string;
  level: AppLogLevel;
  category: AppLogCategory;
  message: string;
  detail?: string;
}

const STORAGE_APP_LOGS_KEY = 'droidpy_exec_logs_v1';
const MAX_LOG_ENTRIES = 600;

type LogListener = (logs: AppExecutionLogEntry[]) => void;

const listeners = new Set<LogListener>();
let memoryLogs: AppExecutionLogEntry[] | null = null;

function formatTimestamp(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

function loadLogs(): AppExecutionLogEntry[] {
  if (memoryLogs !== null) return memoryLogs;
  try {
    const raw = localStorage.getItem(STORAGE_APP_LOGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryLogs = parsed.slice(-MAX_LOG_ENTRIES) as AppExecutionLogEntry[];
        return memoryLogs;
      }
    }
  } catch {
    // ignore storage errors
  }
  memoryLogs = [];
  return memoryLogs;
}

function persistLogs(logs: AppExecutionLogEntry[]): void {
  try {
    localStorage.setItem(STORAGE_APP_LOGS_KEY, JSON.stringify(logs));
  } catch {
    // if quota exceeded, keep half
    try {
      const trimmed = logs.slice(-Math.floor(MAX_LOG_ENTRIES / 2));
      memoryLogs = trimmed;
      localStorage.setItem(STORAGE_APP_LOGS_KEY, JSON.stringify(trimmed));
    } catch {
      // ignore
    }
  }
}

function notifyListeners(): void {
  const current = [...loadLogs()];
  listeners.forEach((fn) => {
    try {
      fn(current);
    } catch {
      // ignore listener error
    }
  });
}

export function appLog(
  category: AppLogCategory,
  message: string,
  options?: { level?: AppLogLevel; detail?: string }
): void {
  const logs = loadLogs();
  const entry: AppExecutionLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: formatTimestamp(),
    level: options?.level ?? 'info',
    category,
    message,
    detail: options?.detail ? options.detail.slice(0, 1200) : undefined,
  };
  const next = [...logs, entry];
  memoryLogs = next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next;
  persistLogs(memoryLogs);
  notifyListeners();
}

export function getAppLogs(): AppExecutionLogEntry[] {
  return [...loadLogs()];
}

export function clearAppLogs(): void {
  memoryLogs = [];
  try {
    localStorage.removeItem(STORAGE_APP_LOGS_KEY);
  } catch {
    // ignore
  }
  notifyListeners();
}

export function subscribeAppLogs(listener: LogListener): () => void {
  listeners.add(listener);
  listener(getAppLogs());
  return () => {
    listeners.delete(listener);
  };
}

export function formatAppLogsAsText(
  logs: AppExecutionLogEntry[],
  nativeLogs?: { nativeLines?: string[]; logcatLines?: string[] } | null
): string {
  const header = [
    '=== DroidPy Full Execution Logs ===',
    `Exported At: ${new Date().toISOString()}`,
    `User Agent : ${typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'}`,
    `App Logs   : ${logs.length}`,
    '',
    '--- Application & Runtime Logs ---',
  ];

  const appLines = logs.map((item) => {
    const base = `[${item.timestamp}] [${item.level.toUpperCase()}] [${item.category}] ${item.message}`;
    return item.detail ? `${base}\n  detail: ${item.detail}` : base;
  });

  const sections = [...header, ...appLines];

  if (nativeLogs?.nativeLines && nativeLogs.nativeLines.length > 0) {
    sections.push('', '--- Android Native / Embedded Termux Bridge Logs ---', ...nativeLogs.nativeLines);
  }
  if (nativeLogs?.logcatLines && nativeLogs.logcatLines.length > 0) {
    sections.push('', '--- Android Process Logcat ---', ...nativeLogs.logcatLines);
  }

  return sections.join('\n') + '\n';
}

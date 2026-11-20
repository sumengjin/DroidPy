import { ThemeId } from '../services/themes';
import { LocaleId } from '../services/i18n';

export interface PythonFile {
  id: string;
  name: string;
  content: string;
  updatedAt: number;
}

export type TerminalEntryType =
  | 'stdout'
  | 'stderr'
  | 'system'
  | 'input'
  | 'repl-in'
  | 'repl-out'
  | 'plot';

export interface TerminalEntry {
  id: string;
  type: TerminalEntryType;
  content: string;
  timestamp: string;
  imageDataUrl?: string;
}

export type PyodideStatus = 'idle' | 'loading' | 'ready' | 'running' | 'error';

export interface InstalledPackage {
  name: string;
  version: string;
}

export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  showSymbolBar: boolean;
  theme: ThemeId;
  locale: LocaleId;
  androidStoragePermission: boolean;
}

export type MobileTab = 'editor' | 'console' | 'browser' | 'files' | 'tools';
export type DesktopSection = 'workspace' | 'termux' | 'packages' | 'android' | 'settings';
export type DesktopRightPane = 'terminal' | 'browser';

export type ExecutionEngine = 'pyodide' | 'termux';
export type TermuxConnectionState = 'disconnected' | 'checking' | 'connected' | 'error';

export interface TermuxConfig {
  endpointUrl: string;
  token: string;
}

export interface TermuxHealthInfo {
  pythonVersion: string;
  arch: string;
  hasClang: boolean;
  hasFfmpeg: boolean;
  workspaceDir: string;
  embedded?: boolean;
  hasPython?: boolean;
}

export interface CapturedCookieItem {
  name: string;
  value: string;
  enabled: boolean;
  domain?: string;
  path?: string;
  httpOnly?: boolean;
}

export interface CrawlerSessionData {
  url: string;
  userAgent: string;
  cookies: CapturedCookieItem[];
  extraHeaders: Record<string, string>;
  capturedAt: number;
}

export interface UrlProbeResult {
  ok: boolean;
  url: string;
  finalUrl: string;
  statusCode: number;
  title: string;
  setCookies: string[];
  headers: Record<string, string>;
  bodyPreview: string;
}

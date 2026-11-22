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

export type MobileTab = 'editor' | 'console' | 'browser' | 'files';
export type NegativeScreenSection = 'termux' | 'packages' | 'android' | 'settings';
export type DeviceClass = 'phone' | 'tablet' | 'desktop';
export type TabletPaneTab = 'terminal' | 'browser' | 'files';
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
  installedPipPackages?: string[];
  installedPkgPackages?: string[];
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

export interface SdcardEntry {
  name: string;
  relPath: string;
  isDir: boolean;
  size: number;
  updatedAt: number;
}

export interface SdcardStatusInfo {
  granted: boolean;
  manageAllFiles: boolean;
  runtimeWrite: boolean;
  rootPath: string;
  droidpyDir: string;
  totalBytes?: number;
  freeBytes?: number;
  usedBytes?: number;
}

export interface DroidPyNativeBridge {
  isNativeApp?: () => boolean;
  readPersistedState?: () => string;
  writePersistedState?: (json: string) => void;
  getInternalStoragePath?: () => string;
  hasStoragePermission?: () => boolean;
  requestStoragePermission?: () => void;
  openCrawlerBrowser?: (url: string, desktopUa: boolean) => void;
  closeCrawlerBrowser?: () => void;
  saveBase64File?: (base64Data: string, fileName: string, mimeType: string) => void;
}

declare global {
  interface Window {
    DroidPyNative?: DroidPyNativeBridge;
  }
}



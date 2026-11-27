import { ThemeId } from '../services/themes';
import { LocaleId } from '../services/i18n';

export interface PythonFile {
  id: string;
  name: string;
  content: string;
  updatedAt: number;
  externalPath?: string;
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

export type Atmosphere3dMode = 'auto' | 'petals' | 'snow' | 'rain' | 'starlight';

export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  showSymbolBar: boolean;
  theme: ThemeId;
  locale: LocaleId;
  androidStoragePermission: boolean;
  autoUpdatePackages?: boolean;
  githubRepo?: string;
  enableSandboxAddon?: boolean;
  cleanTextMode?: boolean;
  pipTrustedHostEmergency?: boolean;
  enable3dBg?: boolean;
  atmosphere3dMode?: Atmosphere3dMode;
}

export type MobileTab = 'editor' | 'console' | 'browser' | 'files' | 'packages';
export type SettingsWorkspaceSection = 'termux' | 'packages' | 'android' | 'settings';
export type DeviceClass = 'phone' | 'tablet';
export type TabletPaneTab = 'terminal' | 'browser' | 'files';

export interface ProcessCleanupItem {
  pid: number;
  name: string;
  state: string;
  elapsedSec: number;
  reason: string;
  signal: string;
}

export interface ProcessCleanupResult {
  ok: boolean;
  checkedAt: number;
  manual: boolean;
  scannedCount: number;
  killedCount: number;
  killed: ProcessCleanupItem[];
  message?: string;
}

export interface ScriptBackupSnapshot {
  id: string;
  createdAt: number;
  label: string;
  reason: 'manual' | 'pre-restore' | 'import';
  fileCount: number;
  totalBytes: number;
  files: PythonFile[];
}

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

export interface PackageBackupStatus {
  hasBackup: boolean;
  backupSource?: string;
  updatedAt?: number;
  pipPackages: string[];
  pkgPackages: string[];
  missingPipPackages: string[];
  missingPkgPackages: string[];
  pipInventoryComplete?: boolean;
  pkgInventoryComplete?: boolean;
}

export interface CapturedCookieItem {
  name: string;
  value: string;
  enabled: boolean;
  domain?: string;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  expiresAt?: number;
  sameSite?: string;
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

export interface AppStorageUsageInfo {
  ok: boolean;
  usrBytes: number;
  tmpBytes: number;
  cacheBytes: number;
  workspaceBytes: number;
  logBytes: number;
  apkUpdatesBytes: number;
  reclaimableBytes: number;
}

export interface AppStorageCleanupResult {
  ok: boolean;
  freedBytes: number;
  usageAfter?: AppStorageUsageInfo;
}

export interface DroidPyNativeBridge {
  setSystemBarAppearance?: (isDark: boolean) => void;
  isNativeApp?: () => boolean;
  getAppVersionName?: () => string;
  getBridgeToken?: () => string;
  getBridgeEndpoint?: () => string;
  downloadAndInstallApk?: (apkUrl: string, fileName: string) => void;
  readPersistedState?: () => string;
  writePersistedState?: (json: string) => void;
  getInternalStoragePath?: () => string;
  hasStoragePermission?: () => boolean;
  requestStoragePermission?: () => void;
  openCrawlerBrowser?: (url: string, desktopUa: boolean) => void;
  closeCrawlerBrowser?: () => void;
  saveBase64File?: (base64Data: string, fileName: string, mimeType: string) => void;
  copyToClipboard?: (text: string) => boolean;
}

declare global {
  interface Window {
    DroidPyNative?: DroidPyNativeBridge;
  }
}



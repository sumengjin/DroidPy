import { APP_VERSION, getSavedGithubRepo, parseGithubRepoSlug } from '../version';
import { TermuxConfig } from '../types/ide';
import { probeUrlViaTermux } from './termuxBridge';

export interface ReleaseAssetInfo {
  name: string;
  size: number;
  downloadUrl: string;
}

export interface AppReleaseInfo {
  tagName: string;
  version: string;
  name: string;
  body: string;
  publishedAt: string;
  htmlUrl: string;
  prerelease: boolean;
  apkAssets: ReleaseAssetInfo[];
}

export interface AppUpdateCheckResult {
  currentVersion: string;
  repoSlug: string;
  checkedAt: number;
  hasUpdate: boolean;
  latest: AppReleaseInfo | null;
  releases: AppReleaseInfo[];
  error?: string;
}

export interface NativeApkDownloadEvent {
  status: 'downloading' | 'installing' | 'error';
  progress: number;
  downloadedBytes?: number;
  totalBytes?: number;
  fileName?: string;
  message?: string;
}

export function normalizeVersionStr(raw: string): string {
  return raw.trim().replace(/^v/i, '').split('-')[0];
}

export function compareSemver(aRaw: string, bRaw: string): number {
  const a = normalizeVersionStr(aRaw)
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const b = normalizeVersionStr(bRaw)
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const len = Math.max(a.length, b.length, 3);
  for (let i = 0; i < len; i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

export function getInstalledAppVersion(): string {
  try {
    const nativeVer = window.DroidPyNative?.getAppVersionName?.();
    if (nativeVer && nativeVer.trim()) {
      return normalizeVersionStr(nativeVer);
    }
  } catch {
    // fallback to build constant
  }
  return APP_VERSION;
}

interface RawGitHubRelease {
  tag_name?: string;
  name?: string;
  body?: string;
  published_at?: string;
  created_at?: string;
  html_url?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: {
    name?: string;
    size?: number;
    browser_download_url?: string;
  }[];
}

function mapGitHubReleases(rawList: RawGitHubRelease[]): AppReleaseInfo[] {
  return rawList
    .filter((r) => !r.draft && Boolean(r.tag_name))
    .map((r) => {
      const tagName = String(r.tag_name || '');
      const version = normalizeVersionStr(tagName);
      const assets = Array.isArray(r.assets) ? r.assets : [];
      const apkAssets: ReleaseAssetInfo[] = assets
        .filter((a) => (a.name || '').toLowerCase().endsWith('.apk') && Boolean(a.browser_download_url))
        .map((a) => ({
          name: String(a.name),
          size: Number(a.size || 0),
          downloadUrl: String(a.browser_download_url),
        }));

      return {
        tagName,
        version,
        name: String(r.name || tagName),
        body: String(r.body || '').trim(),
        publishedAt: String(r.published_at || r.created_at || ''),
        htmlUrl: String(r.html_url || ''),
        prerelease: Boolean(r.prerelease),
        apkAssets,
      };
    });
}

export const BUILTIN_LOCAL_RELEASES: AppReleaseInfo[] = [
  {
    tagName: 'v1.2.11',
    version: '1.2.11',
    name: 'DroidPy v1.2.11',
    publishedAt: '2026-11-22',
    htmlUrl: '',
    prerelease: false,
    apkAssets: [],
    body: [
      '• 新增 16+ 趣味 Python 腳本範例（數位雨、曼德布羅碎形、21 點撲克、迷宮最短路徑、番茄鐘、HN 即時爬蟲等）與分類篩選',
      '• 新增完整熱門＋冷門分類套件目錄（60+ 套件、7 大分類、Termux 預編譯對照與別名搜尋）',
      '• 輸入套件名稱時即時模糊搜尋聯想（支援拼寫容錯、縮寫別名如 bs4 / pil / yaml 與一鍵填入/安裝）',
      '• 新增手動檢查／一鍵更新已安裝套件與背景自動更新開關（支援 Termux pip / pkg 與 Pyodide 沙盒）',
      '• 新增程式內版本更新檢查器、更新日誌展示與 APK 直接下載安裝（Android FileProvider 原生安裝）',
      '• 修復 CMake / make 編譯原生擴充時 make[1]: /data/data/com.termux/files/usr/bin/sh: Permission denied 錯誤',
    ].join('\n'),
  },
  {
    tagName: 'v1.2.10',
    version: '1.2.10',
    name: 'DroidPy v1.2.10',
    publishedAt: '2026-11-22',
    htmlUrl: '',
    prerelease: false,
    apkAssets: [],
    body: [
      '• 根治 pip truststore Errno 13 與 C 擴充編譯 Permission denied 問題',
      '• 新增 CC / CXX / AR / RANLIB / LDSHARED 自動導出與 sysconfig 重寫',
      '• Termux 快捷套件補齊 python-pillow、python-lxml 與 flask',
    ].join('\n'),
  },
  {
    tagName: 'v1.2.8',
    version: '1.2.8',
    name: 'DroidPy v1.2.8',
    publishedAt: '2026-11-21',
    htmlUrl: '',
    prerelease: false,
    apkAssets: [],
    body: [
      '• 修復退出重開後 Termux Python 與已安裝套件恢復預設問題',
      '• 適配手機與平板操作差異、低頻功能收納至負屏工具箱、新增程式執行所有日誌',
    ].join('\n'),
  },
];

export async function checkForAppUpdates(
  repoOverride?: string,
  termuxConfig?: TermuxConfig,
  termuxConnected?: boolean
): Promise<AppUpdateCheckResult> {
  const currentVersion = getInstalledAppVersion();
  const repoSlug = parseGithubRepoSlug(repoOverride ?? getSavedGithubRepo());
  const checkedAt = Date.now();

  if (!repoSlug) {
    return {
      currentVersion,
      repoSlug: '',
      checkedAt,
      hasUpdate: false,
      latest: null,
      releases: BUILTIN_LOCAL_RELEASES,
    };
  }

  const apiUrl = `https://api.github.com/repos/${repoSlug}/releases?per_page=15`;
  let rawJsonText = '';

  try {
    const res = await fetch(apiUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) {
      throw new Error(`GitHub API HTTP ${res.status}`);
    }
    rawJsonText = await res.text();
  } catch (browserErr) {
    if (termuxConnected && termuxConfig) {
      try {
        const probed = await probeUrlViaTermux(termuxConfig, {
          url: apiUrl,
          extraHeaders: { Accept: 'application/vnd.github+json' },
        });
        if (probed.statusCode >= 200 && probed.statusCode < 300 && probed.bodyPreview) {
          rawJsonText = probed.bodyPreview;
        } else {
          throw new Error(`GitHub API HTTP ${probed.statusCode}`);
        }
      } catch (tmxErr) {
        return {
          currentVersion,
          repoSlug,
          checkedAt,
          hasUpdate: false,
          latest: null,
          releases: BUILTIN_LOCAL_RELEASES,
          error: tmxErr instanceof Error ? tmxErr.message : String(browserErr),
        };
      }
    } else {
      return {
        currentVersion,
        repoSlug,
        checkedAt,
        hasUpdate: false,
        latest: null,
        releases: BUILTIN_LOCAL_RELEASES,
        error: browserErr instanceof Error ? browserErr.message : String(browserErr),
      };
    }
  }

  try {
    const parsed = JSON.parse(rawJsonText) as RawGitHubRelease[];
    if (!Array.isArray(parsed)) {
      throw new Error('無效的 GitHub Releases 回應格式');
    }
    const releases = mapGitHubReleases(parsed);
    const latest = releases[0] ?? null;
    const hasUpdate = Boolean(latest && compareSemver(latest.version, currentVersion) > 0);
    return {
      currentVersion,
      repoSlug,
      checkedAt,
      hasUpdate,
      latest,
      releases: releases.length > 0 ? releases : BUILTIN_LOCAL_RELEASES,
    };
  } catch (parseErr) {
    return {
      currentVersion,
      repoSlug,
      checkedAt,
      hasUpdate: false,
      latest: null,
      releases: BUILTIN_LOCAL_RELEASES,
      error: parseErr instanceof Error ? parseErr.message : String(parseErr),
    };
  }
}

export function triggerInAppApkDownload(apkUrl: string, fileName: string): 'native' | 'browser' {
  const safeName = fileName.trim() || `DroidPy-${APP_VERSION}.apk`;
  if (window.DroidPyNative?.downloadAndInstallApk) {
    window.DroidPyNative.downloadAndInstallApk(apkUrl, safeName);
    return 'native';
  }
  const a = document.createElement('a');
  a.href = apkUrl;
  a.download = safeName;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return 'browser';
}

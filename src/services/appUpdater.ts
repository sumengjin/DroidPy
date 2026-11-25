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
    tagName: 'v1.2.29',
    version: '1.2.29',
    name: 'DroidPy v1.2.29',
    publishedAt: '2026-11-25',
    htmlUrl: '',
    prerelease: false,
    apkAssets: [],
    body: [
      '• 修正 App 版本常數、原生 APK 預設版本與離線更新資訊長期停留在舊版的問題',
      '• 統一主專案與匯出 Android 專案的版本回退值，避免更新視窗誤判目前版本',
    ].join('\\n'),
  },
  {
    tagName: 'v1.2.28',
    version: '1.2.28',
    name: 'DroidPy v1.2.28',
    publishedAt: '2026-11-25',
    htmlUrl: 'https://github.com/sumengjin/DroidPy/releases/tag/v1.2.28',
    prerelease: false,
    apkAssets: [],
    body: [
      '• 修復 Android Bridge 併發阻塞、Activity 重建與 Python 程序生命週期問題',
      '• 改善斷線處理、停止流程、崩潰診斷與 SD 卡備份逾時記錄',
    ].join('\\n'),
  },

  {
    tagName: 'v1.2.16',
    version: '1.2.16',
    name: 'DroidPy v1.2.16',
    publishedAt: '2026-11-24',
    htmlUrl: '',
    prerelease: false,
    apkAssets: [],
    body: [
      '• 深度修復 pip truststore PermissionError (Errno 13)：於 sitecustomize.py 植入記憶體備援 certifi CA 憑證文本、攔截 truststore _create_truststore_ssl_context 與 load_verify_locations、設定 pip.conf 與規範 usr/etc/lib/tmp 讀寫執行權限',
      '• 重新設計工具箱操作架構為「精簡選項目錄 → 獨立操作視窗」：Python、套件、儲存、設定內每個功能皆具備獨立視窗與頂部返回列，不再堆疊長牆頁面',
      '• 精簡全域冗長說明文字（將「Python 直譯器」統一精簡為「Python／內建 Python」），並全面修復手機窄螢幕按鈕與狀態列文字溢出截斷問題',
      '• 升級「寫實 3D 季節晝夜背景」：隨目前月份自動切換春（櫻吹雪）、夏（晴空陣雨）、秋（楓葉暮嵐）、冬（靜夜雪晶）大氣粒子，並依日出／正午／黃昏／深夜變化漸層天光',
    ].join('\n'),
  },
  {
    tagName: 'v1.2.15',
    version: '1.2.15',
    name: 'DroidPy v1.2.15',
    publishedAt: '2026-11-24',
    htmlUrl: '',
    prerelease: false,
    apkAssets: [],
    body: [
      '• 修復 GitHub Actions 重試或重複建置時 APK 資產同名衝突失敗（asset under the same name already exists）問題，統一改用 --clobber 安全覆寫並保留唯一標準檔名',
      '• 修復新版本不發布問題：CI 自動偵測 CHANGELOG 與遠端標籤對應 commit，新提交自動遞增修訂版號（如 v1.2.15 → v1.2.16）並同步寫入 Android versionCode / versionName 後發布 Release；更新檢查改以語意版本由高至低排序並停用過期快取',
      '• 新增浪漫女性化「動態 3D 氛圍背景」（Three.js WebGL）：隨時間推移自動切換晨曦落櫻花瓣飄、晴空／紫羅蘭微雨連漪、月夜初雪晶體與星塵流螢，支援設定頁自由選擇效果與一鍵開關',
      '• 新增 4 款柔美女性化主題（胭脂牡丹、香檳珍珠、月影薔薇、極光粉霧），並調整編輯器／面板半透明層次以兼具程式碼高對比與動態背景美感',
    ].join('\n'),
  },
  {
    tagName: 'v1.2.14',
    version: '1.2.14',
    name: 'DroidPy v1.2.14',
    publishedAt: '2026-11-23',
    htmlUrl: '',
    prerelease: false,
    apkAssets: [],
    body: [
      '• 修復原生與 Pyodide「已安裝套件為空」顯示異常：補齊 Termux site-packages/dist-packages + importlib.metadata 雙重掃描與 UI 套件面板常駐顯示',
      '• 徹底修復 pip / pkg 安裝失敗後殘留暫存檔導致儲存空間暴增且不清的問題，新增應用程式暫存用量檢查與「一鍵清理暫存」功能',
      '• 補強 Kotlin 與前端 ANSI／控制碼濾除並預設導出 PYTHONUTF8=1，根除腳本輸出出現「□」或 8;5;129mm 等亂碼',
      '• 移除終端機與設定中冗餘的「純淨文字」切換按鈕，改由底層自動呈現潔淨色彩輸出',
      '• 實作原生 POST /shell 端點與 404 串流自動回退、消除重複開機日誌，全面修正手機窄螢幕字體／按鈕溢出與長時使用卡頓問題',
    ].join('\n'),
  },
  {
    tagName: 'v1.2.13',
    version: '1.2.13',
    name: 'DroidPy v1.2.13',
    publishedAt: '2026-11-23',
    htmlUrl: '',
    prerelease: false,
    apkAssets: [],
    body: [
      '• 改為以原生 Python 直譯器為預設執行引擎，將 Pyodide 瀏覽器沙盒下放為可在設定中開關的附加功能 (Add-on)',
      '• 強化 Pyodide 沙盒錯誤防護：攔截 subprocess Errno 138、原生編譯輪子失敗（如 parsel）與 input() KeyboardInterrupt 中斷，提供清楚環境引導',
      '• 修復終端機與匯出 .log 日誌的 ANSI 控制碼外露問題（[0m、[38;5;...m、;88mO 等），並新增「純淨文字模式」一鍵切換',
      '• 腳本執行與 droid.device_info() 環境偵測預設為手機（Android）環境',
      '• 修復 /health 套件清單誤將連字號名稱截斷導致 pipPkgs 統計不準的問題，並消除啟動期 Unhandled rejection: Not found 錯誤',
      '• 新增已安裝套件清單自動備份至 /sdcard/DroidPy/.droidpy_backup/ 與更新／重裝後一鍵恢復功能，並將所有日誌按鈕統一簡化為「日誌」',
    ].join('\n'),
  },
  {
    tagName: 'v1.2.12',
    version: '1.2.12',
    name: 'DroidPy v1.2.12',
    publishedAt: '2026-11-22',
    htmlUrl: '',
    prerelease: false,
    apkAssets: [],
    body: [
      '• 終端機與執行紀錄改為即時時分秒計時顯示（HH:MM:SS），不再以毫秒顯示',
      '• 程式更新日誌改為僅顯示當前／目標版本說明，版面更精簡清晰',
      '• 新增 Pyodide 沙盒與 Termux 原生套件解除安裝（移除）功能並保護系統核心套件',
      '• 修復最新套件仍誤報「可更新」的問題（PEP 440 版本比對＋Pyodide WASM／純 Python 輪子精準過濾）',
      '• 修正「啟動時自動更新套件」僅於開啟程式啟動視窗執行，不在操作過程中重複觸發',
      '• 新增「一鍵更新所有套件」按鈕，可一次完成沙盒與 Termux 已安裝套件檢查與升級',
      '• 修復非編輯區與終端機區在手機 WebView 長按選字與複製失效問題，並新增「複製選取」快捷鈕',
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

  const apiUrl = `https://api.github.com/repos/${repoSlug}/releases?per_page=20`;
  let rawJsonText = '';

  try {
    const res = await fetch(apiUrl, {
      cache: 'no-store',
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
    const releases = mapGitHubReleases(parsed).sort((a, b) =>
      compareSemver(b.version, a.version)
    );
    const stableReleases = releases.filter((r) => !r.prerelease);
    const latest = stableReleases[0] ?? releases[0] ?? null;
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

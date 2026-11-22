import React, { useState } from 'react';
import {
  BookOpen,
  X,
  Zap,
  Globe,
  Smartphone,
  HelpCircle,
  Code2,
  ArrowRight,
} from 'lucide-react';
import { LocaleId, useI18n } from '../services/i18n';

type HelpTab = 'quickstart' | 'crawler' | 'apk' | 'faq';

interface HelpTutorialModalProps {
  open: boolean;
  onClose: () => void;
  onInsertSampleFile: (filename: string, content: string) => void;
  onNavigateBrowser: () => void;
  onNavigateAndroid: () => void;
  onNotify: (msg: string) => void;
}

const CROSS_ENV_DEMO_CODE = `"""
DroidPy 跨平台相容範例 (PC / Termux / 獨立 APK / 瀏覽器沙盒)
執行前會自動偵測目前引擎與作業環境
"""
import os
import sys

IS_PYODIDE = sys.platform == "emscripten"
IS_TERMUX = "com.termux" in os.environ.get("PREFIX", "") or "/usr" in os.environ.get("PREFIX", "")

try:
    import droid
    HAS_DROID = True
except ImportError:
    HAS_DROID = False


def main():
    print(f"Python 版本: {sys.version.split()[0]}")
    print(f"執行平台   : {sys.platform}")
    print(f"Pyodide 沙盒: {IS_PYODIDE}")
    print(f"Termux/APK : {IS_TERMUX}")

    if HAS_DROID:
        info = droid.device_info()
        print("裝置螢幕   :", info.get("screen"))
        droid.vibrate(35)
        droid.toast("跨環境偵測完成！")
    else:
        print("目前為原生 Python 環境，可使用相對路徑讀寫工作區檔案。")


if __name__ == "__main__":
    main()
`;

const CRAWLER_STARTER_CODE = `"""
DroidPy Cookie 爬蟲實戰範本
步驟：
1. 先開啟「爬蟲瀏覽器」登入網站並點擊「寫入 cookies.json」
2. 切換引擎至「Termux 原生引擎」（或獨立 APK）
3. 執行本程式即可自動讀取 cookies.json 發送請求
"""
import json
from pathlib import Path

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    raise SystemExit("請先切換至 Termux 引擎並安裝: pip install requests beautifulsoup4")

COOKIE_FILE = Path("cookies.json")


def load_session():
    sess = requests.Session()
    url = "https://quotes.toscrape.com/"
    if COOKIE_FILE.exists():
        data = json.loads(COOKIE_FILE.read_text(encoding="utf-8"))
        url = data.get("url") or url
        sess.headers.update(data.get("headers") or {})
        sess.cookies.update(data.get("cookies") or {})
    else:
        sess.headers.update({"User-Agent": "DroidPy-Crawler/1.0"})
    return sess, url


def main():
    sess, url = load_session()
    print(f"目標網址: {url}")
    resp = sess.get(url, timeout=15)
    print(f"HTTP 狀態: {resp.status_code}")
    soup = BeautifulSoup(resp.text, "html.parser")
    print("頁面標題:", soup.title.get_text(strip=True) if soup.title else "(無)")


if __name__ == "__main__":
    main()
`;

interface GuideContent {
  quickSteps: { title: string; body: string }[];
  crawlerSteps: { title: string; body: string }[];
  apkSteps: { title: string; body: string }[];
  faqs: { q: string; a: string }[];
}

const GUIDE_TEXT: Record<LocaleId, GuideContent> = {
  'zh-TW': {
    quickSteps: [
      {
        title: '1. 選擇執行引擎（離線沙盒 vs. Termux 原生）',
        body: '終端機上方可切換引擎：「沙盒 (Pyodide)」免連線、可畫 matplotlib 圖表並支援 import droid 震動/裝置資訊；「Termux 原生」適合網路爬蟲（無 CORS 限制）與 pip/pkg 原生套件。',
      },
      {
        title: '2. 行動端編輯效率技巧',
        body: '編輯器下方有 Android 快捷符號列（可按鍵盤圖示收合），工具列提供一鍵排版與即時 Python/JSON 語法檢查；非 .py 資料檔按下執行時，會自動改跑 main.py。',
      },
      {
        title: '3. 工作區檔案與自動同步',
        body: '支援 .py、.json、.csv、.txt、requirements.txt 等多種格式。於 Termux 執行爬蟲產出的結果檔，執行完會自動拉回左側專案清單，不需手動搬檔。',
      },
    ],
    crawlerSteps: [
      {
        title: '1. 開啟「爬蟲瀏覽器」登入或探測目標站',
        body: '手機點擊底部「瀏覽器」分頁、桌面在右側切換「爬蟲瀏覽器」。若在獨立 APK 內，點綠色「APK 原生瀏覽器登入抓 Cookie」即可繞過 iframe 封鎖並讀取 HttpOnly 認證 Cookie。',
      },
      {
        title: '2. 其他快速取 Cookie 方式（網頁 / Chrome）',
        body: '連上 Termux 後可用「Termux 探測」抓取 Set-Cookie；或切到「匯入 cURL / 標頭」，直接貼上 DevTools 的 Copy as cURL、Cookie 標頭，或複製內建 Chrome 書籤小工具回貼。',
      },
      {
        title: '3. 寫入 cookies.json 並一鍵生成爬蟲',
        body: '在 Cookie 分頁勾選需要的項目，點「寫入 cookies.json」或「產生 crawler_session.py」，再切換至 Termux 引擎執行，即可帶著登入態與 User-Agent 高速抓取資料。',
      },
    ],
    apkSteps: [
      {
        title: '1. 匯出 GitHub 獨立 APK 自動編譯專案',
        body: '前往「Android 部署」，設定 App 名稱與 Package ID，點選「匯出 GitHub 獨立 APK 專案（內嵌 Termux）」。解壓縮後將整個資料夾 Push 到 GitHub 倉庫。',
      },
      {
        title: '2. GitHub Actions 自動打包 ARM64 APK',
        body: '推送後進入倉庫的 Actions 頁籤，雲端會自動編譯前端（若有 package.json）、下載 Termux bootstrap-aarch64.zip 並產出單一 APK，於頁底 Artifacts 下載安裝。',
      },
      {
        title: '3. 手機開啟 APK 一鍵初始化爬蟲環境',
        body: '安裝後開啟 App（完全不需另外安裝外部 Termux App），進入「Termux 橋接」點擊「一鍵初始化 Python + 爬蟲環境」，系統會自動安裝 python、clang、libxml2 與 requests/bs4/lxml/httpx。',
      },
    ],
    faqs: [
      {
        q: '為什麼部分網站內嵌預覽顯示空白或拒絕連線？',
        a: '多數登入頁會設定 X-Frame-Options 禁止被 iframe 嵌入。請改用 APK 內的「APK 原生瀏覽器」、用「Termux 探測」，或在 Chrome 登入後用書籤小工具／Copy as cURL 匯入。',
      },
      {
        q: '為什麼在沙盒模式下跑 requests 抓外部網站會失敗？',
        a: '瀏覽器 WebAssembly 沙盒受限於跨域安全規範（CORS）。網路爬蟲請切換至「Termux 原生引擎」或使用打包後的獨立 APK 執行。',
      },
      {
        q: '為什麼手機執行正常，拿到電腦或 Termux 卻提示找不到 droid 模組？',
        a: 'import droid 是 Pyodide 沙盒專屬的瀏覽器硬體橋接。建議用 try: import droid / except ImportError: 包裝，或點擊下方「載入跨環境範例腳本」參考標準寫法。',
      },
      {
        q: '產出的資料檔與匯出的 ZIP 存在手機哪裡？',
        a: '在獨立 APK 中匯出 ZIP 會直接存到手機系統的「Downloads / 下載」資料夾；Termux 產出的 JSON/CSV 則會自動同步回 IDE 的專案清單中。',
      },
    ],
  },
  'zh-CN': {
    quickSteps: [
      {
        title: '1. 选择执行引擎（离线沙盒 vs. Termux 原生）',
        body: '终端上方可切换引擎：“沙盒 (Pyodide)”免配置可离线运行、支持 matplotlib 图表和 import droid；“Termux 原生”适合网络爬虫（无 CORS 限制）与原生 pip/pkg 包。',
      },
      {
        title: '2. 移动端高效编辑技巧',
        body: '编辑器底部提供 Android 快捷符号栏（可随时收起），工具栏支持一键格式化和 Python/JSON 实时语法检查；查看非 .py 文件时点运行会自动执行 main.py。',
      },
      {
        title: '3. 多格式文件与自动回传同步',
        body: '支持 .py、.json、.csv、.txt、requirements.txt。Termux 运行脚本新生成的数据文件，会在运行结束后自动拉回 IDE 工作区文件列表。',
      },
    ],
    crawlerSteps: [
      {
        title: '1. 打开“爬虫浏览器”登录或探测网页',
        body: '手机点击底部“浏览器”，桌面端切换右侧“爬虫浏览器”。在独立 APK 中点击“APK 原生浏览器登录抓 Cookie”，可绕过 iframe 拦截并直接读取 HttpOnly Cookie。',
      },
      {
        title: '2. 其他获取 Cookie 方式（cURL / 书签工具）',
        body: '连接 Termux 后可使用“Termux 探测”获取 Set-Cookie；也可在“导入 cURL / 请求头”中粘贴 DevTools Copy as cURL、Cookie 请求头或使用 Chrome 书签小工具。',
      },
      {
        title: '3. 写入 cookies.json 并一键生成脚本',
        body: '确认 Cookie 与 User-Agent 后点击“写入 cookies.json”或“生成 crawler_session.py”，切换至 Termux 原生引擎即可直接带登录态抓取。',
      },
    ],
    apkSteps: [
      {
        title: '1. 导出 GitHub 独立 APK 自动打包项目',
        body: '前往“Android 部署”，填写应用名称与 Package ID，点击“导出 GitHub 独立 APK 项目（内嵌 Termux）”。解压后推送到你的 GitHub 仓库。',
      },
      {
        title: '2. GitHub Actions 云端自动编译 APK',
        body: '推送后查看 GitHub Actions，工作流会自动构建离线前端、下载 Termux bootstrap-aarch64.zip 并编译出 ARM64 APK，在 Artifacts 下载安装即可。',
      },
      {
        title: '3. 打开 APK 一键初始化爬虫环境',
        body: '安装后无需额外安装外部 Termux App，打开 DroidPy 进入“Termux 桥接”，点击“一键初始化 Python + 爬虫环境”即可完成全部依赖安装。',
      },
    ],
    faqs: [
      {
        q: '为什么部分网站在预览框里显示空白？',
        a: '目标网站设置了 X-Frame-Options 禁止 iframe 嵌套。请改用“APK 原生浏览器”、“Termux 探测”或通过 cURL / Chrome 书签小工具导入 Cookie。',
      },
      {
        q: '为什么在沙盒模式爬外部网站会报跨域错？',
        a: '浏览器 WebAssembly 受 CORS 限制。请切换到“Termux 原生引擎”或导出安装独立 APK 执行爬虫脚本。',
      },
      {
        q: '如何让脚本在电脑和手机 APK 都能通用？',
        a: '使用相对路径读写文件，并用 try: import droid / except ImportError 做兼容判断，可点击下方按钮查看跨环境标准示例。',
      },
    ],
  },
  en: {
    quickSteps: [
      {
        title: '1. Pick Your Runtime (Pyodide Sandbox vs. Termux Native)',
        body: 'Switch engines above the console: Pyodide runs offline in WebAssembly with Matplotlib inline plots and import droid hardware APIs. Termux Native runs real ARM64 Python with zero CORS limits for web crawlers.',
      },
      {
        title: '2. Mobile Coding Shortcuts',
        body: 'Use the Android Quick-Symbol Bar below the editor (toggleable anytime), 1-tap code formatting, and live Python AST / JSON syntax linting. Pressing Run on a non-.py file falls back to main.py.',
      },
      {
        title: '3. Multi-File Workspace & Sync',
        body: 'Create .py, .json, .csv, .txt, and requirements.txt files. Files created by Termux scripts are automatically pulled back into the IDE workspace after execution finishes.',
      },
    ],
    crawlerSteps: [
      {
        title: '1. Open the Crawler Browser',
        body: 'Tap "Browser" on mobile or switch the right workspace pane on desktop. Inside the standalone APK, tap the Native Browser button to log in on any site and capture HttpOnly cookies via Android CookieManager.',
      },
      {
        title: '2. Alternative Cookie Capture (Termux Probe / cURL / Bookmarklet)',
        body: 'When Termux is connected, use "Probe via Termux" to inspect real HTTP status and Set-Cookie headers, or open the Import tab to paste Chrome DevTools "Copy as cURL" or use the Chrome Bookmarklet.',
      },
      {
        title: '3. Save cookies.json & Generate Scraper',
        body: 'Click "Save cookies.json" or "Create crawler_session.py" to generate a pre-configured requests.Session() scraper, then run it using the Termux Native engine.',
      },
    ],
    apkSteps: [
      {
        title: '1. Export the GitHub APK Project',
        body: 'Open Android APK, set App Name and Package ID, and export the GitHub Standalone APK zip. Push the extracted files to a GitHub repository.',
      },
      {
        title: '2. Automated Cloud Build via GitHub Actions',
        body: 'GitHub Actions automatically builds the web UI (if package.json exists), downloads Termux bootstrap-aarch64.zip, and outputs a ready-to-install ARM64 APK under workflow Artifacts.',
      },
      {
        title: '3. One-Tap Initialization on Android',
        body: 'No external Termux app required. Open the installed APK, go to Termux Bridge, and tap "Init Python + Crawler Stack" to install Python, clang, libxml2, requests, beautifulsoup4, lxml, and httpx.',
      },
    ],
    faqs: [
      {
        q: 'Why is a site blank inside the preview iframe?',
        a: 'Sites with X-Frame-Options block iframe embedding. Use the Native APK Browser, Termux Probe, or paste Copy as cURL / Bookmarklet output in the Import tab.',
      },
      {
        q: 'Why do external crawler requests fail in Pyodide Sandbox?',
        a: 'Browser WebAssembly is subject to CORS security policies. Switch the engine to Termux Native or run inside the exported Android APK.',
      },
      {
        q: 'Can the same Python script run on both PC and Android?',
        a: 'Yes! Use relative paths (e.g. Path("cookies.json")) and guard import droid with try/except ImportError. Load the cross-platform demo below to see the pattern.',
      },
    ],
  },
  ja: {
    quickSteps: [
      {
        title: '1. 実行エンジンを選択（Pyodide サンドボックス / Termux ネイティブ）',
        body: '端末上部で切替可能：Pyodide はオフライン対応・Matplotlib グラフ表示・import droid 利用可。Termux ネイティブは CORS 制限なしで本格的な Web クローラーを実行できます。',
      },
      {
        title: '2. モバイル向け入力支援',
        body: '記号バー（上部アイコンで折りたたみ可）、ワンタップ整形、Python AST / JSON リアルタイム構文チェックを搭載。データファイル表示中に実行すると自動で main.py を実行します。',
      },
      {
        title: '3. 複数ファイル対応と自動同期',
        body: '.py / .json / .csv / .txt / requirements.txt をサポート。Termux で生成された出力ファイルは実行後に自動でワークスペースへ同期されます。',
      },
    ],
    crawlerSteps: [
      {
        title: '1. クローラーブラウザでログイン・検証',
        body: 'モバイル下部「ブラウザ」またはデスクトップ右ペインから利用します。独立 APK 内ではネイティブ WebView でログインし、HttpOnly を含む Cookie を自動取得できます。',
      },
      {
        title: '2. Termux 検証・cURL 取込・ブックマークレット',
        body: 'Termux 接続時は Set-Cookie の直接検証が可能。「cURL / ヘッダー取込」タブでは DevTools の Copy as cURL や Chrome ブックマークレットも利用できます。',
      },
      {
        title: '3. cookies.json 保存とスクリプト生成',
        body: '「cookies.json に保存」や「crawler_session.py を生成」を押し、Termux ネイティブエンジンに切り替えて実行してください。',
      },
    ],
    apkSteps: [
      {
        title: '1. GitHub APK プロジェクトを書き出す',
        body: '「Android APK」タブからアプリ名と Package ID を指定して ZIP を書き出し、解凍して GitHub リポジトリへ Push します。',
      },
      {
        title: '2. GitHub Actions で自動ビルド',
        body: 'Actions が自動で Web UI のビルドと Termux bootstrap-aarch64.zip の組み込みを行い、ARM64 APK を Artifacts に出力します。',
      },
      {
        title: '3. 端末インストール後のワンタップ初期化',
        body: '外部 Termux アプリ不要で起動し、「Termux 連携」の「Python + クローラー環境を一括初期化」を押すだけで環境構築が完了します。',
      },
    ],
    faqs: [
      {
        q: 'プレビュー画面が真っ白になるサイトがあります',
        a: 'X-Frame-Options による iframe 制限が原因です。APK ネイティブブラウザ、Termux 検証、または cURL / ブックマークレット取込をご利用ください。',
      },
      {
        q: 'Pyodide で外部サイトへ requests すると失敗します',
        a: 'ブラウザの CORS 制約のためです。エンジンを Termux ネイティブへ切り替えるか、独立 APK 上で実行してください。',
      },
      {
        q: 'PC とスマホで同じスクリプトを共有できますか？',
        a: '相対パスを使い、import droid を try/except ImportError で囲むことで両環境でそのまま動作します。下のサンプルで確認できます。',
      },
    ],
  },
};

export const HelpTutorialModal: React.FC<HelpTutorialModalProps> = ({
  open,
  onClose,
  onInsertSampleFile,
  onNavigateBrowser,
  onNavigateAndroid,
  onNotify,
}) => {
  const { locale, t } = useI18n();
  const [tab, setTab] = useState<HelpTab>('quickstart');

  if (!open) return null;

  const content = GUIDE_TEXT[locale] ?? GUIDE_TEXT['zh-TW'];

  const handleLoadCrossDemo = () => {
    onInsertSampleFile('cross_env_demo.py', CROSS_ENV_DEMO_CODE);
    onNotify(t('help_toast_demo_loaded', { name: 'cross_env_demo.py' }));
    onClose();
  };

  const handleLoadCrawlerDemo = () => {
    onInsertSampleFile('crawler_cookie_starter.py', CRAWLER_STARTER_CODE);
    onNotify(t('help_toast_demo_loaded', { name: 'crawler_cookie_starter.py' }));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[var(--ide-surface)] border border-[var(--ide-border)] shadow-xl text-[var(--ide-text)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-[var(--ide-border)] rounded-full mx-auto mt-3 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--ide-border)] shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
              <span>{t('help_title')}</span>
            </h2>
            <p className="text-xs text-[var(--ide-text-muted)] mt-0.5">{t('help_subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('btn_done')}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl border border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="px-5 py-2.5 border-b border-[var(--ide-border)] bg-[var(--ide-surface-alt)] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {(
            [
              { id: 'quickstart', label: t('help_tab_quickstart'), Icon: Zap },
              { id: 'crawler', label: t('help_tab_crawler'), Icon: Globe },
              { id: 'apk', label: t('help_tab_apk'), Icon: Smartphone },
              { id: 'faq', label: t('help_tab_faq'), Icon: HelpCircle },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`min-h-[36px] px-3 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-[var(--ide-accent)] text-white'
                    : 'bg-[var(--ide-surface)] border border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Guide Body */}
        <div className="selectable-text flex-1 min-h-0 overflow-y-auto ide-scroll p-5 space-y-3 bg-[var(--ide-bg)]">
          {tab === 'quickstart' &&
            content.quickSteps.map((step, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-4 space-y-1.5"
              >
                <h3 className="text-sm font-semibold text-[var(--ide-text)]">{step.title}</h3>
                <p className="text-xs text-[var(--ide-text-muted)] leading-relaxed">{step.body}</p>
              </div>
            ))}

          {tab === 'crawler' &&
            content.crawlerSteps.map((step, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-4 space-y-1.5"
              >
                <h3 className="text-sm font-semibold text-[var(--ide-text)]">{step.title}</h3>
                <p className="text-xs text-[var(--ide-text-muted)] leading-relaxed">{step.body}</p>
              </div>
            ))}

          {tab === 'apk' &&
            content.apkSteps.map((step, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-4 space-y-1.5"
              >
                <h3 className="text-sm font-semibold text-[var(--ide-text)]">{step.title}</h3>
                <p className="text-xs text-[var(--ide-text-muted)] leading-relaxed">{step.body}</p>
              </div>
            ))}

          {tab === 'faq' &&
            content.faqs.map((item, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-4 space-y-1.5"
              >
                <h3 className="text-sm font-semibold text-[var(--ide-accent-text)]">{item.q}</h3>
                <p className="text-xs text-[var(--ide-text-muted)] leading-relaxed">{item.a}</p>
              </div>
            ))}
        </div>

        {/* Interactive Footer Actions */}
        <div className="px-5 py-3.5 border-t border-[var(--ide-border)] bg-[var(--ide-surface)] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {tab === 'crawler' ? (
              <>
                <button
                  type="button"
                  onClick={handleLoadCrawlerDemo}
                  className="min-h-[38px] px-3.5 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{t('help_insert_crawler_demo')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateBrowser();
                    onClose();
                  }}
                  className="min-h-[38px] px-3.5 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-accent)] text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span>{t('help_go_browser')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : tab === 'apk' ? (
              <button
                type="button"
                onClick={() => {
                  onNavigateAndroid();
                  onClose();
                }}
                className="min-h-[38px] px-3.5 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <span>{t('help_go_android')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLoadCrossDemo}
                className="min-h-[38px] px-3.5 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{t('help_insert_cross_demo')}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] px-4 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-xs font-medium hover:border-[var(--ide-accent)] whitespace-nowrap"
          >
            {t('btn_done')}
          </button>
        </div>
      </div>
    </div>
  );
};

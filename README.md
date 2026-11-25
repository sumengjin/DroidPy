# DroidPy — Android-First Python IDE, Pyodide 3.12, Termux Bridge & Standalone Crawler APK

**DroidPy** 是一套以 Android 手機為優先的 Python 開發環境，結合離線 Pyodide、原生 Termux 執行引擎、互動式終端機、檔案管理、爬蟲瀏覽器與 Cookie 工作台，並透過 GitHub Actions 自動建置及發布 ARM64 Android APK。

無須依賴電腦即可在手機上編寫、執行及管理 Python 專案。Pyodide 與 Termux 是兩個不同的執行環境：前者固定使用 Python 3.12 WebAssembly，適合離線純 Python 與支援的科學運算套件；後者的 Python 版本由內嵌 Termux Bootstrap 提供，並可使用 Android/Linux 原生套件、網路工具及系統命令。可攜式程式碼可盡量共用，但兩邊安裝的套件不會自動互通。

> **English Summary**: DroidPy is an Android-first Python IDE featuring an offline Pyodide sandbox, native Termux runtime, interactive terminal, project file management, a native crawler browser with Android CookieManager capture, and automated ARM64 APK builds and GitHub Releases.

---

## 核心特色與架構

### 1. 雙執行引擎架構（可隨時一鍵切換）
| 引擎模式 | 適用場景 | 執行能力與特點 |
| :--- | :--- | :--- |
| **Pyodide 離線沙盒** | 離線演算、純 Python、科學繪圖 | 內建 Python 3.12 WebAssembly 核心，支援 `numpy`、`pandas`、`matplotlib`（圖表直出終端機）、`scipy`、`import droid` 手機硬體橋接；支援 Service Worker 全離線快取。 |
| **Termux 原生引擎** | 網路爬蟲、原生 C/C++ 套件、`ffmpeg` | 透過 `127.0.0.1:8765` PTY 串流橋接真實 ARM64 Linux/Python 環境，**無瀏覽器 CORS 限制**，可直接執行 `requests`、`beautifulsoup4`、`lxml`、`httpx`、`yt-dlp`、`clang`。 |
| **獨立 APK 內建環境** | 免裝外部 Termux App、一裝即用 | 匯出的 GitHub 專案內含 `EmbeddedTermuxBridge.kt` 與 `bootstrap-aarch64.zip`，打開 App 自動啟動本地 Python/Termux 橋接並支援一鍵初始化爬蟲環境。 |

### 2. 爬蟲瀏覽器與 Cookie 工作台（Crawler Browser）
- **APK 原生登入瀏覽器**：獨立 APK 使用隔離的 Android `WebView` 開啟網站，登入後可透過原生 **「擷取 Cookie」** 按鈕讀取該網址可供 HTTP 請求使用的 Cookie（包含 `HttpOnly` Cookie），並同步回 IDE 工作階段及 `cookies.json`。原生 JavaScript Bridge 僅保留在受信任的 IDE WebView，不注入第三方網站，避免登入頁取得 App 私有操作權限。
- **Cookie 擷取回饋與診斷**：擷取成功、目前網址沒有 Cookie、網址無效或寫入失敗時均提供明確提示；原生執行日誌記錄擷取流程與結果，但不記錄 Cookie 值或登入憑證。
- **Termux 原生請求探測（`POST /probe-url`）**：從手機原生網路層直接測試目標網址，檢查 HTTP 狀態碼、最終跳轉網址、`Set-Cookie` 與 HTML 預覽。
- **cURL / Header / 書籤小工具匯入**：支援貼上 Chrome DevTools `Copy as cURL`、原始 `Cookie:` 標頭、JSON、Netscape `cookies.txt` 或手機 Chrome Bookmarklet 結果，一鍵產生可直接執行的 `crawler_session.py`。

### 3. 專為手機觸控設計的編輯體驗
- **CodeMirror 6 編輯器**：支援 Python 語法高亮與即時 AST 語法檢查（`@codemirror/lint`）、JSON 結構高亮驗證、單鍵程式碼排版、搜尋與取代。
- **Android 快捷符號列**：快速輸入縮排、`()`、`[]`、`{}`、`:`、`=`、`->` 與游標微調，並可於頂部工具列隨時收合。
- **雙向檔案同步與多副檔名**：支援 `.py`、`.json`、`.csv`、`.txt`、`.md`、`requirements.txt` 等格式；Termux 腳本執行結束後自動將產出檔（如 `quotes_output.json`）拉回 IDE 工作區。
- **多主題與多語言**：內建 10 套高對比主題（含柔粉系與經典暗色/亮色）與 **繁體中文 / 简体中文 / English / 日本語** 4 國語言即時切換。

---

## 本機開發與建置（Web / PWA）

### 環境需求
- Node.js 18+（建議 20 LTS）

### 啟動與編譯指令
```bash
# 1. 安裝相依套件
npm install --legacy-peer-deps

# 2. 啟動開發伺服器 (預設連接埠 3000)
npm run dev

# 3. TypeScript 型別檢查
npm run lint

# 4. 建置正式版靜態檔 (輸出至 dist/)
npm run build
```

---

## 打包為獨立 Android APK（GitHub Actions 自動編譯）

不需在本機安裝 Android Studio，只要直接將本倉庫推送至 GitHub（或於 DroidPy 匯出獨立 ZIP），即可由 GitHub Actions 自動產出可安裝與發佈的 ARM64 APK：

### 方式一：本倉庫直接推送自動化（`.github/workflows/droidpy.yml`）
1. 直接 Push 至 `main` / `master` 分支（或進入 GitHub **Actions** 手動觸發 `DroidPy CI / APK / Release`）。
2. 工作流程會依序完成：**測試與網頁建置** → **打包 Android APK (ARM64)**（自動呼叫 `scripts/prepare-android.ts` 產生 `android/` 並嵌入離線 `dist/` 與 Termux `bootstrap-aarch64.zip`）→ **建立 GitHub Release**，全程三項工作自動執行不跳過。
3. 若未另外推送 `v*` 標籤或填寫 `release_tag`，第 3 階段會自動讀取 `CHANGELOG.md` 最新版本號（例如 `v1.2.2`）直接建立或更新對應的 GitHub Release 並附加 `DroidPy-arm64-*.apk`。

### 方式二：從 App 內客製包名匯出獨立專案
1. 在 DroidPy 切換至 **「Android 部署」** 分頁，填寫應用程式名稱與 `Package ID`（例如 `org.droidpy.app`）。
2. 點擊 **「匯出 GitHub 獨立 APK 專案（內嵌 Termux）」** 下載專案 ZIP。
3. 解壓縮並將全部檔案（包含 `.github/workflows/build-apk.yml`、`android/` 與 `CHANGELOG.md`）上傳／Push 到獨立 GitHub 倉庫 `main` 分支即可自動編譯。

### 首次安裝 APK 後初始化爬蟲環境
1. 開啟安裝好的 DroidPy APK（會自動偵測並切換至內建原生引擎）。
2. 前往 **「Termux 橋接」**，點擊 **「一鍵初始化 Python + 爬蟲環境」**，系統會自動執行：
   ```bash
   pkg update -y && pkg install -y python python-pip python-lxml libxml2 libxslt clang && pip install --no-cache-dir requests beautifulsoup4 httpx
   ```
3. 接著即可直接使用 **「爬蟲瀏覽器」** 登入網站抓 Cookie，或在終端執行任意爬蟲腳本。

---

## Termux 套件安裝注意事項

- **大型原生套件優先使用 Termux 預編譯套件**：例如 `python-lxml`、`python-numpy`、`python-pandas` 與 `matplotlib`。不要為了安裝這些套件而讓 pip 在 Android 上長時間從原始碼編譯。
- **Parsel** 是純 Python 套件，但它仍依賴 `lxml`。在 Termux 先執行 `pkg install -y python-lxml`，再安裝 Parsel：
  ```bash
python -m pip install --no-cache-dir --index-url https://pypi.org/simple parsel==1.12.1
```
  Parsel 官方相依套件為 `cssselect`、`jmespath`、`lxml` 與 `w3lib`；`frostwork` 並非 Parsel 的官方相依套件。若安裝時出現 Frostwork，請先停止並檢查 pip 套件索引／鏡像設定，不要把它當成 Parsel 必要依賴。
- **`metadata` 不等於 Python 標準庫的套件中繼資料 API**：Python 3.8+ 已內建 `importlib.metadata`，可直接 `from importlib import metadata`，一般不需要執行 `pip install metadata`。若某個第三方程式真的要求同名套件，應先確認其文件與用途。

---

## 外部 Termux 手動橋接（選用）

如果你習慣使用獨立的 Termux App，也可以在 DroidPy 的 **「Termux 橋接」** 分頁複製單行啟動指令，貼入手機 Termux App 執行：
- 自動安裝 Python 並寫入 `~/droidpy_bridge.py`（監聽 `http://127.0.0.1:8765`）。
- 支援即時 PTY 串流輸出、`stdin` 互動輸入、`/probe-url` 無 CORS 探測與工作區檔案雙向同步。

---

## 跨平台腳本撰寫建議（電腦 & 手機共用同一份程式碼）

- **檔案路徑**：請使用相對於工作區的寫法（例如 `Path("cookies.json")`、`open("output.json", "w")`），避免寫死 `C:\...` 或手機絕對路徑。
- **相容 `import droid`**：`droid` 為瀏覽器 Pyodide 沙盒專有硬體橋接模組；若同一支腳本需同時在電腦與 APK/Termux 執行，建議加上相容判斷：

```python
import os
import sys

IS_PYODIDE = sys.platform == "emscripten"
try:
    import droid
    HAS_DROID = True
except ImportError:
    HAS_DROID = False
```

---

## 主要專案目錄結構

```text
├── src/
│   ├── App.tsx                       # 主工作區、桌面/手機雙佈局、雙引擎狀態管理
│   ├── components/
│   │   ├── CodeEditor.tsx            # CodeMirror 6 編輯器（Python AST & JSON Linting、格式化）
│   │   ├── CrawlerBrowserPanel.tsx   # 爬蟲瀏覽器、Cookie 工作台、cURL 解析與書籤工具
│   │   ├── FileExplorer.tsx          # 多副檔名專案檔案總管與 ZIP 匯出/匯入
│   │   ├── HelpTutorialModal.tsx     # 應用內建多語系使用說明與互動教學
│   │   ├── TerminalPanel.tsx         # 即時串流終端機、REPL、Matplotlib 圖表預覽
│   │   ├── TermuxIntegrationPanel.tsx# Termux / 內嵌 APK 引擎控制與一鍵初始化
│   │   └── ToolsAndPackages.tsx      # PyPI 套件管理、requirements.txt、Android 部署匯出
│   ├── services/
│   │   ├── androidApkBuilder.ts      # GitHub Actions + Kotlin WebView + 內嵌 Termux 產生器
│   │   ├── i18n.tsx                  # 繁體中文 / 簡體中文 / English / 日本語字典
│   │   ├── pyodideRuntime.ts         # Pyodide 3.12 WebAssembly 執行核心與 droid 模組
│   │   ├── termuxBridge.ts           # Termux PTY 橋接腳本與 HTTP/NDJSON API 客戶端
│   │   └── themes.ts                 # 10 套編輯器與介面配色主題
│   └── utils/
│       └── crawlerSession.ts         # Cookie / cURL / Netscape 解析與爬蟲程式碼產生器
├── public/                           # PWA 圖示與靜態資源
└── package.json
```

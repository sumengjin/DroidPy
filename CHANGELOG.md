# Changelog / 更新日誌

All notable changes to **DroidPy** are documented in this file.

## [1.2.2] - 2026-11-21

### Fixed (GitHub Release Automation)
- **修復推送分支時「建立 GitHub Release」被跳過問題**：更新 `.github/workflows/droidpy.yml`，於一般 Push 至 `main`/`master` 或手動觸發（未填 `release_tag`）時自動讀取 `CHANGELOG.md` 最新版本號（如 `v1.2.2`），直接建立或覆寫更新對應的 GitHub Release 與 APK 附件，不再跳過第三階段工作。

---

## [1.2.1] - 2026-11-21

### Fixed (GitHub Actions CI & Auto Android APK Build)
- **修復 GitHub Actions 工作流程被跳過問題**：整合並更新 `.github/workflows/droidpy.yml`，移除依賴不存在 `buildozer.spec` 的跳過條件；新增 `scripts/prepare-android.ts` 於雲端 Runner 自動由 `src/services/androidApkBuilder.ts` 產生完整 `android/` Gradle + Kotlin + 內嵌 Termux 專案，即使倉庫尚未手動匯出 `android/` 資料夾也能於每次 Push / 手動觸發執行測試、網頁建置與 ARM64 APK 打包（不再被跳過）。
- **修復 `npm ci` `ERESOLVE` 相依性衝突**：針對 `vite@8` 與 `esbuild@0.25` 的 `peerOptional` 版本差異，於 CI 與匯出流程加入 `--legacy-peer-deps` 安全退回。
- **支援手動觸發發布 Release**：`droidpy.yml` 新增 `workflow_dispatch` 的 `release_tag` 選填輸入，除推送 `v*` 標籤自動發布外，也可直接從 GitHub Actions 手動觸發打包並建立 Release。

---

## [1.2.0] - 2026-11-21

### Fixed (Mobile Execution & Standalone APK)
- **修復內嵌 APK `pkg` / `pip` 跨包名路徑相容性**：在 `EmbeddedTermuxBridge.kt` 加入 `$HOME/.droidpy_bin` 前綴轉接層（`pkg` / `pip` / `pip3` Wrapper），自動將 Termux Bootstrap 套件（`python`、`clang`、`libxml2`、`libxslt`、`ffmpeg`）安全重定位至獨立 App 的 `$PREFIX` 私有目錄並修正 Script Shebang 與 SSL 憑證變數（`SSL_CERT_FILE` / `PIP_CERT` / `REQUESTS_CA_BUNDLE`）。
- **修復 Kotlin 編譯模板字面量跳脫錯誤**：修正 `EmbeddedTermuxBridge.kt` `/run-stream` 中 `\$PREFIX` 未解析參考問題，並改以 `exec python -u` 啟動，確保點擊「停止」時可立即終止 Python 子程序、不留孤兒進程。
- **修復手機虛擬鍵盤與底部導覽列遮擋問題**：於 `index.html` 加入 `interactive-widget=resizes-content`，並在 `MainActivity.kt` 啟用 `windowSoftInputMode="adjustResize"`、將手機版底部導覽列改為彈性排版（非懸浮覆蓋），確保開啟鍵盤時符號列與 REPL 輸入框始終完整可見。
- **修復 Pyodide 行動端執行細節**：
  - 修復首次執行 `matplotlib` 腳本時 `plt.show()` 尚未被攔截導致首跑不出圖的問題。
  - 優雅處理 `sys.exit()`，避免正常結束碼 `0` 被誤報為紅色錯誤訊息。
  - 支援在互動式 REPL 直接執行頂層 `await` 表達式（如 `await droid.battery()`）。
  - 離線開啟 APK（已啟用內嵌 Termux 引擎）時不於背景強行拉取 Pyodide CDN 而顯示紅字連線錯誤。
- **修復 Termux 橋接多套件安裝解析**：`droidpy_bridge.py` 改用 `shlex.split` 拆分套件名稱，修復從 `requirements.txt` 一次安裝多個套件時失敗的問題。
- **修復 Android WebView 外部連結處理**：`MainActivity.kt` 攔截 `termux://`、`intent://` 等外部協定並轉交系統開啟，避免產生 `ERR_UNKNOWN_URL_SCHEME`。

### Fixed (GitHub Actions APK Build & Release)
- **修復 `.github/workflows/build-apk.yml` 標籤發佈失效問題**：於 `on.push` 補齊 `tags: [ 'v*' ]`，確保推送版本標籤（如 `v1.2.0`）時能正確觸發自動打包與 GitHub Releases 發佈。
- **指定相容 Gradle 版本與彈性依賴安裝**：於 `gradle/actions/setup-gradle@v4` 明確指定 `gradle-version: '8.7'`（符合 AGP 8.5.2 需求），並將 `npm ci` 改為自動判斷 `package-lock.json` 存在與否後退回 `npm install`，相容使用 `bun.lock` 的倉庫。
- **自動帶入更新日誌**：GitHub Release 步驟自動附加 `CHANGELOG.md` 作為發佈說明並啟用自動產出 Release Notes。

---

## [1.1.0] - 2026-11-20

### Added & Fixed
- **新增爬蟲瀏覽器與 Cookie 工作台（Crawler Browser）**：整合網頁預覽、Termux 原生 `/probe-url` 無 CORS 探測、cURL / HTTP Header / Netscape `cookies.txt` / JSON / 手機 Chrome 書籤小工具匯入，以及原生 APK `WebView` + `CookieManager`（可讀含 `HttpOnly` Cookie）自動同步 `cookies.json`。
- **新增多語系應用內教學說明（Help & Tutorial）**：內建繁體中文 / 簡體中文 / English / 日本語 4 語互動教學與一鍵載入範例腳本。
- **修復獨立 APK 離線資源載入**：透過 `EmbeddedTermuxBridge.kt` 在 `http://127.0.0.1:8765/` 供應 `assets/www/` 靜態資產，解決 `file://` 下的 ES Module CORS 與 `/assets/` 404 白畫面。
- **修復 Android WebView 檔案下載檔名**：透過 `downloadBlob` / `DroidPyNative.saveBase64File` 將匯出之 ZIP、腳本與圖表 PNG 以原始檔名寫入系統 Downloads 資料夾。
- **擴充本機資料夾同步支援**：支援同步 `.py`、`.json`、`.csv`、`.txt`、`.md`、`requirements.txt` 等所有工作區純文字檔案。

---

## [1.0.0] - 2026-11-18

### Initial Release
- **雙引擎行動 Python 3.12 IDE**：結合 Pyodide WebAssembly 離線沙盒（支援 `numpy`、`pandas`、`matplotlib`、`import droid` 硬體橋接）與 Termux PTY 原生串流橋接。
- **Android 觸控優化**：CodeMirror 6 語法高亮與即時檢查、可收合觸控快捷符號列、10 套主題配色與 4 國介面語言。
- **GitHub 獨立 APK 自動打包器**：一鍵匯出包含 `.github/workflows/build-apk.yml`、Kotlin `WebView` 與內嵌 Termux Bootstrap 的 Android 專案。

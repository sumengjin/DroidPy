# DroidPy 語言無關核心與多語言擴充架構

> 狀態：Architecture RFC v0.1（設計基線，尚未改動執行流程）
> 分支：`architecture/language-neutral-core`
> 本文件先定義方向與遷移約束；任何 API 落地前，必須先以現有外部 Termux Bridge 與 APK 內嵌 Bridge 做相容性測試。

## 1. 目標與非目標

DroidPy 不應被目前的 TypeScript／React 技術選型限制未來功能、執行環境或原生能力。TypeScript 可以繼續負責現有 Web UI，但它不是產品核心，也不是唯一允許的實作語言。

這裡有兩個不同的「多語言」維度，必須分開設計：

1. **產品實作語言自由**：UI、Android 平台服務、執行引擎、效能模組可以使用最適合的語言。現階段 React／TypeScript、Kotlin、Python 並存；未來可按需要加入 Rust、C／C++ 或其他語言。
2. **使用者程式語言擴充**：Python 是 DroidPy 的首要使用者語言與既有核心體驗。架構應允許日後加入其他語言執行器，但不代表現在就承諾所有語言都能執行，也不應為了抽象化而削弱 Python。

**核心目標：** UI、執行器、Android 能力與套件管理透過穩定、版本化、語言中立的契約溝通。替換 UI 框架或新增一種實作語言，不應迫使整個 Python 執行環境重寫。

**本階段非目標：**
- 不立即重寫 React／TypeScript、Kotlin 或 Python。
- 不把所有功能搬進 Python，也不讓 Kotlin 變成新的單一限制。
- 不改變既有 Python／Pyodide／Termux 的使用者行為。
- 不同時改動套件來源政策、簽名金鑰、Bootstrap 或儲存格式。
- 不把「支援某語言」等同於「該語言所有套件都能在 Android 安裝」。

## 2. 現況基線（已由程式碼確認）

### 2.1 前端與應用協調

- `src/App.tsx` 約 3,500 行，負責主要畫面、應用狀態、執行器切換、Termux 操作、套件流程、檔案同步、儲存權限與原生橋接調用。
- React 元件位於 `src/components/`；服務位於 `src/services/`；共享型別集中在 `src/types/ide.ts`。
- `src/main.tsx` 直接掛載 React App；Vite／PWA 是目前 Web UI 的建置與交付方式。
- 目前服務介面多為 TypeScript 函式與全域 `window.DroidPyNative`，不是可由其他語言直接重用的獨立核心 API。

### 2.2 Python 執行環境

目前至少有兩種不同執行器，不能假設其能力與套件環境相同：

- **Pyodide**：`src/services/pyodideRuntime.ts`，Python 3.12 WebAssembly，使用瀏覽器記憶體檔案系統與 micropip；另有 `droid` 裝置功能橋接。
- **Termux CPython**：由 `src/services/termuxBridge.ts` 產生 Python HTTP 服務，執行原生 ARM64 Python、shell、PTY 與 APT／pip 套件操作。

兩個執行器應被視為不同的 Runtime Provider。它們可實作共同的基本能力，但各自的能力、限制、套件索引、ABI 與檔案可見範圍必須明確回報，不可假裝完全相同。

### 2.3 Android 原生層

- Kotlin 原生程式碼目前主要由 `src/services/androidApkBuilder.ts` 產生，包含 Gradle、Manifest、MainActivity、WebView、Cookie 擷取與內嵌 Termux Bridge。
- `DroidPyNative` 是 WebView 到 Kotlin 的特權入口；其能力包括原生 App 識別、Bridge 連線資訊、狀態持久化、儲存權限、瀏覽器、剪貼簿、檔案輸出與 APK 更新。
- 內嵌 Kotlin Bridge 以本機 Socket Server 提供 HTTP API；外部 Termux Bridge 則以 Python HTTP Server 提供相近 API。兩份實作需要同一份契約與共用測試。

### 2.4 現有 Bridge 事實

- 外部 Termux Bridge 的預設端點是 `http://127.0.0.1:8765`。
- APK 穩定版使用 8765；Beta 套件使用 8766，以避免與穩定版爭用連接埠。原生端會把實際端點提供給 Web UI。
- 現有路由涵蓋健康狀態、執行 Python、shell、套件安裝、PTY 串流、stdin、停止／暫停／繼續、工作區檔案、URL 探測、備份、儲存與 SD 卡操作等。
- 現有串流採用 NDJSON，事件主要以 `type` 與 `data` 傳遞；非串流請求主要回傳 JSON。
- 兩個 Bridge 已有權杖、來源／Host 驗證、請求大小限制及連線資源保護。任何新協定都必須保留這些安全條件，不能為了簡化而退回通配 CORS 或無認證 localhost API。

## 3. 目標分層

| 層 | 職責 | 可採用的實作語言 | 不應依賴 |
|---|---|---|---|
| Presentation | 編輯器、終端、套件中心、檔案、瀏覽器與無障礙 UI | TypeScript／React，未來可替換 | Kotlin 私有類別、Python 內部模組 |
| Application Facade | 工作階段、命令調度、狀態協調、錯誤呈現 | 任意合適語言 | 特定 UI 框架 |
| Runtime Providers | Pyodide、Termux CPython，以及未來其他語言執行器 | Python、Rust、C/C++、Java/Kotlin 等 | React 元件 |
| Platform Services | Android 權限、檔案、Cookie、背景工作、通知、硬體能力 | Kotlin／Java；必要時 JNI | Web UI 狀態 |
| Shared Contracts | 命令、事件、資料模型、錯誤、能力宣告與版本 | JSON／JSON Schema 等語言中立格式 | 任一語言專屬型別 |
| Native Extensions | 高效能運算、系統函式庫、原生套件 | Rust／C／C++ 等 | UI 直接呼叫原生細節 |

分層是責任邊界，不是要求每一層都必須拆成獨立程序或網路服務。初期可以仍在同一 APK、同一程序內，以模組與介面隔離；只有在有明確收益時才拆程序。

## 4. 語言中立契約（提案）

### 4.1 訊息信封

新版本 API 建議採用明確的版本與請求識別欄位：

- `protocolVersion`：契約主／次版本。
- `requestId`：每次請求唯一識別，用於關聯回應、串流事件與取消。
- `method`：穩定的能力名稱，不以 TypeScript 函式名或 Kotlin 類別名作為 API。
- `params`：JSON 物件，欄位定義需有 schema。
- 回應統一包含 `protocolVersion`、`requestId`、`ok`，成功使用 `result`，失敗使用結構化 `error`（至少含 `code`、安全可顯示的 `message`，可選 `retryable` 與診斷細節）。

以上是新契約的設計方向，不是聲稱目前舊 API 已採用此格式。現有路由與欄位先保留，由相容層轉接。

### 4.2 串流事件

長時間執行、終端輸出與安裝進度採 NDJSON 或等價的事件串流。每個事件至少能關聯 `requestId` 與遞增序號；事件類型需涵蓋 stdout、stderr、progress、input-required、process-state、completed、failed、cancelled。

客戶端斷線不應默認等於停止使用者程序。停止、暫停、繼續與取消必須是明確且經授權的控制命令。串流結束、程序結束與 Bridge 生命週期必須是不同狀態。

### 4.3 能力探索

Runtime／Platform Provider 應回報能力，而不是讓 UI 依賴硬編碼的實作名稱。能力資訊至少包括：

- Provider ID、版本、執行語言與語言版本。
- 作業系統、CPU 架構、ABI 與執行模式（WebAssembly／原生）。
- 可用功能：執行檔案、互動式 stdin、PTY、套件安裝、原生擴充、檔案存取、網路、圖表、暫停／停止等。
- 限制與缺失原因，例如 Python ABI 不相容、缺少 Android ARM64 預編譯套件、不可用的權限。

新能力探索端點應採版本化路徑或明確協商；既有 `/health` 暫時維持原狀。

### 4.4 安全與相容性

- 只允許受信任的本機呼叫來源；保留隨機權杖、Host／Origin 驗證、大小限制、逾時與有界工作佇列。
- 權杖、Cookie、使用者輸入與敏感路徑不得進入一般日誌。
- 新欄位採向後相容的可選擴充；移除或改名必須升主版本。
- 未知能力或未知事件應安全忽略，不得讓舊 UI 崩潰。
- 契約 schema、範例請求／回應與錯誤碼應放在版本控制中，並由 CI 驗證。

## 5. Runtime Provider 設計

先定義最小共同介面，再保留每個引擎的擴充能力：

- `initialize`：初始化與健康狀態。
- `getCapabilities`：回報語言、版本、平台與能力。
- `run`：執行指定工作區中的程式。
- `sendInput`：向互動程序送入標準輸入（若支援）。
- `controlProcess`：停止／暫停／繼續（逐項宣告支援情況）。
- `installPackage`／`removePackage`：套件操作，必須同時回報套件管理器與來源。
- `listPackages`：清單及盤點完整度。
- `syncWorkspace`：以明確檔案清單和相對路徑同步資料。

這些是概念能力，不要求所有 Provider 都實作全部方法。缺少能力必須回報「不支援」，不能用空成功回應掩蓋。

未來新增語言執行器時，應透過 Provider 註冊與語言描述資料接入；不得要求 UI 為每種語言複製一整套畫面。語言描述可包括 ID、顯示名稱、檔案副檔名、執行入口、除錯能力、套件管理器與環境需求。真正的執行與套件安裝仍由對應 Provider 負責。

## 6. 遷移順序

### Phase 0 — 架構基線（本文件）
- 記錄目前 UI、Pyodide、Termux、Kotlin 與 Bridge 的真實邊界。
- 明確區分產品實作語言自由與使用者執行語言擴充。
- 不改動現有執行流程。

### Phase 1 — 契約與相容性測試
- 抽取外部 Python Bridge 與內嵌 Kotlin Bridge 的路由、請求欄位、回應欄位、錯誤碼及串流事件。
- 建立一份共同 schema／fixture，讓兩種實作接受相同測試。
- 對現有行為建立 characterization tests，先測出差異，不先假設兩者完全一致。
- 驗證穩定版 8765、Beta 8766、外部 Termux 8765 的連線與權杖隔離。

### Phase 2 — 相容 API v1
- 在兩個 Bridge 中加入版本協商／能力探索與統一錯誤格式。
- 舊路由保留為相容層，舊版 UI 可繼續運作。
- 新 UI 先讀取能力宣告，再選擇可用功能。

### Phase 3 — 解耦前端
- 把 `App.tsx` 中的執行器、套件、檔案、平台與 Bridge 調度移至獨立 Application Facade／Domain Services。
- React 元件只呈現狀態與發送使用者意圖，不直接拼裝 HTTP 路由或了解 Kotlin 細節。
- 保持現有儲存資料格式與使用者工作區向後相容。

### Phase 4 — 擴充語言與原生能力
- 依真實需求新增其他 Runtime Provider。
- 對效能或 Android 系統整合需求，再選擇 Rust／C/C++／JNI 等實作。
- 任何新語言都必須遵守共同契約與測試，不要求 TypeScript 成為中介語言。

## 7. 不可破壞的產品約束

1. Python 仍是第一優先；Pyodide 與 Termux 的差異必須如實呈現。
2. Termux 官方 APT／已驗證的 TUR 預編譯套件優先；PyPI 保留預設索引。PyPI 套件必須另驗證 Android ARM64、Python 版本與 ABI／wheel 相容性。
3. 不在 Android 上盲目啟動大型原生原始碼編譯；沒有驗證過的預編譯方案就明確拒絕或標示不支援。
4. 不破壞 Android 10+ 私有路徑、Termux `usr/`、`py_user/`、工作區、套件清單與備份。
5. 不更換既有正式簽名金鑰，不以架構重構為理由改變簽名或發布流程。
6. PR #52／#53 的既有裝置驗收與 Draft 狀態獨立處理；本架構工作不能擅自合併它們。
7. 每階段必須有 CI、相容性測試、CHANGELOG（若改變產品行為）與可回退路徑。

## 8. 第一個實作交付物的驗收條件

Phase 1 完成前，不進行大規模重構。至少要有：

- 外部 Python Bridge 與內嵌 Kotlin Bridge 的端點／方法矩陣。
- 兩邊請求與回應的共同 fixture。
- 成功、驗證失敗、無效參數、逾時、串流中斷、明確停止等測試。
- 穩定版／Beta 連接埠與權杖隔離測試。
- 一份差異報告，列出目前無法完全共用的能力及理由。

只有上述測試通過，才開始把現有 UI 呼叫遷移到新 Facade。
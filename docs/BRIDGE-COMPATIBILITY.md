# Bridge 相容性盤點（Phase 1）

> 盤點基準：`architecture/language-neutral-core`，2026-11-27
> 狀態：靜態程式碼盤點 v0.1；尚未加入新協定或修改現有 Bridge 行為。
> 對照來源：`src/services/termuxBridge.ts`、`src/services/androidApkBuilder.ts`（其中產生 `EmbeddedTermuxBridge` Kotlin 原始碼）。

## 1. 實作位置與運行方式

| 項目 | 外部 Termux | APK 內嵌環境 |
|---|---|---|
| 實作語言 | Python | Kotlin |
| Server | `ThreadingHTTPServer` 衍生類別 | `ServerSocket` + 有界 `ThreadPoolExecutor` |
| 預設端點 | `127.0.0.1:8765` | 穩定版 8765；Beta 8766 |
| Token | 由 App 產生並經啟動命令傳入 Python Bridge | Android 私有目錄保存的每安裝隨機 token |
| 工作目錄 | `~/droidpy_workspace` | App 私有 Termux workspace |
| 串流 | HTTP NDJSON | HTTP NDJSON |
| 來源 | `src/services/termuxBridge.ts` | `src/services/androidApkBuilder.ts` 產生 Kotlin |

兩個實作並不是同一份程式碼的不同語言版本。它們共用部分路由名稱與使用者體驗，但功能集合、資料來源和內部程序管理方式有差異。

## 2. 外部 Python Bridge 目前路由

| 方法 | 路徑 | 用途 | 回應形式 |
|---|---|---|---|
| GET | `/health` | Python 版本、架構、工具與 pip／APT 套件盤點 | JSON |
| GET | `/files` | 讀取工作區允許副檔名的小型檔案 | JSON |
| POST | `/run` | 同步執行 Python 檔案 | JSON |
| POST | `/run-stream` | PTY Python 執行與輸出 | NDJSON |
| POST | `/shell` | 同步執行 shell 命令 | JSON |
| POST | `/shell-stream` | PTY shell 輸出 | NDJSON |
| POST | `/install` | pip／pkg 安裝 | JSON |
| POST | `/install-stream` | pip／pkg 安裝串流 | NDJSON |
| POST | `/stdin` | 對作用中的 PTY 傳送輸入 | JSON |
| POST | `/stop` | 明確停止作用中的程序 | JSON |
| POST | `/pause`、`/resume` | 暫停／繼續作用中的程序 | JSON |
| POST | `/probe-url` | 受安全限制的 URL 探測 | JSON |
| POST | `/maintenance/cleanup-processes` | 程序清理診斷／維護 | JSON |
| OPTIONS | 預檢 | 限制方法、來源與允許標頭 | HTTP 204 |

Python Bridge 的串流事件目前主要為 `{"type":"stdout","data":"..."}` 與結束事件 `{"type":"done","exitCode":...,"durationMs":...}`。PTY 將 stdout／stderr 合併，因此事件類型不能被誤解為完整保留原始 stdout／stderr 分流。

## 3. APK 內嵌 Kotlin Bridge 目前能力

Kotlin 路由集合除健康檢查、工作區檔案、執行／shell／安裝串流、stdin、停止／暫停／繼續及 URL 探測外，還包括：

| 方法 | 路徑 | 能力 |
|---|---|---|
| GET | `/backup/status` | 套件備份與盤點完整度 |
| POST | `/backup/restore` | 依備份還原原生與 pip 套件 |
| GET | `/logs` | 讀取 App 原生日誌與受限 logcat |
| POST | `/logs/clear` | 清理原生日誌 |
| GET | `/storage/app-usage` | App 私有儲存空間盤點 |
| POST | `/storage/cleanup` | 受限制的儲存清理 |
| GET | `/sdcard/status` | Android 共用儲存權限與狀態 |
| GET | `/sdcard/list` | 共用儲存目錄列表 |
| POST | `/sdcard/read`、`/write` | 共用儲存檔案讀寫 |
| POST | `/sdcard/mkdir`、`/delete` | 共用儲存目錄建立與刪除 |
| POST | `/droid-action` | Android 原生裝置動作 |
| POST | `/maintenance/cleanup-processes` | 內嵌環境程序維護 |

內嵌 Kotlin Bridge 還能提供打包的 Web 靜態資產；該行為不是外部 Termux Python Bridge 的通用 Runtime 能力。Kotlin 端另有同步 `POST /shell`，但沒有同步 `POST /run` 或 `POST /install`；這三個路由不能一概視為 Kotlin 端缺失。

## 4. 共用客戶端目前送出的資料形狀

以下欄位由 `src/services/termuxBridge.ts` 的實際呼叫端確認。空白 POST 以空 JSON 物件表示；Token 放在 `X-DroidPy-Token` Header，不放進 JSON body。

| 路徑 | Request body | 重要回應欄位／事件 |
|---|---|---|
| `GET /health` | 無 | `ok`、`embedded`、`hasPython`、`pythonVersion`、`arch`、套件盤點 |
| `GET /files` | 無 | `files[]: name, content, updatedAt` |
| `POST /run-stream` | `entry`、`files[]: name, content` | NDJSON `stdout/data`、`done/exitCode/durationMs` |
| `POST /run`（僅 Python） | `entry`、`files[]: name, content` | JSON `exitCode`、`stdout`、`stderr`、`durationMs` |
| `POST /install`（僅 Python） | `mode`、`target`、`trustedHost` | JSON `exitCode`、`stdout`、`stderr`、`durationMs` |
| `POST /shell` | `command` | Python 回 `exitCode/stdout/stderr/durationMs`；Kotlin 回 `runBufferedShellCommand` 結果 |
| `POST /install-stream` | `mode`（pip/pkg）、`target`、`trustedHost` | NDJSON 輸出與完成事件 |
| `POST /shell-stream` | `command` | NDJSON 輸出與完成事件 |
| `POST /stdin` | `data` | `ok` |
| `POST /stop`、`/pause`、`/resume` | 空物件 | `ok` 與程序控制狀態 |
| `POST /probe-url` | `url`、可選 `userAgent`、`cookieHeader`、`extraHeaders` | `ok`、`finalUrl`、`statusCode`、`setCookies`、`headers`、`bodyPreview` |
| `POST /maintenance/cleanup-processes` | `manual` | 程序清理結果 |

外部 Python Bridge 額外支援同步 `POST /run`、`/install`、`/shell`，其輸入欄位與相應串流版本相同。內嵌 Kotlin 路由清單沒有 `/run` 或 `/install`，目前執行與安裝主要走串流端點；不能把這些非串流端點當成兩邊的共同能力。

## 5. 已確認的相容性差異

1. **功能集合不相同。** 外部 Python Bridge 沒有 Kotlin 端的套件備份還原、原生日誌、App 儲存空間與 SD 卡操作路由。UI 必須依 Provider 能力顯示或停用功能，不能只依「已連線」推斷全部功能可用。
2. **健康資料來源不相同。** Python 端透過目前 Python／dpkg 環境盤點；Kotlin 端直接檢查內嵌 `usr/`、套件清單與 App 私有資料。相同欄位名稱不代表資料收集語義完全一致。
3. **Python 版本回報不對稱。** 外部 Bridge 回報真實 `platform.python_version()`；目前內嵌 Kotlin 健康資料以 `Termux Embedded` 等標籤回報，應在新能力模型中分開提供 runtime label 與實際版本。
4. **串流事件資訊不足。** 目前以 `type/data` 和 `done` 為主，缺少統一 request ID、事件序號、progress／process-state／cancelled 等標準事件。
5. **執行語義不同。** Python 端具有非串流 `/run`、`/install` 與 `/shell`；內嵌 Kotlin 具有非串流 `/shell`，但 `/run` 與 `/install` 目前主要透過串流路由執行。需逐路由比較成功回應、錯誤狀態與程序控制語義。
6. **程序控制需要逐項驗證。** 兩邊均有明確停止與 PTY 控制，但程序保留、客戶端斷線、重啟後控制能力與輸出尾端處理必須用同一組測試驗證，不能僅以路由存在判定相容。

### 5.0 已由處理器程式碼確認的共用路由細節

| 路由 | 外部 Python Bridge | APK 內嵌 Kotlin Bridge | 相容性判定 |
|---|---|---|---|
| `GET /files` | 回傳 `files[]`，只讀取工作目錄頂層允許副檔名檔案，排除隱藏檔、`__pycache__`、非一般檔案及大於 180 KiB 的檔案 | 回傳相同主要欄位與 180 KiB 限制；只列頂層一般檔案及允許副檔名 | 回應欄位一致；需用檔名、Unicode、mtime 與邊界大小 fixture 驗證 |
| `GET /health` | 回報真實 Python 版本及 Python／dpkg 套件盤點 | `pythonVersion` 目前是 `Termux Embedded` 或 `Bootstrap Ready` 標籤，並由內嵌目錄盤點套件 | 同名欄位語義不同；新能力模型應分開 `runtimeId`、`runtimeLabel`、`pythonVersion` |
| `POST /shell` | body `command`；空命令回 400；同步結果包含 `exitCode/stdout/stderr/durationMs` | body `command`；空命令回 400；結果來自 `runBufferedShellCommand` | 需固定成功與錯誤結果的欄位契約 |
| `POST /stdin` | body `data`；沒有 PTY 回 409；成功回 `ok:true` | body `data`；沒有作用中程序回 409；成功回 `ok:true` | 狀態碼與成功欄位一致；換行及程序生命週期需實測 |
| `POST /pause`、`/resume` | 無作用中程序回 409；成功回 `ok:true, paused` | 以程序訊號操作；回傳 `ok`、`paused`、`error` | Kotlin 端即使成功也包含空字串 `error`；錯誤 payload 不完全一致 |

### 5.1 已由處理器程式碼確認的回應差異

| 路由 | 外部 Python Bridge | APK 內嵌 Kotlin Bridge | 相容性判定 |
|---|---|---|---|
| `POST /stdin` | 無作用中 PTY 時回 409；成功回 `{ok:true}`；寫入錯誤回 500 | 無作用中程序時回 409；成功回 `{ok:true}`；寫入錯誤回 500 | 狀態碼與主要成功欄位一致；輸入換行與程序生命週期仍需 fixture 驗證 |
| `POST /pause`、`/resume` | 無作用中程序回 409 並包含 `ok:false`、目前 `paused`；成功回 `ok:true, paused` | 以訊號操作作用中程序；失敗回 409，成功回 200；需再確認完整 JSON 欄位 | 不能只比較 HTTP 狀態碼；需核對 paused 狀態與錯誤欄位 |
| `POST /stop` | 無作用中程序回 `{ok:true, stopped:false}`；成功回 `{ok:true, stopped:true}` | 不論是否存在作用中程序，處理器都回 `{ok:true}`，並清除暫停狀態 | **已確認不等價**；呼叫端不可依賴兩邊相同的 `stopped` 欄位 |
| `POST /shell` | 同步執行後回 `exitCode`、`stdout`、`stderr`、`durationMs` | 呼叫 `runBufferedShellCommand` 後回傳其結果物件 | 路由存在，但必須比較 Kotlin 結果物件的實際欄位與退出碼語義 |
| 無效 JSON body | 由 Python body parser 回 400；超過 8 MiB 回 413 | Kotlin JSON 解析失敗回 400；需核對 body 上限與 framing 規則 | **請求解析基線尚未證明一致** |

以上是靜態處理器程式碼觀察，不是整合測試結果。特別是 `/stop` 的回應差異應納入舊 API 相容層；新契約可定義一致結果，但不能靜默改變舊客戶端行為。

## 6. 安全基線（新契約必須保留）

- 僅綁定／接受預期的 loopback Host，驗證可信任 Origin。
- 以每安裝權杖驗證受保護的 API；不在日誌、共享儲存或診斷回報暴露權杖。
- 限制請求大小、Header 大小、讀取逾時、工作佇列與並行請求數。
- 拒絕重複或含糊的 Content-Length／Transfer-Encoding framing。
- URL 探測必須保留 SSRF、DNS／Redirect 與跨來源敏感 Header 防護。
- 使用者程序不能因單純 HTTP 客戶端斷線而被意外殺掉；停止必須是明確、已驗證的操作。
- SD 卡讀寫／刪除需維持 canonical path 與儲存權限檢查。

## 7. Phase 1 下一步

- [ ] 對每條共用路由記錄 request JSON 欄位、成功回應、錯誤狀態與錯誤 JSON。
- [ ] 對兩個實作建立相同輸入 fixture，確認共同語義與允許差異。
- [ ] 以同一組測試驗證權杖錯誤、Origin／Host 錯誤、超大請求、無效 JSON、逾時、串流斷線、明確停止。
- [ ] 加入能力宣告 fixture，將「不支援」與「執行失敗」區分。
- [ ] 在相容性測試通過前，不移除舊路由、不更改 8765／8766，也不遷移 UI 呼叫。

## 8. 本文件的限制

這是靜態原始碼盤點，不是兩個 Bridge 已通過同一組整合測試的聲明。表中功能需再以實際 request／response fixture 與 Android 10+ 裝置測試驗證。
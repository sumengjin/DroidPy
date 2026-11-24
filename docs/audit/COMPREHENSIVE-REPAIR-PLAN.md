# DroidPy 全專案修復與安全加固總計畫

> 狀態：進行中（規劃基線）
> 基準分支：`main`（最新基準 SHA 需續作時重新查詢）
> 規劃分支：`project/comprehensive-hardening-plan`
> 建立日期：2026-11-25
> 專案目標：一次完成全專案盤點與整體修復規劃，分階段實作、整合及驗收；不可因分階段而遺漏任何列出的工作。

## 0. 不可違反的產品與資料要求

1. Android 10 及以上版本必須保有完整的 App 私有目錄讀寫能力；使用者主要測試裝置包含 Android 11 與 Android 13。
2. 不上架 Google Play；APK 以私有安裝及 GitHub Releases 發布為主。
3. 保留自動 Android APK 建置及正式版本自動發布 GitHub Release 的流程。
4. **不得直接更換、刪除或覆寫既有簽名私鑰。**任何簽名身分遷移必須先完成可行性研究、升級相容性驗證及回復方案；未通過實機驗證不得執行。
5. 不得清空、重裝、搬移或覆寫既有 `usr/`、Python 套件、工作區、備份或其他使用者資料作為一般修復手段。
6. 不得把程序執行時間長直接視為卡死；不得自動終止使用者正常工作的 Python 程序。
7. 所有破壞性操作必須有明確確認、範圍預覽、備份/回復策略與日誌。
8. 不把尚未執行的 Android 建置、設備測試或安全驗證描述為通過。
9. 變更先進專用修復分支與 PR；每一階段通過測試後才整合。保留可追蹤提交與回復點。
10. 任何診斷報告預設遮蔽 Token、密碼、Cookie、私鑰、個人路徑中的敏感片段及使用者程式內容。

## 1. 已知問題與初步發現

### P0 — 簽名私鑰暴露（安全事件）
初步檢查發現公開儲存庫中存在 `signing/droidpy-debug.p12`，且 `src/services/androidSigningAsset.ts` 包含對應 Base64 金鑰素材；APK 建置程式亦有從內嵌素材產生簽名檔的流程。這代表私鑰素材曾進入公開 Git 歷史，不能只刪除目前檔案就視為未洩露。

必做：
- 確認該金鑰是否等同於正式 Release 實際使用的原始憑證；以現有正式 APK 的 signer SHA-256 與私鑰派生憑證比對，禁止只憑檔名判斷。
- 確認 Git 歷史、所有分支、Release artifact、workflow log、產生的 Android 專案 ZIP 是否含私鑰或密碼。
- 盤點 Android APK 簽名輪替/Proof-of-Rotation、既有安裝更新相容性及回退策略。
- 在不破壞現有安裝的前提下，提出可驗證的密鑰事件處置方案。若無法安全輪替，必須清楚記錄風險與可行限制，不得假稱風險已消失。
- 未完成相容性研究與使用者既有 APK 實機升級驗證前，不更換簽名、不移除現有可用簽名流程、不發布不相容 APK。
- 後續私鑰不得放在公開原始碼或產生的公開專案中；正式簽名僅由受保護的 CI secret/受控簽名環境提供。缺少簽名材料時 Release 必須 fail closed，不能靜默退回公開預設金鑰。
- 不得把私鑰、密碼或可還原私鑰的 Base64 寫入日誌或 artifact。

### P0 — 本機 HTTP Bridge 跨來源/授權安全
初步檢查發現 Bridge 使用 loopback 服務、固定 Token（程式碼中可見 `droidpy-local`）、寬鬆 CORS（`*`）及 Private Network Access 標頭；API 包含 shell、Python 執行、檔案讀寫/刪除、備份還原及 URL 探測等高權限功能。

必做：
- 每個安裝實例產生高熵隨機 Token，存放於 App 私有目錄；啟動時安全傳遞給 WebView，不硬編碼、不輸出日誌。
- 嚴格驗證 Origin/Host、方法、路徑、Token；拒絕不必要的跨來源請求。移除通配 CORS 及不必要的 Private Network Access 授權。
- 評估並實作每次啟動的短期授權/請求 nonce、防重放及安全的 WebView-origin 綁定。
- 對 shell、run、檔案、刪除、備份還原等高權限路由分級授權。
- 限制 header/body 大小、讀取時間、並行連線、輸出大小與逾時；拒絕不合法 Content-Length、路徑編碼繞過及異常 HTTP 請求。
- URL 探測防 SSRF：限制協定、localhost/私有網段/鏈路本地/雲端 metadata 位址及重新導向目的地，並防 DNS rebinding。
- 路徑操作採 canonical path + symlink 防逃逸；所有刪除/寫入都要驗證實際目標。
- 加入跨來源攻擊測試、錯誤 Token 測試、路徑穿越測試及 API 權限測試。

### P1 — Python/Termux 程序 watchdog 誤殺風險
目前程式把程序存活時間達到 watchdog 閾值（約 30 分鐘）當成 stalled 判斷之一；單純執行時間長不能證明程序卡死。

必做：
- 不以 elapsed time 單獨終止程序。
- 以由 DroidPy 啟動的程序 PID/Process identity、啟動時間、父子關係、任務狀態、輸出/心跳/明確取消狀態判斷。
- 排除使用者自行啟動的背景服務、互動式 shell、長時間計算、下載、Notebook/伺服器及其子程序。
- 只清理已確認屬於 DroidPy 管理、已失去 owner/lease 且可證明失聯的程序；先 SIGTERM、等待、再依安全條件 SIGKILL。
- Zombie 清理與活程序清理分開；不可對不相關父程序任意發 SIGCHLD。
- 加入模擬長任務、子程序、程序 PID 重用、App 重啟、斷線、使用者取消及 zombie 測試。
- watchdog 事件記錄程序識別與原因，但不得記錄命令中的敏感參數或程式碼。

### P1 — pip 套件安裝路徑與 SSL
- 保留 PR #4 的 PEM ASCII 正規化與 PYTHONUSERBASE/site-packages 啟用修復，檢查所有 sitecustomize 產生器是否一致。
- 驗證 Python 3.14 的 CA bundle、PEM 多憑證、CRLF/LF、非 ASCII、錯誤 Base64、空 CA、certifi 更新與 TLS 驗證。
- 不允許為了讓 pip 成功而關閉 TLS 憑證驗證。
- 驗證 pip 安裝、升級、卸載、重新啟動、長時間後重啟、Android 重新開機後仍可 import。
- 驗證 `PYTHONUSERBASE`、`site.ENABLE_USER_SITE`、`sys.path`、pip config 與實際安裝位置一致。

### P1 — 套件清單漏報與備份縮水
- 合併/重整 PR #6 的 filesystem scan + `importlib.metadata` 交叉盤點。
- 盤點不同 Python 版本、user site、prefix site、dist-info/egg-info、namespace package、損壞 metadata、重複 distribution。
- 清單資料來源要標示、可診斷；單一來源失敗不得把整個清單誤判為空。
- 修正 `forceShrink`：未取得完整可信盤點前不得縮小套件備份 manifest。
- 解除安裝前後比對套件狀態；只有確認成功移除且清單完整時才更新備份。
- 套件清單錯誤不得觸發重裝、清除或覆蓋套件資料。

### P1 — Termux bootstrap/部分損壞復原
- 延續 PR #5 的非空 usr 保護。
- 明確定義 fresh / healthy / degraded / partial / missing-core / unknown 狀態。
- bootstrap 前先做只讀檢查與可回復備份；非空 usr 永不直接刪除重建。
- 修復採增量、可驗證、原子替換；保留原始檔案及失敗回復點。
- 標記檔與實際核心二進位檔不一致時進入 degraded，不得誤判為全新安裝。
- 加入斷電/強制關閉/磁碟空間不足/部分解壓/權限異常測試。

### P1 — 儲存空間與資料安全
- 查清 App 私有目錄、usr、py_user、pip cache、apt cache、workspace、backup、updates、logs 的實際大小與重複檔案。
- 區分已安裝套件、快取、暫存、備份與孤兒檔；清理預覽必須逐類顯示。
- 清理不得碰觸已安裝套件、使用者工作區、設定、簽名資料及唯一備份。
- APK 更新只保留安全可刪除的舊下載暫存；不可誤刪使用者匯入 APK。
- 加入空間不足、清理中斷、重複安裝與長期使用的測試。
- 診斷報告只讀，不包含檔案內容；PR #7 的診斷功能需審核效能、逾時、輸出大小及敏感資訊遮蔽。

### P1 — APK updater / Release 信任鏈
- 審核 PR #3 的 package ID + signer fingerprint 檢查，並補齊 Android 端實際安裝路徑的測試。
- 下載前驗證 Release tag、asset 名稱、大小、digest；下載後驗證 SHA-256、APK package ID、簽名憑證與版本資訊。
- 任何驗證失敗均刪除下載暫存並拒絕啟動安裝；不允許 fallback 安裝。
- 評估簽名輪替時舊版安裝相容性、更新鏈及回退方案。
- CI 產生可驗證的 Release provenance/SBOM；簽名失敗或驗證工具缺失時 Release fail closed。

### P2 — 建置可重現性與供應鏈
- 對照 package.json、bun.lock、GitHub Actions；統一套件管理器並採 frozen/lockfile 安裝。
- 固定 Node、Java、Gradle、Android SDK/Build Tools、Termux bootstrap 與外部下載依賴版本。
- Bootstrap/外部二進位檔固定 SHA-256；拒絕未驗證的 latest。
- 審查第三方 GitHub Actions 版本 pinning、permissions 最小權限、PR fork 權限、cache poisoning 及 artifact 暴露。
- PR 需要執行網頁測試、TypeScript/lint、Android Debug APK 編譯；Release tag/push 才執行正式簽名與發布。
- CI 應驗證 APK signer fingerprint、package ID、minSdk/targetSdk、ABI、版本號與 artifact digest。

### P2 — 版本、文件與相容性
- 修正 `src/version.ts`、Release tag、package metadata、README 中的版本與 Python 版本資訊不一致。
- targetSdk 28 目前因嵌入式 Termux 相容性而保留；先做實測與依賴分析，不可為追求數字盲目提高。
- 保持 Android 10+ 私有路徑讀寫完整；檢查 scoped storage、MANAGE_EXTERNAL_STORAGE 使用條件、SAF 與私有目錄路徑。
- 對 Android 10、11、13 及更新版本建立功能矩陣；不因不發布 Play Store 而忽略安全更新。

### P2 — WebView、Crawler、Pyodide、Editor 與其餘模組
全庫逐檔審核：
- WebView JavaScript bridge 的呼叫來源、檔案下載、Blob/Data URL、外部 Intent、混合內容與安全瀏覽。
- Crawler WebView 的 Cookie、Session、跨站資料、憑證、下載與清除生命週期。
- Pyodide 動態載入、CDN fallback、套件版本鎖定、REPL eval 的使用邊界與錯誤隔離。
- Editor、檔案管理器、ZIP 匯入匯出、工作區路徑、備份還原與檔名/路徑穿越。
- localStorage 配額、備份快照容量、設定遷移、損壞 JSON 與升級後相容性。
- 日誌容量、隱私、敏感資訊、無限成長與 crash/rejection 處理。
- UI 非同步競態、重複請求、卸載後 state 更新、計時器/事件 listener 清理、記憶體洩漏。
- 所有 destructive actions、錯誤處理、空狀態與離線行為。

## 2. 現有 PR 盤點（不得假設已合併）

| PR | 目前目的 | 後續處理 |
|---|---|---|
| #3 | 更新 APK 簽名驗證 | 審核並補齊 signer/安裝路徑測試；納入 updater 工作 |
| #4 | pip SSL、PYTHONUSERBASE 路徑 | 保留已驗證修復；補完整 Android/實機測試 |
| #5 | 非空 usr 部分損壞保護 | 納入 bootstrap 狀態機及故障復原測試 |
| #6 | pip 套件清單交叉盤點 | 納入清單與備份 manifest 修復 |
| #7 | Python 路徑/儲存只讀診斷 | 安全審核、遮蔽敏感資料、效能測試後整合 |

PR 與主分支可能隨時間改變；每次續作必須重新讀取 GitHub 的實際 head/base/CI 狀態，不以本文件舊紀錄取代現況。

## 3. 執行順序與交付物

### Phase A — 全庫盤點與基線
- 建立完整檔案/模組清單、依賴圖、API 路由表、資料目錄清單、GitHub workflow/secret 使用清單。
- 確認目前 main SHA、開啟 PR、Release、CI 狀態與現有 signer 指紋。
- 建立測試基線及風險登錄表。
- 交付：`docs/audit/REPOSITORY-INVENTORY.md`、`docs/audit/RISK-REGISTER.md`。

### Phase B — P0 安全與簽名事件處理
- 先修 Bridge 身分驗證、CORS/Origin、路由權限與 SSRF。
- 完成簽名金鑰事件鑑識與相容性方案；未經驗證不輪替。
- 交付：威脅模型、攻擊測試、簽名相容性報告。

### Phase C — 資料保全與 Python 穩定性
- watchdog、pip/site path、套件清單、備份 manifest、bootstrap 復原、儲存診斷。
- 所有測試以保留既有資料為前提。
- 交付：資料遷移/復原測試、Python/Termux 測試矩陣。

### Phase D — 更新、建置與其餘全庫品質
- updater、CI/CD、鎖定依賴、WebView/Crawler/Pyodide/Editor/UI 全面審核。
- 交付：供應鏈檢查、版本一致性、完整模組審核報告。

### Phase E — 整合與驗收
- 每個 PR 必須有可重現測試與清楚回復策略。
- 所有 PR 必須通過網頁測試、靜態檢查、Android Debug APK 建置。
- Release 必須通過 signer、package ID、digest、ABI、SDK、版本檢查。
- 實機驗收：Android 10+ 私有檔案讀寫、pip 安裝/import、短時間/長時間重啟、手機重開機、長時間 Python 任務不被誤殺、舊版安裝直接升級、工作區與套件資料完整。
- 交付：`docs/audit/FINAL-ACCEPTANCE.md`，逐項標記 PASS/FAIL/BLOCKED，附 CI run、commit、測試設備及證據。

## 4. 完成定義（Definition of Done）

- [ ] 全部 source、native Android、workflow、build scripts、dependencies、assets、docs 均完成逐檔審核。
- [ ] 每個發現均記錄嚴重性、影響、修復 commit、測試證據或明確阻塞原因。
- [ ] P0/P1 問題已修復，或有清楚且經確認的安全阻塞說明；不得隱藏未解風險。
- [ ] 無自動清除使用者安裝套件/工作區/備份的路徑。
- [ ] watchdog 不會僅因執行時間長而終止正常工作。
- [ ] pip 安裝、import、套件清單、備份清單及長時間持久性通過測試。
- [ ] Bridge 不再使用公開固定 Token 或通配跨來源授權。
- [ ] Release 不使用公開原始碼中的私鑰；簽名遷移若受 Android 相容性限制，必須明確記錄並有可行處置方案。
- [ ] Android 10+ 私有檔案存取通過測試。
- [ ] 原有 APK 升級相容性經實機驗證。
- [ ] 自動 APK 建置與 GitHub Release 發布仍正常。
- [ ] 最終驗收文件完整，所有未解項目列明，沒有虛報通過。

## 5. 每次續作的恢復程序

任何新對話/中斷後，先讀取本文件，再讀取：
1. GitHub `main` 最新 SHA 與本計畫分支最新 SHA。
2. `docs/audit/PROGRESS.md`（若存在）。
3. `docs/audit/RISK-REGISTER.md`（若存在）。
4. 所有相關 PR 最新 head/base、diff、CI jobs。
5. 最近完成的 commit 與尚未完成的 checklist。

只從 GitHub 實際狀態確認進度；不要依賴舊聊天內容推測。完成一項就更新進度文件與對應測試證據。若發現計畫與程式現況不符，先更新風險紀錄，再繼續。

## 6. 目前進度（建立時）

- [x] 已建立完整修復總計畫與產品/資料保護要求。
- [x] 已初步辨識簽名私鑰暴露風險。
- [x] 已初步辨識 Bridge 固定 Token/寬鬆 CORS 風險。
- [x] 已初步辨識 watchdog 以程序時間判定卡死的風險。
- [x] 已初步辨識 pip 清單漏報及備份縮水風險。
- [ ] 完成全庫逐檔審核與模組清單。
- [ ] 建立正式風險登錄、進度檔及測試矩陣。
- [ ] 修復 P0 安全問題。
- [ ] 修復 P1 資料保全與 Python 問題。
- [ ] 完成 P2 全庫品質與供應鏈加固。
- [ ] 完成整合及 Android 實機驗收。

**注意：** 本文件是工程工作追蹤基線，不代表所有問題已修復或已通過測試。
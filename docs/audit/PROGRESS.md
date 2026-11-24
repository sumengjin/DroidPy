# DroidPy 修復進度追蹤

> 本文件搭配 [COMPREHENSIVE-REPAIR-PLAN.md](./COMPREHENSIVE-REPAIR-PLAN.md) 使用。
> 最後更新：2026-11-25
> 計畫分支：`project/comprehensive-hardening-plan`
> 基準主分支：建立計畫時為 `e8956f09d1463cd665322edd5dc7821df0fcd014`；續作時必須重新查詢最新 SHA。

## 目前狀態

**總體：規劃已寫入 GitHub，全面審核與修復尚未完成。**

### 已完成的檢查（初步，非全庫驗收）
- [x] 讀取 main 分支核心 Android APK builder、Termux bridge、updater、App 啟動流程及相關設定。
- [x] 初步檢查公開簽名素材與 Release 簽名路徑。
- [x] 初步檢查 Bridge Token、CORS、Private Network Access、Shell/Run API。
- [x] 初步檢查 watchdog 程序清理條件。
- [x] 初步檢查 pip 套件清單盤點及備份快照更新。
- [x] 盤點 PR #3–#7 的目標與已知 CI 情況。

### 尚未完成
- [ ] 逐檔審核整個 repository，建立檔案/模組清單。
- [ ] 驗證簽名私鑰是否與現行 Release signer 完全相同，並形成安全處置/升級相容性報告。
- [ ] Bridge 威脅模型與跨來源攻擊測試。
- [ ] watchdog 修復與長任務測試。
- [ ] pip/site path、套件清單、manifest、bootstrap 復原完整測試。
- [ ] 儲存空間與所有刪除/清理路徑審查。
- [ ] updater、CI/CD、供應鏈、WebView、Crawler、Pyodide、Editor、備份與 UI 全面審核。
- [ ] Android 10+ 實機驗收。
- [ ] 舊版 APK 升級與簽名相容性實機驗收。
- [ ] 正式 Release 驗收。

## PR / CI 追蹤

每次續作都要即時刷新 GitHub 狀態，不可沿用過期狀態。

| 工作 | 狀態 | 備註 |
|---|---|---|
| PR #3 | 開啟/待重新確認 | 更新 APK 簽名驗證 |
| PR #4 | 開啟/待重新確認 | pip SSL 與 user site 路徑；曾有 Android Debug build 成功紀錄 |
| PR #5 | 開啟/待重新確認 | 部分損壞 usr 資料保護 |
| PR #6 | 開啟/待重新確認 | pip 套件清單交叉盤點 |
| PR #7 | 開啟/待重新確認 | Python 路徑與儲存只讀診斷 |

## 續作紀錄

### 2026-11-25
- 建立完整修復總計畫。
- 計畫 commit：`de2137aa717a6d96de9527528d26abe38539cfa0`
- 建立專用分支：`project/comprehensive-hardening-plan`
- 本次只完成計畫文件與初步審核；沒有修改產品程式碼、沒有合併 PR、沒有發布 APK。
- 下一步：完成全庫檔案清單與風險登錄，然後按 P0 安全問題開始實作。

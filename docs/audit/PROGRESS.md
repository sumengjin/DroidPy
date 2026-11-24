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


### 2026-11-25 — inventory and first data-safety repair
- Refreshed main branch tree; GitHub recursive tree was not truncated. Added `docs/audit/REPOSITORY-INVENTORY.md` covering tracked source, build, workflow, assets and generated Android code entry point.
- Added `docs/audit/RISK-REGISTER.md` with 16 prioritized risks and evidence policy.
- Verified PR #8 docs-only CI run `45468570013` completed successfully. PR #8 remains open/draft; no product code is in that PR.
- Confirmed PRs #2–#8 are still open at the latest repository snapshot; PR #9 is newly opened for the script-backup data-safety fix.
- Found a concrete script-backup defect: quota handling silently dropped old snapshots, and backup creation still returned success even if every write failed. The restore path also proceeded without verifying its pre-restore rollback snapshot.
- Created PR #9: [fix(storage): preserve existing script backups on quota failure](https://github.com/sumengjin/DroidPy/pull/9)
  - Branch: `fix/durable-script-backups`
  - Latest head at this update: `1d252d655d94ba8b4b332abc2631f03883269213`
  - Commits include `ad1215a12d7e470c386bbc7bf0b7e62001bca963`, `ce6185191e599ec68d94f6d25f61b185310a46e1`, `41c4b42fca03b09e9d298125bf44ca6df11b819b`, `1fb47baf1512ef811cdad72b808fab575d1f3f09`, `dd395d2818765a9dee017eb204575591491b9840`, `739ef6b7b4e9e48150de33143fe4458f6431e753`, `1d252d655d94ba8b4b332abc2631f03883269213`
  - Changes: no automatic eviction of old snapshots; write errors propagate; malformed backup stores are not overwritten; manual backup/delete failures are reported; restore is blocked unless the current workspace rollback snapshot is saved.
  - CI run `45470462368` completed successfully for the earlier head `41c4b42...`. After follow-up localization/error-handling commits, the latest head is `1d252d6...`; its check-runs had not yet appeared at the last poll. The current main workflow condition skips Android APK build on pull requests, so Android compilation and device acceptance remain unverified.
- No change to main, signing key, Termux usr/, installed packages, workspace data, or Release artifacts.
- PR #9 CI check `測試與網頁建置`: SUCCESS; no Android APK job was run for this PR.
- Next: complete PR #9 CI review; inspect the exposed signing material against the current v1.2.18 APK signer without rotating any key; then continue Bridge security audit and implementation.
\n- Follow-up hardening: localized backup failure messages in all four supported languages; storage exceptions are converted to stable internal error codes; latest PR #9 head is `1d252d655d94ba8b4b332abc2631f03883269213`.
# DroidPy 修復進度追蹤

> 本文件搭配 [COMPREHENSIVE-REPAIR-PLAN.md](./COMPREHENSIVE-REPAIR-PLAN.md) 使用。
> 最後更新：2026-11-25
> 計畫分支：`project/comprehensive-hardening-plan`
> 最新主分支：`450232e8a4d4ff1e4dc6ab14296433a0e498ace2`（PR #12、#13 已合併）；續作時仍須重新查詢。

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
- [x] 已由 v1.2.18 Release CI 確認公開私鑰就是 production signer；已形成 Android v3/v3.1 輪替分析。仍需安全簽名配置與 Android 10/11/13 升級驗收。
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
- Expanded security review identified two additional high-priority risks: unbounded Bridge request bodies/slow-client resource exhaustion (R-017), and generated APT configuration disabling TLS peer/host verification when a CA file is missing (R-018). Both are recorded in `RISK-REGISTER.md`; neither is yet fixed.

- PR #9 follow-up CI run `45471136835` failed in TypeScript lint due to a missing comma in the Japanese translation entry (`src/services/i18n.tsx`). The failure was inspected from the job log and corrected in commit `923bab90d26d22d2640a64d1695578937be90959`; validation for this latest head is pending. This is not treated as a pass.

- **P0 signing incident confirmed:** inspected v1.2.18 workflow run `45444107279`, build job `138623421863`. Log explicitly shows the fixed repository fallback key was used, and successful `apksigner` output reports the certificate SHA-256 fingerprint matching the exposed `androidSigningAsset.ts` material. The public source therefore contains the production APK signer private key. No key was rotated or removed and no APK was published. Available GitHub connector does not expose repository Actions Secrets; no claim that a secret exists or was changed. Next: design safe Android signing lineage/rotation for Android 10+ while preserving existing installs; block any unverified key change.

- PR #9 latest head `923bab90d26d22d2640a64d1695578937be90959` CI run `45471301643`: TypeScript/lint and web build SUCCESS. Android APK build and Release jobs were SKIPPED by the current workflow's pull-request condition; no device test yet.

- PR #9 merged successfully via squash: merge commit `6266f67016dd173dd422b545d7565e5c9954ba24`; main now points to this commit. Web CI for the final PR head passed; Android APK job was skipped by workflow policy and device acceptance remains pending.

- Added `docs/audit/SIGNING-INCIDENT-AND-ROTATION-ANALYSIS.md`: confirms v1.2.18 used the public fallback signer; records Android v3/v3.1 behavior, Android 10/11/13 validation requirements, residual compromise risks, and a fail-closed containment/rotation plan. No signing key changed.

- Created PR #12 `security/ci: remove public signing key and build Android debug APKs on PRs` (branch `security/contain-signing-key-and-pr-debug-build`). It removes the PKCS#12/Base64 private key from the current source tree and generated project ZIP, removes the public-key fallback from release signing (protected Actions secrets are now mandatory), gives `contents: write` only to the Release job, and enables Android Debug APK compilation on PRs using Gradle's ephemeral debug signer. Because no signing secrets are configured (v1.2.18 log used the public fallback), production Release builds will fail closed until a secure new signer/lineage is provisioned. CI pending.

- PR #12 CI run `45473569491` completed SUCCESS: PWA/TypeScript build passed and the generated Android ARM64 Debug APK compiled successfully with Gradle's ephemeral debug signer. Release build, production signer verification and Release job were correctly skipped for this pull request. This validates generated Android Kotlin/Gradle compilation for the PR #12 source state, not runtime behavior on devices.


### 2026-11-25 — security hardening continuation

- PR #8 (repair plan, inventory, risk register and signing incident analysis) is merged. PR #9 (durable script backups) is merged at `6266f67016dd173dd422b545d7565e5c9954ba24`; final web CI `45471301643` passed. No Android runtime acceptance was performed for this browser-local backup fix.
- PR #12 is merged at `34ae4058b8afd92035145dcc731762ffa3fcbb4e`. It removes the publicly committed PKCS#12/Base64 key from the current tree and requires protected signing secrets for production Release. The old private key remains compromised in Git history and existing artifacts. No secret was configured through the available connector, no key rotation was performed, and no production APK was published by this change.
- PR #13 is merged at `450232e8a4d4ff1e4dc6ab14296433a0e498ace2`. Workflow-level permissions are now `contents: read`; only the Release job gets `contents: write`. CI run `45474423204` passed the web build; Android and Release jobs were skipped by the PR event policy.
- PR #11 (per-install Bridge tokens and exact-origin checks) remains open on stale base `18762e9a1a641b975a107484af9edb2297a40f22`; it must be rebased and reviewed together with WebView-origin protections before merge.
- PR #14 (bounded Bridge request resources) is open on stale base `34ae4058b8afd92035145dcc731762ffa3fcbb4e`. CI run `45474774819` passed web and Android ARM64 APK builds; Release was skipped. No device runtime test yet.
- PR #15 (exact WebView origin and child-frame restrictions) is open on current base `450232e8a4d4ff1e4dc6ab14296433a0e498ace2`. Web CI passed in run `45475215970`; Android APK build was still in progress at last check.
- PR #16 (APT signed-repository and TLS verification hardening) is open on current base `450232e8a4d4ff1e4dc6ab14296433a0e498ace2`, branch `security/apt-authentication-fail-closed`, head `cdc51b2c86a1af9e1fbdf8b699ccb1d0017f067e`. It removes unauthenticated APT flags and `trusted=yes`, strips the legacy source option, and leaves TLS verification enabled if a CA bundle is unavailable. It adds `npm run check:apt-security`; CI check-runs had not appeared at last poll. Android package-manager runtime tests are mandatory before merge.
- PR #13 CI run `45474423204`: web build SUCCESS; APK and Release SKIPPED as expected.
- No changes in this continuation modified the user's Termux `usr/`, installed Python packages, workspace, backups, original signer material or published Release artifacts. The APT change only alters generated APT configuration/source-list behavior and remains unmerged.

## Next actions
1. Refresh PR #15 Android build and PR #16 CI status.
2. Rebase PR #11 and PR #14 onto current main; review combined Bridge token, origin, resource and SSRF protections.
3. Review PR #15 JavaScript bridge exposure and Android navigation behavior.
4. Validate PR #16 against the actual Termux bootstrap keyring and CA bundle; do not merge without package install/update compatibility evidence.
5. Replace the age-only process watchdog with managed-process ownership/heartbeat.
6. Continue audit of storage cleanup, updater, package inventory/backup manifest, bootstrap recovery, crawler cookies, Pyodide, editor and app lifecycle.

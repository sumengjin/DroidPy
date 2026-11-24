# DroidPy 修復進度追蹤

> 本文件搭配 [COMPREHENSIVE-REPAIR-PLAN.md](./COMPREHENSIVE-REPAIR-PLAN.md) 使用。
> 最後更新：2026-11-25
> 計畫分支：`project/comprehensive-hardening-plan`
> 最新主分支：`6266f67016dd173dd422b545d7565e5c9954ba24`（PR #9 已合併）；續作時仍須重新查詢。

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
- Expanded security review identified two additional high-priority risks: unbounded Bridge request bodies/slow-client resource exhaustion (R-017), and generated APT configuration disabling TLS peer/host verification when a CA file is missing (R-018). Both are recorded in `RISK-REGISTER.md`; neither is yet fixed.

- PR #9 follow-up CI run `45471136835` failed in TypeScript lint due to a missing comma in the Japanese translation entry (`src/services/i18n.tsx`). The failure was inspected from the job log and corrected in commit `923bab90d26d22d2640a64d1695578937be90959`; validation for this latest head is pending. This is not treated as a pass.

- **P0 signing incident confirmed:** inspected v1.2.18 workflow run `45444107279`, build job `138623421863`. Log explicitly shows the fixed repository fallback key was used, and successful `apksigner` output reports the certificate SHA-256 fingerprint matching the exposed `androidSigningAsset.ts` material. The public source therefore contains the production APK signer private key. No key was rotated or removed and no APK was published. Available GitHub connector does not expose repository Actions Secrets; no claim that a secret exists or was changed. Next: design safe Android signing lineage/rotation for Android 10+ while preserving existing installs; block any unverified key change.

- PR #9 latest head `923bab90d26d22d2640a64d1695578937be90959` CI run `45471301643`: TypeScript/lint and web build SUCCESS. Android APK build and Release jobs were SKIPPED by the current workflow's pull-request condition; no device test yet.

- PR #9 merged successfully via squash: merge commit `6266f67016dd173dd422b545d7565e5c9954ba24`; main now points to this commit. Web CI for the final PR head passed; Android APK job was skipped by workflow policy and device acceptance remains pending.

- Added `docs/audit/SIGNING-INCIDENT-AND-ROTATION-ANALYSIS.md`: confirms v1.2.18 used the public fallback signer; records Android v3/v3.1 behavior, Android 10/11/13 validation requirements, residual compromise risks, and a fail-closed containment/rotation plan. No signing key changed.

- Created PR #12 `security/ci: remove public signing key and build Android debug APKs on PRs` (branch `security/contain-signing-key-and-pr-debug-build`). It removes the PKCS#12/Base64 private key from the current source tree and generated project ZIP, removes the public-key fallback from release signing (protected Actions secrets are now mandatory), gives `contents: write` only to the Release job, and enables Android Debug APK compilation on PRs using Gradle's ephemeral debug signer. Because no signing secrets are configured (v1.2.18 log used the public fallback), production Release builds will fail closed until a secure new signer/lineage is provisioned. CI pending.

- PR #12 CI run `45473569491` completed SUCCESS: PWA/TypeScript build passed and the generated Android ARM64 Debug APK compiled successfully with Gradle's ephemeral debug signer. Release build, production signer verification and Release job were correctly skipped for this pull request. This validates generated Android Kotlin/Gradle compilation for the PR #12 source state, not runtime behavior on devices.

- PR #10 WebView hardening branch `security/restrict-main-webview-origin` adds exact scheme/host/port navigation matching, exact local entry-file fallback, blocks child-frame navigation, disables file-origin cross-file/universal access and adds CSP frame/object restrictions. Workflow updated to include Android Debug PR builds; validation pending.

- Post-merge main push run `45474451656`: tests and PWA build SUCCESS; Android APK job stopped at signing configuration because protected signing secrets are absent; Debug/Release compile and Release job were skipped. This is the intended fail-closed behavior after PR #12, not an application-code failure.

- PR #15 workflow audit caught that any branch push still entered the production Release path. Updated signing mode and Release/verify/job conditions so feature-branch pushes use ephemeral Debug signing and only main/master, version tags or explicitly tagged workflow dispatch can enter production Release. CI for this correction is pending.

- PR #15 merged as `89e05902dadcfc4362ee274995bdc66d49ec93af`. CI run `45475815787` passed PWA and Android ARM64 Debug APK compilation. Generated Kotlin compiled successfully. Kotlin warnings remain for an unused certificate variable, ambiguous nested `return@...` label, redundant stdout initializer, and unused `force` parameter; these are non-fatal and will be reviewed separately.
- Created PR #16 branch `security/randomize-bridge-token-origin-v2` from the updated main. Ported per-install random Bridge tokens, exact-origin/Host checks, removal of wildcard CORS, PNA preflight restriction, 8 MiB request limits, 15-second socket read timeouts, external-backup token redaction, and generated-Python syntax tests. Android Debug CI and device validation pending. SSRF/redirect/DNS-rebinding defenses and bounded concurrency remain open.


### 2026-11-25 — Process watchdog removal (PR #21)
- PR #21 latest head `3aaf47373eb4998861f8cee98b3a956ef765e599` includes the Kotlin `EmbeddedTermuxBridge.start()` brace correction and removes the 30-minute age-based watchdog from both Bridge implementations.
- Process inspection is read-only. Bridge shutdown leaves active user Python work alive and retains the native `Process` handle so explicit Stop remains available after Bridge restart. UI labels updated in Traditional Chinese, Simplified Chinese, English and Japanese. Added CI regression checks for age-based termination and explicit Stop preservation.
- CI run `45479438842` passed Python tests, PWA/TypeScript build, Android ARM64 Debug APK compilation and artifact upload. Follow-up run `45480204247` also passed the full Debug build. Run `45480787105` completed SUCCESS, including Python tests, PWA/TypeScript build and Android ARM64 Debug APK compilation/artifact upload. Latest run `45481122921` passed Python tests and PWA/TypeScript build after restoring the `signal` import and adding an explicit-Stop regression assertion; its Android build is running, while the Kotlin source was already compiled successfully in run `45480787105`. Production Release APK, production signer verification and GitHub Release are skipped for PR builds; no production APK was published.
- Device verification remains required for Android 10+ process survival and explicit Stop behavior. No `usr/`, installed packages, workspace, backups or signing material was changed.


### 2026-11-25 — Package inventory and manifest safety (current branch)
- Created `fix/package-inventory-manifest-safety-v2` from current main; ported PR #6's core fix instead of merging its stale-base branch.
- Filesystem package scanning is now always cross-checked against `importlib.metadata.distributions()`, so finding one visible package no longer suppresses discovery from `PYTHONUSERBASE`.
- Inventory subprocess output is redirected to an app-private temporary file (not a pipe), limited to 8 seconds and 1 MiB, parsed using a unique marker, and cleaned up on success, failure or timeout. Existing `pip-` temp cleanup already covers this filename.
- Ordinary backup-manifest writes remain additive; explicit uninstall remains the only caller allowed to shrink package lists. No package directories, `usr/`, workspace or backup snapshots are deleted or overwritten by inventory.
- Added a CI regression guard for always-on metadata discovery, bounded file output/timeout/cleanup and monotonic manifest behavior. CI and Android ARM64 Debug compile pending.

- Additional R-008 data-preservation guard added to the same branch: startup now treats non-empty, unreadable or non-directory `usr/` as existing data; when core markers are missing it attempts non-destructive runtime repair, does not write a false bootstrap-success marker, and shows a warning instead of deleting/re-extracting the directory. CI regression checks cover this branch.

- Additional R-009 fix ported into this branch: both generated `sitecustomize.py` implementations now explicitly activate the configured `PYTHONUSERBASE` and normalize CA bundles into validated ASCII PEM blocks (BOM/comments removed; invalid blocks skipped). Certificate verification is not disabled. Android 10+ pip install/import and TLS acceptance remain pending.

- Additional R-018 hardening ported from the APT security review: removed `AllowInsecureRepositories`, `AllowDowngradeToInsecureRepositories`, `AllowUnauthenticated`, all `Verify-Peer/Verify-Host=false` fallbacks and `[trusted=yes]` source injection. Legacy trusted source options are stripped. Added `check:apt-security`; Android package operations now fail closed if verified trust material is unavailable.

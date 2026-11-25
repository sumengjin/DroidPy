# DroidPy 修復進度追蹤

> 本文件搭配 [COMPREHENSIVE-REPAIR-PLAN.md](./COMPREHENSIVE-REPAIR-PLAN.md) 使用。
> 最後更新：2026-11-25
> 審核基準主分支：`e6e035776707d4bfb99ab9a1837ad2d477ca9c2d`（PR #39 合併後）
> 本次審核更新分支：`audit/release-pipeline-and-doc-refresh`
> 已確認最新正式版：v1.2.32；v1.2.33 的主分支 Release run #347 當時仍在建置。

## 目前狀態

**總體：持續進行的定向全面審核；尚未宣稱 69 個檔案全部完成逐行審查，也尚未完成 Android 10+ 真機驗收。**

### 已完成的檢查與修復

- [x] 重新取得 GitHub recursive tree，確認 69 個追蹤檔案、82 個 tree entries，結果未截斷；更新完整檔案清單。
- [x] 確認目前 main 已無公開的 `signing/droidpy-debug.p12` 與 `src/services/androidSigningAsset.ts`；歷史 Git 記錄仍保留曾經公開的金鑰風險。
- [x] 驗證 v1.2.31、v1.2.32 Release APK 均由既有受保護簽名設定簽署，SHA-256 指紋保持 `353F581792A659420EAF1E8EC278E7F5F78C8B13F767EA0A9E3DDEA682AEB818`。
- [x] PR #37 合併：修正 App／APK／匯出專案／離線更新版本資料，發布 v1.2.31。
- [x] PR #38 合併：修正外部 Termux Bridge 在串流客戶端斷線時誤殺 Python 程序，發布 v1.2.32。
- [x] PR #39 合併：套件備份 manifest 使用暫存檔、fsync、原子 rename；版本資料同步至 v1.2.33；PR CI run `45608532103` 通過。
- [x] 靜態檢查儲存清理與刪除邊界：一般清理限於暫存／快取／APT archive；Bootstrap 重建有 usr 資料保護條件；SD 卡目標經 canonical path 檢查，UI 刪除需二次確認。
- [x] 檢查 Crawler Cookie 捕獲路徑：特權 Java Bridge 不注入第三方爬蟲 WebView；原生日誌不輸出 Cookie 值；Cookie 仍會存入工作區 `cookies.json`。
- [x] 修正 README 對 Pyodide Python 3.12 與 Termux Python 版本的描述，避免混為同一執行環境。

### 尚未完成／需真機驗收

- [ ] 逐檔完成 69 個檔案的完整逐行審查；目前已優先檢查安全、程序、備份、更新、Bridge 與儲存關鍵路徑。
- [ ] Android 10+ 實機測試：長時間 Python、WebView 斷線後續跑、明確 Stop、方向變更、背景／前景切換。
- [ ] 用使用者現有 APK 安裝升級 v1.2.31／v1.2.32／v1.2.33，確認既有簽名、Termux usr、py_user、工作區與套件完整保留。
- [ ] 測試套件清單在安裝、卸載、掃描不完整及 App 中斷寫入時的恢復行為。
- [ ] Cookie 工作區檔案在 ZIP／工作區備份中的敏感資料提示與保護策略。
- [ ] 大型 usr 目錄的儲存空間遞迴統計效能與 Bridge worker 佔用。
- [ ] npm/Bun lockfile 策略、Termux Bootstrap 固定版本與 SHA-256 驗證。
- [ ] 全部 React 元件、timer、listener、async unmount/cancel 路徑的生命週期審核。
- [ ] 審核仍開啟的 PR #7 診斷功能；目前保持 draft，未直接合併。

## PR / CI 追蹤

| PR | 狀態 | CI／Release |
|---|---|---|
| #7 | 開啟、draft，舊分支診斷功能 | 未合併；待重新審核與 rebase |
| #37 | 已合併 | PR CI 通過；正式 Release v1.2.31 |
| #38 | 已合併 | PR CI run `45607384138` 通過；正式 Release v1.2.32 |
| #39 | 已合併 | PR CI run `45608532103` 通過；正式 Release v1.2.33 當時由 main run #347 建置中 |
| #40 | 審核更新中 | `audit/release-pipeline-and-doc-refresh`；待 CI 驗證 |

## 本輪重點

- 版本：v1.2.33，versionCode 1002033；正式 Release 完成後再核對資產與簽名。
- 簽名：不旋轉、不重建、不更換既有金鑰；每次正式 Release 都比對相同 SHA-256 指紋。
- 發布：每次合併 main 都會觸發正式 ARM64 APK 建置與 GitHub Release；未完成簽名驗證不交付 APK。
- 稽核：CI 成功只代表自動測試／建置通過，不代表已完成 Android 10+ 實機驗收。

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

- SDK migration decision: keep `targetSdkVersion 28` for now. Raising to 29+ can change legacy external-storage and app-home executable behavior used by the embedded Termux `usr/` runtime. Since the app is sideloaded and the priority is preserving Android 10+ private-path execution and package operations, do not raise target SDK until a dedicated Android 10/11/13 test matrix proves the embedded shell, Python, native packages and file access remain functional. Compile SDK/build tooling can be raised independently.


### 2026-11-25 — URL probe SSRF protection (current PR branch)
- Created `security/probe-url-ssrf-guard-v1` from the latest main after PR #21 merged.
- Replaced automatic urllib/HttpURLConnection redirect handling in both Bridge implementations with manual redirects. Every hop resolves and validates all DNS answers, then pins the socket to a validated public IP; HTTPS preserves SNI and certificate hostname verification.
- Rejects loopback/private/link-local/reserved addresses, local hostnames, URL userinfo, unsafe custom headers and control characters. Cross-origin redirects drop Cookie, Authorization and Referer; response previews and timeouts are bounded.
- Added `scripts/check-probe-url-security.mjs` with static checks plus generated-Python tests for private ranges, pinned sockets, loopback redirects and credential stripping; wired it into CI.
- CI and Android ARM64 Debug build are pending. Android 10+ device validation must confirm normal public HTTP/HTTPS crawler probing and safe redirect behavior before merge. No workspace, `usr/`, package, backup or signing data is changed.


### 2026-11-25 — Integrated Termux security PR #26
- Integrated PR #25's DNS-pinned URL probe implementation into the package/data safety branch so one Debug APK covers SSRF protection, package inventory, backup-manifest safety, partial `usr/` preservation, `PYTHONUSERBASE`, CA normalization and APT fail-closed behavior.
- Standalone PR #25 was closed as superseded by PR #26; no duplicate PR remains for URL probe SSRF.
- Integrated CI run `45488075770` passed Python syntax/unit tests, all TypeScript/PWA/security checks, and Android ARM64 Debug APK compile/upload. Artifact: `DroidPy-arm64-debug-179-a1`. Production Release/signature verification and GitHub Release were skipped as expected for a PR.
- Follow-up commits expand regression coverage for special-purpose IPv4/IPv6 ranges, oversized/ambiguous HTTP response headers and strict chunked framing; latest CI is re-running those assertions. Device acceptance on Android 10+ remains pending before merge.


### 2026-11-25 — Bridge request resource limits (dependent on PR #26)
- Created `security/bridge-resource-limits-v3` from the integrated Termux security branch so the resource fix does not reintroduce stale CORS, SSRF, or watchdog code from the older PR #17 branch.
- Python Bridge now rejects duplicate Content-Length and Transfer-Encoding, validates bounded decimal lengths and JSON object bodies, retains the 8 MiB body limit and 15-second socket timeout, and caps active request handlers at 8 with a 16-connection backlog and explicit 503 overload rejection.
- Native Android Bridge now uses a dedicated accept thread plus a bounded 8-worker/16-queue executor, rejects excess clients, caps headers at 16 KiB and bodies at 8 MiB, rejects ambiguous request framing, incomplete bodies and invalid JSON, and preserves the rule that Bridge shutdown must not terminate active user Python work. It also tracks and closes accepted client sockets during shutdown so rapid stop/start cycles do not leave idle handler threads behind.
- Extended `check:bridge` to verify the generated Python and native Kotlin source resource limits and lifecycle guards. CI and Android 10+ device acceptance pending.
- The older PR #17 patch was not merged directly: its stale base and shutdown behavior would conflict with the newer process-preservation fix. Only the required resource protections were ported and adapted.

- Added `scripts/check-script-backup.mjs` and CI command `check:script-backup`: verifies quota failure leaves the old value unchanged, corrupt storage is never overwritten, imports/deletes preserve independent snapshots, and the restore handler saves its rollback snapshot before calling `setFiles`.


### 2026-11-25 — Consolidated PR #27 validation and branch cleanup
- Latest CI run `45496152665` completed SUCCESS: Python syntax/unit tests, TypeScript/PWA build, Bridge token/origin/resource checks, backup persistence tests, watchdog checks, SSRF checks, package inventory/manifest checks, APT security checks, Android ARM64 Debug APK compile and artifact upload.
- Debug APK artifact: `DroidPy-arm64-debug-194-a1`. Production Release build, production signer verification and GitHub Release were correctly skipped for the pull request.
- PR #27 is the sole consolidated integration PR. Superseded PRs #11, #17, #26, #24, #6, #5 and #4 were closed without merging; their relevant code is already in current main or consolidated PR #27.
- PR Debug APKs use the workflow's ephemeral Debug signer. This is not evidence of the production Release signer or installed-app upgrade compatibility. Android 10+ device acceptance remains required before merge, especially package install/import, `pkg update/install`, partial `usr/` preservation, public HTTP/HTTPS probe behavior, Bridge saturation/restart and backup restore.


### 2026-11-25 — APK updater signer compatibility and download hardening (PR #27)
- Replaced the updater's hard-coded legacy certificate fingerprint with a comparison against the currently installed app's signing certificate. On Android 9+, single-signer updates may use a valid signing-certificate rotation history; multi-signer apps require an exact signer set. Android 7–8 uses exact legacy signer comparison.
- Restricts every updater URL/redirect to HTTPS GitHub release asset hosts; redirects are followed manually. Caps APK downloads at 300 MiB, checks declared versus received length, writes to a .part file and fsyncs before verification, and retains the previous downloaded APK until the candidate passes package-ID and signer checks.
- Added scripts/check-apk-updater.mjs and CI command check:apk-updater. CI and Android ARM64 Debug compile pending.

- Updated the main repository Release workflow to derive the expected APK certificate SHA-256 from the same protected keystore secret used by Gradle, then compare it to apksigner output. This removes the obsolete hard-coded legacy fingerprint while still failing closed on missing or mismatched signing material; no private key is reintroduced into source control.

- Reworked the generated Android export workflow: Debug runs use an ephemeral Gradle signer and produce artifacts only; main/master/tag pushes or an explicitly supplied workflow_dispatch release_tag require all protected signing secrets, build a Release APK, and compare its certificate to the configured keystore. Release publication is a separate job with contents:write; the build job is read-only. No missing embedded-key fallback remains.
- Added scripts/check-export-workflow.mjs and CI command check:export-workflow to generate the project ZIP and assert the exported workflow keeps Debug and protected Release paths separate.


### 2026-11-25 — Final consolidated security CI pass
- CI run `45499820682` completed SUCCESS on the signer/updater/export-workflow changes: Python syntax/unit tests, TypeScript/PWA build, Bridge resource/token/origin checks, backup persistence tests, APK updater checks, generated Android export workflow checks, watchdog, SSRF, package inventory and APT security checks all passed.
- Android ARM64 Debug APK compiled and uploaded as `DroidPy-arm64-debug-222-a1`; web artifact `droidpy-web-dist` also uploaded. Production Release build and signer verification were skipped as expected for a PR.
- Closed obsolete signer PRs #2 and #3 after replacing their hard-coded legacy fingerprint checks with protected-keystore-derived Release verification and installed-app signer/lineage validation.
- The latest Debug artifact uses an ephemeral CI signer; it is a test build, not a production Release. A different signer cannot update an existing installation unless Android accepts a valid signing lineage. Do not uninstall an app that contains needed private Termux data/workspace without first securing a backup.
- PR #27 remains open and unmerged pending Android 10+ device acceptance. Target SDK remains 28 until Termux executable/private-path compatibility is validated on device.

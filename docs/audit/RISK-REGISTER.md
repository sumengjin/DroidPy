# Risk register — DroidPy

> Baseline: `main` at `450232e8a4d4ff1e4dc6ab14296433a0e498ace2`
> Last reviewed: 2026-11-25 — refreshed after PRs #12/#13 merged
> Status labels: OPEN / INVESTIGATING / FIX IN PROGRESS / VERIFIED FIX / ACCEPTED BLOCKER
> No item is marked fixed without code review and relevant CI/device evidence.

| ID | Severity | Area | Evidence / impact | Status | Next action |
|---|---|---|---|---|---|
| R-001 | P0 Critical | Production APK signer private key publicly exposed | PR #12 is merged (`34ae4058b8afd92035145dcc731762ffa3fcbb4e`): the current tree no longer contains the PKCS#12 file/Base64 private-key source and production signing now requires protected Actions secrets; public Git history and prior APKs remain compromised. The connector cannot create or inspect Actions secrets. | CONTAINMENT CODE MERGED; SIGNING CONFIGURATION BLOCKED | Preserve the existing update identity until a tested rotation plan exists. Verify secret provisioning through a trusted owner-controlled process, then validate Android 10/11/13 in-place upgrades. Do not publish or rotate based on assumptions. |
| R-002 | P0 High | Termux HTTP Bridge authentication | PR #11 contains per-install native random tokens, per-browser random tokens, removal of static fallback, and external-backup token redaction. It is still open on an older base commit and must be rebased/reviewed before integration. | FIX IN PROGRESS (PR #11; stale base) | Rebase onto current main; verify WebView-origin boundary from PR #15 and test token persistence, backup/restore and PWA migration. |
| R-003 | P0 High | Bridge CORS / PNA | PR #11 changes both Bridge implementations to exact-origin/Host checks and removes wildcard CORS; it remains unmerged and needs PWA/file-origin compatibility tests. | FIX IN PROGRESS (PR #11; stale base) | Rebase and test exact origin, Origin:null fallback, preflight, Host spoofing and cross-origin negative cases on Android WebView. |
| R-004 | P0 High | URL probe SSRF | Bridge exposes URL probing from the device network. Private/local/metadata targets and redirect/DNS rebinding behavior require validation. | OPEN | Review `/probe-url` in both implementations; enforce protocol, address-class, redirect and DNS checks or remove unnecessary capability. |
| R-005 | P1 High | Process watchdog false termination | Termux service tracks an active process and defines a 1,800-second watchdog threshold. Runtime elapsed time is not proof of a hung process; legitimate long-running tasks may be terminated. | OPEN | Replace age-only cleanup with explicit managed-process ownership/heartbeat/cancel state and tests for long tasks/child processes. |
| R-006 | P1 High | Backup reports success without persistence | PR #9 merged (`6266f67016dd173dd422b545d7565e5c9954ba24`): failed writes now throw without evicting old snapshots, malformed stores are not overwritten, and script restore is blocked unless the pre-restore snapshot is saved. Final PR CI run `45471301643` passed TypeScript/lint and web build; Android job was skipped because this is web-localStorage logic. | VERIFIED FIX (web CI) | Retain device-level regression coverage for quota/corrupt-store scenarios; verify export/import and restore behavior after future storage changes. |
| R-007 | P1 High | Package inventory/backup manifest | Existing PR #6 addresses inventory false negatives, but manifest shrink and incomplete scan behavior still require audit and tests. | INVESTIGATING | Rebase/review PR #6 against latest main; test multiple Python paths and ensure incomplete inventory never shrinks backup manifest. |
| R-008 | P1 High | Termux bootstrap data preservation | Bootstrap path can classify damaged markers/core files as fresh install; PR #5 adds non-empty usr protection but does not fully restore damaged runtime. | INVESTIGATING | Review all bootstrap entry points and failure states; guarantee non-empty usr is never destructively replaced. |
| R-009 | P1 High | pip SSL / user-site path | PR #4 changes CA PEM handling and user-site activation; device reported successful package installation and short close/reopen persistence. Long-term/reboot persistence and all TLS cases are not yet proven. | INVESTIGATING | Re-review PR #4 and generated Python; add CA encoding and Android persistence tests. |
| R-010 | P1 High | APK updater integrity | PR #3 adds signer checks; current release metadata exposes SHA-256 asset digest. Need verify the complete download/install path and failure handling on device. | INVESTIGATING | Review full PR diff and native installer callback; verify digest, package ID, signer, version and cleanup behavior. |
| R-011 | P1 Medium | CI permission scope | PR #13 merged (`450232e8a4d4ff1e4dc6ab14296433a0e498ace2`): workflow default is `contents: read`; only the Release job receives `contents: write`. PR CI `45474423204` passed web build; APK and Release jobs were skipped as expected. | VERIFIED FIX (CI) | Keep future jobs least-privileged; separately audit third-party action pinning and fork PR behavior. |
| R-012 | P1 Medium | Dependency reproducibility | `bun.lock` is present but CI uses npm install (with fallback); package ranges use caret semver. Bootstrap download uses a moving `releases/latest` URL in build workflow. | OPEN | Choose one lockfile/package manager, use frozen install, pin bootstrap version and verify SHA-256. |
| R-013 | P2 Medium | Version metadata drift | App built-in release history reaches v1.2.16 while GitHub releases reach v1.2.18; package.json is 0.0.0 and README says Python 3.12. | OPEN | Establish a single version source; align metadata/docs with generated APK facts. |
| R-014 | P2 Medium | Storage and cleanup safety | App includes storage cleanup and sdcard file operations; full path/symlink/allowlist and category safety audit is not complete. | OPEN | Review all cleanup/delete routes; default to read-only diagnostics and preserve usr, py_user, workspace and unique backups. |
| R-015 | P2 Medium | WebView/Crawler/session privacy | Crawler handles authenticated cookies including HttpOnly cookies; lifecycle, export, logging and cross-site boundaries need dedicated review. | OPEN | Audit CookieManager bridge, persistence, redaction, external navigation and data export. |
| R-016 | P2 Medium | Full UI/runtime lifecycle | Large App/components/services have timers, listeners, async operations and storage state; no full race/leak audit yet. | OPEN | Complete per-module review, tests for cancellation/unmount/repeated open-close and bounded logging. |
| R-017 | P1 High | Bridge request resource exhaustion | PR #14 adds bounded body/header sizes, socket timeouts and bounded concurrency to Python and native Bridge. CI run `45474774819` passed both web build and Android ARM64 APK build; Release was skipped. PR #14 is based on an older main SHA and remains unmerged. | FIX IN PROGRESS (PR #14; CI passed, stale base) | Rebase onto current main; review generated Kotlin/Python and add slow/oversized client tests plus Android runtime verification. |
| R-018 | P1 High | APT package/repository trust disabled | Main generated runtime config previously enabled `AllowInsecureRepositories`, `AllowDowngradeToInsecureRepositories`, `AllowUnauthenticated`, added `[trusted=yes]` to Termux sources, and disabled HTTPS peer/host checks if no CA bundle existed. PR #16 removes these bypasses, strips legacy `[trusted=yes]`, and adds a CI regression test. | FIX IN PROGRESS (PR #16) | Require CI and generated Android APK build; test existing bootstrap keyring/CA bundle and `pkg update`/`pkg install` on Android 11/13. Missing trust material must fail closed, never disable verification. |

## Immediate ordering

1. R-001 signer incident verification and safe containment plan (no key rotation without tested update compatibility).
2. R-002/R-003/R-004 localhost Bridge security.
3. R-006 backup persistence correctness (small, isolated, high-value data-safety fix).
4. R-005 process watchdog.
5. R-007/R-008/R-009 package persistence and bootstrap.
6. R-010 updater, R-011/R-012 supply chain, then remaining full-tree items.

## Evidence policy

- A source-code observation is not a runtime exploit proof.
- A successful web build is not an Android APK build.
- An Android APK build is not an Android device acceptance test.
- A successful short close/reopen test does not prove persistence after reboot or extended idle.
- A key fingerprint in a source comment does not prove that the distributed APK was signed by that key.
- Mark VERIFIED FIX only after the exact relevant test has passed and evidence is linked.

| R-019 | P0 High | Privileged WebView navigation boundary | PR #15 replaces permissive URL prefix/host checks with exact app origin or exact bundled file path, blocks child frames, disables file-origin cross-file/universal access and adds CSP frame/object restrictions. Web CI passed; Android APK build is still running. | FIX IN PROGRESS (PR #15) | Review redirect/intent edge cases and validate navigation + JavaScript bridge isolation on Android 10/11/13 before merge. |
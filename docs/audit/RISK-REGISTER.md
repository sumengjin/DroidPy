# Risk register — DroidPy

> Baseline: `main` at `e8956f09d1463cd665322edd5dc7821df0fcd014`
> Last reviewed: 2026-11-25
> Status labels: OPEN / INVESTIGATING / FIX IN PROGRESS / VERIFIED FIX / ACCEPTED BLOCKER
> No item is marked fixed without code review and relevant CI/device evidence.

| ID | Severity | Area | Evidence / impact | Status | Next action |
|---|---|---|---|---|---|
| R-001 | P0 Critical | Production APK signer private key publicly exposed | Public tree contains `signing/droidpy-debug.p12` and Base64 PKCS#12 private-key material in `src/services/androidSigningAsset.ts`. v1.2.18 workflow run `45444107279` explicitly logged use of the fixed repository fallback key; its successful `apksigner` output reported the same SHA-256 certificate fingerprint embedded in source. This confirms the publicly exposed private key is the production signer identity. | CONFIRMED INCIDENT — CONTAINMENT REQUIRED | Preserve existing install upgrade compatibility; design staged Android signing-key rotation with proof-of-rotation/lineage for Android 10+, test upgrades from v1.2.18 on Android 11/13, and immediately prevent future release builds from silently using public source key material. GitHub Actions secrets cannot be written/read by the available connector; do not claim they are configured. Do not rotate until a tested update path exists. |
| R-002 | P0 High | Termux HTTP Bridge authentication | Previous code used a fixed token compiled into the APK and external Bridge script. PR #11 generates a 256-bit random token per native install, generates a random browser/PWA token, removes static fallback tokens, and redacts the native token from shared-storage state backup. | FIX IN PROGRESS (PR #11) | Validate Android runtime token lifecycle and PWA token migration; confirm the JS interface is only reachable from the trusted WebView after PR #10. |
| R-003 | P0 High | Bridge CORS / PNA | Previous Python and native Bridge used wildcard CORS and always allowed Private Network Access. PR #11 binds Python Bridge scripts to the exact app origin, validates Host/Origin, and emits PNA permission only for an exact-origin preflight; native Bridge now uses a build-mode-specific exact origin and validates Host/Origin. | FIX IN PROGRESS (PR #11) | Validate preflight behavior on Android WebView and PWA browsers, including file fallback (`Origin: null`) and remote-origin fallback. |
| R-004 | P0 High | URL probe SSRF | Bridge exposes URL probing from the device network. Private/local/metadata targets and redirect/DNS rebinding behavior require validation. | OPEN | Review `/probe-url` in both implementations; enforce protocol, address-class, redirect and DNS checks or remove unnecessary capability. |
| R-005 | P1 High | Process watchdog false termination | Termux service tracks an active process and defines a 1,800-second watchdog threshold. Runtime elapsed time is not proof of a hung process; legitimate long-running tasks may be terminated. | OPEN | Replace age-only cleanup with explicit managed-process ownership/heartbeat/cancel state and tests for long tasks/child processes. |
| R-006 | P1 High | Backup reports success without persistence | `scriptBackup.ts` drops oldest snapshots until storage write succeeds; if all writes fail it returns `[]`, while `createScriptBackup` still returns the snapshot. Restore caller does not verify durable pre-restore backup before replacing current files. | OPEN | Return explicit persisted status; never claim success or proceed with destructive restore when pre-restore snapshot was not durably saved. Preserve old snapshots on failed write. |
| R-007 | P1 High | Package inventory/backup manifest | Existing PR #6 addresses inventory false negatives, but manifest shrink and incomplete scan behavior still require audit and tests. | INVESTIGATING | Rebase/review PR #6 against latest main; test multiple Python paths and ensure incomplete inventory never shrinks backup manifest. |
| R-008 | P1 High | Termux bootstrap data preservation | Bootstrap path can classify damaged markers/core files as fresh install; PR #5 adds non-empty usr protection but does not fully restore damaged runtime. | INVESTIGATING | Review all bootstrap entry points and failure states; guarantee non-empty usr is never destructively replaced. |
| R-009 | P1 High | pip SSL / user-site path | PR #4 changes CA PEM handling and user-site activation; device reported successful package installation and short close/reopen persistence. Long-term/reboot persistence and all TLS cases are not yet proven. | INVESTIGATING | Re-review PR #4 and generated Python; add CA encoding and Android persistence tests. |
| R-010 | P1 High | APK updater integrity | PR #3 adds signer checks; current release metadata exposes SHA-256 asset digest. Need verify the complete download/install path and failure handling on device. | INVESTIGATING | Review full PR diff and native installer callback; verify digest, package ID, signer, version and cleanup behavior. |
| R-011 | P1 Medium | CI permission scope | `.github/workflows/droidpy.yml` sets `contents: write` at workflow scope. Test job does not need write permission. | OPEN | Move permissions to jobs; test read-only PR job and preserve write only for trusted release job. |
| R-012 | P1 Medium | Dependency reproducibility | `bun.lock` is present but CI uses npm install (with fallback); package ranges use caret semver. Bootstrap download uses a moving `releases/latest` URL in build workflow. | OPEN | Choose one lockfile/package manager, use frozen install, pin bootstrap version and verify SHA-256. |
| R-013 | P2 Medium | Version metadata drift | App built-in release history reaches v1.2.16 while GitHub releases reach v1.2.18; package.json is 0.0.0 and README says Python 3.12. | OPEN | Establish a single version source; align metadata/docs with generated APK facts. |
| R-014 | P2 Medium | Storage and cleanup safety | App includes storage cleanup and sdcard file operations; full path/symlink/allowlist and category safety audit is not complete. | OPEN | Review all cleanup/delete routes; default to read-only diagnostics and preserve usr, py_user, workspace and unique backups. |
| R-015 | P2 Medium | WebView/Crawler/session privacy | Crawler handles authenticated cookies including HttpOnly cookies; lifecycle, export, logging and cross-site boundaries need dedicated review. | OPEN | Audit CookieManager bridge, persistence, redaction, external navigation and data export. |
| R-016 | P2 Medium | Full UI/runtime lifecycle | Large App/components/services have timers, listeners, async operations and storage state; no full race/leak audit yet. | OPEN | Complete per-module review, tests for cancellation/unmount/repeated open-close and bounded logging. |
| R-017 | P1 High | Bridge request resource exhaustion | Previous Python Bridge read arbitrary `Content-Length` and native Bridge allocated a byte array directly from request length. PR #11 adds an 8 MiB body cap and 15-second socket read timeout to both implementations. Cached-thread-pool concurrency is still not bounded. | FIX IN PROGRESS (PR #11; partial) | Add bounded concurrency and malformed/oversized/slow-request integration tests; verify timeouts do not interrupt legitimate long-running streamed jobs. |
| R-018 | P1 High | APT TLS verification fallback | Generated Android bootstrap code writes APT config with `Acquire::https::Verify-Peer=false` and `Verify-Host=false` when no CA file is found. This weakens package download authenticity exactly when trust configuration is unavailable. | OPEN | Remove insecure fallback; use a verified system/Termux CA source or fail closed with a clear repair message. Test bootstrap with missing/corrupt CA bundle. |

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

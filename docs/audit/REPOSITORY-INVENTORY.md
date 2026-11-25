# Repository inventory — DroidPy

> Audit baseline: `main` at `e6e035776707d4bfb99ab9a1837ad2d477ca9c2d` (before this audit-refresh PR)
> Inventory refreshed: 2026-11-25
> Source: GitHub recursive tree API (`truncated=false`)
> Scope: tracked repository files only; generated Android project contents and Git history are reviewed separately.

## Repository size and layout

The main branch snapshot contains **69 tracked files** across 82 tree entries (69 files and 13 directories). The recursive tree was not truncated.

| Area | Files | Audit focus |
|---|---:|---|
| Root config, app metadata and workflow | 11 | package manager/lock, CI permissions, versioning, environment examples |
| Audit documentation | 5 | current inventory, risk register, signing incident and progress |
| Public media | 5 | PWA icons and static assets |
| Scripts | 9 | regression checks, Android project preparation |
| React/TypeScript source | 39 | UI lifecycle, storage, Bridge, updater, crawler and generated native Android code |
| **Total** | **69** | |

## Tracked file inventory

### Root, build and workflow (11)
- `.env.example`
- `.github/workflows/droidpy.yml`
- `.gitignore`
- `CHANGELOG.md`
- `README.md`
- `bun.lock`
- `index.html`
- `metadata.json`
- `package.json`
- `tsconfig.json`
- `vite.config.ts`

### Audit documentation (5)
- `docs/audit/COMPREHENSIVE-REPAIR-PLAN.md`
- `docs/audit/PROGRESS.md`
- `docs/audit/REPOSITORY-INVENTORY.md`
- `docs/audit/RISK-REGISTER.md`
- `docs/audit/SIGNING-INCIDENT-AND-ROTATION-ANALYSIS.md`

### Public assets (5)
- `public/apple-touch-icon.png`
- `public/icon.svg`
- `public/pwa-192x192.png`
- `public/pwa-512x512.png`
- `public/pwa-maskable-512x512.png`

### Scripts (9)
- `scripts/check-apk-updater.mjs`
- `scripts/check-apt-security.mjs`
- `scripts/check-bridge.mjs`
- `scripts/check-export-workflow.mjs`
- `scripts/check-package-inventory.mjs`
- `scripts/check-probe-url-security.mjs`
- `scripts/check-script-backup.mjs`
- `scripts/check-watchdog-safety.mjs`
- `scripts/prepare-android.ts`

### Application and UI (15)
- `src/App.tsx`
- `src/main.tsx`
- `src/index.css`
- `src/components/AndroidSymbolBar.tsx`
- `src/components/AppExecutionLogModal.tsx`
- `src/components/AppUpdateModal.tsx`
- `src/components/CodeEditor.tsx`
- `src/components/CrawlerBrowserPanel.tsx`
- `src/components/DynamicAtmosphere3D.tsx`
- `src/components/FileExplorer.tsx`
- `src/components/HelpTutorialModal.tsx`
- `src/components/InternalStoragePanel.tsx`
- `src/components/NegativeScreenDrawer.tsx`
- `src/components/PWAInstallButton.tsx`
- `src/components/TerminalPanel.tsx`

### Termux integration and data (5)
- `src/components/TermuxIntegrationPanel.tsx`
- `src/components/ToolsAndPackages.tsx`
- `src/data/defaultFiles.ts`
- `src/data/packageCatalog.ts`
- `src/version.ts`

### Hooks (3)
- `src/hooks/useDeviceLayout.ts`
- `src/hooks/useOnlineStatus.ts`
- `src/hooks/usePWAInstall.ts`

### Services (10)
- `src/services/androidApkBuilder.ts` (generates Android Kotlin, Gradle, Manifest, Bridge and export workflow)
- `src/services/androidIconAssets.ts`
- `src/services/appLogger.ts`
- `src/services/appUpdater.ts`
- `src/services/i18n.tsx`
- `src/services/pyodideRuntime.ts`
- `src/services/scriptBackup.ts`
- `src/services/storageManager.ts`
- `src/services/termuxBridge.ts`
- `src/services/themes.ts`

### Types and utilities (6)
- `src/types/ide.ts`
- `src/utils/ansiParser.tsx`
- `src/utils/clipboard.ts`
- `src/utils/crawlerSession.ts`
- `src/utils/downloadBlob.ts`
- `src/utils/formatDuration.ts`

## Verified observations

1. The current main tree no longer contains `signing/droidpy-debug.p12` or `src/services/androidSigningAsset.ts`. The historical public-key exposure remains a Git-history compromise; this inventory does not claim the old key was erased from history.
2. Formal Releases v1.2.31 and v1.2.32 were built with the protected Actions signer. The APK signer SHA-256 remained `353F581792A659420EAF1E8EC278E7F5F78C8B13F767EA0A9E3DDEA682AEB818`. Device upgrade compatibility still requires installation testing.
3. README now distinguishes Pyodide's Python 3.12 runtime from the Python version supplied by the embedded Termux Bootstrap.
4. Package metadata now uses `droidpy` and a release-aligned version. `bun.lock` exists, but CI still installs with npm rather than a frozen lockfile; dependency reproducibility remains open.
5. Native Kotlin and the exported GitHub workflow are generated from `src/services/androidApkBuilder.ts`; tests must validate both the source template and generated project.
6. The crawler Cookie capture stores session cookies in workspace `cookies.json`. Native logs avoid cookie values, but workspace backups and ZIP exports may include that file; this remains a privacy-review item.

## Audit coverage and limitations

This is a verified repository inventory plus a targeted static review of security-sensitive paths (Bridge authentication/CORS, URL probing, process lifecycle, package inventory/backup, bootstrap preservation, storage deletion boundaries, updater signing, WebView navigation and Cookie capture). It is **not** a claim that all 69 files have received a complete line-by-line audit or that Android 10+ device acceptance is complete.

Remaining work includes full UI lifecycle review, Android 10+ storage and upgrade tests, cookie export privacy, dependency-lock reproducibility, bounded storage-usage scanning, and review of the still-draft package diagnostics PR #7.

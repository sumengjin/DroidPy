# Repository inventory — DroidPy

> Audit baseline: `main` at `e8956f09d1463cd665322edd5dc7821df0fcd014`
> Inventory refreshed: 2026-11-25
> Source: GitHub recursive tree API (`truncated=false`)
> Scope: tracked repository files only; generated Android project contents and Git history require separate inspection.

## Repository size and layout

The current tree contains **58 tracked files** (including binary assets). Main areas:

| Area | Files | Audit focus |
|---|---:|---|
| GitHub Actions | 1 | permissions, trigger conditions, fork PR trust, signing and Release gates |
| Root config/docs | 9 | dependency lock, package metadata, README/version consistency, environment examples |
| Android generator | 1 | generated Kotlin/Gradle/Manifest/WebView/Bridge, signing, permissions, storage |
| Android preparation script | 1 | generated project reproducibility |
| Signing assets | 2 | exposed PKCS#12 and embedded Base64 private-key material |
| React application | 1 | lifecycle, state, async races, storage migration, destructive actions |
| UI components | 13 | editor, crawler, file manager, storage, terminal, update, package UI |
| Data/catalog | 2 | embedded templates and package catalog |
| Hooks | 3 | timers/listeners and lifecycle cleanup |
| Services | 11 | APK builder, Termux Bridge, updater, backup, storage, logger, Pyodide, i18n |
| Types | 1 | bridge and diagnostic contracts |
| Utilities | 6 | crawler session, ANSI, clipboard, download, formatting |
| Public media | 5 | icons/PWA assets |
| Styles/entry | 3 | CSS, HTML/React entry, Vite config |
| Other | 1 | metadata |

## Tracked file inventory

### Root, build and workflow
- `.env.example`
- `.github/workflows/droidpy.yml`
- `.gitignore`
- `CHANGELOG.md`
- `README.md`
- `bun.lock`
- `index.html`
- `metadata.json`
- `package.json`
- `scripts/prepare-android.ts`
- `tsconfig.json`
- `vite.config.ts`

### Public assets
- `public/apple-touch-icon.png`
- `public/icon.svg`
- `public/pwa-192x192.png`
- `public/pwa-512x512.png`
- `public/pwa-maskable-512x512.png`

### Android/signing
- `signing/droidpy-debug.p12`
- `src/services/androidSigningAsset.ts`
- `src/services/androidApkBuilder.ts` (generates the Android project, native Kotlin and workflow)

### Application and components
- `src/App.tsx`
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
- `src/components/TermuxIntegrationPanel.tsx`
- `src/components/ToolsAndPackages.tsx`

### Data, hooks, services, types and utilities
- `src/data/defaultFiles.ts`
- `src/data/packageCatalog.ts`
- `src/hooks/useDeviceLayout.ts`
- `src/hooks/useOnlineStatus.ts`
- `src/hooks/usePWAInstall.ts`
- `src/index.css`
- `src/main.tsx`
- `src/services/androidIconAssets.ts`
- `src/services/appLogger.ts`
- `src/services/appUpdater.ts`
- `src/services/i18n.tsx`
- `src/services/pyodideRuntime.ts`
- `src/services/scriptBackup.ts`
- `src/services/storageManager.ts`
- `src/services/termuxBridge.ts`
- `src/services/themes.ts`
- `src/types/ide.ts`
- `src/utils/ansiParser.tsx`
- `src/utils/clipboard.ts`
- `src/utils/crawlerSession.ts`
- `src/utils/downloadBlob.ts`
- `src/utils/formatDuration.ts`
- `src/version.ts`

## Initial verified observations

1. The tracked tree includes a binary PKCS#12 file at `signing/droidpy-debug.p12` and an application source file `src/services/androidSigningAsset.ts` containing a Base64-encoded PKCS#12 asset. The source comments expose the associated certificate fingerprint. This proves private signing material is present in public source control; it does **not yet prove** that the same key signed the currently distributed APK. Treat as a P0 key-exposure incident until cryptographic comparison is completed.
2. `src/services/termuxBridge.ts` defines a default fixed bridge token and its Python server generator falls back to that token when the supplied token is empty. The same service generates a localhost HTTP server with broad CORS/Private Network Access behavior. The generated native Android bridge in `src/services/androidApkBuilder.ts` must be audited separately; fixing only one implementation is insufficient.
3. `src/services/scriptBackup.ts` removes older snapshots under localStorage quota pressure. When all writes fail it returns an empty list, but `createScriptBackup` still returns the newly constructed snapshot. Callers can therefore report a backup that was not persisted. The restore flow creates a pre-restore backup but does not verify persistence before replacing in-memory files.
4. `package.json` has no package version aligned to the app release (currently `0.0.0`) and declares broad semver ranges. `bun.lock` exists while CI uses npm installation; the lockfile/installer strategy is inconsistent.
5. The main workflow declares `contents: write` globally, although the test job only needs read access. Build/release jobs should receive only the permissions they require.
6. `src/services/appUpdater.ts` contains built-in local release history through v1.2.16, while GitHub Releases currently include v1.2.18. `src/version.ts` and README runtime claims also require reconciliation against generated APK metadata and actual embedded Termux Python.
7. `README.md` describes Python 3.12 and the exported APK workflow. The previously observed runtime traceback reported Python 3.14. Treat documentation/runtime mismatch as unverified until the generated bootstrap and device environment are checked.

## Audit coverage

This is a repository file inventory and initial static review, not a claim that all 58 files have received line-by-line security review. Native Kotlin is generated inside `androidApkBuilder.ts`; audit its generated output and all security-sensitive routes as first-class code. Git history, binary keystore contents, release APK signer identity, runtime behavior, and Android 10+ storage behavior remain separate verification tasks.

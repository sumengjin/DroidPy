import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, bridgeSource, catalogSource, exportSource, panelSource, terminalSource, appSource, settingsWorkspaceSource, i18nSource, crawlerSessionSource, frostworkSource, frostworkMetadata] = await Promise.all([
  readFile(new URL('../src/services/androidApkBuilder.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/services/termuxBridge.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/data/packageCatalog.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/ToolsAndPackages.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/TermuxIntegrationPanel.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/TerminalPanel.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/SettingsWorkspace.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/services/i18n.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/utils/crawlerSession.ts', import.meta.url), 'utf8'),
  readFile(new URL('../android/app/src/main/assets/python/frostwork/__init__.py', import.meta.url), 'utf8'),
  readFile(new URL('../android/app/src/main/assets/python/frostwork-0.2.2.dist-info/METADATA', import.meta.url), 'utf8'),
]);

const catalogItems = catalogSource.split(/\n  \{\n    id: '/).slice(1);
assert.ok(catalogItems.length >= 70, 'package catalog should retain its complete inventory');
const themeCardNamesBlock = exportSource.match(/const THEME_CARD_NAMES:[\s\S]*?\n};/)?.[0];
assert.ok(themeCardNamesBlock, 'theme selector must define compact card labels');
const themeCardLabels = [...themeCardNamesBlock.matchAll(/'zh-TW': '([^']+)'/g)].map((match) => match[1]);
assert.equal(themeCardLabels.length, 14, 'all 14 built-in themes must have a card label');
assert.ok(themeCardLabels.every((label) => [...label].length === 4), 'Traditional Chinese theme card labels must be exactly four characters');
assert.match(frostworkSource, /def navigation\(/, 'pure-Python Frostwork navigation fallback must be bundled');
assert.match(frostworkSource, /class Page:/, 'pure-Python multi-field extraction API must be bundled');
assert.match(frostworkSource, /def _css_nodes\(/, 'CSS selector fallback must be bundled');
assert.match(frostworkSource, /def _xpath_nodes\(/, 'XPath selector fallback must be bundled');
assert.ok(frostworkMetadata.includes('Name: frostwork') && frostworkMetadata.includes('Version: 0.2.2'));
assert.ok(crawlerSessionSource.includes("DEFAULT_CRAWLER_URL = 'https://www.google.com/'"), 'Google must be the default crawler homepage');
assert.ok(crawlerSessionSource.includes('? DEFAULT_CRAWLER_URL'), 'empty browser address input must resolve to the Google homepage');
assert.ok(appSource.includes("restored.url.trim() === 'https://quotes.toscrape.com/'") && appSource.includes('restored.url = DEFAULT_CRAWLER_URL'), 'existing installs must migrate the previous built-in demo homepage while preserving custom URLs');
assert.match(source, /crawlerNavigationStartedAt/, 'native crawler must track page navigation timing');
assert.match(source, /Page started url=/, 'native crawler must log navigation start');
assert.match(source, /Page finished durationMs=/, 'native crawler must log completed page load duration');
assert.match(source, /request\?\.isForMainFrame == true/, 'native crawler must distinguish main-frame errors from subresource errors');
assert.match(source, /Pure-Python Frostwork fallback seed warning/);
assert.match(source, /hasNativeFrostwork/, 'a real upstream Frostwork install must take precedence');
assert.match(source, /isOurFallbackMetadata/, 'fallback cleanup must not delete unrelated user metadata');
assert.match(source, /if \(!fallbackInit\.exists\(\) \|\| isOurFallback\)/, 'custom user modules must never be overwritten');

assert.ok(source.includes('python/frostwork/__init__.py'));

for (const item of catalogItems) {
  const packageId = item.match(/^([^']+)/)?.[1] || 'unknown';
  assert.match(
    item,
    /termux:\s*\{\s*mode:\s*'(?:pip|pkg)',\s*targetName:\s*'[^']+'\s*\}/,
    `Termux install route must be explicit for catalog package ${packageId}`
  );
}
assert.match(bridgeSource, /matplotlib:\s*'matplotlib'/);
assert.match(catalogSource, /id: 'pandas',[\s\S]*?termux: \{ mode: 'pkg', targetName: 'python-pandas' \}/);
assert.match(catalogSource, /id: 'matplotlib',[\s\S]*?termux: \{ mode: 'pkg', targetName: 'matplotlib' \}/);
assert.match(catalogSource, /id: 'psutil',[\s\S]*?termux: \{ mode: 'pkg', targetName: 'python-psutil' \}/);
assert.match(catalogSource, /id: 'msgpack',[\s\S]*?termux: \{ mode: 'pkg', targetName: 'python-msgpack' \}/);
assert.match(catalogSource, /id: 'grpcio',[\s\S]*?termux: \{ mode: 'pkg', targetName: 'python-grpcio' \}/);
assert.match(catalogSource, /id: 'brotli',[\s\S]*?termux: \{ mode: 'pkg', targetName: 'python-brotli' \}/);
assert.match(catalogSource, /id: 'bcrypt',[\s\S]*?termux: \{ mode: 'pkg', targetName: 'python-bcrypt' \}/);
assert.match(catalogSource, /id: 'pycryptodomex',[\s\S]*?termux: \{ mode: 'pkg', targetName: 'python-pycryptodomex' \}/);
assert.match(catalogSource, /id: 'apsw',[\s\S]*?termux: \{ mode: 'pkg', targetName: 'python-apsw' \}/);
assert.match(catalogSource, /id: 'tflite-runtime',[\s\S]*?termux: \{ mode: 'pkg', targetName: 'python-tflite-runtime' \}/);
assert.match(catalogSource, /id: 'torch',[\s\S]*?termux: \{ mode: 'pkg', targetName: 'python-torch' \}/);
assert.match(catalogSource, /id: 'torchvision',[\s\S]*?termux: \{ mode: 'pkg', targetName: 'python-torchvision' \}/);
assert.match(catalogSource, /id: 'torchaudio',[\s\S]*?termux: \{ mode: 'pkg', targetName: 'python-torchaudio' \}/);

assert.match(source, /'w3lib>=2\.6' parsel/, 'embedded APK installs must use the bundled pure-Python fallback');
assert.match(source, /w3lib>=2\.6/, 'embedded terminal routing must use the fallback');
assert.match(bridgeSource, /w3lib<2\.6/, 'standalone Termux bridge must retain its independent compatibility pin');

assert.match(catalogSource, /外部 Termux 固定 w3lib<2\.6；APK 內建環境使用 Frostwork 純 Python 相容層支援 w3lib 2\.6\+/);
assert.match(bridgeSource, /getTermuxNativePackageName\(cleaned\[0\]\)/, 'pip inventory uninstall must resolve native APT package names');
assert.match(bridgeSource, /polars: 'python-polars'/, 'TUR Polars must retain its native package mapping');
assert.match(bridgeSource, /scipy: 'python-scipy'/, 'SciPy must use the official Termux native package mapping');
assert.match(panelSource, /item\.id === 'polars' \? 'python-polars' : tmx\.targetName/, 'TUR Polars installed state must read the APT inventory');
assert.match(catalogSource, /Termux User Repository（TUR）預編譯套件提供/);
assert.match(source, /"polars" to "python-polars"/);
assert.match(source, /"scipy" to "python-scipy"/, 'backup restore must use the official native SciPy package');
assert.match(source, /val needsTurPolars = "python-polars" in missingPkgsOnly[\s\S]*?pkg update -y && pkg install -y tur-repo && pkg update -y/, 'Polars restore must refresh official package metadata before enabling TUR');
assert.match(source, /val packagesWithoutTur = missingPkgsOnly\.filter \{ it != "python-polars" \}/, 'TUR-only packages must not block restoration of official Termux packages');
assert.match(source, /if pkg install -y python-polars; then[\s\S]*?all other restore steps will continue/, 'optional Polars failure must not abort the remaining restore process');
assert.match(source, /"python-polars" in missingPkgsOnly/);
assert.match(source, /it\.isFile && it\.canExecute\(\)/, 'Python readiness must require an executable interpreter');
assert.match(source, /it\.name\.startsWith\("python3\."\)[\s\S]*?it\.canExecute\(\)/, 'Python readiness must support versioned Termux interpreter binaries');
assert.match(source, /if \(pythonCmd == null\)[\s\S]*?pip restore was skipped/, 'missing Python must skip only pip restoration instead of aborting native package restoration');
assert.match(source, /val safePkgName = Regex\("""\^\[A-Za-z0-9\]\[A-Za-z0-9\+\.\-\]\*\$"""\)/, 'APT package names from backup manifests must be validated before shell use');
assert.match(source, /if \(!safePkgName\.matches\(v\)\)/, 'invalid APT backup entries must be skipped');
assert.match(source, /Skipped invalid APT package names in backup manifest/);
assert.match(source, /var bestUpdatedAt = Long\.MIN_VALUE/);
assert.match(source, /val updatedAt = obj\.optLong\("updatedAt", 0L\)/);
assert.match(source, /updatedAt > bestUpdatedAt \|\| \(updatedAt == bestUpdatedAt && score > bestScore\)/, 'newer package snapshots must win over stale larger backups');
assert.doesNotMatch(panelSource, /python-lxml libxml2 libxslt clang/);
assert.doesNotMatch(panelSource, /pip install requests beautifulsoup4 lxml httpx/);
assert.match(panelSource, /PackagePlus/, 'Termux package action icon must be imported when used');
assert.doesNotMatch(appSource, /handleInitializeEmbeddedEnv|onQuickInitEmbedded/, 'removed manual initialization callback must not remain wired');
assert.doesNotMatch(terminalSource, /onQuickInitEmbedded/, 'terminal must not expose the removed manual initialization action');
assert.match(terminalSource, /tmx_py_missing/, 'terminal must explain automatic first-use Python installation');
assert.match(appSource, /const ensureEmbeddedPythonEnvironment = useCallback/);
assert.match(appSource, /pkg update -y && pkg install -y python python-pip/);
assert.doesNotMatch(appSource, /pkg install -y python python-pip python-lxml|clang/);
assert.match(appSource, /await ensureEmbeddedPythonEnvironment\(\)/);
assert.match(appSource, /Unable to verify Python before first use/);
const certifiHandler = appSource.slice(appSource.indexOf('const handleRebuildPipCertifi'), appSource.indexOf('const handleRestoreScriptBackup'));
assert.ok(certifiHandler.length > 0, 'SSL repair handler must remain present');
assert.match(certifiHandler, /update_pip_config_preserving_existing_settings/, 'SSL repair must preserve existing pip configuration');
assert.match(certifiHandler, /stat\.S_IMODE\(os\.stat\(cfg_path\)\.st_mode\)/, 'SSL repair must preserve existing pip.conf permissions');
assert.match(certifiHandler, /os\.replace\(tmp_path, cfg_path\)/, 'SSL repair must atomically replace pip configuration');
assert.doesNotMatch(certifiHandler, /with open\(cfg_path, "w"/, 'SSL repair must not truncate user pip.conf directly');
assert.match(appSource, /termuxOperationLockRef\.current = true/);
assert.match(appSource, /const pyodidePackageOperationLockRef = useRef\(false\)/, 'Pyodide package operations must have a synchronous shared lock');
const pyAutoRestore = appSource.slice(appSource.indexOf('const savedPkgs = sandboxPackagesRef.current'), appSource.indexOf('const handleLinkDirectory'));
assert.match(pyAutoRestore, /pyodidePackageOperationLockRef\.current = true[\s\S]*?await installPyPackage\(pkg, callbacksRef\.current\)[\s\S]*?finally\s*\{\s*pyodidePackageOperationLockRef\.current = false/, 'automatic Pyodide package restoration must share the package operation lock');
const pyInstallHandler = appSource.slice(appSource.indexOf('const handleInstallPackage'), appSource.indexOf('const handleUninstallPyPackage'));
assert.match(pyInstallHandler, /pyodidePackageOperationLockRef\.current\)\s*\{[\s\S]*?pyodidePackageOperationLockRef\.current = true/, 'rapid Pyodide install taps must be serialized synchronously');
assert.match(pyInstallHandler, /finally\s*\{[\s\S]*?pyodidePackageOperationLockRef\.current = false/, 'Pyodide install must always release the shared lock');
const pyRefreshHandler = appSource.slice(appSource.indexOf('const handleRefreshPackages'), appSource.indexOf('const handleUpgradePyPackage'));
assert.match(pyRefreshHandler, /pyodidePackageOperationLockRef\.current = true[\s\S]*?finally\s*\{\s*pyodidePackageOperationLockRef\.current = false/, 'package inventory refresh must not overlap package mutations');
const pyUninstallHandler = appSource.slice(appSource.indexOf('const handleUninstallPyPackage'), appSource.indexOf('const handleRefreshPackages'));
assert.match(pyUninstallHandler, /pyodidePackageOperationLockRef\.current\)\s*\{[\s\S]*?pyodidePackageOperationLockRef\.current = true[\s\S]*?finally\s*\{\s*pyodidePackageOperationLockRef\.current = false/, 'Pyodide uninstall must not overlap install or upgrade');
const pyUpgradeHandler = appSource.slice(appSource.indexOf('const handleUpgradePyPackage'), appSource.indexOf('const handleCheckAndUpgradeAllPy'));
assert.match(pyUpgradeHandler, /pyodidePackageOperationLockRef\.current = true[\s\S]*?pyodidePackageOperationLockRef\.current = false/, 'single Pyodide upgrades must acquire and release the shared lock');
const pyBulkUpgradeHandler = appSource.slice(appSource.indexOf('const handleCheckAndUpgradeAllPy'), appSource.indexOf('const handleCheckTermuxOutdated'));
assert.match(pyBulkUpgradeHandler, /pyodidePackageOperationLockRef\.current = true[\s\S]*?pyodidePackageOperationLockRef\.current = false/, 'bulk Pyodide upgrades must acquire and release the shared lock');
assert.match(appSource, /if \(pyodideStatus === 'ready'\) \{\s*pyodidePackageOperationLockRef\.current = true/,'combined package upgrades must lock the Pyodide phase');
const pyCombinedUpgrade = appSource.slice(appSource.indexOf('const handleUpgradeAllPackages'), appSource.indexOf('const handleCheckAppUpdates'));
assert.match(pyCombinedUpgrade, /pyodidePackageOperationLockRef\.current = true[\s\S]*?pyodidePackageOperationLockRef\.current = false/, 'combined package upgrades must release the Pyodide lock before continuing');
const workspaceHeaderSource = await readFile(new URL('../src/components/WorkspaceHeader.tsx', import.meta.url), 'utf8');
const workspaceNavigationStart = appSource.indexOf('<WorkspaceNavigation');
const mobileNavStart = appSource.indexOf('<WorkspaceNavigation', workspaceNavigationStart + 1);
const mobileNavEnd = appSource.indexOf('/>', mobileNavStart);
assert.ok(mobileNavStart > workspaceNavigationStart && mobileNavEnd > mobileNavStart, 'mobile workspace navigation must exist');
const mobileNavSource = appSource.slice(mobileNavStart, mobileNavEnd);
assert.match(mobileNavSource, /variant="phone"/, 'phone navigation must use the shared responsive workspace navigation');
assert.match(mobileNavSource, /setSettingsWorkspaceOpen\(false\);\s*setMobileTab\(destination === 'terminal' \? 'console' : destination\)/, 'switching workspaces must close the Settings workspace before showing the selected destination');
const workspaceNavigationSource = await readFile(new URL('../src/components/WorkspaceNavigation.tsx', import.meta.url), 'utf8');
assert.match(workspaceNavigationSource, /grid grid-cols-4/, 'phone navigation must expose four primary workspaces');
assert.match(workspaceNavigationSource, /dp-nav-item/, 'phone and tablet navigation must use the shared interaction token');
const fileTabsSource = await readFile(new URL('../src/components/WorkspaceFileTabs.tsx', import.meta.url), 'utf8');
assert.match(fileTabsSource, /dp-nav-item/, 'file tabs must share the selected-state interaction token');
assert.match(fileTabsSource, /aria-selected={active}/, 'file tabs must expose their selected state accessibly');
assert.ok(appSource.includes('tabletWorkspace.toggleSplit'), 'tablet split view must remain available');
assert.ok(workspaceHeaderSource.includes('aria-pressed={tabletSplit}'), 'split layout toggle must expose its selected state');
assert.match(appSource, /aria-current={active \? 'page' : undefined}/, 'secondary workspace tabs must expose their selected state');
const designTokensSource = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
assert.match(designTokensSource, /\.dp-nav-item\[aria-current="page"\][\s\S]*?border-color: var\(--ide-accent\)[\s\S]*?color: var\(--ide-accent-text\)/, 'selected navigation destinations must use theme-aware accent outlines and text');
assert.match(designTokensSource, /\.dp-nav-item:not\(\[aria-current="page"\]\)[\s\S]*?color: var\(--ide-text\)/, 'unselected navigation destinations must remain transparent and lower emphasis');
assert.match(designTokensSource, /\.dp-nav-item:disabled[\s\S]*?opacity: 0\.38/, 'disabled navigation controls must be visibly distinct from unselected controls');
assert.match(designTokensSource, /\.dp-workspace-row/, 'settings and package work rows must use the new surface-free row primitive');
assert.match(designTokensSource, /\.dp-nav-item\[aria-selected="true"\]/, 'file tabs must share the same selected visual state');
assert.match(designTokensSource, /\.dp-nav-item\[aria-pressed="true"\]/, 'selected layout toggles must share the same selected visual state');
assert.match(designTokensSource, /\.dp-icon-button/, 'transparent icon-only actions must use a shared focus and disabled-state primitive');
const legacySurfaceSources = await Promise.all([
  readFile(new URL('../src/components/FileExplorer.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/CrawlerBrowserPanel.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/InternalStoragePanel.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/AppUpdateModal.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/HelpTutorialModal.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/AppExecutionLogModal.tsx', import.meta.url), 'utf8'),
]);
for (const surfaceSource of [exportSource, panelSource, terminalSource, ...legacySurfaceSources]) {
  assert.doesNotMatch(surfaceSource, /md-card|md-sheet/, 'legacy Material card and sheet classes must not return');
}
assert.match(designTokensSource, /\.dp-panel,[\s\S]*?\.dp-panel-tonal[\s\S]*?background: transparent[\s\S]*?border: 0/, 'DroidPy panels must be transparent and surface-free');
assert.match(designTokensSource, /\.dp-sheet[\s\S]*?box-shadow: none/, 'DroidPy sheets must not use the old Material shadow treatment');
assert.doesNotMatch(designTokensSource, /--md-[\w-]+\s*:/, 'unused Material theme variables must be retired from the new design system');
assert.doesNotMatch(designTokensSource, /\.md-card\s*\{|\.md-sheet\s*\{|\.md-nav-pill\s*\{|\.md-fab\s*\{/, 'old Material visual primitives must be retired');

assert.doesNotMatch(workspaceNavigationSource, /id: 'packages'/, 'package management must not occupy a primary bottom-navigation destination');
assert.match(settingsWorkspaceSource, /id: 'packages' as const, label: t\('neg_category_packages'\)/, 'package management must remain available as a translated dedicated Settings category');
assert.match(exportSource, /activeSubView === 'packages'[\s\S]*?renderHubOptionList\(packageHubOptions/, 'package management must open directly without an intermediate folder screen');
assert.doesNotMatch(exportSource, /renderFolderList|renderFolderContents|setPackageFolder|setTermuxFolder|setStorageFolder|setSettingsFolder/, 'the Settings workspace must not retain nested folder navigation');
assert.match(exportSource, /workspaceMode\?: boolean/, 'the system center must use workspace layout terminology rather than drawer terminology');
assert.doesNotMatch(appSource, /negativeOpen|negativeSection|openNegativeDrawer|NegativeScreenSection/, 'legacy drawer state names must not return');
assert.doesNotMatch(appSource, /--md-/, 'the main application shell must not use Material theme tokens');
assert.match(i18nSource, /neg_category_packages:/, 'package management category label must be localized');
assert.match(i18nSource, /neg_category_packages_desc:/, 'package management category description must be localized');
const backHandlerStart = appSource.indexOf('window.__droidpyHandleBack = () => {');
const backHandlerEnd = appSource.indexOf('return () => {', backHandlerStart);
assert.ok(backHandlerStart >= 0 && backHandlerEnd > backHandlerStart, 'native back handler must exist');
const backHandlerSource = appSource.slice(backHandlerStart, backHandlerEnd);
assert.match(appSource, /const mobileTabRef = useRef<MobileTab>\(mobileTab\);\s*mobileTabRef\.current = mobileTab;/, 'native back handling must read the latest mobile destination without a stale effect closure');
assert.match(appSource, /const packageReturnTabRef = useRef<MobileTab>\('editor'\);/, 'the package drawer must remember the workspace tab it was opened from');
assert.match(backHandlerSource, /if \(ov\.settingsWorkspaceOpen\) \{[\s\S]*?if \(window\.__droidpySettingsBack\?\.\(\)\) return true;[\s\S]*?setSettingsWorkspaceOpen\(false\);\s*if \(mobileTabRef\.current === 'packages'\) setMobileTab\(packageReturnTabRef\.current\);\s*return true;/, 'Android back must first respect nested Settings navigation, then restore the originating workspace tab when closing the Settings workspace');
assert.match(appSource, /if \(mobileTabRef\.current === 'packages'\) setMobileTab\(packageReturnTabRef\.current\);/, 'closing the package drawer must restore its originating workspace tab');

const executionControlsSource = await readFile(new URL('../src/components/WorkspaceExecutionControls.tsx', import.meta.url), 'utf8');
const tabletHeaderStart = appSource.indexOf('<WorkspaceHeader');
const tabletHeaderEnd = appSource.indexOf('/>', tabletHeaderStart);
assert.ok(tabletHeaderStart >= 0 && tabletHeaderEnd > tabletHeaderStart);
assert.ok(appSource.slice(tabletHeaderStart, tabletHeaderEnd).includes('variant="tablet"'), 'tablet must use the shared workspace header');
const phoneHeaderStart = appSource.indexOf('<WorkspaceHeader', tabletHeaderEnd);
const phoneHeaderEnd = appSource.indexOf('/>', phoneHeaderStart);
assert.ok(phoneHeaderStart > tabletHeaderEnd && phoneHeaderEnd > phoneHeaderStart);
assert.ok(appSource.slice(phoneHeaderStart, phoneHeaderEnd).includes('variant="phone"'), 'phone must use the shared workspace header');
assert.match(workspaceHeaderSource, /WorkspaceExecutionControls/, 'the shared header must compose the execution controls');
assert.match(workspaceHeaderSource, /WorkspaceFileTabs/, 'the tablet header must compose the shared file tabs');
assert.match(workspaceHeaderSource, /tabletSplit/, 'the tablet split-view control must remain in the header');
assert.match(executionControlsSource, /termuxStopping \?[/\s\S]*termuxRunning \?/, 'execution controls must prioritize stopping and active Termux states');
assert.match(executionControlsSource, /termuxPaused \? labels\.resume : labels\.pause/, 'pause control must expose the current process state');
assert.match(executionControlsSource, /isRunning \|\| isCoreLoading/, 'Run must remain disabled while Python is busy');
assert.match(appSource, /const handleToggleTermuxPause = useCallback\(async \(\) => \{\s*if \(!termuxScriptRunning \|\| termuxStopLockRef\.current \|\| termuxPauseToggleLockRef\.current\) return;/, 'pause and resume controls must only affect an active Python script and must serialize with Stop');
assert.match(appSource, /cleaningProcesses \|\|\s*termuxRunning \|\|\s*termuxOperationLockRef\.current \|\|\s*termuxScriptStartLockRef\.current[\s\S]*?termuxOperationLockRef\.current = true;\s*setCleaningProcesses\(true\)/, 'the process watchdog must not kill an active Termux operation');

assert.match(appSource, /termuxOperationLockRef\.current = false/);
assert.match(appSource, /async \(command: string, operationLockAlreadyHeld = false\)/, 'nested upgrade commands must reuse the already-held operation lock without deadlocking');
assert.match(appSource, /operationLockAlreadyHeld && !termuxOperationLockRef\.current/, 'nested shell commands must reject an invalid inherited-lock call');
assert.match(appSource, /if \(!operationLockAlreadyHeld\) termuxOperationLockRef\.current = true/, 'shell commands must acquire the shared lock only when they own it');
assert.match(appSource, /if \(!operationLockAlreadyHeld\) termuxOperationLockRef\.current = false/, 'nested shell commands must leave inherited lock release to their owner');
assert.match(appSource, /checkingTermuxOutdated \|\|\s*termuxRunning \|\|\s*termuxOperationLockRef\.current \|\|\s*termuxScriptStartLockRef\.current/, 'manual outdated checks must not overlap active Termux operations');
assert.match(appSource, /termuxOperationLockRef\.current = true;\s*setCheckingTermuxOutdated\(true\);[\s\S]*?setCheckingTermuxOutdated\(false\);\s*termuxOperationLockRef\.current = false;/, 'manual package inventory checks must hold and release the shared lock');
assert.match(appSource, /async \(kind: 'pip' \| 'pkg'\) => \{\s*if \(termuxRunning \|\| termuxOperationLockRef\.current \|\| termuxScriptStartLockRef\.current \|\| upgradingTermux\)/, 'bulk Termux upgrades must claim the lock before their preflight check');
assert.match(appSource, /handleRunShellInTermux\(buildTermuxAptUpgradeCommand\(\), true\)/, 'bulk APT upgrades must reuse the orchestration lock');
assert.match(appSource, /const handleUpgradeAllPackages = useCallback\(async \(\) => \{\s*if \([\s\S]*?termuxOperationLockRef\.current[\s\S]*?termuxScriptStartLockRef\.current/, 'combined upgrades must respect existing Termux operations');
assert.match(appSource, /const timer = window\.setTimeout\(async \(\) => \{\s*if \(termuxRunning \|\| termuxOperationLockRef\.current \|\| termuxScriptStartLockRef\.current\) return;\s*termuxOperationLockRef\.current = true;/, 'startup background upgrades must claim the shared lock before checking packages');
assert.match(appSource, /setUpgradingTermux\(false\);\s*termuxOperationLockRef\.current = false;/, 'background and orchestration upgrades must always release their lock');
assert.match(appSource, /if \(termuxRunning \|\| termuxOperationLockRef\.current \|\| termuxScriptStartLockRef\.current\)/, 'package installation and removal must not overlap active Python execution');
assert.match(appSource, /if \(termuxRunning \|\| termuxOperationLockRef\.current \|\| termuxScriptStartLockRef\.current\)/, 'Python execution must not race a native package installation');
assert.match(appSource, /termuxOperationLockRef\.current = true[\s\S]*?streamShellInTermux/, 'native shell operations must acquire the shared Termux operation lock');
assert.match(appSource, /termuxOperationLockRef\.current = false/, 'native Termux operation lock must be released after completion');
assert.match(appSource, /setTermuxActiveTask\(\`install:\$\{target\.trim\(\)\}\`\)/);
assert.match(exportSource, /activePyodidePackage/);
assert.match(exportSource, /installingPkg \|\| activePyodidePackage/, 'the package search action must retain its spinner after the drawer remounts');
assert.match(exportSource, /disabled=\{!!installingPkg \|\| !!activePyodidePackage/, 'package actions must remain disabled while an app-level Pyodide install is active');
assert.match(exportSource, /overscroll-x-contain touch-pan-x/, 'horizontal package category gestures must stay within their scroller');
assert.match(panelSource, /activeTermuxTask === \`install:\$\{tmx\.targetName\}\`/);
assert.match(panelSource, /disabled=\{!!busyAction \|\| termuxRunning/);
assert.doesNotMatch(panelSource, /handleInitEmbedded/);
assert.ok(settingsWorkspaceSource.includes('fixed inset-0 z-50 flex flex-col bg-[var(--ide-bg)]'), 'Settings must occupy an independent full-screen workspace');
assert.ok(!settingsWorkspaceSource.includes('bg-black/35') && !settingsWorkspaceSource.includes('md:max-w-6xl'), 'Settings must not be rendered as a dimmed slide-over dialog');
assert.ok(settingsWorkspaceSource.includes('dp-nav-item'), 'Settings categories must use the shared theme-aware interaction primitive');
assert.ok(!settingsWorkspaceSource.includes('backdropTouchRef'), 'the full-screen Settings workspace must not depend on backdrop dismissal gestures');
assert.match(settingsWorkspaceSource, /termuxActiveTask/);
assert.match(i18nSource, /首次執行 Python 或安裝套件時，自動安裝 Python 3 與 pip/);
assert.match(exportSource, /matplotlib:\s*'matplotlib'/);

const start = source.indexOf('private fun collectInstalledPipInventory()');
const end = source.indexOf('private fun calcDirSize', start);
assert.ok(start >= 0 && end > start, 'package inventory function must exist');
const inventory = source.slice(start, end);

assert.match(inventory, /importlib\.metadata\.distributions\(\)/);
assert.doesNotMatch(inventory, /hasNonCoreFromFs/, 'a partial filesystem result must not suppress metadata discovery');
assert.match(inventory, /File\.createTempFile\("pip-inventory-"/);
assert.match(inventory, /redirectOutput\(outputFile\)/);
assert.match(inventory, /waitFor\(8, java\.util\.concurrent\.TimeUnit\.SECONDS\)/);
assert.match(inventory, /Build\.VERSION\.SDK_INT >= Build\.VERSION_CODES\.O/);
assert.match(inventory, /outputFile\.length\(\) in 1L\.\.\(1024L \* 1024L\)/);
assert.match(inventory, /DROIDPY_PIP_INVENTORY:/);
assert.match(inventory, /metadataComplete = true/);
assert.match(source, /PkgInventory\(pkgSet\.sorted\(\), pkgSet\.isNotEmpty\(\)\)/);
assert.match(source, /site\.addsitedir\(_droidpy_site\)/);
assert.match(bridgeSource, /site\.addsitedir\(_droidpy_site\)/);
assert.match(source, /decode\("utf-8-sig"/);
assert.match(bridgeSource, /decode\("utf-8-sig"/);
assert.match(source, /base64\.b64decode\(payload, validate=True\)/);
assert.match(bridgeSource, /base64\.b64decode\(payload, validate=True\)/);
assert.match(inventory, /inventoryFile\?\.delete\(\)/);
assert.match(inventory, /proc\?\.destroyForcibly\(\)/);

const atomicStart = source.indexOf('private fun writeAtomicTextFile(');
const atomicEnd = source.indexOf('private fun savePackageBackupSnapshot', atomicStart);
assert.ok(atomicStart >= 0 && atomicEnd > atomicStart, 'atomic manifest writer must exist');
const atomicWriter = source.slice(atomicStart, atomicEnd);
assert.match(atomicWriter, /File\.createTempFile\("droidpy-manifest-"/);
assert.match(atomicWriter, /temp\.outputStream\(\)\.use/);
assert.match(atomicWriter, /output\.fd\.sync\(\)/);
assert.match(atomicWriter, /android\.system\.Os\.rename/);
assert.match(atomicWriter, /finally/);

const manifestStart = source.indexOf('private fun savePackageBackupSnapshot(');
const manifestEnd = source.indexOf('private fun readBackupManifest', manifestStart);
assert.ok(manifestStart >= 0 && manifestEnd > manifestStart, 'manifest writer must exist');
const manifest = source.slice(manifestStart, manifestEnd);
assert.match(manifest, /forceShrink && pipInventory\.complete && pkgInventory\.complete/);
assert.match(manifest, /if \(canShrink\)/);
assert.match(manifest, /prevPipList \+ currentUserPip/);
assert.match(manifest, /prevPkgList \+ currentUserPkg/);
assert.match(manifest, /writeAtomicTextFile\(manifestFile, text\)/);
assert.match(manifest, /writeAtomicTextFile\(it, text\)/);
assert.doesNotMatch(manifest, /manifestFile\.writeText/);
assert.doesNotMatch(manifest, /packages_manifest\.json.*writeText/);
assert.match(manifest, /previous copies were preserved/);

assert.match(source, /savePackageBackupSnapshot\(forceShrink = isUninstall\)/);

const bootstrapStart = source.indexOf('val hasExistingInstall =');
const bootstrapEnd = source.indexOf('localBridge = getOrStartRetainedBridge', bootstrapStart);
assert.ok(bootstrapStart >= 0 && bootstrapEnd > bootstrapStart, 'bootstrap startup guard must exist');
const bootstrap = source.slice(bootstrapStart, bootstrapEnd);
assert.match(bootstrap, /val hasExistingUsrData = usrDir\.exists\(\)/);
assert.match(bootstrap, /usrDir\.listFiles\(\)\?\.isNotEmpty\(\) != false/);
assert.match(bootstrap, /if \(!hasExistingInstall && !hasExistingUsrData\)/);
assert.match(bootstrap, /if \(hasExistingInstall && !bootstrapMarker\.exists\(\)\)/);
assert.match(bootstrap, /Detected partial usr\/ data/);



assert.match(catalogSource, /id: 'scikit-learn',[\s\S]*?目前沒有已驗證的官方 Termux ARM64／Python 3\.14 預編譯版本/);
assert.match(bridgeSource, /no verified Termux ARM64 \/ Python 3\.14 prebuilt scikit-learn package is available/);
assert.match(source, /no verified Termux ARM64 \/ Python 3\.14 prebuilt scikit-learn package is available/);
assert.doesNotMatch(bridgeSource, /def _scikit_learn_source_install_command/);

// Android Back must unwind app navigation before the native double-press exit guard.
assert.match(appSource, /mobileTabHistoryRef = useRef<MobileTab\[\]>\(\[\]\)/, 'mobile workspace navigation must retain a Back stack');
assert.match(appSource, /mobileTabHistoryRef\.current\.push\(previous\)/, 'workspace changes must be recorded for Back navigation');
assert.match(appSource, /mobileTabHistoryRef\.current\.pop\(\)/, 'Back must return to the previously visited workspace');
assert.match(appSource, /mobileTabRef\.current !== 'editor'/, 'non-home workspaces must return to the editor before app exit');
assert.match(appSource, /suppressMobileTabHistoryRef/, 'Back navigation must not re-add the destination to its own history');
assert.match(source, /if \(handled == "true"\) \{[\s\S]*?lastBackPressedAt = 0L/, 'an in-app Back action must reset the native double-press exit timer');
assert.match(source, /if \(webView\.canGoBack\(\)\) \{\s*lastBackPressedAt = 0L/, 'WebView history navigation must reset the native exit timer');
assert.match(source, /if \(crawlerOverlay\.visibility == View\.VISIBLE\) \{\s*\/\/ A Back press consumed inside the browser must never count toward app exit\.\s*lastBackPressedAt = 0L/, 'crawler browser navigation must not count toward app exit');

console.log('Package inventory and navigation safety checks passed: dual-source discovery, bounded private output, cleanup, non-shrinking manifest and Back-stack exit guard.');

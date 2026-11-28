import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, bridgeSource, catalogSource, exportSource, panelSource, terminalSource, appSource, fileExplorerSource, settingsWorkspaceSource, i18nSource, crawlerSessionSource, frostworkSource, frostworkMetadata] = await Promise.all([
  readFile(new URL('../src/services/androidApkBuilder.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/services/termuxBridge.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/data/packageCatalog.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/ToolsAndPackages.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/TermuxIntegrationPanel.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/TerminalPanel.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/FileExplorer.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/SettingsWorkspace.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/services/i18n.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/utils/crawlerSession.ts', import.meta.url), 'utf8'),
  readFile(new URL('../android/app/src/main/assets/python/frostwork/__init__.py', import.meta.url), 'utf8'),
  readFile(new URL('../android/app/src/main/assets/python/frostwork-0.2.2.dist-info/METADATA', import.meta.url), 'utf8'),
 ]);
const themeCssSource = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
const starterExamplesSource = await readFile(new URL('../src/data/defaultFiles.ts', import.meta.url), 'utf8');
const examplesPanelSource = await readFile(new URL('../src/components/ScriptExamplesPanel.tsx', import.meta.url), 'utf8');
const tabletSplitSource = await readFile(new URL('../src/components/TabletSplitLayout.tsx', import.meta.url), 'utf8');
const workspaceHeaderSource = await readFile(new URL('../src/components/WorkspaceHeader.tsx', import.meta.url), 'utf8');
const executionControlsSource = await readFile(new URL('../src/components/WorkspaceExecutionControls.tsx', import.meta.url), 'utf8');
const codeEditorSource = await readFile(new URL('../src/components/CodeEditor.tsx', import.meta.url), 'utf8');
const symbolBarSource = await readFile(new URL('../src/components/AndroidSymbolBar.tsx', import.meta.url), 'utf8');
const pyodidePackagesSource = await readFile(new URL('../src/components/PyodidePackageWorkspace.tsx', import.meta.url), 'utf8');
const termuxPackagesSource = await readFile(new URL('../src/components/TermuxPackageWorkspace.tsx', import.meta.url), 'utf8');
const appLoggerSource = await readFile(new URL('../src/services/appLogger.ts', import.meta.url), 'utf8');
const executionLogModalSource = await readFile(new URL('../src/components/AppExecutionLogModal.tsx', import.meta.url), 'utf8');

// A fresh app session must discard persisted logs from the previous launch,
// while the log viewer must reset its transient state after each dismissal.
assert.match(appSource, /import \{ appLog, clearAppLogs \} from '\.\/services\/appLogger'/);
assert.match(appSource, /startupBootLoggedInModule = true;[\s\S]*?clearAppLogs\(\);[\s\S]*?appLog\(/, 'previous-session app logs must be cleared before recording the new boot entry');
assert.match(appLoggerSource, /export function clearAppLogs\(\): void/);
assert.ok(['setActiveTab(\'execution\');', 'setSearchQuery(\'\');', 'if (!open) setLogs([]);'].every((snippet) => executionLogModalSource.includes(snippet)), 'the log viewer must reset its filters and stale entries on close');
assert.match(executionLogModalSource, /nativeRequestIdRef\.current\);[\s\S]*?return \(\) => \{[\s\S]*?nativeRequestIdRef\.current \+= 1;/, 'late native-log responses must not repopulate a dismissed log viewer');

const catalogItems = catalogSource.split(/\n  \{\n    id: '/).slice(1);
assert.ok(catalogItems.length >= 70, 'package catalog should retain its complete inventory');
const themeCardNamesBlock = exportSource.match(/const THEME_CARD_NAMES:[\s\S]*?\n};/)?.[0];
assert.ok(themeCardNamesBlock, 'theme selector must define compact card labels');
const themeCardLabels = [...themeCardNamesBlock.matchAll(/'zh-TW': '([^']+)'/g)].map((match) => match[1]);
assert.equal(themeCardLabels.length, 14, 'all 14 built-in themes must have a card label');
assert.ok(themeCardLabels.every((label) => [...label].length === 4), 'Traditional Chinese theme card labels must be exactly four characters');

// Verify readable foreground colors against every built-in theme background (WCAG AA).
const themeBlocks = [...themeCssSource.matchAll(/(?:^|\n)\s*(?::root,\s*html\[data-theme="light"\]|html\[data-theme="[^"]+"\])\s*\{([^}]+)\}/g)];
assert.equal(themeBlocks.length, 14, 'all 14 built-in themes must define a complete color token block');
const readThemeColor = (block, token) => {
  const match = block[1].match(new RegExp('--' + token + ':\\s*(#[0-9A-Fa-f]{6})'));
  const themeName = block[0].match(/data-theme="([^"]+)"/)?.[1] ?? 'light';
  assert.ok(match, 'theme ' + themeName + ' must define ' + token + ' as a solid hex color');
  return match[1];
};
const relativeLuminance = (hex) => {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};
const contrastRatio = (first, second) => {
  const a = relativeLuminance(first), b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
for (const block of themeBlocks) {
  const themeName = block[0].match(/data-theme="([^"]+)"/)?.[1] ?? 'light';
  const background = readThemeColor(block, 'ide-bg');
  for (const token of ['ide-text', 'ide-text-muted', 'ide-accent-text']) {
    const ratio = contrastRatio(readThemeColor(block, token), background);
    assert.ok(ratio >= 4.5, themeName + ' ' + token + ' contrast must meet WCAG AA (4.5:1); got ' + ratio.toFixed(2) + ':1');
  }
}
assert.match(frostworkSource, /def navigation\(/, 'pure-Python Frostwork navigation fallback must be bundled');
assert.match(frostworkSource, /class Page:/, 'pure-Python multi-field extraction API must be bundled');
assert.match(frostworkSource, /def _css_nodes\(/, 'CSS selector fallback must be bundled');
assert.match(frostworkSource, /def _xpath_nodes\(/, 'XPath selector fallback must be bundled');
assert.ok(frostworkMetadata.includes('Name: frostwork') && frostworkMetadata.includes('Version: 0.2.2'));
// The crawler browser implementation is deliberately frozen during the workspace redesign.
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
assert.match(termuxPackagesSource, /item\.id === 'polars' \? 'python-polars' : tmx\.targetName/, 'TUR Polars installed state must read the APT inventory');
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
assert.match(termuxPackagesSource, /PackagePlus/, 'Termux package action icon must be imported when used');
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
assert.match(themeCssSource, /\.cm-panels-top,[\s\S]*?\.cm-panels-bottom/, 'search dialog positioning must support both CodeMirror panel hosts');
assert.match(themeCssSource, /\.dp-code-editor-container \.cm-editor > \.cm-panels-top,[\s\S]*?\.dp-code-editor-container \.cm-editor > \.cm-panels-bottom/, 'search dialog must center in the full editor pane whether CodeMirror mounts at top or bottom');
assert.match(appSource, /<BookOpen className="w-4 h-4" \/>/, 'phone editor must expose a direct script examples entry');
assert.equal((appSource.match(/scriptExamplesVisible \? \(/g) || []).length, 2, 'phone and tablet editor panes must host examples without replacing their file tabs');
assert.match(appSource, /setScriptExamplesVisible\(true\)/, 'the book shortcut must open examples without navigating to Files');
assert.doesNotMatch(appSource, /setScriptExamplesVisible\(true\);\s*set(?:MobileTab|TabletPaneTab)\('files'\)/, 'opening examples must not mutate the Files navigation destination');
assert.match(appSource, /if \(ov\.scriptExamplesVisible\)[\s\S]*?setScriptExamplesVisible\(false\)/, 'Android Back must close the editor-owned examples workspace first');
assert.doesNotMatch(fileExplorerSource, /SNIPPET_TEMPLATES|templatesVisible|openTemplatesRequest/, 'the file manager must not own or render script examples');
assert.doesNotMatch(appSource, /WorkspaceFileTabs/, 'the editor must not render the old filename tab strip or plus button');
assert.equal((appSource.match(/t\('editor_current_file'/g) || []).length, 2, 'phone and tablet editor panes must display the active script name in their own header');
assert.match(appSource, /inlineMainHelper[\s\S]*?format_device_report[\s\S]*?starter\.name/, 'existing main.py files must be migrated to a self-contained Chinese starter script');
assert.doesNotMatch(appSource, /content = starter\.content/, 'migrating legacy starter files must preserve user-edited script contents');
const tabletEditorTools = appSource.slice(appSource.indexOf('/* Tablet Primary Editor Pane */'), appSource.indexOf('/* Tablet Secondary Output / Files / Browser Workspace */'));
assert.match(tabletEditorTools, /<BookOpen className="w-4 h-4" \/>/, 'tablet editor must expose the same direct script examples entry');
const mobileNavStart = appSource.indexOf('<WorkspaceNavigation');
const mobileNavEnd = appSource.indexOf('/>', mobileNavStart);
assert.ok(mobileNavStart >= 0 && mobileNavEnd > mobileNavStart, 'phone workspace navigation must exist');
const mobileNavSource = appSource.slice(mobileNavStart, mobileNavEnd);
assert.match(mobileNavSource, /variant="phone"/, 'phone navigation must use the shared responsive workspace navigation');
assert.match(mobileNavSource, /onNavigate=\{navigatePhoneWorkspace\}/, 'switching workspaces must use the explicit phone destination handler');
const workspaceNavigationSource = await readFile(new URL('../src/components/WorkspaceNavigation.tsx', import.meta.url), 'utf8');
assert.ok(workspaceNavigationSource.includes("'dp-phone-navigation relative z-[60] flex w-full shrink-0 min-h-[64px] pb-safe px-2 pt-1'") && workspaceNavigationSource.includes("'grid grid-cols-4 items-stretch gap-1 w-full min-w-0'"), 'phone navigation must occupy the full viewport width with four equal-width destinations');
assert.ok(workspaceNavigationSource.includes("'dp-phone-nav-item relative w-full flex-col min-h-[56px] px-1 pt-2 pb-1 rounded-xl'"), 'phone navigation destinations must fill their equal-width grid cells with the compact dock style');
assert.match(workspaceHeaderSource, /onNavigate\?\.\(id\)/, 'tablet workspace destinations must be integrated into the single top header');
assert.match(workspaceHeaderSource, /labels\.console[\s\S]*?labels\.files[\s\S]*?labels\.browser/, 'tablet header must expose terminal, files and browser destinations once');
assert.match(starterExamplesSource, /name: '主程式\.py'[\s\S]*?name: '工具函式\.py'[\s\S]*?name: '感測器波形圖\.py'[\s\S]*?name: '互動式輸入示範\.py'/, 'the four built-in starter scripts must be moved into the examples catalog with Chinese filenames');
assert.match(starterExamplesSource, /export const DEFAULT_FILES[\s\S]*?name: '未命名\.py'/, 'new workspaces must start with a blank script instead of preloading the four examples');
assert.match(examplesPanelSource, /STARTER_EXAMPLES[\s\S]*?onSelectFile\(existing\.id\)/, 'existing starter scripts must be selectable from the examples catalog without losing edits');
assert.match(appSource, /pointer-events-none absolute inset-0 z-\[1\]/, 'one continuous paper layer must cover the entire viewport behind phone and tablet chrome');
assert.match(appSource, /const workspaceSurfaceAlpha =\s*1 - Math\.min\(100, Math\.max\(0, settings\.workspaceTransparency \?\? 35\)\) \/ 100/, 'workspace transparency must map the 0–100 slider to a clamped 1–0 alpha');
assert.match(appSource, /One continuous translucent paper surface covers the full viewport[\s\S]*?backgroundColor: is3dBgActive[\s\S]*?hexToRgba\(activeThemeMeta\.swatchBg, workspaceSurfaceAlpha\)/, 'one full-screen paper surface must own the live transparency alpha');
assert.doesNotMatch(appSource, /Each pane therefore owns its adjustable theme-glass surface/, 'tablet panes must not draw a second alpha surface over the full-screen paper');
assert.match(appSource, /tablet-landscape-split-paper/, 'tablet divider aperture must remain available in the single paper layer');
assert.doesNotMatch(themeCssSource, /--ide-bg:\s*rgba\(/, 'the 3D mode must not replace the original theme background token with a fixed-alpha color');
assert.match(exportSource, /id="workspace-transparency"[\s\S]*?type="range"[\s\S]*?min=\{0\}[\s\S]*?max=\{100\}[\s\S]*?onChange=\{\(event\) => onUpdateSettings\(\{ workspaceTransparency: Number\(event\.target\.value\) \}\)\}/, 'the transparency slider must write its numeric value into shared settings state');
assert.match(appSource, /const handleUpdateSettings = useCallback\(\(patch: Partial<EditorSettings>\)[\s\S]*?setSettings\(\(prev\) => \(\{ \.\.\.prev, \.\.\.patch \}\)\)/, 'workspace appearance updates must be applied to the shared settings state');
assert.match(appSource, /localStorage\.setItem\(STORAGE_SETTINGS_KEY, JSON\.stringify\(settings\)\)/, 'workspace transparency settings must persist between launches');
assert.match(appSource, /One continuous translucent paper surface covers the full viewport[\s\S]*?backgroundColor: is3dBgActive[\s\S]*?hexToRgba\(activeThemeMeta\.swatchBg, workspaceSurfaceAlpha\)/, 'one full-screen paper surface must own the live transparency alpha');
assert.match(appSource, /className="relative z-10 flex-1 min-h-0 min-w-0 w-full flex flex-col overflow-hidden bg-transparent"/, 'workspace content must share the full-screen paper instead of drawing a second sheet');
assert.match(workspaceHeaderSource, /minHeight:[\s\S]*?droidpy-statusbar-inset/, 'workspace header must reserve Android status bar safe-area height');
assert.match(executionControlsSource, /dp-execution-control/, 'execution controls must use the dedicated native-WebView border reset class');
assert.match(themeCssSource, /button\.dp-execution-control[\s\S]*appearance: none !important[\s\S]*border: 0 !important/, 'execution control borders must be removed at the global CSS level');
assert.equal((executionControlsSource.match(/dp-execution-control/g) || []).length, 5, 'run, stop, pause/resume, cancel and stopping controls must all use the borderless class');
assert.match(executionControlsSource, /labels\.run/, 'run control must render its explicit concise label');
assert.match(executionControlsSource, /borderlessButtonStyle/, 'all execution buttons must receive inline native-WebView border resets');
assert.doesNotMatch(executionControlsSource, /bg-red-600|bg-\[var\(--ide-accent\)\]|rounded-full|rounded-xl/, 'workspace execution controls must remain visually unboxed and borderless');
assert.match(appSource, /stop: '停止'/, 'tablet stop control must use the concise 停止 label');
assert.match(appSource, /run: '執行'/, 'tablet run control must use the concise 執行 label');
assert.doesNotMatch(executionControlsSource, /border-2 border-\[var\(--ide-accent\)\]/, 'pause/resume control must not retain an accent border');
assert.match(codeEditorSource, /const editorBg = transparentBg \? 'transparent' : t\.bg/, 'editor canvas must not stack an opaque tint over the shared translucent paper');
assert.match(codeEditorSource, /const gutterBg = transparentBg \? 'transparent' : t\.gutterBg/, 'line-number gutter must share the editor and terminal glass background');
assert.match(codeEditorSource, /fontSize: '0\.82em'/, 'line-number gutter must be narrower and visually compact');
assert.match(appSource, /mobileTab === 'editor'[\s\S]*?flex-1 min-h-0 flex flex-col overflow-hidden bg-transparent/, 'phone editor content must sit directly on the shared workspace sheet');
assert.match(appSource, /shrink-0 bg-transparent/, 'phone editor controls must not create a second opaque paper layer');
assert.match(themeCssSource, /--ide-sheet-bg: color-mix\(in srgb, var\(--ide-surface\) 82%, transparent\)/, 'the single paper surface must be slightly translucent so the 3D glass environment remains visible');
assert.doesNotMatch(themeCssSource, /--ide-surface:\s*rgba\(|--ide-surface-alt:\s*rgba\(/, '3D atmosphere must not make nested workspace surfaces translucent');
assert.match(terminalSource, /<div className="flex flex-col h-full bg-transparent text-\[var\(--ide-text\)\] overflow-hidden">/, 'terminal output must not create a second opaque sheet');
assert.match(terminalSource, /className="terminal-console-surface flex-1 min-h-0 flex flex-col overflow-hidden"[\s\S]*?onClick=\{\(event\) => \{[\s\S]*?inputRef\.current\?\.focus\([\s\S]*?ref=\{scrollRef\}[\s\S]*?className="terminal-input-row/, 'the whole terminal surface must focus its shared input when tapped');
assert.match(themeCssSource, /\.terminal-console-surface[\s\S]*?border: 1px solid[\s\S]*?border-radius: 10px/, 'the phone and non-split terminal must retain their shared outer frame');
assert.match(themeCssSource, /\.tablet-split-layout \.terminal-console-surface[\s\S]*?border: 0 !important[\s\S]*?border-radius: 0 !important/, 'only the tablet split terminal must lose its outer frame');
assert.match(appSource, /<TabletSplitLayout split=\{tabletSplit\}/, 'the tablet split layout must remain isolated from phone layout');
assert.match(tabletSplitSource, /className=\{\x60tablet-split-layout/, 'the split-only terminal style scope must wrap tablet panes');
assert.match(tabletSplitSource, /createPortal\([\s\S]*?document\.body/, 'the tablet divider must be positioned across the viewport rather than only inside the content grid');
assert.match(tabletSplitSource, /top: 0, bottom: 0, left: dividerCenter - 14, width: 28/, 'the landscape tablet divider hit area must span the full screen height');
assert.match(tabletSplitSource, /width: '1\.5mm'[\s\S]*?height: '84%'[\s\S]*?top: '8%'[\s\S]*?borderRadius: '9999px'/, 'the visible landscape divider must be a centered 84% rounded 1.5 mm capsule');
assert.match(tabletSplitSource, /setPointerCapture\(event\.pointerId\)[\s\S]*updateFromPointer\(event\)/, 'the full-height transparent tablet divider must retain pointer dragging');
assert.match(themeCssSource, /\.terminal-console-surface \.terminal-input-row[\s\S]*?width: 100% !important[\s\S]*?border: 0 !important/, 'the terminal command row must fill the shared terminal surface without its own frame');
assert.match(themeCssSource, /\.android-symbol-bar[\s\S]*?width: 100%[\s\S]*?border: 0 !important/, 'the editor symbol bar must follow the full editor width and remain borderless');
assert.match(symbolBarSource, /android-symbol-bar/, 'the Android symbol bar must use the dedicated compact style');
assert.match(symbolBarSource, /onPointerDown=\{handleStripPointerDown\}[\s\S]*onPointerMove=\{handleStripPointerMove\}[\s\S]*onPointerUp=\{finishStripPointer\}/, 'the complete symbol strip must capture and own the Android pointer gesture');
assert.match(symbolBarSource, /e\.currentTarget\.setPointerCapture\(e\.pointerId\)/, 'the strip must retain the gesture when the finger moves over another pane');
assert.match(symbolBarSource, /scrollWidth - e\.currentTarget\.clientWidth[\s\S]*startScrollLeft - deltaX/, 'horizontal dragging must scroll the symbol row with the finger and reveal off-screen symbols');
assert.match(symbolBarSource, /findSymbolAtX\(e\.currentTarget, e\.clientX\)/, 'selection must use symbol geometry rather than hit-testing elements obscured by the terminal pane');
assert.match(symbolBarSource, /if \(selected && !swipe\.moved\) onInsert\(selected\.insert, selected\.offset \?\? 0\)/, 'a stationary tap inserts its symbol, but a completed swipe must never type a symbol');
assert.match(symbolBarSource, /relative z-50[\s\S]*\[touch-action:none\]/, 'the symbol strip must sit above the terminal overlap and suppress native long-press gestures');
assert.doesNotMatch(symbolBarSource, /border border-\[var\(--ide-border\)\]|border-t border-\[var\(--ide-border\)\]/, 'symbol bar controls and strip must not draw borders');
assert.equal((terminalSource.match(/terminal-input-row px-2 py-1 bg-transparent flex items-center gap-2 shrink-0/g) || []).length, 1, 'the terminal must render exactly one persistent shared input row');
assert.match(themeCssSource, /\.terminal-input-row[\s\S]*width: 100% !important[\s\S]*flex: 0 0 auto/, 'the shared terminal input row must span the full terminal width');
assert.equal((terminalSource.match(/enterKeyHint="send"/g) || []).length, 1, 'the shared Android terminal keyboard must use the Send action');
assert.match(terminalSource, /const submitTerminalInput = async \(\)[\s\S]*waitingForPythonInput[\s\S]*onSubmitInput\(value\)/, 'the shared terminal input must route Python input() responses through the pending resolver');
assert.match(terminalSource, /engine === 'termux' && status === 'running'[\s\S]*onSendTermuxStdin\(value\)/, 'the shared terminal input must route active Termux stdin to the running process');
assert.match(terminalSource, /await onRunRepl\(statement\)/, 'the shared terminal input must route idle commands to the selected REPL or shell');
assert.match(terminalSource, /handleTerminalKeyDown[\s\S]*event.key === 'Enter'[\s\S]*submitTerminalInput\(\)/, 'the shared terminal input must submit from Android keyboard Enter');
assert.equal((terminalSource.match(/className="terminal-submit-button/g) || []).length, 1, 'the shared terminal input must retain one visible submit button');
assert.equal((terminalSource.match(/type="submit"/g) || []).length, 1, 'the shared terminal input must expose exactly one submit form');
assert.doesNotMatch(terminalSource, /stdinValue|replValue|replInputRef|handleReplSubmit|handleTermuxStdinSubmit/, 'separate terminal input states and forms must be retired');
assert.doesNotMatch(terminalSource, /bg-\[var\(--ide-surface\)\].*flex items-center gap-2 shrink-0/, 'terminal input bars must not add a second opaque surface');
assert.match(settingsWorkspaceSource, /fixed inset-0 z-\[1000\][\s\S]*?backgroundColor: 'var\(--ide-surface\)'/, 'settings must be a fully opaque top-level workspace');
assert.match(appSource, /const isPhoneLayout = deviceClass === 'phone' \|\| \(deviceClass === 'tablet' && !isLandscape\)/, 'portrait tablets must use the same single-workspace shell as phones');
assert.match(appSource, /deviceClass === 'tablet' && isLandscape \? \([\s\S]*?<TabletSplitLayout split=\{tabletSplit\} orientation="horizontal">/, 'only landscape tablets may render the adjustable side-by-side workbench');
assert.match(appSource, /\{isPhoneLayout && \([\s\S]*?<WorkspaceHeader[\s\S]*?variant="phone"/, 'portrait tablets must use the phone workspace header');
assert.match(appSource, /\{isPhoneLayout && \([\s\S]*?<WorkspaceNavigation[\s\S]*?variant="phone"/, 'portrait tablets must use the phone bottom navigation');
assert.match(tabletSplitSource, /setPrimaryPercent\(Math\.min\(75, Math\.max\(25, raw\)\)\)/, 'tablet workbench split must be user-adjustable within usable bounds');
assert.match(tabletSplitSource, /onPointerDown=[\s\S]*?setPointerCapture[\s\S]*?onPointerMove=[\s\S]*?updateFromPointer/, 'tablet workbench divider must support touch and mouse dragging');
assert.ok(tabletSplitSource.includes('role="separator"') && tabletSplitSource.includes('aria-valuemin={25}') && tabletSplitSource.includes('aria-valuemax={75}') && tabletSplitSource.includes('onKeyDown={handleKeyDown}'), 'tablet workbench divider must expose accessible keyboard resizing');
assert.match(tabletSplitSource, /width: '1\.5mm'[\s\S]*?height: '84%'[\s\S]*?top: '8%'[\s\S]*?borderRadius: '9999px'/, 'tablet splitter must retain a centered 84% rounded transparent divider core');
assert.match(tabletSplitSource, /tablet-gel-handle[\s\S]*top: '64%'[\s\S]*transform: 'translate\(-50%, -50%\)'/, 'tablet splitter must keep the compact gel handle at two-thirds of the shortened guide');
assert.match(tabletSplitSource, /tablet-gel-handle-vertical[\s\S]*tablet-gel-handle-horizontal/, 'the compact gel handle must adapt to both divider orientations');
assert.match(tabletSplitSource, /setIsDragging\(true\)[\s\S]*setIsDragging\(false\)/, 'tablet gel divider must visibly respond while being dragged');
assert.match(themeCssSource, /\.tablet-gel-divider[\s\S]*background: transparent !important[\s\S]*box-shadow: none !important/, 'the full-height divider hit area must draw no line, edge or glow');
assert.match(themeCssSource, /\.tablet-divider-clear-core[\s\S]*border-radius: 9999px !important[\s\S]*background: transparent !important[\s\S]*border: 0 !important[\s\S]*backdrop-filter: none !important/, 'the transparent divider core must stay optically empty without blur fringes');
assert.ok(
  [
    'tablet-landscape-split-paper',
    "width: 'calc(var(--tablet-divider-center, 50vw) - 0.75mm)'",
    "left: 'calc(var(--tablet-divider-center, 50vw) + 0.75mm)'",
    'viewBox="0 0 1.5 100"',
    'M0 0H1.5V100H0Z M0.75 8 A0.75 0.75',
    'fillRule="evenodd"',
    'backgroundColor: hexToRgba(activeThemeMeta.swatchBg, workspaceSurfaceAlpha)',
  ].every((fragment) => appSource.includes(fragment)),
  'tablet divider aperture must use alpha-matched side paper and a round-ended even-odd SVG opening'
);
assert.doesNotMatch(appSource, /tablet-divider-rounded-aperture|<mask[\\s\\S]*maskUnits/, 'tablet divider must avoid SVG luminance-mask compositing on Android WebView');
assert.match(appSource, /is3dBgActive && deviceClass === 'tablet' && isLandscape && tabletSplit \? 'tablet-landscape-split-paper'/, 'only the active landscape tablet split may cut a transparent channel through the paper overlay');
assert.match(tabletSplitSource, /setProperty\('--tablet-divider-center', `\$\{dividerCenter\}px`\)/, 'the paper channel must track the live divider center while the split is resized');
assert.match(tabletSplitSource, /removeProperty\('--tablet-divider-center'\)/, 'the live divider position must be cleared when split mode is disabled or unmounted');
assert.doesNotMatch(themeCssSource, /\\.tablet-landscape-split-paper[\\s\\S]*mask-image:/, 'tablet paper must not depend on multi-layer CSS mask compositing');
assert.match(themeCssSource, /\.tablet-gel-handle-vertical[\s\S]*width: 1mm[\s\S]*height: 10mm/, 'the vertical divider gel handle must be 1 mm wide and 1 cm long');
assert.doesNotMatch(themeCssSource.slice(themeCssSource.indexOf('.tablet-gel-handle {'), themeCssSource.indexOf('.terminal-console-surface .terminal-input-row')), /var\(--ide-accent\)|saturate\(/, 'the divider gel handle must remain neutral glass without theme-accent orange tint or color saturation');
assert.match(themeCssSource, /\.tablet-gel-handle-horizontal[\s\S]*width: 10mm[\s\S]*height: 1mm/, 'the horizontal divider gel handle must be 1 cm long and 1 mm high');
assert.match(tabletSplitSource, /top: '64%'[\s\S]*?transform: 'translate\(-50%, -50%\)'/, 'landscape tablet gel handle must sit two-thirds down the shortened vertical divider');
assert.match(tabletSplitSource, /onPointerDown=[\s\S]*setPointerCapture[\s\S]*updateFromPointer\(event\)[\s\S]*onPointerMove=[\s\S]*updateFromPointer/, 'tablet divider must respond immediately and continuously to touch or mouse dragging');
assert.match(themeCssSource, /\.tablet-split-layout \.terminal-console-surface[\s\S]*background: transparent !important[\s\S]*border: 0 !important/, 'tablet terminal must share the transparent workspace background and have no frame');
assert.doesNotMatch(appSource, /w-\[56%\]|h-\[56%\]/, 'tablet split panes must not use the old fixed 56 percent layout');
assert.match(workspaceNavigationSource, /dp-nav-item/, 'phone and tablet navigation must use the shared interaction token');
assert.ok(appSource.includes('tabletWorkspace.toggleSplit'), 'tablet split view must remain available');
assert.ok(workspaceHeaderSource.includes('aria-pressed={tabletSplit}'), 'split layout toggle must expose its selected state');
assert.match(workspaceNavigationSource, /aria-current={active \? 'page' : undefined}/, 'shared phone/tablet workspace navigation must expose its selected destination accessibly');
assert.equal((appSource.match(/<WorkspaceNavigation/g) ?? []).length, 1, 'only the phone should render a separate bottom navigation; tablet destinations must share the single top header');
const designTokensSource = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
assert.match(designTokensSource, /\.dp-nav-item\[aria-current="page"\][\s\S]*?color: var\(--ide-accent-text\)/, 'selected navigation destinations must use theme-aware foreground color only');
assert.match(designTokensSource, /\.dp-nav-item:not\(\[aria-current="page"\]\)[\s\S]*?color: var\(--ide-text\)/, 'unselected navigation destinations must remain transparent and lower emphasis');
assert.match(designTokensSource, /\.dp-nav-item:disabled[\s\S]*?opacity: 0\.38/, 'disabled navigation controls must be visibly distinct from unselected controls');
assert.match(designTokensSource, /\.dp-workspace-row/, 'settings and package work rows must use the new surface-free row primitive');
assert.match(designTokensSource, /\.dp-nav-item\[aria-selected="true"\]/, 'file tabs must share the same selected visual state');
assert.match(designTokensSource, /\.dp-nav-item\[aria-pressed="true"\]/, 'selected layout toggles must share the same selected visual state');
assert.match(designTokensSource, /\.dp-icon-button/, 'transparent icon-only actions must use a shared focus and disabled-state primitive');
const legacySurfaceSources = await Promise.all([
  readFile(new URL('../src/components/FileExplorer.tsx', import.meta.url), 'utf8'),
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

const tabletHeaderStart = appSource.indexOf('<WorkspaceHeader');
const tabletHeaderEnd = appSource.indexOf('/>', tabletHeaderStart);
assert.ok(tabletHeaderStart >= 0 && tabletHeaderEnd > tabletHeaderStart);
assert.ok(appSource.slice(tabletHeaderStart, tabletHeaderEnd).includes('variant="tablet"'), 'tablet must use the shared workspace header');
const phoneHeaderStart = appSource.indexOf('<WorkspaceHeader', tabletHeaderEnd);
const phoneHeaderEnd = appSource.indexOf('/>', phoneHeaderStart);
assert.ok(phoneHeaderStart > tabletHeaderEnd && phoneHeaderEnd > phoneHeaderStart);
assert.ok(appSource.slice(phoneHeaderStart, phoneHeaderEnd).includes('variant="phone"'), 'phone must use the shared workspace header');
assert.match(workspaceHeaderSource, /WorkspaceExecutionControls/, 'the shared header must compose the execution controls');
assert.doesNotMatch(workspaceHeaderSource, /WorkspaceFileTabs/, 'the global tablet header must not duplicate the editor file strip');
assert.doesNotMatch(appSource, /WorkspaceFileTabs/, 'neither phone nor tablet may retain the file tab strip');
assert.match(appSource, /editor_current_file/, 'the active script title must be visible in the editor header');
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
assert.match(pyodidePackagesSource, /activePyodidePackage/);
assert.match(pyodidePackagesSource, /installingPkg \|\| activePyodidePackage/, 'the package search action must retain its spinner after the workspace remounts');
assert.match(pyodidePackagesSource, /disabled=\{!!installingPkg \|\| !!activePyodidePackage/, 'package actions must remain disabled while an app-level Pyodide install is active');
assert.match(pyodidePackagesSource, /overscroll-x-contain touch-pan-x/, 'horizontal package category gestures must stay within their scroller');
assert.match(termuxPackagesSource, /activeTermuxTask === \`install:\$\{tmx\.targetName\}\`/);
assert.match(termuxPackagesSource, /disabled=\{!!busyAction \|\| termuxRunning/);
assert.doesNotMatch(panelSource, /handleInitEmbedded/);
assert.ok(settingsWorkspaceSource.includes('fixed inset-0 z-[1000] isolate flex flex-col') && settingsWorkspaceSource.includes("backgroundColor: 'var(--ide-surface)'"), 'Settings must occupy an opaque independent full-screen workspace above the editor and atmosphere layers');
assert.ok(!settingsWorkspaceSource.includes('bg-black/35') && !settingsWorkspaceSource.includes('md:max-w-6xl'), 'Settings must not be rendered as a dimmed slide-over dialog');
assert.ok(settingsWorkspaceSource.includes('dp-nav-item'), 'Settings categories must use the shared theme-aware interaction primitive');
const allSettingsSwitchSource = exportSource + pyodidePackagesSource;
const switchCount = (allSettingsSwitchSource.match(/role="switch"/g) || []).length;
assert.equal(switchCount, 5, 'all five settings switches must remain available');
const switchControls = [...allSettingsSwitchSource.matchAll(/<button\b(?:(?!<button\b)[\s\S])*?role="switch"(?:(?!<\/button>)[\s\S])*?<\/button>/g)].map((match) => match[0]);
assert.equal(switchControls.length, switchCount, 'each switch must be independently identifiable for accessibility checks');
assert.ok(switchControls.every((control) => /aria-label=\{t\('/.test(control)), 'every settings switch must expose a localized accessible name');
assert.doesNotMatch(allSettingsSwitchSource, /bg-white shadow-sm/, 'switch thumbs must not hard-code a white surface or shadow');
assert.equal((allSettingsSwitchSource.match(/className="dp-switch/g) || []).length, switchCount, 'all settings switches must use the shared theme-aware control');
assert.doesNotMatch(allSettingsSwitchSource, /bg-slate-300 dark:bg-slate-700/, 'settings switches must not hard-code light/dark track colors');
assert.match(exportSource, /<PyodidePackageWorkspace/, 'the settings hub must delegate sandbox package management to its own workspace component');
assert.match(pyodidePackagesSource, /const handleInstall = async/, 'the package workspace must own its install lifecycle');
assert.match(pyodidePackagesSource, /const handleUninstall = async/, 'the package workspace must own its uninstall lifecycle');
assert.match(pyodidePackagesSource, /aria-pressed={tierFilter === tier}/, 'package tier filters must expose selected state and use the transparent navigation primitive');
assert.match(pyodidePackagesSource, /aria-pressed={active}/, 'package category filters must expose selected state and use the transparent navigation primitive');
assert.ok(pyodidePackagesSource.includes('dp-workspace-row min-h-[84px]'), 'package catalog entries must use flat divider-based workspace rows instead of framed cards');
assert.match(designTokensSource, /\.dp-switch\[aria-checked="true"\][\s\S]*?background: var\(--ide-accent\)/, 'selected switches must use the active theme accent');
assert.match(designTokensSource, /\.dp-switch[\s\S]*?background: var\(--ide-surface-alt\)/, 'unselected switches must use the active theme surface');

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


// Regression checks for the reported phone/tablet UI defects.
const uiSettingsWorkspaceSource = await readFile(new URL('../src/components/SettingsWorkspace.tsx', import.meta.url), 'utf8');
const uiExecutionControlsSource = await readFile(new URL('../src/components/WorkspaceExecutionControls.tsx', import.meta.url), 'utf8');
assert.match(uiSettingsWorkspaceSource, /backgroundColor: 'var\(--ide-surface\)'/, 'Settings must use an opaque theme surface so the previous workspace cannot show through');
assert.match(uiSettingsWorkspaceSource, /z-\[1000\].*isolate/, 'Settings must sit above all workspace content in an isolated stacking context');
assert.match(uiSettingsWorkspaceSource, /aria-modal="true"/, 'Settings must be exposed as a modal full-screen workspace');
assert.match(workspaceHeaderSource, /relative z-30 isolate/, 'the workspace header must remain above the terminal pane when their bounds meet');
const tabletSplitControl = workspaceHeaderSource.indexOf('onClick={onToggleSplit}');
const tabletSettingsControl = workspaceHeaderSource.indexOf('onClick={onOpenSettings}', workspaceHeaderSource.indexOf('onClick={onToggleSplit}'));
assert.ok(tabletSplitControl >= 0 && tabletSettingsControl > tabletSplitControl, 'tablet Settings must appear to the right of the Focus Editor / split control');
assert.doesNotMatch(uiExecutionControlsSource, /border-2 border-\[var\(--ide-accent\)\]/, 'Run/Pause controls must not retain a decorative accent border');
assert.match(uiExecutionControlsSource, /dp-execution-control/, 'all execution controls must use the dedicated global WebView border reset');
assert.match(uiExecutionControlsSource, /labels\.run/, 'the phone and tablet Run control must render the shared concise run label');
assert.match(appSource, /const navigatePhoneWorkspace = useCallback\(\(destination: 'editor' \| 'terminal' \| 'files' \| 'browser'\)/, 'phone navigation must use one explicit destination handler');
assert.match(appSource, /onNavigate=\{navigatePhoneWorkspace\}/, 'phone bottom navigation must call the explicit destination handler');
assert.match(appSource, /data-active-workspace=\{isPhoneLayout \? mobileTab : tabletPaneTab\}/, 'the active workspace must be observable on the rendered content root for phones and portrait tablets');
assert.match(appSource, /mobileTab === 'console' && \(/, 'the phone terminal page must render from the selected navigation state');
assert.match(appSource, /mobileTab === 'files' && \(/, 'the phone files page must render from the selected navigation state');
assert.match(appSource, /mobileTab === 'browser' \? 'flex-1 min-h-0 overflow-hidden' : 'hidden'/, 'the phone browser page must render from the selected navigation state');

console.log('Package inventory and navigation safety checks passed: dual-source discovery, bounded private output, cleanup, non-shrinking manifest and Back-stack exit guard.');

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, bridgeSource, catalogSource, exportSource, panelSource, appSource, drawerSource, i18nSource, frostworkSource, frostworkMetadata] = await Promise.all([
  readFile(new URL('../src/services/androidApkBuilder.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/services/termuxBridge.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/data/packageCatalog.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/ToolsAndPackages.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/TermuxIntegrationPanel.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/NegativeScreenDrawer.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/services/i18n.tsx', import.meta.url), 'utf8'),
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
assert.match(source, /if \("python-polars" in missingPkgsOnly\)[\s\S]*?pkg install -y tur-repo/, 'Polars restore must enable the signed TUR repository before installing');
assert.match(source, /"python-polars" in missingPkgsOnly/);
assert.match(source, /val safePkgName = Regex\("""\^\[A-Za-z0-9\]\[A-Za-z0-9\+\.\-\]\*\$"""\)/, 'APT package names from backup manifests must be validated before shell use');
assert.match(source, /if \(!safePkgName\.matches\(v\)\)/, 'invalid APT backup entries must be skipped');
assert.match(source, /Skipped invalid APT package names in backup manifest/);
assert.match(source, /var bestUpdatedAt = Long\.MIN_VALUE/);
assert.match(source, /val updatedAt = obj\.optLong\("updatedAt", 0L\)/);
assert.match(source, /updatedAt > bestUpdatedAt \|\| \(updatedAt == bestUpdatedAt && score > bestScore\)/, 'newer package snapshots must win over stale larger backups');
assert.doesNotMatch(panelSource, /python-lxml libxml2 libxslt clang/);
assert.doesNotMatch(panelSource, /pip install requests beautifulsoup4 lxml httpx/);
assert.match(appSource, /const ensureEmbeddedPythonEnvironment = useCallback/);
assert.match(appSource, /pkg update -y && pkg install -y python python-pip/);
assert.doesNotMatch(appSource, /pkg install -y python python-pip python-lxml|clang/);
assert.match(appSource, /await ensureEmbeddedPythonEnvironment\(\)/);
assert.match(appSource, /setTermuxActiveTask\(\`install:\$\{target\.trim\(\)\}\`\)/);
assert.match(exportSource, /activePyodidePackage/);
assert.match(exportSource, /installingPkg \|\| activePyodidePackage/, 'the package search action must retain its spinner after the drawer remounts');
assert.match(exportSource, /disabled=\{\{?\!?installingPkg \|\| \!?activePyodidePackage/, 'package actions must remain disabled while an app-level Pyodide install is active');
assert.match(panelSource, /activeTermuxTask === \`install:\$\{tmx\.targetName\}\`/);
assert.match(panelSource, /disabled=\{!!busyAction \|\| termuxRunning/);
assert.doesNotMatch(panelSource, /handleInitEmbedded/);
assert.doesNotMatch(drawerSource, /onTouchEnd/);
assert.doesNotMatch(drawerSource, /Swipe left on drawer to dismiss/);
assert.match(drawerSource, /termuxActiveTask/);
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

console.log('Package inventory safety checks passed: dual-source discovery, bounded private output, cleanup and non-shrinking manifest.');

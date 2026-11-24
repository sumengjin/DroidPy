import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/services/androidApkBuilder.ts', import.meta.url), 'utf8');
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
assert.match(inventory, /outputFile.length() in 1L\.\.\(1024L \* 1024L\)/);
assert.match(inventory, /DROIDPY_PIP_INVENTORY:/);
assert.match(inventory, /metadataComplete = true/);
assert.match(source, /PkgInventory\(pkgSet\.sorted\(\), pkgSet\.isNotEmpty\(\)\)/);
assert.match(inventory, /inventoryFile\?\.delete\(\)/);
assert.match(inventory, /proc\?\.destroyForcibly\(\)/);

const manifestStart = source.indexOf('private fun savePackageBackupSnapshot(');
const manifestEnd = source.indexOf('private fun readBackupManifest', manifestStart);
assert.ok(manifestStart >= 0 && manifestEnd > manifestStart, 'manifest writer must exist');
const manifest = source.slice(manifestStart, manifestEnd);
assert.match(manifest, /forceShrink && pipInventory\.complete && pkgInventory\.complete/);
assert.match(manifest, /if \(canShrink\)/);
assert.match(manifest, /prevPipList \+ currentUserPip/);
assert.match(manifest, /prevPkgList \+ currentUserPkg/);
assert.match(source, /savePackageBackupSnapshot\(forceShrink = isUninstall\)/);

console.log('Package inventory safety checks passed: dual-source discovery, bounded private output, cleanup and non-shrinking manifest.');

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('src/services/androidApkBuilder.ts', 'utf8');
const start = source.indexOf('fun downloadAndInstallApk(apkUrl: String, fileName: String)');
const end = source.indexOf('@JavascriptInterface\n        fun readPersistedState', start);
assert.ok(start >= 0 && end > start, 'native APK updater source must exist');
const updater = source.slice(start, end);

// Redirects must remain HTTPS and on the official GitHub asset delivery hosts.
assert.ok(updater.includes('fun validateGithubAssetUrl(raw: String): URL'));
assert.ok(source.includes('import java.net.URL\\nimport javax.net.ssl.HttpsURLConnection'));
assert.ok(updater.includes('uri.scheme != "https"'));
assert.ok(updater.includes('uri.rawUserInfo != null'));
assert.ok(updater.includes('host == "github.com"'));
assert.ok(updater.includes('host == "api.github.com"'));
assert.ok(updater.includes('host == "objects.githubusercontent.com"'));
assert.ok(updater.includes('host == "release-assets.githubusercontent.com"'));
assert.ok(updater.includes('instanceFollowRedirects = false'));
assert.ok(updater.includes('validateGithubAssetUrl(currentUrl)'));

// Bound downloads, write to a synced temporary file, and keep the prior APK
// until the downloaded candidate has passed package and signer verification.
assert.ok(updater.includes('val maxApkBytes = 300L * 1024L * 1024L'));
assert.ok(updater.includes('downloaded > maxApkBytes'));
assert.ok(updater.includes('downloaded != totalBytes'));
assert.ok(updater.includes('val tempFile = File(updatesDir, "$safeName.part")'));
assert.ok(updater.includes('output.fd.sync()'));
assert.ok(updater.includes('tempFile.renameTo(outFile)'));
assert.ok(updater.includes('val previousFile = File(updatesDir, "$safeName.previous")'));

// Verify the package ID and match the installed app's signer or valid
// single-signer certificate lineage; do not pin the obsolete hard-coded cert.
assert.ok(updater.includes('fun signerMatchesInstalledApp(apkPath: String): Boolean'));
assert.ok(updater.includes('getPackageArchiveInfo(apkPath, flags)'));
assert.ok(updater.includes('archiveInfo.packageName != packageName'));
assert.ok(updater.includes('PackageManager.GET_SIGNING_CERTIFICATES'));
assert.ok(updater.includes('PackageManager.GET_SIGNATURES'));
assert.ok(updater.includes('signingCertificateHistory'));
assert.ok(updater.includes('hasMultipleSigners()'));
assert.ok(updater.includes('compatibleHistory.containsAll(installedCurrent)'));
assert.ok(!updater.includes('29C549F02AB1781D42D94A6D80530EC8EF86670C82605F9255FDD95D5D545EBA'));
assert.ok(!updater.includes('expectedFingerprint'));

// Production Release verification must follow the protected keystore selected
// for this build, not a stale hard-coded certificate fingerprint.
const workflow = await readFile('.github/workflows/droidpy.yml', 'utf8');
assert.ok(workflow.includes('keytool -exportcert -keystore "$KEYSTORE_PATH"'));
assert.ok(workflow.includes('KEYSTORE_PATH="android/app/${DROIDPY_KEYSTORE_FILE:-droidpy-custom.keystore}"'));
assert.ok(workflow.includes('APK 簽名與本次受保護 keystore 不一致'));
assert.ok(!workflow.includes('29C549F02AB1781D42D94A6D80530EC8EF86670C82605F9255FDD95D5D545EBA'));

console.log('Native APK updater HTTPS redirect, size, atomic download and installed-signer checks passed.');

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('src/services/androidApkBuilder.ts', 'utf8');
const start = source.indexOf('fun downloadAndInstallApk(apkUrl: String, fileName: String)');
const end = source.indexOf('@JavascriptInterface\n        fun readPersistedState', start);
assert.ok(start >= 0 && end > start, 'native APK updater source must exist');
const updater = source.slice(start, end);

// First-update permission flow must persist the verified APK while Settings is open,
// then resume installation from onResume after the user grants the per-app permission.
assert.ok(source.includes('private fun installVerifiedApkOrRequestPermission(apkFile: File)'));
assert.ok(source.includes('Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES'));
assert.ok(source.includes('Uri.parse("package:\\$packageName")'));
assert.ok(source.includes('updatePrefs.edit().putString(pendingInstallKey, apkFile.absolutePath).apply()'));
assert.ok(source.includes('override fun onResume()'));
assert.ok(source.includes('packageManager.canRequestPackageInstalls()'));
assert.ok(source.includes('installVerifiedApkOrRequestPermission(File(pendingPath))'));
const onCreateStart = source.indexOf('override fun onCreate(savedInstanceState: Bundle?)');
const onCreateEnd = source.indexOf('override fun onResume()', onCreateStart);
assert.ok(onCreateStart >= 0 && onCreateEnd > onCreateStart);
assert.ok(!source.slice(onCreateStart, onCreateEnd).includes('requestExternalStoragePermissionIfNeeded()'), 'storage Settings must not interrupt first-run startup');
// Android 11+ must use one all-files-access settings flow, never launch
// legacy READ/WRITE runtime dialogs concurrently with the Settings activity.
assert.ok(source.includes('Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&'));
assert.ok(source.includes('applicationInfo.targetSdkVersion >= Build.VERSION_CODES.R'), 'all-files Settings must only be used when the app targets Android 11+');
assert.ok(source.includes('if (Environment.isExternalStorageManager()) {'));
assert.ok(source.includes('Opening app-specific all-files access settings'));
assert.ok(source.includes('legacy-target apps on Android 11+ retain runtime READ/WRITE permissions.'));
assert.ok(source.includes('ActivityCompat.requestPermissions(this, permsToAsk.toTypedArray(), 1001)'));
// Redirects must remain HTTPS and on the official GitHub asset delivery hosts.
assert.ok(updater.includes('fun validateGithubAssetUrl(raw: String): URL'));
assert.ok(source.includes('import java.net.URL\nimport javax.net.ssl.HttpsURLConnection'));
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

// PR builds may use a temporary Debug signer; merged main/master Release builds
// require the new protected keystore and compare the APK signer to that keystore.
const workflow = await readFile('.github/workflows/droidpy.yml', 'utf8');
assert.ok(workflow.includes('CUSTOM_KS_B64: ${{ secrets.DROIDPY_KEYSTORE_BASE64 }}'));
assert.ok(workflow.includes('if [ "$IS_RELEASE_REF" = "true" ]; then'));
assert.ok(workflow.includes('正式發布缺少必要的 GitHub Actions Secret'));
assert.ok(workflow.includes('DROIDPY_KEYSTORE_BASE64 無法解碼'));
assert.ok(workflow.includes('CUSTOM_KS_B64_CLEAN=$(printf'));
assert.ok(workflow.includes('EXPECTED_RELEASE_CERT_SHA256="353F581792A659420EAF1E8EC278E7F5F78C8B13F767EA0A9E3DDEA682AEB818"'));
assert.ok(workflow.includes('PKCS12 金鑰庫載入失敗'));
assert.ok(workflow.includes('實際指紋：$KEYSTORE_SHA256'));
assert.ok(workflow.includes('找不到指定金鑰別名'));
assert.ok(workflow.includes('DROIDPY_EXPECTED_CERT_SHA256=$KEYSTORE_SHA256'));
assert.ok(workflow.includes('Release APK 與本次受保護的新 keystore 憑證不一致'));
assert.ok(workflow.includes("if: (github.event_name == 'push'"));
const releaseHeadingParser = "VER=$(sed -nE 's/^## \\[([0-9]+\\.[0-9]+\\.[0-9]+)\\].*/\\1/p' CHANGELOG.md 2>/dev/null | head -n1 || true)";
assert.ok(workflow.includes(releaseHeadingParser));
assert.ok(workflow.includes('actions/checkout@v5'));
assert.ok(workflow.includes('actions/setup-node@v5'));
assert.ok(workflow.includes('actions/setup-python@v6'));
assert.ok(!workflow.includes('actions/checkout@v4'));
assert.ok(source.includes('applicationIdSuffix = ".beta"'), 'Debug APK must use a separate application ID');
assert.ok(source.includes('android:authorities="\\${applicationId}.fileprovider"'), 'FileProvider authority must follow the variant application ID');
assert.ok(workflow.includes('VNAME="${REL_TAG#v}-Beta"'), 'unpublished APK versionName must use the next release version and end in -Beta');
assert.ok(workflow.includes('DroidPy-arm64-${DROIDPY_VERSION_NAME}.apk'), 'unpublished APK filename must include its Beta version');
assert.ok(workflow.includes('*.beta) echo "已確認測試版使用獨立套件 ID'), 'CI must verify Beta APK package ID isolation');
assert.ok(!workflow.includes('actions/setup-node@v4'));
assert.ok(!workflow.includes('actions/setup-python@v5'));

assert.ok(!workflow.includes('29C549F02AB1781D42D94A6D80530EC8EF86670C82605F9255FDD95D5D545EBA'));
assert.ok(!workflow.includes('所有 APK 都必須使用原始 keystore'));

// App, generated APK and native fallback versions must advance together.
const versionSource = await readFile('src/version.ts', 'utf8');
assert.ok(versionSource.includes("APP_VERSION = '1.2.34'"));
assert.ok(versionSource.includes('APP_VERSION_CODE = 1002034'));
assert.ok(source.includes('versionCode = System.getenv("DROIDPY_VERSION_CODE")?.toIntOrNull() ?: 1002034'));
assert.ok(source.includes('versionName = System.getenv("DROIDPY_VERSION_NAME")?.takeIf { it.isNotBlank() } ?: "1.2.34"'));
assert.ok(source.includes('packageManager.getPackageInfo(packageName, 0).versionName ?: "1.2.34"'));
assert.ok(source.includes('                "1.2.34"\n            }'));
assert.ok(source.includes('VCODE=$(( \\${CMAJ:-1} * 1000000 + \\${CMIN:-0} * 1000 + \\${CPAT:-0} ))'));

const updaterSource = await readFile('src/services/appUpdater.ts', 'utf8');
assert.ok(updaterSource.includes("tagName: 'v1.2.34'"));
assert.ok(updaterSource.includes("tagName: 'v1.2.33'"));
assert.ok(updaterSource.indexOf("tagName: 'v1.2.34'") < updaterSource.indexOf("tagName: 'v1.2.16'"));
const packageManifest = JSON.parse(await readFile('package.json', 'utf8'));
assert.equal(packageManifest.name, 'droidpy');
assert.equal(packageManifest.version, '1.2.34');
const bunLock = await readFile('bun.lock', 'utf8');
assert.ok(bunLock.includes('"name": "droidpy"'));
assert.ok((await readFile('README.md', 'utf8')).includes('Android-First Python IDE, Pyodide 3.12'));
assert.ok(!(await readFile('README.md', 'utf8')).startsWith('# DroidPy — Android-First Python 3.12 IDE'));

assert.ok(!source.includes('?: 10216'));
assert.ok(!source.includes('?: "1.2.16"'));


console.log('Native APK updater HTTPS redirect, size, atomic download and installed-signer checks passed.');

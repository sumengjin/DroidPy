import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: ['src/services/androidApkBuilder.ts'],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'node20',
  write: false,
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`;
const { generateGitHubApkProjectZip } = await import(moduleUrl);
const blob = await generateGitHubApkProjectZip({
  appTitle: 'DroidPy',
  packageId: 'org.droidpy.app',
  includeStoragePermission: true,
  files: [],
});
const zip = await JSZip.loadAsync(await blob.arrayBuffer());
const workflowFile = zip.file('.github/workflows/build-apk.yml');
assert.ok(workflowFile, 'exported Android project must include its build workflow');
const workflow = await workflowFile.async('string');

assert.ok(workflow.includes('workflow_dispatch:'));
const releaseHeadingParser = "VER=$(sed -nE 's/^## \\[([0-9]+\\.[0-9]+\\.[0-9]+)\\].*/\\1/p' CHANGELOG.md 2>/dev/null | head -n1 || true)";
assert.ok(workflow.includes(releaseHeadingParser));
assert.ok(workflow.includes('actions/checkout@v5'));
assert.ok(workflow.includes('actions/setup-node@v5'));
assert.ok(!workflow.includes('actions/checkout@v4'));
assert.ok(!workflow.includes('actions/setup-node@v4'));

assert.ok(workflow.includes('release_tag:'));
assert.ok(workflow.includes('permissions:'));
assert.ok(workflow.includes('contents: read'));
assert.ok(workflow.includes('publish-release:'));
assert.ok(workflow.includes('contents: write'));
assert.ok(workflow.includes('gradle assembleDebug --no-daemon'));
assert.ok(workflow.includes('gradle assembleRelease --no-daemon'));
assert.ok(workflow.includes('DROIDPY_RELEASE_BUILD'));
assert.ok(workflow.includes("if: steps.configure.outputs.is_release == 'true'"));
assert.ok(workflow.includes('The new DROIDPY_KEYSTORE_BASE64 secret is required for Release builds.'));
assert.ok(workflow.includes('if [ "$IS_RELEASE_REF" = true ]; then'));
assert.ok(workflow.includes('keytool -exportcert -keystore'));
assert.ok(workflow.includes('DROIDPY_EXPECTED_CERT_SHA256='));
assert.ok(workflow.includes('verify --verbose --print-certs'));
assert.ok(workflow.includes('needs.build-apk.outputs.is_release == \'true\''));
assert.ok(workflow.includes('android/app/build/outputs/apk/release/*.apk'));
assert.ok(workflow.includes('android/app/build/outputs/apk/debug/*.apk'));
assert.ok(workflow.includes("printf 'DROIDPY_STORE_PASSWORD=%s\\n'"));
assert.ok(workflow.includes("printf '%s\\n' \"$SIGNER_OUTPUT\""));
assert.ok(workflow.includes("DroidPy-arm64-apk-$GITHUB_RUN_NUMBER"));
assert.ok(!workflow.includes('29C549F02AB1781D42D94A6D80530EC8EF86670C82605F9255FDD95D5D545EBA'));
assert.ok(workflow.includes('PR/debug builds use the temporary Android debug signer'));
assert.ok(!workflow.includes('The original DROIDPY_KEYSTORE_BASE64 secret is required for every APK build.'));

const readmeFile = zip.file('README_GITHUB_APK.md') || zip.file('README.md');
assert.ok(readmeFile, 'exported Android project must include signing instructions');
const readme = await readmeFile.async('string');
assert.ok(readme.includes('DROIDPY_KEYSTORE_BASE64'));
assert.ok(readme.includes('簽名金鑰已更換'));
assert.ok(readme.includes('PR／Debug 建置使用臨時 Debug 簽名'));
assert.ok(readme.includes('合併至 main/master 後'));
assert.ok(!readme.includes('固定的 `android/app/droidpy-debug.p12` 簽名金鑰'));

console.log('Exported Android workflow separates temporary PR Debug signing from protected rotated Release signing.');

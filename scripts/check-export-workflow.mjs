import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: ['src/services/androidApkBuilder.ts'],
  bundle: true,
  platform: 'node',
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
assert.ok(workflow.includes('release_tag:'));
assert.ok(workflow.includes('permissions:'));
assert.ok(workflow.includes('contents: read'));
assert.ok(workflow.includes('publish-release:'));
assert.ok(workflow.includes('contents: write'));
assert.ok(workflow.includes('gradle assembleDebug --no-daemon'));
assert.ok(workflow.includes('gradle assembleRelease --no-daemon'));
assert.ok(workflow.includes('DROIDPY_RELEASE_BUILD'));
assert.ok(workflow.includes('A production Release requires all protected DROIDPY signing secrets'));
assert.ok(workflow.includes('keytool -exportcert -keystore'));
assert.ok(workflow.includes('apksigner verify --verbose --print-certs'));
assert.ok(workflow.includes('needs.build-apk.outputs.is_release == \'true\''));
assert.ok(workflow.includes('android/app/build/outputs/apk/release/*.apk'));
assert.ok(workflow.includes('android/app/build/outputs/apk/debug/*.apk'));
assert.ok(!workflow.includes('cp android/app/droidpy-debug.p12'));
assert.ok(!workflow.includes('29C549F02AB1781D42D94A6D80530EC8EF86670C82605F9255FDD95D5D545EBA'));

console.log('Exported Android workflow separates ephemeral Debug builds from protected signed Releases.');

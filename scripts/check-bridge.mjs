import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';

// Bundle the actual TypeScript generator so this check exercises the same
// script template used by the UI rather than a duplicated fixture.
const bundle = await build({
  entryPoints: ['src/services/termuxBridge.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  write: false,
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`;
const { buildTermuxBridgeScript } = await import(moduleUrl);

const token = 'a'.repeat(64);
const origin = 'https://droidpy-ci.example';
const generated = buildTermuxBridgeScript(token, origin);

assert.ok(generated.includes('TOKEN = "' + token + '"'));
assert.ok(generated.includes('ALLOWED_ORIGIN = "' + origin + '"'));
assert.ok(generated.includes('MAX_REQUEST_BYTES = 8 * 1024 * 1024'));
assert.ok(generated.includes('Access-Control-Allow-Origin", ALLOWED_ORIGIN'));
assert.ok(!generated.includes('Access-Control-Allow-Origin", "*"'));

assert.throws(() => buildTermuxBridgeScript('', origin), /權杖無效/);
assert.throws(() => buildTermuxBridgeScript(token, 'file:///tmp/app'), /網頁來源/);

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'droidpy-bridge-check-'));
try {
  const pythonFile = path.join(tempDir, 'droidpy_bridge.py');
  await writeFile(pythonFile, generated, 'utf8');
  const result = spawnSync('python3', ['-m', 'py_compile', pythonFile], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Generated Termux Bridge Python failed py_compile:\n${result.stdout}\n${result.stderr}`);
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log('Generated Termux Bridge token/origin checks and Python syntax validation passed.');

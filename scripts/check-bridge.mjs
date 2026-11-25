import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
const { buildTermuxBridgeScript, resolveTermuxInstallTarget } = await import(moduleUrl);

const token = 'a'.repeat(64);
const origin = 'https://droidpy-ci.example';
const generated = buildTermuxBridgeScript(token, origin);

assert.ok(generated.includes('TOKEN = "' + token + '"'));
assert.ok(generated.includes('ALLOWED_ORIGIN = "' + origin + '"'));
assert.ok(generated.includes('MAX_REQUEST_BYTES = 8 * 1024 * 1024'));
assert.ok(generated.includes('Access-Control-Allow-Origin", ALLOWED_ORIGIN'));
assert.ok(!generated.includes('Access-Control-Allow-Origin", "*"'));

// Request parsing and concurrency must remain bounded in the generated Python Bridge.
assert.ok(generated.includes('def _read_json_body(self):'));
assert.ok(generated.includes('self.headers.get_all("Transfer-Encoding")'));
assert.ok(generated.includes('self.headers.get_all("Content-Length")'));
assert.ok(generated.includes('Duplicate Content-Length'));
assert.ok(generated.includes('class BoundedThreadingHTTPServer(ThreadingHTTPServer):'));
assert.ok(generated.includes('request_queue_size = 16'));
assert.ok(generated.includes('threading.BoundedSemaphore(8)'));
assert.ok(generated.includes('self.send_header("Connection", "close")'));
assert.ok(generated.includes('self.close_connection = True'));
assert.ok(generated.includes('if self.path in ("/pause", "/resume"):'));
assert.ok(generated.includes('os.killpg(pgid, signal.SIGSTOP if should_pause else signal.SIGCONT)'));
assert.ok(generated.includes('def _normalize_shell_command(command):'));
assert.ok(generated.includes('return re.sub(r"^(\\s*pkg\\s+install\\b)", r"\\1 -y"'));
assert.ok(generated.includes('BoundedThreadingHTTPServer(("127.0.0.1", 8765), DroidPyBridgeHandler)'));

// Native Bridge limits are checked against the actual generated Android source.
const androidBuilder = await readFile('src/services/androidApkBuilder.ts', 'utf8');
assert.ok(androidBuilder.includes('ThreadPoolExecutor('));
assert.ok(androidBuilder.includes('ArrayBlockingQueue<Runnable>(16)'));
assert.ok(androidBuilder.includes('RejectedExecutionException'));
assert.ok(androidBuilder.includes('serverSocket === localServer'));
assert.ok(androidBuilder.includes('oldExecutor?.shutdownNow()'));
assert.ok(androidBuilder.includes('activeClientSockets.add(client)'));
assert.ok(androidBuilder.includes('activeClientSockets.remove(client)'));
assert.ok(androidBuilder.includes('activeClientSockets.toList().forEach'));
assert.ok(androidBuilder.includes('headerBuf.size() > 16 * 1024'));
assert.ok(androidBuilder.includes('len > 8 * 1024 * 1024'));
assert.ok(androidBuilder.includes('duplicateContentLength'));
assert.ok(androidBuilder.includes('headers.containsKey("transfer-encoding")'));
assert.ok(androidBuilder.includes('Only the explicit /stop action may terminate that process.'));
assert.ok(androidBuilder.includes('"/pause"'));
assert.ok(androidBuilder.includes('"/resume"'));
assert.ok(androidBuilder.includes('android.os.Process.sendSignal(pid, signal)'));
assert.ok(androidBuilder.includes('private fun normalizeShellCommand(command: String): String'));
assert.ok(androidBuilder.includes('ProcessBuilder(shFile.absolutePath, "-c", wrappedCommand)'));
assert.ok(androidBuilder.includes('activeProcessPidFile.takeIf { it.isFile }'));
assert.ok(androidBuilder.includes('echo \\$\\$ >'));
assert.ok(!androidBuilder.includes('proc.pid()'));
const terminalUi = await readFile('src/components/TerminalPanel.tsx', 'utf8');
assert.ok(terminalUi.includes('paused ? \'繼續\' : \'暫停\''));
const appSource = await readFile('src/App.tsx', 'utf8');
assert.ok(appSource.includes('pauseTermuxProcess(termuxConfig)'));
assert.ok(appSource.includes('resumeTermuxProcess(termuxConfig)'));
assert.ok(!androidBuilder.includes('private val executor = Executors.newCachedThreadPool()'));

// Native buffered shell commands must wait with a timeout before reading output,
// redirect output to a bounded temporary file, and return diagnostic stderr.
const bufferedShellStart = androidBuilder.indexOf('private fun runBufferedShellCommand(command: String): JSONObject {');
const bufferedShellEnd = androidBuilder.indexOf('private fun streamShellCommand', bufferedShellStart);
assert.ok(bufferedShellStart >= 0 && bufferedShellEnd > bufferedShellStart);
const bufferedShell = androidBuilder.slice(bufferedShellStart, bufferedShellEnd);
assert.ok(bufferedShell.includes('pb.redirectOutput(logFile)'));
assert.ok(bufferedShell.includes('proc.waitFor(120, java.util.concurrent.TimeUnit.SECONDS)'));
assert.ok(bufferedShell.includes('2L * 1024L * 1024L'));
assert.ok(bufferedShell.includes('.put("stderr", stripAnsiForLog(stderrText))'));
assert.ok(!bufferedShell.includes('proc.inputStream.bufferedReader(Charsets.UTF_8).readText()'));

// Shared-storage state backups must fail closed if JSON sanitization fails;
// otherwise malformed state could leak the per-install bridge credential.
const backupWriterStart = androidBuilder.indexOf('fun writePersistedState(json: String)');
assert.ok(backupWriterStart >= 0);
const backupWriter = androidBuilder.slice(backupWriterStart, backupWriterStart + 2200);
assert.ok(backupWriter.includes('val backupJson = JSONObject(json).apply {'));
assert.ok(backupWriter.includes('optJSONObject("termuxConfig")?.put("token", "")'));
assert.ok(!backupWriter.includes('catch (_: Exception) {\n                            json'));


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

// Package installation routing: Python archives must use pip, native extensions should use Termux binaries.
const cases = [
  ['pip', 'numpy', 'pkg', 'python-numpy'],
  ['pip', 'pandas', 'pkg', 'python-pandas'],
  ['pip', 'Pillow', 'pkg', 'python-pillow'],
  ['pip', 'PIL', 'pkg', 'python-pillow'],
  ['pip', 'lxml', 'pkg', 'python-lxml'],
  ['pip', 'cryptography', 'pkg', 'python-cryptography'],
  ['pip', 'matplotlib', 'pkg', 'matplotlib'],
  ['pkg', 'matplotlib', 'pkg', 'matplotlib'],
  ['pkg', 'numpy', 'pkg', 'python-numpy'],
  ['pkg', './dist/library.tar.gz', 'pip', './dist/library.tar.gz'],
  ['pkg', '/sdcard/Download/library.tgz', 'pip', '/sdcard/Download/library.tgz'],
  ['pkg', 'https://example.invalid/library.whl', 'pip', 'https://example.invalid/library.whl'],
  ['pkg', 'library.zip', 'pip', 'library.zip'],
  ['pkg', 'library.tar.bz2', 'pip', 'library.tar.bz2'],
  ['pkg', 'library.tar.xz', 'pip', 'library.tar.xz'],
  ['pkg', '-r requirements.txt', 'pip', '-r requirements.txt'],
  ['pkg', './local-package.deb', 'pkg', './local-package.deb'],
  ['pip', './local-package.deb', 'pkg', './local-package.deb'],
  ['pkg', 'pandas==2.2.0', 'pip', 'pandas==2.2.0'],
  ['pkg', 'Pillow[extra]', 'pip', 'Pillow[extra]'],
  ['pkg', 'https://example.invalid/pkg.tar.gz', 'pip', 'https://example.invalid/pkg.tar.gz'],
  ['pip', 'numpy==2.0.0', 'pip', 'numpy==2.0.0'],
  ['pip', 'Pillow[extra]', 'pip', 'Pillow[extra]'],
  ['pip', 'requests pandas', 'pip', 'requests pandas'],
];
for (const [inputMode, input, expectedMode, expectedTarget] of cases) {
  const resolved = resolveTermuxInstallTarget(inputMode, input);
  assert.equal(resolved.mode, expectedMode, `${inputMode} ${input} mode`);
  assert.equal(resolved.target, expectedTarget, `${inputMode} ${input} target`);
}
assert.ok(generated.includes('cmd = [sys.executable, "-m", "pip", "install", "--prefer-binary"]'));
console.log('Generated Termux Bridge token/origin checks and Python syntax validation passed.');

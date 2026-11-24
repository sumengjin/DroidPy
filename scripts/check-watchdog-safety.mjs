import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [pythonBridge, androidBuilder, app, translations] = await Promise.all([
  read('../src/services/termuxBridge.ts'),
  read('../src/services/androidApkBuilder.ts'),
  read('../src/App.tsx'),
  read('../src/services/i18n.tsx'),
]);

const pythonCleanupStart = pythonBridge.indexOf('def cleanup_stuck_python_processes(');
const pythonCleanupEnd = pythonBridge.indexOf('class DroidPyBridgeHandler', pythonCleanupStart);
assert.ok(pythonCleanupStart >= 0 && pythonCleanupEnd > pythonCleanupStart, 'Python cleanup function must exist');
const pythonCleanup = pythonBridge.slice(pythonCleanupStart, pythonCleanupEnd);
assert.doesNotMatch(pythonCleanup, /os\.kill\s*\(|signal\.|SIGKILL|SIGTERM|WATCHDOG_INTERVAL_SEC/);
assert.doesNotMatch(pythonBridge, /_watchdog_loop|_watchdog_thread\.start\s*\(|WATCHDOG_INTERVAL_SEC/);

const nativeCleanupStart = androidBuilder.indexOf('private fun cleanupStuckPythonProcesses(');
const nativeCleanupEnd = androidBuilder.indexOf('private fun buildEnv()', nativeCleanupStart);
assert.ok(nativeCleanupStart >= 0 && nativeCleanupEnd > nativeCleanupStart, 'Native cleanup function must exist');
const nativeCleanup = androidBuilder.slice(nativeCleanupStart, nativeCleanupEnd);
assert.doesNotMatch(nativeCleanup, /Os\.kill\s*\(|killProcess\s*\(|destroyForcibly\s*\(|SIGKILL|SIGTERM|thresholdSec/);
assert.doesNotMatch(androidBuilder, /watchdogScheduler|scheduleAtFixedRate|thresholdSec = 1800L/);

const nativeStopStart = androidBuilder.indexOf('fun stop() {');
const nativeStopEnd = androidBuilder.indexOf('private fun ensurePrefixWrappers()', nativeStopStart);
assert.ok(nativeStopStart >= 0 && nativeStopEnd > nativeStopStart, 'Native Bridge stop function must exist');
assert.doesNotMatch(androidBuilder.slice(nativeStopStart, nativeStopEnd), /activeProcess\?\.destroyForcibly|killProcess\s*\(/);

assert.doesNotMatch(app, /handleCleanupStuckProcesses\(false\)/, 'App must not run a periodic process-kill scan');
assert.match(app, /read-only scan/, 'UI log should identify the process scan as read-only');
assert.match(translations, /Python 行程安全檢查（不自動終止）/);
assert.match(translations, /Python 进程安全检查（不自动终止）/);
assert.match(translations, /Python Process Safety Check \(No Auto Termination\)/);
assert.match(translations, /Python プロセス安全確認（自動終了なし）/);

console.log('Watchdog safety checks passed: process age never triggers termination.');

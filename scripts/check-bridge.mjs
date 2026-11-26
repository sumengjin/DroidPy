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
const {
  buildTermuxBridgeScript,
  resolveTermuxInstallTarget,
  buildTermuxUninstallCommand,
  buildTermuxPipUpgradeCommand,
  parseOutdatedPipJson,
  filterTermuxPipPackages,
} = await import(moduleUrl);

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
const pythonStreamStart = generated.indexOf('    def _stream_pty_command(self, cmd, shell=False):');
const pythonStreamEnd = generated.indexOf('    def _read_json_body(self):', pythonStreamStart);
assert.ok(pythonStreamStart >= 0 && pythonStreamEnd > pythonStreamStart);
const pythonStream = generated.slice(pythonStreamStart, pythonStreamEnd);
assert.ok(pythonStream.includes('client_disconnected = False'));
assert.ok(pythonStream.includes('def emit_stream_event(event):'));
assert.ok(pythonStream.includes('client_disconnected = True'));
assert.ok(pythonStream.includes('The HTTP client does not own the child process.'));
assert.ok(!pythonStream.includes('os.killpg(proc.pid, signal.SIGKILL)'));
const explicitStopStart = generated.indexOf('        if self.path == "/stop":');
const explicitStopEnd = generated.indexOf('        if self.path in ("/run"', explicitStopStart);
assert.ok(explicitStopStart >= 0 && explicitStopEnd > explicitStopStart);
assert.ok(generated.slice(explicitStopStart, explicitStopEnd).includes('os.killpg(pgid, signal.SIGKILL)'));

assert.ok(generated.includes('os.killpg(pgid, signal.SIGSTOP if should_pause else signal.SIGCONT)'));
assert.ok(generated.includes('def _normalize_shell_command(command):'));
assert.ok(generated.includes('python-polars'));
const nativeInstalledPackages = ['python-numpy', 'python-polars', 'python-scipy'];
assert.equal(
  buildTermuxUninstallCommand('pip', 'polars', nativeInstalledPackages),
  'pkg uninstall -y python-polars',
  'TUR Polars must be removed through APT, not pip'
);
assert.equal(
  buildTermuxUninstallCommand('pip', 'numpy', nativeInstalledPackages),
  'pkg uninstall -y python-numpy',
  'APT-backed Python distributions must be removed through APT'
);
assert.equal(
  buildTermuxUninstallCommand('pip', 'polars', []),
  'pip uninstall -y polars',
  'a genuine PyPI Polars install must remain removable through pip'
);
assert.equal(
  buildTermuxUninstallCommand('pip', 'requests', nativeInstalledPackages),
  'pip uninstall -y requests',
  'ordinary PyPI packages must continue to uninstall through pip'
);
assert.deepEqual(
  filterTermuxPipPackages(['numpy', 'polars', 'requests'], nativeInstalledPackages),
  ['requests'],
  'native APT distributions must not be duplicated in the pip inventory'
);
assert.deepEqual(
  filterTermuxPipPackages(['numpy', 'requests']),
  ['requests'],
  'when APT inventory is unavailable, known native packages must be excluded conservatively'
);
const outdatedJson = JSON.stringify([
  { name: 'numpy', version: '1.0', latest_version: '2.0' },
  { name: 'polars', version: '1.0', latest_version: '2.0' },
  { name: 'requests', version: '1.0', latest_version: '2.0' },
]);
assert.deepEqual(
  parseOutdatedPipJson(outdatedJson, nativeInstalledPackages).map((item) => item.name),
  ['requests'],
  'APT-backed distributions must not be offered as pip upgrades'
);
assert.deepEqual(
  parseOutdatedPipJson(outdatedJson).map((item) => item.name),
  ['requests'],
  'unknown APT inventory must conservatively suppress native package pip upgrades'
);
assert.equal(
  buildTermuxPipUpgradeCommand(['numpy', 'polars', 'requests'], false, nativeInstalledPackages),
  'pip install --upgrade requests',
  'bulk pip upgrades must not overwrite native APT distributions'
);


assert.ok(generated.includes('index-url = https://pypi.org/simple'));
assert.ok(generated.includes('if not os.path.isfile(pip_conf_path):'));
assert.ok(generated.includes('with open(pip_conf_path, "x", encoding="utf-8") as fp:'));
assert.ok(generated.includes('Preserve an existing user pip configuration or private package index.'));
assert.ok(generated.includes('def _compatibility_install_command(package_name, trusted_host=False):'));
assert.ok(generated.includes('if package == "parsel":'));
assert.ok(generated.includes('if package == "scipy":'));
assert.ok(generated.includes('if package == "polars":'));
assert.ok(generated.includes('if package in ("scikit-learn", "sklearn"):'));
assert.ok(generated.includes('no verified Termux ARM64 / Python 3.14 prebuilt scikit-learn package is available'));
assert.ok(generated.includes('"pandas": "python-pandas"'));
assert.ok(generated.includes('"numpy": "python-numpy"'));
assert.ok(generated.includes('"matplotlib": "matplotlib"'));
assert.ok(generated.includes('"cryptography": "python-cryptography"'));
assert.ok(generated.includes('"apsw": "python-apsw"'));
assert.ok(generated.includes('"bcrypt": "python-bcrypt"'));
assert.ok(generated.includes('"brotli": "python-brotli"'));
assert.ok(generated.includes('"grpcio": "python-grpcio"'));
assert.ok(generated.includes('"msgpack": "python-msgpack"'));
assert.ok(generated.includes('"psutil": "python-psutil"'));
assert.ok(generated.includes('"pycryptodomex": "python-pycryptodomex"'));
assert.ok(generated.includes('"tflite-runtime": "python-tflite-runtime"'));
assert.ok(generated.includes('"torch": "python-torch"'));
assert.ok(generated.includes('"torchaudio": "python-torchaudio"'));
assert.ok(generated.includes('"torchvision": "python-torchvision"'));
assert.ok(generated.includes('"yt-dlp": "python-yt-dlp"'));
assert.ok(generated.includes('shlex.quote("DroidPy: no verified Termux ARM64 / Python 3.14 prebuilt scikit-learn package is available; on-device source builds are disabled.")'));
assert.ok(generated.includes('_compatibility_install_command(pkgs[0], trusted_host=trusted_host)'));






assert.ok(generated.includes('return re.sub(r"^(\\s*pkg\\s+install\\b)", r"\\1 -y"'));
assert.ok(generated.includes('BoundedThreadingHTTPServer(("127.0.0.1", 8765), DroidPyBridgeHandler)'));

// Android edge-to-edge system bars must stay transparent while app content respects insets.
const edgeToEdgeBuilder = await readFile('src/services/androidApkBuilder.ts', 'utf8');
assert.ok(edgeToEdgeBuilder.includes('WindowCompat.setDecorFitsSystemWindows(window, false)'));
assert.ok(edgeToEdgeBuilder.includes('window.statusBarColor = Color.TRANSPARENT'));
assert.ok(edgeToEdgeBuilder.includes('window.navigationBarColor = Color.TRANSPARENT'));
assert.ok(edgeToEdgeBuilder.includes('WindowInsetsCompat.Type.statusBars()'));
assert.ok(edgeToEdgeBuilder.includes('WindowInsetsCompat.Type.navigationBars()'));
assert.ok(edgeToEdgeBuilder.includes("setProperty('--droidpy-statusbar-inset'"));
assert.ok(edgeToEdgeBuilder.includes('fun setSystemBarAppearance(isDark: Boolean)'));
assert.ok(edgeToEdgeBuilder.includes('override fun onPageFinished(view: WebView?, url: String?)'));
const systemBarApp = await readFile('src/App.tsx', 'utf8');
assert.ok(systemBarApp.includes('window.DroidPyNative?.setSystemBarAppearance?.(meta.isDark)'));
const systemBarTypes = await readFile('src/types/ide.ts', 'utf8');
assert.ok(systemBarTypes.includes('setSystemBarAppearance?: (isDark: boolean) => void;'));
const systemBarCss = await readFile('src/index.css', 'utf8');
assert.ok(systemBarCss.includes('var(--droidpy-statusbar-inset, 0px)'));
assert.ok(systemBarCss.includes('var(--droidpy-navigationbar-inset, 0px)'));

// Native Bridge limits are checked against the actual generated Android source.
const androidBuilder = await readFile('src/services/androidApkBuilder.ts', 'utf8');
assert.ok(androidBuilder.includes('ThreadPoolExecutor('));
assert.ok(androidBuilder.includes('4, 8, 60L, TimeUnit.SECONDS, ArrayBlockingQueue<Runnable>(16)'));
assert.ok(androidBuilder.includes('RejectedExecutionException'));
assert.ok(androidBuilder.includes('serverSocket === localServer'));
assert.ok(androidBuilder.includes('oldExecutor?.shutdown()'));
assert.ok(!androidBuilder.includes('oldExecutor?.shutdownNow()'));
assert.ok(androidBuilder.includes('activeClientSockets.add(client)'));
assert.ok(androidBuilder.includes('activeClientSockets.remove(client)'));
assert.ok(androidBuilder.includes('private val bridgePort: Int get() = if (packageName.endsWith(".beta")) 8766 else 8765'));
assert.ok(androidBuilder.includes('port = bridgePort'));
assert.ok(androidBuilder.includes('fun getBridgeEndpoint(): String') && androidBuilder.includes('bridgePort}'));
assert.ok(androidBuilder.includes('webView.loadUrl("http://127.0.0.1:') && androidBuilder.includes('bridgePort}/")'));
const nativeEndpointSource = await readFile('src/App.tsx', 'utf8');
assert.ok(nativeEndpointSource.includes('window.DroidPyNative?.getBridgeEndpoint?.()'));
assert.ok(nativeEndpointSource.includes('endpointUrl: nativeEndpoint || savedConfig.endpointUrl || DEFAULT_TERMUX_CONFIG.endpointUrl'));
const nativeBridgeTypes = await readFile('src/types/ide.ts', 'utf8');
assert.ok(nativeBridgeTypes.includes('getBridgeEndpoint?: () => string;'));
assert.ok(androidBuilder.includes('retainedBridge'));
assert.ok(androidBuilder.includes('Keeping embedded bridge alive across Activity configuration recreation'));
assert.ok(androidBuilder.includes('installCrashDiagnostics()'));
assert.ok(androidBuilder.includes('[FATAL] Uncaught exception'));
assert.ok(androidBuilder.includes('android.util.Log.i("DroidPy", "[$tag] $message")'), "startup diagnostics must mirror tagged messages to Logcat");
assert.ok(androidBuilder.includes('appendStartupLog("Bridge", "Starting embedded bridge")'));
assert.ok(androidBuilder.includes('Embedded bridge started successfully'));
assert.ok(androidBuilder.includes('Embedded bridge startup FAILED:'));
const nativeClientHandlerStart = androidBuilder.indexOf('private fun handleClient(socket: Socket) {');
const nativeClientHandlerEnd = androidBuilder.indexOf('private data class SafeProbeResponse', nativeClientHandlerStart);
assert.ok(nativeClientHandlerStart >= 0 && nativeClientHandlerEnd > nativeClientHandlerStart);
const nativeClientHandler = androidBuilder.slice(nativeClientHandlerStart, nativeClientHandlerEnd);
assert.ok(nativeClientHandler.includes('catch (_: java.io.IOException)'));
assert.ok(nativeClientHandler.includes('normal request teardown, not a fatal worker-thread crash'));
assert.ok(androidBuilder.includes('pid=\\${android.os.Process.myPid()}'));
assert.ok(androidBuilder.includes('onRenderProcessGone'));
assert.ok(androidBuilder.includes('Renderer process gone didCrash='));
assert.ok(androidBuilder.includes('onLowMemory callback'));
assert.ok(androidBuilder.includes('onTrimMemory level=$level'));
assert.ok(androidBuilder.includes('Stream client disconnected; continuing process'));
assert.ok(androidBuilder.includes('Process started pid='));
assert.ok(androidBuilder.includes('Process exited pid='));
assert.ok(androidBuilder.includes('activeProcessStopRequested'));
assert.ok(androidBuilder.includes('Explicit Stop request: force stopping process tree'));
assert.ok(androidBuilder.includes('Process output read ended after explicit Stop'));
assert.ok(androidBuilder.includes('Run script requested: $entry'));
assert.ok(androidBuilder.includes('SD-card write request received'));
const streamShellStart = androidBuilder.indexOf('private fun streamShellCommand(out: OutputStream, command: String) {');
const streamShellEnd = androidBuilder.indexOf('private fun corsHeaders(', streamShellStart);
assert.ok(streamShellStart >= 0 && streamShellEnd > streamShellStart);
const nativeStreamShell = androidBuilder.slice(streamShellStart, streamShellEnd);
assert.ok(nativeStreamShell.includes('Stream client disconnected; continuing process'));
assert.ok(!nativeStreamShell.includes('proc.destroyForcibly()'), 'a dropped output socket must not kill the Python child');
const runLoggingSource = await readFile('src/App.tsx', 'utf8');
assert.ok(runLoggingSource.includes('${entryFile.name} exited with code ${res.exitCode}'));
assert.ok(runLoggingSource.includes('Finished ${entryFile.name}'));
assert.ok(androidBuilder.includes('Explicit Stop request: force stopping process tree'));
assert.ok(androidBuilder.includes('headerBuf.size() > 16 * 1024'));
assert.ok(androidBuilder.includes('len > 8 * 1024 * 1024'));
assert.ok(androidBuilder.includes('duplicateContentLength'));
assert.ok(androidBuilder.includes('headers.containsKey("transfer-encoding")'));
assert.ok(androidBuilder.includes('Only the explicit /stop action may terminate that process.'));
assert.ok(androidBuilder.includes('"/pause"'));
assert.ok(androidBuilder.includes('"/resume"'));
assert.ok(androidBuilder.includes('private fun signalActiveProcess(signal: Int): Boolean'));
const pauseSignalStart = androidBuilder.indexOf('private fun signalActiveProcess(signal: Int): Boolean');
const pauseSignalEnd = androidBuilder.indexOf('private fun runBufferedShellCommand', pauseSignalStart);
assert.ok(pauseSignalStart >= 0 && pauseSignalEnd > pauseSignalStart);
const pauseSignal = androidBuilder.slice(pauseSignalStart, pauseSignalEnd);
assert.ok(pauseSignal.includes('collectDescendants(rootPid, descendants)'));
assert.ok(pauseSignal.includes('descendants + rootPid'));
assert.ok(pauseSignal.includes('listOf(rootPid) + descendants.asReversed()'));
assert.ok(pauseSignal.includes('android.os.Process.sendSignal(targetPid, signal)'));
assert.ok(androidBuilder.includes('private fun normalizeShellCommand(command: String): String'));
assert.ok(androidBuilder.includes('val normalizedCommand = normalizeShellCommand(command)'));
assert.ok(androidBuilder.includes('ProcessBuilder(shFile.absolutePath, "-c", normalizedCommand)'));
assert.ok(androidBuilder.includes('"pandas" to "python-pandas"'));
assert.ok(androidBuilder.includes('"numpy" to "python-numpy"'));
assert.ok(androidBuilder.includes('"scipy" to "python-scipy"'));
assert.ok(androidBuilder.includes('index-url = https://pypi.org/simple'));
assert.ok(androidBuilder.includes('private fun resolvePackageCompatibilityCommand(target: String, trustedHost: Boolean = false): String?'));
assert.ok(androidBuilder.includes('"parsel" ->'));
assert.ok(androidBuilder.includes("w3lib>=2.6' parsel"));
assert.ok(androidBuilder.includes('"scipy" -> "pkg install -y python-scipy"'));
assert.ok(androidBuilder.includes('"polars" -> "pkg install -y tur-repo && pkg update -y && pkg install -y python-polars"'));
assert.ok(androidBuilder.includes('"scikit-learn", "sklearn" ->'));
assert.ok(androidBuilder.includes('no verified Termux ARM64 / Python 3.14 prebuilt scikit-learn package is available'));
assert.ok(androidBuilder.includes('else -> nativeTermuxPackageForPip(packageName)?.let { "pkg install -y $it" }'));
assert.ok(androidBuilder.includes('resolvePackageCompatibilityCommand(target, trustedHost)'));
assert.ok(androidBuilder.includes('resolvePackageCompatibilityCommand(packageMatch.groupValues[1])'));


assert.ok(androidBuilder.includes('"polars" to "python-polars"'));
assert.ok(androidBuilder.includes('"matplotlib" to "matplotlib"'));
assert.ok(androidBuilder.includes('"apsw" to "python-apsw"'));
assert.ok(androidBuilder.includes('"bcrypt" to "python-bcrypt"'));
assert.ok(androidBuilder.includes('"brotli" to "python-brotli"'));
assert.ok(androidBuilder.includes('"grpcio" to "python-grpcio"'));
assert.ok(androidBuilder.includes('"msgpack" to "python-msgpack"'));
assert.ok(androidBuilder.includes('"psutil" to "python-psutil"'));
assert.ok(androidBuilder.includes('"pycryptodomex" to "python-pycryptodomex"'));
assert.ok(androidBuilder.includes('"tflite-runtime" to "python-tflite-runtime"'));
assert.ok(androidBuilder.includes('"torch" to "python-torch"'));
assert.ok(androidBuilder.includes('"torchaudio" to "python-torchaudio"'));
assert.ok(androidBuilder.includes('"torchvision" to "python-torchvision"'));
assert.ok(androidBuilder.includes('"yt-dlp" to "python-yt-dlp"'));
assert.ok(androidBuilder.includes('nativeTermuxPackageForPip(name)'));
assert.ok(androidBuilder.includes('val pipInstall = Regex('));
assert.ok(androidBuilder.includes('val packageMatch = pipInstall.find(command)'));
assert.ok(androidBuilder.includes('val pipPrefix ='));
assert.ok(androidBuilder.includes("pkg install -y python-lxml && $pythonCmd -m pip install $pipArgs 'w3lib>=2.6' parsel"));
assert.ok(androidBuilder.includes('private fun resolvePackageCompatibilityCommand(target: String, trustedHost: Boolean = false): String?'));
assert.ok(androidBuilder.includes('val nativeRestoreTargets = linkedSetOf<String>()'));
assert.ok(androidBuilder.includes('val remainingPips = mutableListOf<String>()'));
assert.ok(androidBuilder.includes('Restoring native Termux packages: '));
assert.ok(androidBuilder.includes('--prefer-binary'));
assert.ok(!androidBuilder.includes('val needsNumpy = needPips.any'));
assert.ok(androidBuilder.includes('ProcessBuilder(shFile.absolutePath, "-c", wrappedCommand)'));
assert.ok(androidBuilder.includes('activeProcessPidFile.takeIf { it.isFile }'));
assert.ok(androidBuilder.includes('wrappedCommand'));
assert.ok(androidBuilder.includes('private fun processPid(proc: Process): Int'));
assert.ok(androidBuilder.includes('processPid(proc)'));
// Native crawler browser calls must retain the injected Java bridge receiver.
const crawlerPanel = await readFile('src/components/CrawlerBrowserPanel.tsx', 'utf8');
assert.ok(crawlerPanel.includes('window.DroidPyNative.openCrawlerBrowser(clean, isDesktopUa);'));
assert.ok(!crawlerPanel.includes('const openBrowser = window.DroidPyNative?.openCrawlerBrowser'));
assert.ok(crawlerPanel.includes('Java bridge method can\'t be invoked on a non-injected object'));

// Native cookie capture must provide visible feedback and avoid silently
// closing the browser when the current page has no cookies.
const captureStart = androidBuilder.indexOf('private fun captureCrawlerCookiesAndReturn() {');
const captureEnd = androidBuilder.indexOf('private fun dp(value: Int)', captureStart);
assert.ok(captureStart >= 0 && captureEnd > captureStart);
const cookieCapture = androidBuilder.slice(captureStart, captureEnd);
assert.ok(cookieCapture.includes('Cookie capture requested'));
assert.ok(cookieCapture.includes('Cookie capture found no cookies'));
assert.ok(cookieCapture.includes('Cookie capture completed'));
assert.ok(cookieCapture.includes('Cookie capture failed'));
assert.ok(cookieCapture.includes('evaluateJavascript(js)'));
assert.ok(cookieCapture.includes('writeText(sessionJson.toString(2), Charsets.UTF_8)'));
assert.ok(androidBuilder.includes('Cookie capture button clicked'));

const terminalUi = await readFile('src/components/TerminalPanel.tsx', 'utf8');
assert.ok(terminalUi.includes('paused ? \'繼續\' : \'暫停\''));
const appSource = await readFile('src/App.tsx', 'utf8');
assert.ok(appSource.includes('pauseTermuxProcess(termuxConfig)'));
assert.ok(appSource.includes('resumeTermuxProcess(termuxConfig)'));
assert.ok((appSource.match(/paused={termuxPaused}/g) ?? []).length >= 2, 'phone and tablet terminals must both receive pause state');
assert.ok((appSource.match(/canPause={termuxScriptRunning}/g) ?? []).length >= 2, 'phone and tablet terminals must both expose pause controls');
const stopHandlerStart = appSource.indexOf('const handleStopTermux = useCallback');
const stopHandlerEnd = appSource.indexOf('const handleBackupToSdcard', stopHandlerStart);
assert.ok(stopHandlerStart >= 0 && stopHandlerEnd > stopHandlerStart);
const stopHandler = appSource.slice(stopHandlerStart, stopHandlerEnd);
assert.ok(stopHandler.indexOf('await stopTermuxProcess(termuxConfig)') < stopHandler.indexOf('await waitForActiveTermuxStream()'), 'native process must be stopped before waiting for its output stream');
assert.ok(!stopHandler.includes('setTermuxRunning(false)'), 'failed Stop must not unlock a still-running process');
assert.ok(appSource.includes('termuxScriptStartLockRef.current = true'));
assert.ok(appSource.includes('termuxScriptStartLockRef.current = false'));
const termuxBridgeUi = await readFile('src/services/termuxBridge.ts', 'utf8');
assert.ok(termuxBridgeUi.includes('activeStreamCompletion'));
assert.ok(termuxBridgeUi.includes('waitForActiveTermuxStream'));
assert.ok(termuxBridgeUi.includes('await completion'), 'Stop must wait for the old stream slot to be released');
assert.ok(androidBuilder.includes('activeProcess === proc'));
assert.ok(androidBuilder.includes('stopped = !proc.isAlive && activeProcess !== proc'));
assert.ok(!androidBuilder.includes('private val executor = Executors.newCachedThreadPool()'));

// The tool center uses real folder -> document navigation and preserves parent folders on Back.
const toolsHubSource = await readFile('src/components/ToolsAndPackages.tsx', 'utf8');
assert.ok(toolsHubSource.includes("const [activeWindow, setActiveWindow] = useState<ToolWindowId | null>(null)"));
assert.ok(toolsHubSource.includes('const renderFolderList = <T extends string,>'));
assert.ok(toolsHubSource.includes('const renderFolderContents ='));
assert.ok(toolsHubSource.includes("setTermuxFolder(null)"));
assert.ok(toolsHubSource.includes("setPackageFolder(null)"));
assert.ok(toolsHubSource.includes("setStorageFolder(null)"));
assert.ok(toolsHubSource.includes("setSettingsFolder(null)"));
assert.ok(toolsHubSource.includes('activeFolderLabel &&'));
const toolFolderTranslations = await readFile('src/services/i18n.tsx', 'utf8');
for (const key of [
  'hub_py_folder_runtime', 'hub_py_folder_maintenance',
  'hub_pkg_folder_termux', 'hub_pkg_folder_sandbox',
  'hub_storage_folder_device', 'hub_storage_folder_workspace',
]) {
  assert.ok(toolFolderTranslations.includes(key + ':'), 'missing localized folder key: ' + key);
}

// A second streamed action must never cancel the currently running Python job.
// Only the explicit Stop control is allowed to abort its AbortController.
const termuxBridgeSource = await readFile('src/services/termuxBridge.ts', 'utf8');
assert.ok(termuxBridgeSource.includes('已有 Termux 工作正在執行'));
assert.ok(termuxBridgeSource.includes('def _compatibility_install_command(package_name, trusted_host=False):'));
assert.ok(termuxBridgeSource.includes('package == "parsel"'));
assert.ok(termuxBridgeSource.includes('w3lib<2.6'));
assert.ok(termuxBridgeSource.includes('pkg install -y python-lxml && '));
assert.ok(termuxBridgeSource.includes('shlex.join(_build_pip_cmd(["w3lib<2.6", "parsel"]'));
assert.ok(termuxBridgeSource.includes('pkg install -y python-scipy'));
assert.ok(termuxBridgeSource.includes('normalized_cmd = _normalize_shell_command(cmd_str)'));
assert.ok(termuxBridgeSource.includes('Rewrite only a single, unambiguous pip install'));
assert.ok(!termuxBridgeSource.includes('_scikit_learn_source_install_command'));



assert.ok(termuxBridgeSource.includes('pip_prefix = r"(?:(?:[^\\\\s;&|]*/)?python'));

assert.ok(!termuxBridgeSource.includes("  abortActiveTermuxStream();\n  const controller = new AbortController();"));
const abortHelperStart = termuxBridgeSource.indexOf('export function abortActiveTermuxStream(): void {');
const abortHelperEnd = termuxBridgeSource.indexOf('\n}', abortHelperStart);
assert.ok(abortHelperStart >= 0 && abortHelperEnd > abortHelperStart);
assert.ok(!termuxBridgeSource.slice(abortHelperStart, abortHelperEnd).includes('activeStreamController = null'));
assert.ok(termuxBridgeSource.includes('return { exitCode: -1, durationMs: 0 };'));
assert.ok(termuxBridgeSource.includes('return { exitCode: -1, durationMs };'));
assert.ok(termuxBridgeSource.includes('橋接請求（${path}）'));
assert.ok(termuxBridgeSource.includes('    30000\n  );\n}\n\nexport async function createSdcardFolder'));

// Exercise the actual crawler cookie helpers: cookie scope must be part of identity,
// and Set-Cookie attributes must survive JSON export and generated Python requests code.
const crawlerBundle = await build({
  entryPoints: ['src/utils/crawlerSession.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  write: false,
});
const crawlerModuleUrl = `data:text/javascript;base64,${Buffer.from(crawlerBundle.outputFiles[0].text).toString('base64')}`;
const {
  buildCookiesJsonContent,
  buildPythonCrawlerScript,
  mergeCookieLists,
  normalizeUrlInput,
  parseRawCrawlerInput,
  parseSetCookieLines,
} = await import(crawlerModuleUrl);
const scopedCookies = mergeCookieLists(
  [
    { name: 'sid', value: 'old-a', enabled: true, domain: '.example.com', path: '/a' },
    { name: 'sid', value: 'old-b', enabled: true, domain: '.example.com', path: '/b' },
  ],
  [{ name: 'sid', value: 'new-a', enabled: true, domain: '.example.com', path: '/a' }]
);
assert.equal(scopedCookies.length, 2);
assert.equal(scopedCookies.find((cookie) => cookie.path === '/a')?.value, 'new-a');
const parsedSetCookies = parseSetCookieLines([
  'sid=secret; Domain=.example.com; Path=/account; HttpOnly; Secure; SameSite=None; Max-Age=3600',
]);
assert.equal(parsedSetCookies.length, 1);
assert.equal(parsedSetCookies[0].domain, '.example.com');
assert.equal(parsedSetCookies[0].path, '/account');
assert.equal(parsedSetCookies[0].httpOnly, true);
assert.equal(parsedSetCookies[0].secure, true);
assert.equal(parsedSetCookies[0].sameSite, 'None');
assert.ok((parsedSetCookies[0].expiresAt ?? 0) > Math.floor(Date.now() / 1000));
const imported = parseRawCrawlerInput(JSON.stringify({
  cookies: [{ name: 'sid', value: 'secret', domain: '.example.com', path: '/account', secure: true, httpOnly: true, sameSite: 'Lax', expiresAt: 2000000000 }],
}));
assert.equal(imported.cookies[0].domain, '.example.com');
assert.equal(imported.cookies[0].secure, true);
const netscapeImported = parseRawCrawlerInput(
  '# Netscape HTTP Cookie File\n#HttpOnly_.example.com\tTRUE\t/account\tTRUE\t2000000000\tsid\tsecret'
);
assert.equal(netscapeImported.cookies.length, 1);
assert.equal(netscapeImported.cookies[0].httpOnly, true);
assert.equal(netscapeImported.cookies[0].secure, true);
assert.equal(netscapeImported.cookies[0].path, '/account');
const crawlerSession = {
  url: 'https://example.com/account',
  userAgent: 'DroidPy CI',
  cookies: parsedSetCookies,
  extraHeaders: {},
  capturedAt: Date.now(),
};
const cookieJson = JSON.parse(buildCookiesJsonContent(crawlerSession));
assert.equal(cookieJson.cookie_list[0].sameSite, 'None');
assert.equal(cookieJson.cookie_list[0].secure, true);
const generatedCrawler = buildPythonCrawlerScript(crawlerSession);
assert.ok(generatedCrawler.includes('from requests.cookies import create_cookie'));
assert.ok(generatedCrawler.includes('data.get("cookie_list") or []'));
assert.ok(generatedCrawler.includes('sess.cookies.set_cookie(cookie)'));
assert.ok(generatedCrawler.includes('cookie.domain_specified = False'));
assert.ok(generatedCrawler.includes('target_url = urlparse(url)'));
assert.ok(generatedCrawler.includes('target_url.path or "/"'));
assert.ok(generatedCrawler.includes('cookie_expires = int(expires_value) if expires_value is not None else None'));
assert.equal(normalizeUrlInput('example.com'), 'https://example.com/');
assert.throws(() => normalizeUrlInput('javascript:alert(1)'), /網址無效/);
const crawlerTempDir = await mkdtemp(path.join(os.tmpdir(), 'droidpy-crawler-check-'));
try {
  const crawlerFile = path.join(crawlerTempDir, 'crawler_session.py');
  await writeFile(crawlerFile, generatedCrawler, 'utf8');
  const result = spawnSync('python3', ['-m', 'py_compile', crawlerFile], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Generated crawler Python failed py_compile:\n${result.stdout}\n${result.stderr}`);
  }
} finally {
  await rm(crawlerTempDir, { recursive: true, force: true });
}

const browserPanel = await readFile('src/components/CrawlerBrowserPanel.tsx', 'utf8');
assert.ok(browserPanel.includes('safeAddressHref'));
assert.ok(browserPanel.includes('setProbeResult(null);'));
assert.ok(browserPanel.includes('if (isNativeApk) {'));
assert.ok(browserPanel.includes('window.DroidPyNative?.openCrawlerBrowser'));
assert.ok(browserPanel.includes('window.DroidPyNative.openCrawlerBrowser(clean, isDesktopUa);'));
assert.ok(!browserPanel.includes('const openBrowser = window.DroidPyNative?.openCrawlerBrowser'));
assert.ok(browserPanel.includes('const handleOpenNativeBrowser = () => {\n    navigateTo(urlInput);'));
assert.ok(browserPanel.includes('Host-only cookie'));
assert.ok(browserPanel.includes('sandbox="allow-scripts allow-forms allow-popups"'));
assert.ok(!browserPanel.includes('allow-same-origin'));
assert.ok(androidBuilder.includes('settings.allowFileAccess = false'));
assert.ok(androidBuilder.includes('settings.allowContentAccess = false'));
assert.ok(androidBuilder.includes('WebSettings.MIXED_CONTENT_NEVER_ALLOW'));
assert.ok(androidBuilder.includes('handler?.cancel()'));

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
  ['pip', 'scipy', 'pkg', 'python-scipy'],
  ['pip', 'pandas', 'pkg', 'python-pandas'],
  ['pip', 'Pillow', 'pkg', 'python-pillow'],
  ['pip', 'PIL', 'pkg', 'python-pillow'],
  ['pip', 'lxml', 'pkg', 'python-lxml'],
  ['pip', 'cryptography', 'pkg', 'python-cryptography'],
  ['pip', 'matplotlib', 'pkg', 'matplotlib'],
  ['pip', 'apsw', 'pkg', 'python-apsw'],
  ['pip', 'bcrypt', 'pkg', 'python-bcrypt'],
  ['pip', 'brotli', 'pkg', 'python-brotli'],
  ['pip', 'grpcio', 'pkg', 'python-grpcio'],
  ['pip', 'msgpack', 'pkg', 'python-msgpack'],
  ['pip', 'psutil', 'pkg', 'python-psutil'],
  ['pip', 'pycryptodomex', 'pkg', 'python-pycryptodomex'],
  ['pip', 'tflite-runtime', 'pkg', 'python-tflite-runtime'],
  ['pip', 'torch', 'pkg', 'python-torch'],
  ['pip', 'torchaudio', 'pkg', 'python-torchaudio'],
  ['pip', 'torchvision', 'pkg', 'python-torchvision'],
  ['pip', 'yt-dlp', 'pkg', 'python-yt-dlp'],
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

// Execute the actual generated Python route functions to verify direct terminal installs.
const routeTestFile = path.join(os.tmpdir(), 'droidpy-package-route-test.py');
const routeSourceFile = path.join(os.tmpdir(), 'droidpy-route-generated.py');
const routeTest = [
  'import ast, re, shlex, sys',
  'source = open(sys.argv[1], encoding="utf-8").read()',
  'tree = ast.parse(source)',
  'wanted = {"_compatibility_install_command", "_normalize_shell_command"}',
  'nodes = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in wanted]',
  'assert {node.name for node in nodes} == wanted',
  'namespace = {"re": re, "shlex": shlex, "_build_pip_cmd": lambda args, trusted_host=False: ["pip", "install", *args]}',
  'exec(compile(ast.Module(body=nodes, type_ignores=[]), "<package-routes>", "exec"), namespace)',
  'expected = {"numpy": "python-numpy", "pandas": "python-pandas", "pillow": "python-pillow", "pil": "python-pillow", "lxml": "python-lxml", "cryptography": "python-cryptography", "matplotlib": "matplotlib", "apsw": "python-apsw", "bcrypt": "python-bcrypt", "brotli": "python-brotli", "grpcio": "python-grpcio", "msgpack": "python-msgpack", "psutil": "python-psutil", "pycryptodomex": "python-pycryptodomex", "tflite-runtime": "python-tflite-runtime", "torch": "python-torch", "torchaudio": "python-torchaudio", "torchvision": "python-torchvision", "yt-dlp": "python-yt-dlp", "scipy": "python-scipy"}',
  'for name, target in expected.items():',
  '    command = "pkg install -y " + shlex.quote(target)',
  '    assert namespace["_compatibility_install_command"](name) == command, (name, namespace["_compatibility_install_command"](name))',
  '    assert namespace["_normalize_shell_command"]("pip install " + name) == command, (name, namespace["_normalize_shell_command"]("pip install " + name))',
  'assert namespace["_normalize_shell_command"]("pip install numpy==2.0.0") == "pip install numpy==2.0.0"',
  'assert namespace["_normalize_shell_command"]("pip install requests pandas") == "pip install requests pandas"',
  'assert namespace["_normalize_shell_command"]("pip install scikit-learn").startswith("echo ")',
];
await writeFile(routeTestFile, routeTest.join('\n'), 'utf8');
await writeFile(routeSourceFile, generated, 'utf8');
try {
  const result = spawnSync('python3', [routeTestFile, routeSourceFile], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Generated package route test failed:\n${result.stdout}\n${result.stderr}`);
} finally {
  await rm(routeTestFile, { force: true });
  await rm(routeSourceFile, { force: true });
}
assert.ok(generated.includes('cmd = [sys.executable, "-m", "pip", "install", "--prefer-binary"]'));
console.log('Generated Termux Bridge token/origin checks and Python syntax validation passed.');

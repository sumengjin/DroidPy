import { InstalledPackage, PythonFile } from '../types/ide';
import { copyTextReliable } from '../utils/clipboard';

const PYODIDE_CDN_BASE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';

interface PyodideInterface {
  loadPackage: (names: string | string[]) => Promise<void>;
  loadPackagesFromImports: (code: string) => Promise<void>;
  runPythonAsync: (code: string, options?: { globals?: unknown }) => Promise<unknown>;
  runPython: (code: string) => unknown;
  setStdout: (options: { batched: (text: string) => void }) => void;
  setStderr: (options: { batched: (text: string) => void }) => void;
  FS: {
    writeFile: (path: string, data: string, opts?: { encoding: string }) => void;
    mkdirTree: (path: string) => void;
    unlink?: (path: string) => void;
  };
  globals: {
    get: (name: string) => unknown;
    set: (name: string, val: unknown) => void;
  };
}

declare global {
  interface Window {
    loadPyodide?: (config: { indexURL: string }) => Promise<PyodideInterface>;
    __droidBridge?: {
      vibrate: (pattern: number | number[]) => boolean;
      deviceInfo: () => string;
      battery: () => Promise<string>;
      toast: (message: string) => void;
      clipboardSet: (text: string) => Promise<boolean>;
      emitPlot: (base64Png: string) => void;
      requestInput: (promptText: string) => Promise<string>;
      storageInfo: () => Promise<string>;
    };
  }
}

export interface RuntimeCallbacks {
  onStdout: (text: string) => void;
  onStderr: (text: string) => void;
  onSystem: (text: string) => void;
  onPlot: (dataUrl: string) => void;
  onToast: (message: string) => void;
  onInputRequest: (promptText: string) => Promise<string>;
}

let pyodideInstance: PyodideInterface | null = null;
let initPromise: Promise<PyodideInterface> | null = null;
let micropipLoaded = false;
const syncedWorkspaceFiles = new Set<string>();

let activeCallbacks: RuntimeCallbacks | null = null;

function ensureDroidBridge() {
  window.__droidBridge = {
    vibrate: (pattern: number | number[]) => {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        return navigator.vibrate(pattern);
      }
      return false;
    },
    deviceInfo: () => {
      const info = {
        platform: 'Android',
        deviceType: 'phone',
        userAgent: navigator.userAgent,
        language: navigator.language,
        screen: `${window.screen.width}x${window.screen.height}`,
        pixelRatio: window.devicePixelRatio || 1,
        maxTouchPoints: navigator.maxTouchPoints || 5,
        online: navigator.onLine,
      };
      return JSON.stringify(info);
    },
    battery: async () => {
      try {
        const nav = navigator as unknown as {
          getBattery?: () => Promise<{ level: number; charging: boolean }>;
        };
        if (typeof nav.getBattery === 'function') {
          const b = await nav.getBattery();
          return JSON.stringify({
            supported: true,
            level: b.level,
            charging: b.charging,
          });
        }
      } catch {
        // Fallback when blocked by browser permissions
      }
      return JSON.stringify({ supported: false, level: 1, charging: true });
    },
    toast: (message: string) => {
      activeCallbacks?.onToast(String(message));
    },
    clipboardSet: async (text: string) => {
      return copyTextReliable(text);
    },
    emitPlot: (base64Png: string) => {
      activeCallbacks?.onPlot(`data:image/png;base64,${base64Png}`);
    },
    requestInput: async (promptText: string) => {
      if (!activeCallbacks) return '';
      return activeCallbacks.onInputRequest(promptText);
    },
    storageInfo: async () => {
      try {
        const est = navigator.storage?.estimate ? await navigator.storage.estimate() : { usage: 0, quota: 0 };
        const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
        return JSON.stringify({
          usageBytes: est.usage ?? 0,
          quotaBytes: est.quota ?? 0,
          persisted,
        });
      } catch {
        return JSON.stringify({ usageBytes: 0, quotaBytes: 0, persisted: false });
      }
    },
  };
}

function loadPyodideScript(): Promise<void> {
  if (typeof window.loadPyodide === 'function') {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-pyodide="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Pyodide 核心載入失敗')));
      return;
    }
    const script = document.createElement('script');
    script.src = `${PYODIDE_CDN_BASE}pyodide.js`;
    script.async = true;
    script.dataset.pyodide = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('無法連線至 Pyodide CDN，請檢查網路狀態'));
    document.head.appendChild(script);
  });
}

const DROID_MODULE_PY = `import json
import os
import js

def vibrate(pattern=40):
    """在支援震動馬達的 Android 裝置上觸發震動（毫秒或陣列）"""
    if isinstance(pattern, (list, tuple)):
        js_arr = js.Array.new(*pattern)
        return bool(js.window.__droidBridge.vibrate(js_arr))
    return bool(js.window.__droidBridge.vibrate(int(pattern)))

def device_info():
    """取得裝置平台、螢幕解析度、觸控點數與網路狀態"""
    raw = js.window.__droidBridge.deviceInfo()
    return json.loads(str(raw))

async def battery():
    """非同步取得 Android / 瀏覽器電量與充電狀態"""
    raw = await js.window.__droidBridge.battery()
    return json.loads(str(raw))

def toast(message):
    """在 IDE 介面顯示 Android Toast 通知"""
    js.window.__droidBridge.toast(str(message))

async def clipboard_set(text):
    """將文字寫入系統剪貼簿"""
    return bool(await js.window.__droidBridge.clipboardSet(str(text)))

async def storage_info():
    """非同步取得裝置儲存空間配額與持久化授權狀態"""
    raw = await js.window.__droidBridge.storageInfo()
    return json.loads(str(raw))
`;

const RUNTIME_BOOTSTRAP_PY = `import ast
import asyncio
import base64
import io
import js
import os
import sys
import traceback

if "/home/pyodide" not in sys.path:
    sys.path.insert(0, "/home/pyodide")

async def __droidpy_async_input__(prompt=""):
    if prompt:
        print(prompt, end="", flush=True)
    val = await js.window.__droidBridge.requestInput(str(prompt))
    print(val)
    return str(val)

def __droidpy_patch_matplotlib__():
    import importlib.util
    if "matplotlib" in sys.modules or importlib.util.find_spec("matplotlib") is not None:
        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
            def _patched_show(*args, **kwargs):
                for num in plt.get_fignums():
                    fig = plt.figure(num)
                    buf = io.BytesIO()
                    fig.savefig(buf, format="png", bbox_inches="tight", dpi=140)
                    buf.seek(0)
                    b64 = base64.b64encode(buf.read()).decode("ascii")
                    js.window.__droidBridge.emitPlot(b64)
                    plt.close(fig)
            plt.show = _patched_show
        except Exception:
            pass

def __droidpy_transform_input_ast__(source_code):
    tree = ast.parse(source_code, mode="exec")
    has_input = False
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "input":
            has_input = True
            break
    if not has_input:
        return source_code, False

    async_funcs = set()
    changed = True
    while changed:
        changed = False
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                for sub in ast.walk(node):
                    if isinstance(sub, ast.Call) and isinstance(sub.func, ast.Name):
                        if sub.func.id == "input" or sub.func.id in async_funcs:
                            if node.name not in async_funcs:
                                async_funcs.add(node.name)
                                changed = True

    class _InputTransformer(ast.NodeTransformer):
        def visit_FunctionDef(self, node):
            self.generic_visit(node)
            if node.name in async_funcs:
                return ast.AsyncFunctionDef(
                    name=node.name,
                    args=node.args,
                    body=node.body,
                    decorator_list=node.decorator_list,
                    returns=node.returns,
                    type_comment=node.type_comment,
                    lineno=node.lineno,
                    col_offset=node.col_offset,
                )
            return node

        def visit_Call(self, node):
            self.generic_visit(node)
            if isinstance(node.func, ast.Name):
                if node.func.id == "input":
                    new_call = ast.Call(
                        func=ast.Name(id="__droidpy_async_input__", ctx=ast.Load()),
                        args=node.args,
                        keywords=node.keywords,
                    )
                    return ast.Await(value=new_call)
                if node.func.id in async_funcs:
                    return ast.Await(value=node)
            return node

    transformed = _InputTransformer().visit(tree)
    ast.fix_missing_locations(transformed)
    return ast.unparse(transformed), True

def __droidpy_install_process_guards__():
    if sys.platform != "emscripten":
        return
    try:
        import subprocess
        _orig_popen = getattr(subprocess, "Popen", None)
        _orig_run = getattr(subprocess, "run", None)

        def _guarded_popen(args, *a, **kw):
            cmd_preview = " ".join(args) if isinstance(args, (list, tuple)) else str(args)
            raise OSError(
                138,
                f"emscripten does not support processes（沙盒無法執行外部指令：{cmd_preview}；請改用「原生 Python」執行）"
            )

        def _guarded_run(args, *a, **kw):
            cmd_preview = " ".join(args) if isinstance(args, (list, tuple)) else str(args)
            raise OSError(
                138,
                f"emscripten does not support processes（沙盒無法執行外部指令：{cmd_preview}；請改用「原生 Python」執行）"
            )

        if _orig_popen is not None:
            subprocess.Popen = _guarded_popen
        if _orig_run is not None:
            subprocess.run = _guarded_run
            subprocess.check_call = _guarded_run
            subprocess.check_output = _guarded_run
            subprocess.call = _guarded_run
    except Exception:
        pass
    try:
        def _guarded_system(cmd):
            raise OSError(
                138,
                f"emscripten does not support processes（os.system 無法於沙盒執行：{cmd}；請改用「原生 Python」執行）"
            )
        os.system = _guarded_system
    except Exception:
        pass

__droidpy_install_process_guards__()
__droidpy_repl_ns__ = {"__name__": "__main__"}
`;

function formatPyodideError(rawMsg: string, contextHint?: string): string {
  const clean = rawMsg.trim();
  if (
    clean.includes('Errno 138') ||
    clean.includes('emscripten does not support processes') ||
    clean.includes('subprocess is not supported')
  ) {
    return (
      `${clean}\n\n` +
      '【環境說明】Pyodide 瀏覽器 WebAssembly 沙盒受限於單執行緒 Emscripten 環境，不支援建立外部子行程（如 subprocess.run / pip / os.system）。\n' +
      '建議解法：\n' +
      '1. 切回「內建 Python」執行此腳本（支援完整 subprocess 與系統指令）。\n' +
      '2. 若僅為學習測試，可將腳本中自動呼叫 pip / subprocess 的段落包在 try...except (OSError, NotImplementedError) 中跳過。'
    );
  }
  if (
    clean.includes("Can't find a pure Python 3 wheel") ||
    clean.includes('No known packages') ||
    clean.includes('pure Python')
  ) {
    return (
      `${clean}\n\n` +
      `【環境說明】${contextHint ? `套件「${contextHint}」或其相依套件` : '目標套件'}包含 C/C++ 原生擴充原始碼（例如 parsel / lxml 等）且缺少 WebAssembly (wasm32) 預編譯 wheel，無法在瀏覽器沙盒中編譯。\n` +
      '建議改用「內建 Python」執行 pip / pkg 安裝。'
    );
  }
  if (
    clean.includes('FileNotFoundError') &&
    (/\/storage\/emulated\/0|Download|ovpn|tmp/i.test(clean))
  ) {
    return (
      `${clean}\n\n` +
      '【路徑提示】Pyodide 瀏覽器沙盒無法直接存取 /storage/emulated/0，請改用預設「內建 Python」執行。'
    );
  }
  return clean;
}

export async function initPyodide(callbacks: RuntimeCallbacks): Promise<PyodideInterface> {
  activeCallbacks = callbacks;
  ensureDroidBridge();

  if (pyodideInstance) {
    pyodideInstance.setStdout({ batched: (msg) => activeCallbacks?.onStdout(msg) });
    pyodideInstance.setStderr({ batched: (msg) => activeCallbacks?.onStderr(msg) });
    return pyodideInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    callbacks.onSystem('正在載入 Pyodide 3.12 WebAssembly 沙盒核心...');
    await loadPyodideScript();
    if (!window.loadPyodide) {
      throw new Error('loadPyodide 初始化函式遺失');
    }

    const py = await window.loadPyodide({ indexURL: PYODIDE_CDN_BASE });
    py.setStdout({ batched: (msg) => activeCallbacks?.onStdout(msg) });
    py.setStderr({ batched: (msg) => activeCallbacks?.onStderr(msg) });

    py.FS.mkdirTree('/home/pyodide');
    py.FS.writeFile('/home/pyodide/droid.py', DROID_MODULE_PY, { encoding: 'utf8' });
    await py.runPythonAsync(RUNTIME_BOOTSTRAP_PY);

    pyodideInstance = py;
    callbacks.onSystem('Pyodide 沙盒就緒（支援離線快取、Matplotlib 圖表與 Android 裝置橋接）');
    return py;
  })();

  try {
    return await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

export function syncFilesToFS(py: PyodideInterface, files: PythonFile[]) {
  py.FS.mkdirTree('/home/pyodide');
  const nextNames = new Set<string>();
  const moduleNames: string[] = [];

  for (const file of files) {
    const cleanName = file.name.replace(/^\/+/, '');
    if (!cleanName) continue;
    nextNames.add(cleanName);
    py.FS.writeFile(`/home/pyodide/${cleanName}`, file.content, { encoding: 'utf8' });
    if (cleanName.endsWith('.py')) {
      moduleNames.push(cleanName.slice(0, -3));
    }
  }

  // Remove files deleted or renamed since the previous sync (never touch bundled droid.py)
  for (const prevName of Array.from(syncedWorkspaceFiles)) {
    if (!nextNames.has(prevName) && prevName !== 'droid.py') {
      try {
        py.FS.unlink?.(`/home/pyodide/${prevName}`);
      } catch {
        // ignore if already absent
      }
      if (prevName.endsWith('.py')) {
        moduleNames.push(prevName.slice(0, -3));
      }
      syncedWorkspaceFiles.delete(prevName);
    }
  }
  for (const name of nextNames) {
    syncedWorkspaceFiles.add(name);
  }

  // Invalidate cached user modules in sys.modules so edits/deletions apply immediately
  py.globals.set('__droidpy_user_mods__', moduleNames);
  py.runPython(`
import sys
for _m in list(__droidpy_user_mods__):
    if _m in sys.modules:
        del sys.modules[_m]
`);
}

export async function executePythonFile(
  activeFile: PythonFile,
  allFiles: PythonFile[],
  callbacks: RuntimeCallbacks
): Promise<{ durationMs: number; success: boolean }> {
  activeCallbacks = callbacks;
  const py = await initPyodide(callbacks);
  syncFilesToFS(py, allFiles);

  const startedAt = performance.now();
  try {
    await py.loadPackagesFromImports(activeFile.content);
    py.runPython('__droidpy_patch_matplotlib__()');

    py.globals.set('__droidpy_source__', activeFile.content);
    py.globals.set('__droidpy_filename__', activeFile.name);

    const execScript = `
_code, _transformed = __droidpy_transform_input_ast__(__droidpy_source__)
_ns = {"__name__": "__main__", "__file__": f"/home/pyodide/{__droidpy_filename__}", "__droidpy_async_input__": __droidpy_async_input__}
`;
    py.runPython(execScript);
    const transformedCode = String(py.runPython('_code'));
    const ns = py.globals.get('_ns') as { destroy?: () => void } | undefined;

    try {
      await py.runPythonAsync(transformedCode, { globals: ns });
      // Re-run matplotlib patch in case script imported matplotlib dynamically
      py.runPython('__droidpy_patch_matplotlib__()');
    } finally {
      if (ns && typeof ns.destroy === 'function') {
        ns.destroy();
      }
    }

    const durationMs = Math.round(performance.now() - startedAt);
    return { durationMs, success: true };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const durationMs = Math.round(performance.now() - startedAt);

    if (rawMsg.includes('KeyboardInterrupt')) {
      callbacks.onSystem('使用者已中止輸入，程式執行已安全中斷 (KeyboardInterrupt)');
      return { durationMs, success: false };
    }

    const sysExitMatch = rawMsg.match(/SystemExit:\s*(.*)$/m);
    if (sysExitMatch) {
      const codeRaw = sysExitMatch[1].trim();
      if (!codeRaw || codeRaw === '0' || codeRaw === 'None') {
        return { durationMs, success: true };
      }
      callbacks.onStderr(`SystemExit: ${codeRaw}`);
      return { durationMs, success: false };
    }

    let message = formatPyodideError(rawMsg);
    if (
      message.includes('SyntaxError') &&
      /^[!%]?\s*pip\s+install\b/m.test(activeFile.content)
    ) {
      message +=
        '\n\n提示：pip install 屬於終端機 Shell 指令，並非 Python 語法，不能直接寫在 .py 檔案中執行。請改至「套件管理」分頁安裝套件，或在下方 >>> REPL 直接輸入 pip install <套件名稱>。';
    }
    callbacks.onStderr(message);
    return { durationMs, success: false };
  }
}

export async function executeReplLine(
  statement: string,
  allFiles: PythonFile[],
  callbacks: RuntimeCallbacks
): Promise<string | null> {
  activeCallbacks = callbacks;
  const py = await initPyodide(callbacks);
  syncFilesToFS(py, allFiles);

  const trimmed = statement.trim();
  const normalizedCmd = trimmed.replace(/^[!%]\s*/, '');

  // Intercept shell-style pip commands in REPL
  if (/^pip\s+install\b/i.test(normalizedCmd)) {
    const tokens = normalizedCmd
      .replace(/^pip\s+install\b/i, '')
      .trim()
      .split(/\s+/)
      .filter((t) => t && !t.startsWith('-'));
    if (tokens.length === 0) {
      callbacks.onStderr('請指定要安裝的套件名稱，例如：pip install sympy');
      return null;
    }
    for (const pkg of tokens) {
      if (pkg.toLowerCase() === 'ffmpeg') {
        callbacks.onStderr(
          '說明：ffmpeg 是原生 C/C++ 影音命令列工具（系統二進位執行檔），無法透過 pip 在瀏覽器沙盒中執行。若於 Android Termux 實機環境，請執行「pkg install ffmpeg」；若要安裝 Python 包裝庫，可安裝「ffmpeg-python」。'
        );
        continue;
      }
      try {
        await installPyPackage(pkg, callbacks);
      } catch (err) {
        callbacks.onStderr(err instanceof Error ? err.message : String(err));
      }
    }
    return null;
  }

  if (/^pip\s+uninstall\b/i.test(normalizedCmd)) {
    const tokens = normalizedCmd
      .replace(/^pip\s+uninstall\b/i, '')
      .trim()
      .split(/\s+/)
      .filter((t) => t && !t.startsWith('-'));
    if (tokens.length === 0) {
      callbacks.onStderr('請指定要解除安裝的套件名稱，例如：pip uninstall sympy');
      return null;
    }
    for (const pkg of tokens) {
      try {
        await uninstallPyPackage(pkg, callbacks);
      } catch (err) {
        callbacks.onStderr(err instanceof Error ? err.message : String(err));
      }
    }
    return null;
  }

  if (/^pip\s+list\b/i.test(normalizedCmd)) {
    try {
      const pkgs = await listPyPackages(callbacks);
      return pkgs.map((p) => `${p.name}==${p.version}`).join('\n');
    } catch (err) {
      callbacks.onStderr(err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  try {
    await py.loadPackagesFromImports(statement);
    py.runPython('__droidpy_patch_matplotlib__()');
    py.globals.set('__droidpy_repl_stmt__', statement);
    const result = await py.runPythonAsync(`
import ast as _ast
import inspect as _inspect
_stmt_src = str(__droidpy_repl_stmt__).strip()
_repl_out = None
__droidpy_repl_ns__["__droidpy_async_input__"] = __droidpy_async_input__
if _stmt_src:
    _transformed_src, _was_input = __droidpy_transform_input_ast__(_stmt_src)
    _parsed = _ast.parse(_transformed_src, mode="exec")
    if len(_parsed.body) == 1 and isinstance(_parsed.body[0], _ast.Expr):
        _val = eval(compile(_ast.Expression(_parsed.body[0].value), "<repl>", "eval", flags=_ast.PyCF_ALLOW_TOP_LEVEL_AWAIT), __droidpy_repl_ns__)
        if _inspect.isawaitable(_val):
            _val = await _val
        if _val is not None:
            __droidpy_repl_ns__["_"] = _val
            _repl_out = repr(_val)
    else:
        _res = eval(compile(_parsed, "<repl>", "exec", flags=_ast.PyCF_ALLOW_TOP_LEVEL_AWAIT), __droidpy_repl_ns__)
        if _inspect.isawaitable(_res):
            await _res
_repl_out
`);
    if (result !== undefined && result !== null && String(result).length > 0) {
      return String(result);
    }
    return null;
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    if (rawMsg.includes('KeyboardInterrupt')) {
      callbacks.onSystem('使用者已中止輸入 (KeyboardInterrupt)');
      return null;
    }
    callbacks.onStderr(formatPyodideError(rawMsg));
    return null;
  }
}

export async function installPyPackage(
  packageName: string,
  callbacks: RuntimeCallbacks
): Promise<InstalledPackage[]> {
  activeCallbacks = callbacks;
  const py = await initPyodide(callbacks);
  const cleanPkg = packageName.trim();
  if (!cleanPkg) return [];

  if (!micropipLoaded) {
    callbacks.onSystem('正在載入 micropip 套件管理員...');
    await py.loadPackage('micropip');
    micropipLoaded = true;
  }

  callbacks.onSystem(`正在安裝套件 "${cleanPkg}"...`);
  py.globals.set('__droidpy_pkg_target__', cleanPkg);
  try {
    await py.runPythonAsync(`
import micropip
await micropip.install(__droidpy_pkg_target__)
`);
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    throw new Error(formatPyodideError(rawMsg, cleanPkg));
  }
  callbacks.onSystem(`套件 "${cleanPkg}" 安裝完成`);
  const list = await listPyPackages(callbacks);
  const bare = cleanPkg.split(/[=<>!~[\s]/)[0];
  const installedEntry = list.find(
    (p) => normalizePyPkgName(p.name) === normalizePyPkgName(bare)
  );
  if (installedEntry) {
    verifiedLatestPyPkgs.set(normalizePyPkgName(installedEntry.name), installedEntry.version);
  }
  return list;
}

export async function listPyPackages(callbacks: RuntimeCallbacks): Promise<InstalledPackage[]> {
  activeCallbacks = callbacks;
  const py = await initPyodide(callbacks);
  if (!micropipLoaded) {
    await py.loadPackage('micropip');
    micropipLoaded = true;
  }
  const rawJson = await py.runPythonAsync(`
import json, micropip
_pkgs = micropip.list()
json.dumps([{"name": str(k), "version": str(v.version)} for k, v in _pkgs.items()])
`);
  try {
    return JSON.parse(String(rawJson)) as InstalledPackage[];
  } catch {
    return [];
  }
}

export interface OutdatedPackageInfo {
  name: string;
  currentVersion: string;
  latestVersion: string;
}

export const PYODIDE_CORE_PACKAGES = new Set(['micropip', 'packaging', 'pyodide-http']);

export function normalizePyPkgName(name: string): string {
  return name.trim().toLowerCase().replace(/[-_.]+/g, '-');
}

const verifiedLatestPyPkgs = new Map<string, string>();

interface ParsedPep440 {
  epoch: number;
  release: number[];
  preType: number; // -3=dev, -2=a, -1=b, 0=rc, 1=final
  preNum: number;
  postNum: number;
  devNum: number;
  isPrerelease: boolean;
}

function parsePep440Version(raw: string): ParsedPep440 | null {
  const cleaned = raw.trim().toLowerCase().split('+')[0];
  const m = cleaned.match(
    /^(?:(\d+)!)?(\d+(?:\.\d+)*)(?:[-_.]?(a|alpha|b|beta|c|rc|pre|preview)[-_.]?(\d*))?(?:[-_.]?post[-_.]?(\d*))?(?:[-_.]?dev(\d*))?$/
  );
  if (!m) {
    const fallbackNums = cleaned
      .replace(/[^0-9.]/g, '.')
      .split('.')
      .filter(Boolean)
      .map((n) => parseInt(n, 10) || 0);
    if (fallbackNums.length === 0) return null;
    return {
      epoch: 0,
      release: fallbackNums,
      preType: 1,
      preNum: 0,
      postNum: -1,
      devNum: Number.MAX_SAFE_INTEGER,
      isPrerelease: false,
    };
  }
  const epoch = m[1] ? parseInt(m[1], 10) || 0 : 0;
  const release = m[2].split('.').map((n) => parseInt(n, 10) || 0);
  const preTag = m[3] || '';
  const preNum = m[4] ? parseInt(m[4], 10) || 0 : 0;
  const postNum = m[5] !== undefined ? parseInt(m[5] || '0', 10) || 0 : -1;
  const devNum = m[6] !== undefined ? parseInt(m[6] || '0', 10) || 0 : Number.MAX_SAFE_INTEGER;

  let preType = 1;
  if (preTag === 'a' || preTag === 'alpha') preType = -2;
  else if (preTag === 'b' || preTag === 'beta') preType = -1;
  else if (preTag === 'c' || preTag === 'rc' || preTag === 'pre' || preTag === 'preview') preType = 0;

  const isPrerelease = preType < 1 || m[6] !== undefined;
  return { epoch, release, preType, preNum, postNum, devNum, isPrerelease };
}

export function comparePep440Versions(aRaw: string, bRaw: string): number {
  const a = parsePep440Version(aRaw);
  const b = parsePep440Version(bRaw);
  if (!a || !b) {
    return aRaw.trim().localeCompare(bRaw.trim());
  }
  if (a.epoch !== b.epoch) return a.epoch > b.epoch ? 1 : -1;

  const len = Math.max(a.release.length, b.release.length);
  for (let i = 0; i < len; i++) {
    const va = a.release[i] ?? 0;
    const vb = b.release[i] ?? 0;
    if (va !== vb) return va > vb ? 1 : -1;
  }

  // Pure dev without pre-release sorts before alpha
  const aKeyType = a.preType === 1 && a.devNum !== Number.MAX_SAFE_INTEGER ? -3 : a.preType;
  const bKeyType = b.preType === 1 && b.devNum !== Number.MAX_SAFE_INTEGER ? -3 : b.preType;
  if (aKeyType !== bKeyType) return aKeyType > bKeyType ? 1 : -1;
  if (a.preNum !== b.preNum) return a.preNum > b.preNum ? 1 : -1;
  if (a.postNum !== b.postNum) return a.postNum > b.postNum ? 1 : -1;
  if (a.devNum !== b.devNum) return a.devNum > b.devNum ? 1 : -1;
  return 0;
}

function getPyodideLockfileVersions(): Map<string, string> {
  const map = new Map<string, string>();
  if (!pyodideInstance) return map;
  try {
    const raw = pyodideInstance.runPython(`
import json as _dp_json
_dp_lock = {}
try:
    import pyodide._api as _dp_api
    _repo = getattr(_dp_api, "repodata_packages", None) or {}
    for _k, _v in _repo.items():
        if isinstance(_v, dict) and _v.get("version"):
            _dp_lock[str(_k).lower().replace("_", "-")] = str(_v["version"])
except Exception:
    pass
_dp_json.dumps(_dp_lock)
`);
    const parsed = JSON.parse(String(raw)) as Record<string, string>;
    for (const [k, v] of Object.entries(parsed)) {
      map.set(normalizePyPkgName(k), v);
    }
  } catch {
    // ignore if repodata introspection unavailable
  }
  return map;
}

interface PyPiReleaseFile {
  packagetype?: string;
  filename?: string;
  yanked?: boolean;
}

interface PyPiJsonResponse {
  info?: { version?: string };
  releases?: Record<string, PyPiReleaseFile[]>;
}

function findLatestInstallablePyPiVersion(
  json: PyPiJsonResponse,
  installedVer: string,
  lockfileVer?: string
): string | null {
  const installedParsed = parsePep440Version(installedVer);
  const allowPre = Boolean(installedParsed?.isPrerelease);

  let bestVersion: string | null = null;
  const releases = json.releases ?? {};
  for (const [ver, files] of Object.entries(releases)) {
    if (!Array.isArray(files) || files.length === 0) continue;
    const parsed = parsePep440Version(ver);
    if (!parsed) continue;
    if (!allowPre && parsed.isPrerelease) continue;

    // Only pure Python wheels (none-any.whl) are installable directly from PyPI in micropip
    const hasPureWheel = files.some(
      (f) =>
        !f.yanked &&
        f.packagetype === 'bdist_wheel' &&
        typeof f.filename === 'string' &&
        f.filename.toLowerCase().endsWith('none-any.whl')
    );
    if (!hasPureWheel) continue;

    if (!bestVersion || comparePep440Versions(ver, bestVersion) > 0) {
      bestVersion = ver;
    }
  }

  // If the package is a Pyodide WASM repodata package with no pure wheel newer than lockfile,
  // respect the Pyodide WASM repodata ceiling so C-extension packages don't false-positive.
  if (lockfileVer && (!bestVersion || comparePep440Versions(lockfileVer, bestVersion) >= 0)) {
    return lockfileVer;
  }

  if (bestVersion) return bestVersion;

  // Fallback to info.version only if non-WASM and non-prerelease
  const infoVer = json.info?.version?.trim();
  if (infoVer) {
    const infoParsed = parsePep440Version(infoVer);
    if (infoParsed && (allowPre || !infoParsed.isPrerelease) && !lockfileVer) {
      return infoVer;
    }
  }
  return lockfileVer ?? null;
}

export async function checkOutdatedPyPackages(
  installed: InstalledPackage[]
): Promise<OutdatedPackageInfo[]> {
  const targets = installed.filter(
    (p) => !PYODIDE_CORE_PACKAGES.has(normalizePyPkgName(p.name))
  );
  const lockfileVersions = getPyodideLockfileVersions();

  const results = await Promise.all(
    targets.map(async (pkg) => {
      const normName = normalizePyPkgName(pkg.name);
      const verifiedVer = verifiedLatestPyPkgs.get(normName);
      if (verifiedVer && verifiedVer === pkg.version) {
        return null;
      }

      const lockVer = lockfileVersions.get(normName);
      try {
        const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(pkg.name)}/json`);
        if (!res.ok) return null;
        const json = (await res.json()) as PyPiJsonResponse;
        const latest = findLatestInstallablePyPiVersion(json, pkg.version, lockVer);
        if (latest && comparePep440Versions(latest, pkg.version) > 0) {
          return {
            name: pkg.name,
            currentVersion: pkg.version,
            latestVersion: latest,
          };
        }
        verifiedLatestPyPkgs.set(normName, pkg.version);
      } catch {
        // ignore network errors for individual packages
      }
      return null;
    })
  );
  return results.filter((x): x is OutdatedPackageInfo => x !== null);
}

export async function upgradePyPackage(
  packageName: string,
  callbacks: RuntimeCallbacks,
  targetVersion?: string
): Promise<InstalledPackage[]> {
  activeCallbacks = callbacks;
  const py = await initPyodide(callbacks);
  const cleanPkg = packageName.trim();
  if (!cleanPkg) return listPyPackages(callbacks);

  if (!micropipLoaded) {
    callbacks.onSystem('正在載入 micropip 套件管理員...');
    await py.loadPackage('micropip');
    micropipLoaded = true;
  }

  const spec = targetVersion ? `${cleanPkg}==${targetVersion}` : cleanPkg;
  callbacks.onSystem(`正在更新套件 "${spec}"...`);
  py.globals.set('__droidpy_pkg_target__', cleanPkg);
  py.globals.set('__droidpy_pkg_spec__', spec);
  try {
    await py.runPythonAsync(`
import micropip
try:
    micropip.uninstall(__droidpy_pkg_target__)
except Exception:
    pass
await micropip.install(__droidpy_pkg_spec__)
`);
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    throw new Error(formatPyodideError(rawMsg, cleanPkg));
  }
  callbacks.onSystem(`套件 "${cleanPkg}" 更新完成`);
  const list = await listPyPackages(callbacks);
  const installedEntry = list.find(
    (p) => normalizePyPkgName(p.name) === normalizePyPkgName(cleanPkg)
  );
  if (installedEntry) {
    verifiedLatestPyPkgs.set(normalizePyPkgName(installedEntry.name), installedEntry.version);
  }
  return list;
}

export async function uninstallPyPackage(
  packageName: string,
  callbacks: RuntimeCallbacks
): Promise<InstalledPackage[]> {
  activeCallbacks = callbacks;
  const py = await initPyodide(callbacks);
  const cleanPkg = packageName.trim();
  const norm = normalizePyPkgName(cleanPkg);
  if (!cleanPkg || PYODIDE_CORE_PACKAGES.has(norm)) {
    return listPyPackages(callbacks);
  }

  if (!micropipLoaded) {
    callbacks.onSystem('正在載入 micropip 套件管理員...');
    await py.loadPackage('micropip');
    micropipLoaded = true;
  }

  callbacks.onSystem(`正在解除安裝套件 "${cleanPkg}"...`);
  py.globals.set('__droidpy_pkg_target__', cleanPkg);
  await py.runPythonAsync(`
import micropip
micropip.uninstall(__droidpy_pkg_target__)
`);
  verifiedLatestPyPkgs.delete(norm);
  callbacks.onSystem(`套件 "${cleanPkg}" 已解除安裝`);
  return listPyPackages(callbacks);
}

export async function upgradeAllPyPackages(
  targets: OutdatedPackageInfo[],
  callbacks: RuntimeCallbacks
): Promise<InstalledPackage[]> {
  let latestList = await listPyPackages(callbacks);
  for (const item of targets) {
    try {
      latestList = await upgradePyPackage(item.name, callbacks, item.latestVersion);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      callbacks.onStderr(`更新 ${item.name} 失敗: ${msg}`);
    }
  }
  return latestList;
}

export interface PythonSyntaxErrorInfo {
  line: number;
  col: number;
  message: string;
}

export function checkPythonSyntax(sourceCode: string): PythonSyntaxErrorInfo | null {
  if (!pyodideInstance || !sourceCode.trim()) return null;
  try {
    pyodideInstance.globals.set('__droidpy_lint_src__', sourceCode);
    const raw = pyodideInstance.runPython(`
import ast as _lint_ast, json as _lint_json
_lint_res = None
try:
    _lint_ast.parse(str(__droidpy_lint_src__), mode="exec")
except SyntaxError as _se:
    _lint_res = _lint_json.dumps({
        "line": int(_se.lineno or 1),
        "col": int(_se.offset or 1),
        "message": str(_se.msg or "SyntaxError")
    })
_lint_res
`);
    if (!raw) return null;
    return JSON.parse(String(raw)) as PythonSyntaxErrorInfo;
  } catch {
    return null;
  }
}

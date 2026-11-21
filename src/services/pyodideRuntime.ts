import { InstalledPackage, PythonFile } from '../types/ide';

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
        platform: navigator.platform || 'Android',
        userAgent: navigator.userAgent,
        language: navigator.language,
        screen: `${window.screen.width}x${window.screen.height}`,
        pixelRatio: window.devicePixelRatio || 1,
        maxTouchPoints: navigator.maxTouchPoints || 0,
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
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
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

__droidpy_repl_ns__ = {"__name__": "__main__"}
`;

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
    callbacks.onSystem('正在載入 Python 3.12 WebAssembly 核心...');
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
    callbacks.onSystem('Python 核心就緒（支援離線快取、Matplotlib 圖表與 Android 裝置橋接）');
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
  const moduleNames: string[] = [];
  for (const file of files) {
    const cleanName = file.name.replace(/^\/+/, '');
    py.FS.writeFile(`/home/pyodide/${cleanName}`, file.content, { encoding: 'utf8' });
    if (cleanName.endsWith('.py')) {
      moduleNames.push(cleanName.slice(0, -3));
    }
  }
  // Invalidate cached user modules in sys.modules so edits apply immediately
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
    let message = err instanceof Error ? err.message : String(err);
    const sysExitMatch = message.match(/SystemExit:\s*(.*)$/m);
    if (sysExitMatch) {
      const codeRaw = sysExitMatch[1].trim();
      const durationMs = Math.round(performance.now() - startedAt);
      if (!codeRaw || codeRaw === '0' || codeRaw === 'None') {
        return { durationMs, success: true };
      }
      callbacks.onStderr(`SystemExit: ${codeRaw}`);
      return { durationMs, success: false };
    }
    if (
      message.includes('SyntaxError') &&
      /^[!%]?\s*pip\s+install\b/m.test(activeFile.content)
    ) {
      message +=
        '\n\n提示：pip install 屬於終端機 Shell 指令，並非 Python 語法，不能直接寫在 .py 檔案中執行。請改至「套件管理」分頁安裝套件，或在下方 >>> REPL 直接輸入 pip install <套件名稱>。';
    }
    callbacks.onStderr(message);
    const durationMs = Math.round(performance.now() - startedAt);
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
if _stmt_src:
    _parsed = _ast.parse(_stmt_src, mode="exec")
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
    const message = err instanceof Error ? err.message : String(err);
    callbacks.onStderr(message);
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
    if (rawMsg.includes("Can't find a pure Python 3 wheel") || rawMsg.includes('pure Python')) {
      throw new Error(
        `套件 "${cleanPkg}" 包含尚未編譯的 C/C++ 原生擴充原始碼，且無對應的 WebAssembly (wasm32) 預編譯 wheel，無法於瀏覽器沙盒中編譯。建議改用 Termux（含 clang 工具鏈）或 Buildozer APK 匯出腳本於原生 Android 環境建置。`
      );
    }
    throw err;
  }
  callbacks.onSystem(`套件 "${cleanPkg}" 安裝完成`);
  return listPyPackages(callbacks);
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

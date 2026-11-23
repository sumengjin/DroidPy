import {
  PackageBackupStatus,
  PythonFile,
  SdcardEntry,
  SdcardStatusInfo,
  TermuxConfig,
  TermuxHealthInfo,
  UrlProbeResult,
} from '../types/ide';

export const DEFAULT_TERMUX_CONFIG: TermuxConfig = {
  endpointUrl: 'http://127.0.0.1:8765',
  token: 'droidpy-local',
};

export interface TermuxExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface TermuxStreamCallbacks {
  onChunk: (chunk: string) => void;
}

export function buildTermuxBridgeScript(token: string): string {
  const safeToken = token.replace(/["'\\]/g, '') || 'droidpy-local';
  return `import codecs
import json
import os
import platform
import pty
import re
import select
import shlex
import shutil
import signal
import ssl
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN = "${safeToken}"
WORKSPACE = os.path.expanduser("~/droidpy_workspace")
os.makedirs(WORKSPACE, exist_ok=True)

PROC_LOCK = threading.Lock()
ACTIVE_PROC = {"pid": None, "pgid": None, "master_fd": None}

def _set_active(pid, pgid, master_fd):
    with PROC_LOCK:
        ACTIVE_PROC["pid"] = pid
        ACTIVE_PROC["pgid"] = pgid
        ACTIVE_PROC["master_fd"] = master_fd

def _clear_active():
    with PROC_LOCK:
        ACTIVE_PROC["pid"] = None
        ACTIVE_PROC["pgid"] = None
        ACTIVE_PROC["master_fd"] = None

class DroidPyBridgeHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-DroidPy-Token")

    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._send_cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _begin_ndjson(self):
        self.send_response(200)
        self._send_cors()
        self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.end_headers()

    def _write_ndjson(self, payload):
        line = (json.dumps(payload, ensure_ascii=False) + "\\n").encode("utf-8")
        self.wfile.write(line)
        self.wfile.flush()

    def _check_auth(self):
        return self.headers.get("X-DroidPy-Token", "") == TOKEN

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        parsed_path = self.path.split("?", 1)[0]
        if parsed_path == "/health":
            if not self._check_auth():
                return self._send_json(401, {"error": "Invalid X-DroidPy-Token"})
            pip_pkgs = []
            try:
                import importlib.metadata as _im
                pip_pkgs = sorted({
                    (d.metadata.get("Name") or "").strip().lower().replace("_", "-")
                    for d in _im.distributions()
                    if d.metadata.get("Name")
                })
            except Exception:
                pass
            pkg_pkgs = []
            try:
                out_pkg = subprocess.check_output(
                    ["dpkg-query", "-W", "-f=\${Package}\\n"],
                    text=True,
                    timeout=4,
                    stderr=subprocess.DEVNULL,
                )
                pkg_pkgs = sorted({line.strip() for line in out_pkg.splitlines() if line.strip()})
            except Exception:
                pass
            return self._send_json(200, {
                "ok": True,
                "streaming": True,
                "embedded": False,
                "hasPython": True,
                "pythonVersion": platform.python_version(),
                "arch": platform.machine(),
                "hasClang": shutil.which("clang") is not None,
                "hasFfmpeg": shutil.which("ffmpeg") is not None,
                "workspaceDir": WORKSPACE,
                "installedPipPackages": pip_pkgs,
                "installedPkgPackages": pkg_pkgs,
            })
        if parsed_path == "/files":
            if not self._check_auth():
                return self._send_json(401, {"error": "Invalid X-DroidPy-Token"})
            allowed_ext = (
                ".py", ".json", ".csv", ".txt", ".md", ".html",
                ".xml", ".yaml", ".yml", ".ini", ".cfg", ".log", ".sh", ".toml",
            )
            items = []
            try:
                for entry in sorted(os.listdir(WORKSPACE)):
                    if entry.startswith(".") or entry == "__pycache__":
                        continue
                    full = os.path.join(WORKSPACE, entry)
                    if not os.path.isfile(full):
                        continue
                    if not (entry.lower().endswith(allowed_ext) or entry == "requirements.txt"):
                        continue
                    size = os.path.getsize(full)
                    if size > 180 * 1024:
                        continue
                    try:
                        with open(full, "r", encoding="utf-8") as fp:
                            content = fp.read()
                        items.append({
                            "name": entry,
                            "content": content,
                            "updatedAt": int(os.path.getmtime(full) * 1000),
                        })
                    except (OSError, UnicodeDecodeError):
                        continue
            except OSError:
                pass
            return self._send_json(200, {"files": items})
        return self._send_json(404, {"error": "Not found"})

    def _stream_pty_command(self, cmd, shell=False):
        self._begin_ndjson()
        t0 = time.perf_counter()
        master_fd, slave_fd = pty.openpty()
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        env["TERM"] = "xterm-256color"

        proc = subprocess.Popen(
            cmd,
            shell=shell,
            cwd=WORKSPACE,
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            env=env,
            preexec_fn=os.setsid,
            close_fds=True,
        )
        os.close(slave_fd)
        _set_active(proc.pid, proc.pid, master_fd)

        decoder = codecs.getincrementaldecoder("utf-8")("replace")
        try:
            while True:
                rlist, _, _ = select.select([master_fd], [], [], 0.1)
                if master_fd in rlist:
                    try:
                        chunk = os.read(master_fd, 4096)
                    except OSError:
                        chunk = b""
                    if not chunk:
                        break
                    text = decoder.decode(chunk, False)
                    if text:
                        self._write_ndjson({"type": "stdout", "data": text})
                if proc.poll() is not None:
                    while True:
                        r2, _, _ = select.select([master_fd], [], [], 0.02)
                        if master_fd not in r2:
                            break
                        try:
                            chunk = os.read(master_fd, 4096)
                        except OSError:
                            chunk = b""
                        if not chunk:
                            break
                        text = decoder.decode(chunk, False)
                        if text:
                            self._write_ndjson({"type": "stdout", "data": text})
                    break
            tail = decoder.decode(b"", True)
            if tail:
                self._write_ndjson({"type": "stdout", "data": tail})
            code = proc.wait()
        except BrokenPipeError:
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except OSError:
                pass
            code = -1
        finally:
            _clear_active()
            try:
                os.close(master_fd)
            except OSError:
                pass

        duration_ms = int((time.perf_counter() - t0) * 1000)
        try:
            self._write_ndjson({"type": "done", "exitCode": code, "durationMs": duration_ms})
        except OSError:
            pass

    def do_POST(self):
        if not self._check_auth():
            return self._send_json(401, {"error": "Invalid X-DroidPy-Token"})
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        data = json.loads(raw)

        if self.path == "/stdin":
            text = str(data.get("data", ""))
            with PROC_LOCK:
                mfd = ACTIVE_PROC.get("master_fd")
            if mfd is None:
                return self._send_json(409, {"error": "目前沒有正在執行的互動式程式"})
            try:
                os.write(mfd, (text + "\\n").encode("utf-8"))
                return self._send_json(200, {"ok": True})
            except OSError as exc:
                return self._send_json(500, {"error": str(exc)})

        if self.path == "/stop":
            with PROC_LOCK:
                pgid = ACTIVE_PROC.get("pgid")
            if pgid is None:
                return self._send_json(200, {"ok": True, "stopped": False})
            try:
                os.killpg(pgid, signal.SIGKILL)
                return self._send_json(200, {"ok": True, "stopped": True})
            except OSError as exc:
                return self._send_json(500, {"error": str(exc)})

        if self.path in ("/run", "/run-stream"):
            files = data.get("files", [])
            entry = os.path.basename(data.get("entry", "main.py")) or "main.py"
            for f in files:
                name = os.path.basename(f.get("name", ""))
                if not name:
                    continue
                target = os.path.join(WORKSPACE, name)
                with open(target, "w", encoding="utf-8") as fp:
                    fp.write(f.get("content", ""))

            if self.path == "/run-stream":
                return self._stream_pty_command(["python", "-u", entry], shell=False)

            t0 = time.perf_counter()
            proc = subprocess.run(
                ["python", "-u", entry],
                cwd=WORKSPACE,
                capture_output=True,
                text=True,
                timeout=120,
            )
            return self._send_json(200, {
                "exitCode": proc.returncode,
                "stdout": proc.stdout,
                "stderr": proc.stderr,
                "durationMs": int((time.perf_counter() - t0) * 1000),
            })

        if self.path in ("/install", "/install-stream"):
            mode = data.get("mode", "pip")
            target = str(data.get("target", "")).strip()
            if not target:
                return self._send_json(400, {"error": "Missing package target"})
            pkgs = shlex.split(target)
            if not pkgs:
                return self._send_json(400, {"error": "Missing package target"})
            cmd = (["pkg", "install", "-y"] + pkgs) if mode == "pkg" else ([sys.executable, "-m", "pip", "install"] + pkgs)
            if self.path == "/install-stream":
                return self._stream_pty_command(cmd, shell=False)

            t0 = time.perf_counter()
            proc = subprocess.run(cmd, cwd=WORKSPACE, capture_output=True, text=True, timeout=300)
            return self._send_json(200, {
                "exitCode": proc.returncode,
                "stdout": proc.stdout,
                "stderr": proc.stderr,
                "durationMs": int((time.perf_counter() - t0) * 1000),
            })

        if self.path in ("/shell", "/shell-stream"):
            cmd_str = str(data.get("command", "")).strip()
            if not cmd_str:
                return self._send_json(400, {"error": "Empty command"})
            if self.path == "/shell-stream":
                return self._stream_pty_command(cmd_str, shell=True)

            t0 = time.perf_counter()
            proc = subprocess.run(cmd_str, shell=True, cwd=WORKSPACE, capture_output=True, text=True, timeout=180)
            return self._send_json(200, {
                "exitCode": proc.returncode,
                "stdout": proc.stdout,
                "stderr": proc.stderr,
                "durationMs": int((time.perf_counter() - t0) * 1000),
            })

        if self.path == "/probe-url":
            target_url = str(data.get("url", "")).strip()
            if not target_url or not (target_url.startswith("http://") or target_url.startswith("https://")):
                return self._send_json(400, {"error": "Invalid or missing http(s) URL"})
            ua = str(data.get("userAgent", "")).strip() or "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36"
            cookie_hdr = str(data.get("cookieHeader", "")).strip()
            req_headers = {"User-Agent": ua, "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8"}
            if cookie_hdr:
                req_headers["Cookie"] = cookie_hdr
            extra_headers = data.get("extraHeaders") or {}
            if isinstance(extra_headers, dict):
                for hk, hv in extra_headers.items():
                    if hk and hv is not None:
                        req_headers[str(hk)] = str(hv)
            req = urllib.request.Request(target_url, headers=req_headers, method="GET")
            ctx = ssl.create_default_context()
            try:
                with urllib.request.urlopen(req, timeout=18, context=ctx) as resp:
                    status_code = getattr(resp, "status", 200)
                    final_url = resp.geturl()
                    raw_bytes = resp.read(24000)
                    body_text = raw_bytes.decode("utf-8", errors="replace")
                    set_cookies = resp.headers.get_all("Set-Cookie") or []
                    resp_headers = {k: v for k, v in resp.headers.items() if k.lower() != "set-cookie"}
            except urllib.error.HTTPError as exc:
                status_code = exc.code
                final_url = exc.geturl() or target_url
                raw_bytes = exc.read(16000) if exc.fp else b""
                body_text = raw_bytes.decode("utf-8", errors="replace")
                set_cookies = exc.headers.get_all("Set-Cookie") or [] if exc.headers else []
                resp_headers = {k: v for k, v in exc.headers.items() if k.lower() != "set-cookie"} if exc.headers else {}
            except Exception as exc:
                return self._send_json(502, {"error": str(exc)})

            m = re.search(r"<title[^>]*>(.*?)</title>", body_text, flags=re.IGNORECASE | re.DOTALL)
            title = re.sub(r"\\s+", " ", m.group(1)).strip() if m else ""
            return self._send_json(200, {
                "ok": 200 <= status_code < 400,
                "url": target_url,
                "finalUrl": final_url,
                "statusCode": status_code,
                "title": title,
                "setCookies": set_cookies,
                "headers": resp_headers,
                "bodyPreview": body_text[:8000],
            })

        return self._send_json(404, {"error": "Not found"})

if __name__ == "__main__":
    print(f"[DroidPy Termux PTY Bridge] Listening on http://127.0.0.1:8765 (Workspace: {WORKSPACE})")
    ThreadingHTTPServer(("127.0.0.1", 8765), DroidPyBridgeHandler).serve_forever()
`;
}

export function buildTermuxOneLineCommand(token: string): string {
  const script = buildTermuxBridgeScript(token);
  const bytes = new TextEncoder().encode(script);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);
  return `pkg update -y && pkg install -y python && echo "${b64}" | base64 -d > ~/droidpy_bridge.py && python ~/droidpy_bridge.py`;
}

async function termuxFetch<T>(
  config: TermuxConfig,
  path: string,
  options: RequestInit = {},
  timeoutMs = 15000
): Promise<T> {
  const base = config.endpointUrl.replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-DroidPy-Token': config.token,
        ...(options.headers ?? {}),
      },
    });
    const data = (await res.json()) as T & { error?: string };
    if (!res.ok) {
      const errDetail = data.error?.trim();
      const friendly =
        errDetail && errDetail !== 'Not found'
          ? errDetail
          : `Termux 橋接端點 ${path} 回應錯誤 (HTTP ${res.status}${errDetail ? `: ${errDetail}` : ''})`;
      throw new Error(friendly);
    }
    return data;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Termux 執行逾時，請確認 Termux 橋接程式仍在前景或背景運行');
    }
    if (err instanceof TypeError) {
      throw new Error(`無法連線至 Termux 橋接服務 (${base})，請先在 Termux 啟動橋接腳本`);
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

let activeStreamController: AbortController | null = null;

export function abortActiveTermuxStream(): void {
  if (activeStreamController) {
    activeStreamController.abort();
    activeStreamController = null;
  }
}

async function termuxStreamRequest(
  config: TermuxConfig,
  path: string,
  payload: Record<string, unknown>,
  callbacks: TermuxStreamCallbacks
): Promise<{ exitCode: number; durationMs: number }> {
  const base = config.endpointUrl.replace(/\/+$/, '');
  abortActiveTermuxStream();
  const controller = new AbortController();
  activeStreamController = controller;

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-DroidPy-Token': config.token,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (activeStreamController === controller) {
      activeStreamController = null;
    }
    if (err instanceof Error && err.name === 'AbortError') {
      return { exitCode: 130, durationMs: 0 };
    }
    if (err instanceof TypeError) {
      throw new Error(`無法連線至 Termux 橋接服務 (${base})，請先在 Termux 啟動新版橋接腳本`);
    }
    throw err;
  }

  if (!res.ok) {
    if (activeStreamController === controller) {
      activeStreamController = null;
    }
    let msg = `Termux 橋接回應錯誤 (${res.status})`;
    try {
      const errJson = (await res.json()) as { error?: string };
      if (errJson.error) msg = errJson.error;
    } catch {
      // ignore non-json
    }
    throw new Error(msg);
  }

  if (!res.body) {
    if (activeStreamController === controller) {
      activeStreamController = null;
    }
    throw new Error('Termux 串流回應為空，請重新複製新版啟動指令啟動橋接');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let exitCode = 0;
  let durationMs = 0;
  let sawDone = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const evt = JSON.parse(trimmed) as {
            type?: string;
            data?: string;
            exitCode?: number;
            durationMs?: number;
          };
          if (evt.type === 'stdout' && typeof evt.data === 'string') {
            callbacks.onChunk(evt.data);
          } else if (evt.type === 'done') {
            sawDone = true;
            exitCode = evt.exitCode ?? 0;
            durationMs = evt.durationMs ?? 0;
          }
        } catch {
          // ignore malformed partial line
        }
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { exitCode: 130, durationMs };
    }
    throw err;
  } finally {
    if (activeStreamController === controller) {
      activeStreamController = null;
    }
  }

  return { exitCode: sawDone ? exitCode : 1, durationMs };
}

export async function checkTermuxHealth(config: TermuxConfig): Promise<TermuxHealthInfo> {
  const res = await termuxFetch<TermuxHealthInfo & { ok: boolean }>(config, '/health', { method: 'GET' }, 4500);
  return {
    pythonVersion: res.pythonVersion,
    arch: res.arch,
    hasClang: res.hasClang,
    hasFfmpeg: res.hasFfmpeg,
    workspaceDir: res.workspaceDir,
    embedded: Boolean(res.embedded),
    hasPython: res.hasPython ?? true,
    installedPipPackages: Array.isArray(res.installedPipPackages) ? res.installedPipPackages : undefined,
    installedPkgPackages: Array.isArray(res.installedPkgPackages) ? res.installedPkgPackages : undefined,
  };
}

export async function fetchTermuxWorkspaceFiles(config: TermuxConfig): Promise<PythonFile[]> {
  const res = await termuxFetch<{
    files: { name: string; content: string; updatedAt?: number }[];
  }>(config, '/files', { method: 'GET' }, 6000);
  return (res.files ?? []).map((item) => ({
    id: `tmx-${item.name}`,
    name: item.name,
    content: item.content,
    updatedAt: item.updatedAt ?? Date.now(),
  }));
}

export async function syncAndRunInTermux(
  config: TermuxConfig,
  activeFile: PythonFile,
  allFiles: PythonFile[]
): Promise<TermuxExecResult> {
  return termuxFetch<TermuxExecResult>(
    config,
    '/run',
    {
      method: 'POST',
      body: JSON.stringify({
        entry: activeFile.name,
        files: allFiles.map((f) => ({ name: f.name, content: f.content })),
      }),
    },
    125000
  );
}

export async function streamRunInTermux(
  config: TermuxConfig,
  activeFile: PythonFile,
  allFiles: PythonFile[],
  callbacks: TermuxStreamCallbacks
): Promise<{ exitCode: number; durationMs: number }> {
  return termuxStreamRequest(
    config,
    '/run-stream',
    {
      entry: activeFile.name,
      files: allFiles.map((f) => ({ name: f.name, content: f.content })),
    },
    callbacks
  );
}

export async function installInTermux(
  config: TermuxConfig,
  mode: 'pip' | 'pkg',
  target: string
): Promise<TermuxExecResult> {
  return termuxFetch<TermuxExecResult>(
    config,
    '/install',
    {
      method: 'POST',
      body: JSON.stringify({ mode, target }),
    },
    305000
  );
}

export async function streamInstallInTermux(
  config: TermuxConfig,
  mode: 'pip' | 'pkg',
  target: string,
  callbacks: TermuxStreamCallbacks
): Promise<{ exitCode: number; durationMs: number }> {
  return termuxStreamRequest(config, '/install-stream', { mode, target }, callbacks);
}

export async function execTermuxShell(
  config: TermuxConfig,
  command: string
): Promise<TermuxExecResult> {
  return termuxFetch<TermuxExecResult>(
    config,
    '/shell',
    {
      method: 'POST',
      body: JSON.stringify({ command }),
    },
    185000
  );
}

export async function streamShellInTermux(
  config: TermuxConfig,
  command: string,
  callbacks: TermuxStreamCallbacks
): Promise<{ exitCode: number; durationMs: number }> {
  return termuxStreamRequest(config, '/shell-stream', { command }, callbacks);
}

export async function sendTermuxStdin(config: TermuxConfig, text: string): Promise<void> {
  await termuxFetch<{ ok: boolean }>(
    config,
    '/stdin',
    {
      method: 'POST',
      body: JSON.stringify({ data: text }),
    },
    4000
  );
}

export async function stopTermuxProcess(config: TermuxConfig): Promise<void> {
  await termuxFetch<{ ok: boolean }>(
    config,
    '/stop',
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
    4000
  );
}

export async function probeUrlViaTermux(
  config: TermuxConfig,
  payload: {
    url: string;
    userAgent?: string;
    cookieHeader?: string;
    extraHeaders?: Record<string, string>;
  }
): Promise<UrlProbeResult> {
  return termuxFetch<UrlProbeResult>(
    config,
    '/probe-url',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    22000
  );
}

export async function getSdcardStatus(config: TermuxConfig): Promise<SdcardStatusInfo> {
  return termuxFetch<SdcardStatusInfo>(config, '/sdcard/status', { method: 'GET' }, 5000);
}

export async function listSdcardDirectory(
  config: TermuxConfig,
  relPath = ''
): Promise<{
  granted: boolean;
  rootPath: string;
  currentPath: string;
  entries: SdcardEntry[];
}> {
  const qs = `?path=${encodeURIComponent(relPath)}`;
  return termuxFetch(config, `/sdcard/list${qs}`, { method: 'GET' }, 8000);
}

export async function readSdcardFile(
  config: TermuxConfig,
  relPath: string
): Promise<{ name: string; relPath: string; content: string }> {
  return termuxFetch(
    config,
    '/sdcard/read',
    { method: 'POST', body: JSON.stringify({ path: relPath }) },
    8000
  );
}

export async function writeSdcardFile(
  config: TermuxConfig,
  relPath: string,
  content: string
): Promise<{ ok: boolean; path: string }> {
  return termuxFetch(
    config,
    '/sdcard/write',
    { method: 'POST', body: JSON.stringify({ path: relPath, content }) },
    8000
  );
}

export async function backupWorkspaceToSdcard(
  config: TermuxConfig,
  files: PythonFile[],
  dir = 'DroidPy'
): Promise<{ ok: boolean; count: number; dir: string }> {
  return termuxFetch(
    config,
    '/sdcard/write',
    {
      method: 'POST',
      body: JSON.stringify({
        dir,
        files: files.map((f) => ({ name: f.name, content: f.content })),
      }),
    },
    10000
  );
}

export async function createSdcardFolder(
  config: TermuxConfig,
  relPath: string
): Promise<{ ok: boolean }> {
  return termuxFetch(
    config,
    '/sdcard/mkdir',
    { method: 'POST', body: JSON.stringify({ path: relPath }) },
    6000
  );
}

export async function deleteSdcardPath(
  config: TermuxConfig,
  relPath: string
): Promise<{ ok: boolean }> {
  return termuxFetch(
    config,
    '/sdcard/delete',
    { method: 'POST', body: JSON.stringify({ path: relPath }) },
    8000
  );
}

export interface TermuxNativeLogsResponse {
  ok: boolean;
  logPath?: string;
  nativeLines: string[];
  logcatLines: string[];
}

export async function fetchTermuxNativeLogs(
  config: TermuxConfig
): Promise<TermuxNativeLogsResponse> {
  try {
    return await termuxFetch<TermuxNativeLogsResponse>(config, '/logs', { method: 'GET' }, 6000);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('HTTP 404') || msg.includes('Not found')) {
      return { ok: false, nativeLines: [], logcatLines: [] };
    }
    throw err;
  }
}

export async function clearTermuxNativeLogs(config: TermuxConfig): Promise<{ ok: boolean }> {
  return termuxFetch<{ ok: boolean }>(config, '/logs/clear', { method: 'POST', body: '{}' }, 5000);
}

export async function getBackupStatus(config: TermuxConfig): Promise<PackageBackupStatus | null> {
  try {
    return await termuxFetch<PackageBackupStatus>(config, '/backup/status', { method: 'GET' }, 5000);
  } catch {
    return null;
  }
}

export async function streamRestoreBackedUpPackages(
  config: TermuxConfig,
  callbacks: TermuxStreamCallbacks
): Promise<{ exitCode: number; durationMs: number }> {
  return termuxStreamRequest(config, '/backup/restore', {}, callbacks);
}

export const CORE_TERMUX_PIP_PACKAGES = new Set(['pip', 'setuptools', 'wheel']);
export const CORE_TERMUX_PKG_PACKAGES = new Set([
  'apt',
  'dpkg',
  'bash',
  'dash',
  'coreutils',
  'python',
  'python-pip',
  'busybox',
  'termux-tools',
  'libandroid-support',
  'libc++',
]);

export function normalizeTermuxPkgName(name: string): string {
  return name.trim().toLowerCase().replace(/[-_.]+/g, '-');
}

export interface TermuxOutdatedPipItem {
  name: string;
  currentVersion: string;
  latestVersion: string;
}

export function parseOutdatedPipJson(rawOutput: string): TermuxOutdatedPipItem[] {
  const cleaned = rawOutput.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim();
  const startIdx = cleaned.indexOf('[');
  const endIdx = cleaned.lastIndexOf(']');
  if (startIdx === -1 || endIdx <= startIdx) return [];
  try {
    const parsed = JSON.parse(cleaned.slice(startIdx, endIdx + 1)) as Array<{
      name?: string;
      version?: string;
      latest_version?: string;
    }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item.name && item.version && item.latest_version && item.version !== item.latest_version)
      .map((item) => ({
        name: String(item.name),
        currentVersion: String(item.version),
        latestVersion: String(item.latest_version),
      }));
  } catch {
    return [];
  }
}

export function buildTermuxUninstallCommand(mode: 'pip' | 'pkg', target: string): string {
  const cleaned = target
    .split(/\s+/)
    .map((p) => p.replace(/[^a-zA-Z0-9_.+-]/g, '').trim())
    .filter((p) => {
      if (!p) return false;
      const lower = p.toLowerCase();
      return mode === 'pkg' ? !CORE_TERMUX_PKG_PACKAGES.has(lower) : !CORE_TERMUX_PIP_PACKAGES.has(lower);
    });
  if (cleaned.length === 0) return '';
  return mode === 'pkg'
    ? `pkg uninstall -y ${cleaned.join(' ')}`
    : `pip uninstall -y ${cleaned.join(' ')}`;
}

export function buildTermuxPipUpgradeCommand(installedPipPackages: string[]): string {
  const safeTargets = installedPipPackages
    .map((p) => p.replace(/[^a-zA-Z0-9_.-]/g, '').trim())
    .filter((p) => p && !CORE_TERMUX_PIP_PACKAGES.has(p.toLowerCase()));
  if (safeTargets.length === 0) {
    return 'pip install --upgrade pip';
  }
  return `pip install --upgrade ${safeTargets.join(' ')}`;
}

export function buildTermuxAptUpgradeCommand(pkgNames?: string[]): string {
  const cleaned = (pkgNames ?? [])
    .map((p) => p.replace(/[^a-zA-Z0-9_.+-]/g, '').trim())
    .filter(Boolean);
  if (cleaned.length > 0) {
    return `(pkg update -y || true) && pkg install --reinstall -y ${cleaned.join(' ')}`;
  }
  return '(pkg update -y || true) && pkg upgrade -y';
}



import {
  AppStorageCleanupResult,
  AppStorageUsageInfo,
  PackageBackupStatus,
  ProcessCleanupResult,
  PythonFile,
  SdcardEntry,
  SdcardStatusInfo,
  TermuxConfig,
  TermuxHealthInfo,
  UrlProbeResult,
} from '../types/ide';
import { stripAnsi } from '../utils/ansiParser';

export const DEFAULT_TERMUX_CONFIG: TermuxConfig = {
  endpointUrl: 'http://127.0.0.1:8765',
  token: '',
};

export function createSecureBridgeToken(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('安全亂數產生器不可用，已停止建立橋接權杖。');
  }
  const bytes = new Uint8Array(32);
  cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function isSecureBridgeToken(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

export interface TermuxExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface TermuxStreamCallbacks {
  onChunk: (chunk: string) => void;
}

export function buildTermuxBridgeScript(token: string, allowedOrigin: string): string {
  if (!isSecureBridgeToken(token)) {
    throw new Error('橋接權杖無效；請重新產生安全權杖後再匯出橋接程式。');
  }
  let safeOrigin = '';
  try {
    const parsedOrigin = new URL(allowedOrigin);
    if ((parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:') || parsedOrigin.origin === 'null') {
      throw new Error('Unsupported origin');
    }
    safeOrigin = JSON.stringify(parsedOrigin.origin);
  } catch {
    throw new Error('無法確認 DroidPy 網頁來源；已停止匯出橋接程式。');
  }
  const safeToken = token;
  return `import codecs
import json
import hmac
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
import tempfile
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import http.client
import ipaddress
import socket
import urllib.parse

TOKEN = "${safeToken}"
ALLOWED_ORIGIN = ${safeOrigin}
MAX_REQUEST_BYTES = 8 * 1024 * 1024
WORKSPACE = os.path.expanduser("~/droidpy_workspace")
os.makedirs(WORKSPACE, exist_ok=True)

PROC_LOCK = threading.Lock()
OPERATION_LOCK = threading.Lock()
ACTIVE_PROC = {
    "pid": None, "pgid": None, "master_fd": None,
    "started_at": 0.0, "paused": False,
    "starting": False, "stop_requested": False,
}
_LEGACY_CERTS_SUPPORTED = None

def _reserve_process_start():
    with PROC_LOCK:
        if ACTIVE_PROC["starting"] or ACTIVE_PROC["pgid"] is not None:
            return False
        ACTIVE_PROC["starting"] = True
        ACTIVE_PROC["stop_requested"] = False
        return True

def _set_active(pid, pgid, master_fd):
    with PROC_LOCK:
        ACTIVE_PROC["pid"] = pid
        ACTIVE_PROC["pgid"] = pgid
        ACTIVE_PROC["master_fd"] = master_fd
        ACTIVE_PROC["started_at"] = time.time()
        ACTIVE_PROC["paused"] = False
        ACTIVE_PROC["starting"] = False
        return bool(ACTIVE_PROC["stop_requested"])

def _clear_active():
    with PROC_LOCK:
        ACTIVE_PROC["pid"] = None
        ACTIVE_PROC["pgid"] = None
        ACTIVE_PROC["master_fd"] = None
        ACTIVE_PROC["started_at"] = 0.0
        ACTIVE_PROC["paused"] = False
        ACTIVE_PROC["starting"] = False
        ACTIVE_PROC["stop_requested"] = False

def _stage_workspace_files(files):
    if not isinstance(files, list):
        raise ValueError("Invalid workspace file list")
    for item in files:
        if not isinstance(item, dict):
            continue
        raw_name = str(item.get("name", ""))
        name = os.path.basename(raw_name.replace("\\\\", "/"))
        if not name or name in (".", "..") or "\\x00" in name:
            continue
        content = item.get("content", "")
        if not isinstance(content, str):
            content = str(content)
        target = os.path.join(WORKSPACE, name)
        fd, temp_path = tempfile.mkstemp(prefix="." + name + ".", suffix=".tmp", dir=WORKSPACE)
        try:
            with os.fdopen(fd, "w", encoding="utf-8", newline="") as fp:
                fp.write(content)
                fp.flush()
                os.fsync(fp.fileno())
            os.replace(temp_path, target)
        finally:
            try:
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
            except OSError:
                pass

def _find_certifi_source():
    for getter in (
        lambda: __import__("certifi").where(),
        lambda: __import__("pip._vendor.certifi", fromlist=["where"]).where(),
    ):
        try:
            cand = getter()
            if cand and os.path.isfile(cand) and os.path.getsize(cand) > 0:
                return cand
        except Exception:
            pass
    try:
        out = subprocess.check_output(
            [sys.executable, "-c", "import certifi; print(certifi.where())"],
            text=True,
            timeout=4,
            stderr=subprocess.DEVNULL,
        ).strip()
        if out and os.path.isfile(out) and os.path.getsize(out) > 0:
            return out
    except Exception:
        pass
    prefix = os.environ.get("PREFIX", "")
    for rel in (
        os.path.join(prefix, "etc", "tls", "cert.pem") if prefix else "",
        os.path.join(prefix, "etc", "ssl", "cert.pem") if prefix else "",
        os.path.join(prefix, "etc", "ssl", "certs", "ca-certificates.crt") if prefix else "",
        "/etc/ssl/certs/ca-certificates.crt",
    ):
        if rel and os.path.isfile(rel) and os.path.getsize(rel) > 0:
            return rel
    return None

def _ensure_writable_cacert():
    src = _find_certifi_source()
    if not src:
        return None
    prefix = os.environ.get("PREFIX", "")
    candidates = []
    if prefix:
        candidates.append(os.path.join(prefix, "tmp", "cacert.pem"))
    candidates.append(os.path.expanduser("~/tmp/droidpy-cacert.pem"))
    for dst in candidates:
        try:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copyfile(src, dst)
            os.chmod(dst, 0o644)
            if os.access(dst, os.R_OK) and os.path.getsize(dst) > 0:
                return dst
        except Exception:
            continue
    return src if os.access(src, os.R_OK) else None

def _supports_legacy_certs():
    global _LEGACY_CERTS_SUPPORTED
    if _LEGACY_CERTS_SUPPORTED is not None:
        return _LEGACY_CERTS_SUPPORTED
    try:
        help_out = subprocess.check_output(
            [sys.executable, "-m", "pip", "install", "--help"],
            text=True,
            timeout=5,
            stderr=subprocess.STDOUT,
        )
        _LEGACY_CERTS_SUPPORTED = "legacy-certs" in help_out
    except Exception:
        _LEGACY_CERTS_SUPPORTED = False
    return _LEGACY_CERTS_SUPPORTED

def _ensure_droidpy_sitecustomize(ca_path):
    droid_lib = os.path.expanduser("~/.droidpy_lib")
    os.makedirs(droid_lib, exist_ok=True)
    hook_code = '''import base64
import importlib.abc
import os
import ssl
import sys

# Explicitly activate pip's configured user base so installed distributions remain importable.
try:
    import site
    _droidpy_user_base = os.environ.get("PYTHONUSERBASE")
    if _droidpy_user_base:
        _droidpy_user_site = site.getusersitepackages()
        if isinstance(_droidpy_user_site, (list, tuple)):
            _droidpy_user_sites = list(_droidpy_user_site)
        else:
            _droidpy_user_sites = [_droidpy_user_site]
        _droidpy_user_sites.append(os.path.join(
            _droidpy_user_base, "lib",
            "python%d.%d" % sys.version_info[:2], "site-packages"
        ))
        for _droidpy_site in _droidpy_user_sites:
            if _droidpy_site and os.path.isdir(_droidpy_site):
                site.addsitedir(_droidpy_site)
except Exception:
    pass

_DROIDPY_CA_FILE = None
_DROIDPY_CA_TEXT = None

def _droidpy_read_pem(path):
    if not path or not os.path.isfile(path):
        return None
    try:
        if os.path.getsize(path) <= 0:
            return None
        with open(path, "rb") as fp:
            raw = fp.read()
        txt = raw.decode("utf-8-sig", errors="ignore")
        blocks = []
        in_cert = False
        body = []
        for line in txt.splitlines():
            line = line.strip()
            if line == "-----BEGIN CERTIFICATE-----":
                in_cert = True
                body = []
            elif line == "-----END CERTIFICATE-----" and in_cert:
                payload = "".join(body)
                try:
                    der = base64.b64decode(payload, validate=True)
                    encoded = base64.b64encode(der).decode("ascii")
                    wrapped = [encoded[i:i + 64] for i in range(0, len(encoded), 64)]
                    blocks.append("-----BEGIN CERTIFICATE-----" + chr(10) + chr(10).join(wrapped) + chr(10) + "-----END CERTIFICATE-----")
                except Exception:
                    pass
                in_cert = False
                body = []
            elif in_cert:
                body.append(line)
        if blocks:
            return chr(10).join(blocks) + chr(10)
    except Exception:
        return None
    return None

def _droidpy_prepare_ca():
    global _DROIDPY_CA_FILE, _DROIDPY_CA_TEXT
    prefix = os.environ.get("PREFIX", "")
    home = os.environ.get("HOME", os.path.expanduser("~"))
    cands = [
        os.environ.get("SSL_CERT_FILE", ""),
        os.environ.get("PIP_CERT", ""),
        os.path.join(prefix, "tmp", "cacert.pem") if prefix else "",
        os.path.join(home, "tmp", "droidpy-cacert.pem") if home else "",
        os.path.join(prefix, "etc", "tls", "cert.pem") if prefix else "",
        os.path.join(prefix, "etc", "ssl", "certs", "ca-certificates.crt") if prefix else "",
    ]
    for root in (prefix, os.path.join(home, ".local")):
        lib_dir = os.path.join(root, "lib") if root else ""
        if lib_dir and os.path.isdir(lib_dir):
            try:
                for entry in os.listdir(lib_dir):
                    if entry.startswith("python3."):
                        for sp in ("site-packages", "dist-packages"):
                            cands.append(os.path.join(lib_dir, entry, sp, "certifi", "cacert.pem"))
                            cands.append(os.path.join(lib_dir, entry, sp, "pip", "_vendor", "certifi", "cacert.pem"))
            except Exception:
                pass
    pem_text = None
    src_path = None
    for cand in cands:
        if not cand or cand == src_path:
            continue
        txt = _droidpy_read_pem(cand)
        if txt:
            pem_text = txt
            src_path = cand
            break
    if not pem_text:
        return None, None
    _DROIDPY_CA_TEXT = pem_text
    targets = []
    if prefix:
        targets.append(os.path.join(prefix, "tmp", "cacert.pem"))
    if home:
        targets.append(os.path.join(home, "tmp", "droidpy-cacert.pem"))
    chosen = src_path
    for dst in targets:
        try:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            if os.path.abspath(dst) != os.path.abspath(src_path) or not _droidpy_read_pem(dst):
                with open(dst, "w", encoding="utf-8") as fp:
                    fp.write(pem_text)
            os.chmod(dst, 0o644)
            if _droidpy_read_pem(dst):
                chosen = dst
                break
        except Exception:
            continue
    _DROIDPY_CA_FILE = chosen
    if chosen:
        for k in ("SSL_CERT_FILE", "PIP_CERT", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE"):
            os.environ[k] = chosen
    return chosen, pem_text

def _droidpy_patch_ssl():
    _orig_load = ssl.SSLContext.load_verify_locations
    def _safe_load_verify_locations(self, cafile=None, capath=None, cadata=None):
        try:
            return _orig_load(self, cafile=cafile, capath=capath, cadata=cadata)
        except (PermissionError, OSError):
            if cadata is not None:
                raise
            pem = _droidpy_read_pem(cafile) if cafile else None
            if not pem:
                pem = _DROIDPY_CA_TEXT
            if pem:
                return _orig_load(self, cafile=None, capath=None, cadata=pem)
            if _DROIDPY_CA_FILE and _DROIDPY_CA_FILE != cafile:
                return _orig_load(self, cafile=_DROIDPY_CA_FILE, capath=None, cadata=None)
            raise
    ssl.SSLContext.load_verify_locations = _safe_load_verify_locations

def _droidpy_patch_module(name, mod):
    if mod is None:
        return
    if name in ("certifi", "pip._vendor.certifi") and _DROIDPY_CA_FILE:
        try:
            mod.where = lambda: _DROIDPY_CA_FILE
            if hasattr(mod, "core"):
                mod.core.where = lambda: _DROIDPY_CA_FILE
        except Exception:
            pass
    elif name == "pip._vendor.truststore._api":
        try:
            cls = getattr(mod, "SSLContext", None)
            if cls is not None and not getattr(cls, "_droidpy_patched", False):
                orig_ts_load = cls.load_verify_locations
                def _safe_ts_load(self, cafile=None, capath=None, cadata=None):
                    try:
                        return orig_ts_load(self, cafile=cafile, capath=capath, cadata=cadata)
                    except (PermissionError, OSError):
                        pem = _droidpy_read_pem(cafile) or _DROIDPY_CA_TEXT
                        if pem:
                            return orig_ts_load(self, cafile=None, capath=None, cadata=pem)
                        if _DROIDPY_CA_FILE and _DROIDPY_CA_FILE != cafile:
                            return orig_ts_load(self, cafile=_DROIDPY_CA_FILE, capath=None, cadata=None)
                        raise
                cls.load_verify_locations = _safe_ts_load
                cls._droidpy_patched = True
        except Exception:
            pass
    elif name == "pip._internal.cli.index_command":
        try:
            def _droidpy_create_ssl_context():
                pem = _DROIDPY_CA_TEXT
                if pem:
                    return ssl.create_default_context(cadata=pem)
                if _DROIDPY_CA_FILE:
                    return ssl.create_default_context(cafile=_DROIDPY_CA_FILE)
                return ssl.create_default_context()
            mod._create_truststore_ssl_context = _droidpy_create_ssl_context
        except Exception:
            pass

class _DroidPyHookLoader(importlib.abc.Loader):
    def __init__(self, orig_loader):
        self._orig_loader = orig_loader
        self._in_create = False
        self._in_exec = False

    def create_module(self, spec):
        loader = self._orig_loader
        if (
            loader is None
            or loader is self
            or isinstance(loader, _DroidPyHookLoader)
            or self._in_create
        ):
            return None
        fn = getattr(loader, "create_module", None)
        if fn is None:
            return None
        self._in_create = True
        try:
            return fn(spec)
        finally:
            self._in_create = False

    def exec_module(self, module):
        loader = self._orig_loader
        if (
            loader is not None
            and loader is not self
            and not isinstance(loader, _DroidPyHookLoader)
            and not self._in_exec
        ):
            self._in_exec = True
            try:
                if hasattr(loader, "exec_module"):
                    loader.exec_module(module)
                elif hasattr(loader, "load_module"):
                    loader.load_module(module.__name__)
            finally:
                self._in_exec = False
        _droidpy_patch_module(module.__name__, module)

    def __getattr__(self, name):
        return getattr(self._orig_loader, name)

class _DroidPySslImportHook(importlib.abc.MetaPathFinder):
    _TARGETS = frozenset({"certifi", "pip._vendor.certifi", "pip._vendor.truststore._api", "pip._internal.cli.index_command"})
    def __init__(self):
        self._in_progress = set()
    def find_spec(self, fullname, path, target=None):
        if fullname not in self._TARGETS or fullname in self._in_progress:
            return None
        self._in_progress.add(fullname)
        try:
            for finder in list(sys.meta_path):
                if isinstance(finder, _DroidPySslImportHook):
                    continue
                try:
                    spec = finder.find_spec(fullname, path, target)
                except Exception:
                    spec = None
                if spec is not None and spec.loader is not None:
                    orig_loader = spec.loader
                    if not isinstance(orig_loader, _DroidPyHookLoader) and not getattr(spec, "_droidpy_wrapped", False):
                        spec.loader = _DroidPyHookLoader(orig_loader)
                        try:
                            spec._droidpy_wrapped = True
                        except Exception:
                            pass
                    return spec
        finally:
            self._in_progress.discard(fullname)
        return None

_droidpy_prepare_ca()
_droidpy_patch_ssl()
for _mod_name in ("certifi", "pip._vendor.certifi", "pip._vendor.truststore._api", "pip._internal.cli.index_command"):
    if _mod_name in sys.modules:
        _droidpy_patch_module(_mod_name, sys.modules[_mod_name])
if not any(isinstance(f, _DroidPySslImportHook) for f in sys.meta_path):
    sys.meta_path.insert(0, _DroidPySslImportHook())
'''
    try:
        sc_path = os.path.join(droid_lib, "sitecustomize.py")
        with open(sc_path, "w", encoding="utf-8") as fp:
            fp.write(hook_code)
        os.chmod(sc_path, 0o644)
    except Exception:
        pass
    pip_conf_path = os.path.expanduser("~/.config/pip/pip.conf")
    try:
        # Preserve an existing user pip configuration or private package index.
        # Fresh Termux profiles use official PyPI by pip's own default.
        if not os.path.isfile(pip_conf_path):
            os.makedirs(os.path.dirname(pip_conf_path), exist_ok=True)
            lines = ["[global]", "index-url = https://pypi.org/simple", "no-cache-dir = true", "break-system-packages = true", "disable-pip-version-check = true"]
            if ca_path:
                lines.append(f"cert = {ca_path}")
            with open(pip_conf_path, "x", encoding="utf-8") as fp:
                fp.write("\\n".join(lines) + "\\n")
            os.chmod(pip_conf_path, 0o644)
    except FileExistsError:
        pass
    except Exception:
        pass
    return droid_lib, pip_conf_path

def _resolve_certifi_env(base_env=None):
    env = dict(base_env) if base_env is not None else os.environ.copy()
    env.setdefault("PYTHONUNBUFFERED", "1")
    env.setdefault("PYTHONUTF8", "1")
    env.setdefault("TERM", "xterm-256color")
    env.setdefault("PIP_DISABLE_PIP_VERSION_CHECK", "1")
    env.setdefault("PIP_BREAK_SYSTEM_PACKAGES", "1")
    env["DROIDPY_DISABLE_TRUSTSTORE"] = "1"
    ca_path = _ensure_writable_cacert()
    droid_lib, pip_conf_path = _ensure_droidpy_sitecustomize(ca_path)
    cur_pp = env.get("PYTHONPATH", "")
    pp_parts = [p for p in cur_pp.split(os.pathsep) if p and p != droid_lib]
    env["PYTHONPATH"] = os.pathsep.join([droid_lib] + pp_parts)
    if pip_conf_path and os.path.isfile(pip_conf_path):
        env.setdefault("PIP_CONFIG_FILE", pip_conf_path)
    if ca_path:
        env["SSL_CERT_FILE"] = ca_path
        env["PIP_CERT"] = ca_path
        env["REQUESTS_CA_BUNDLE"] = ca_path
        env["CURL_CA_BUNDLE"] = ca_path
    if _supports_legacy_certs():
        env["PIP_USE_DEPRECATED"] = "legacy-certs"
    return env

def _build_pip_cmd(pkgs, trusted_host=False):
    # Prefer a compatible wheel; build from source only when no wheel is available.
    cmd = [sys.executable, "-m", "pip", "install", "--prefer-binary"]
    if trusted_host:
        cmd.extend(["--trusted-host", "pypi.org", "--trusted-host", "files.pythonhosted.org"])
    cmd.extend(pkgs)
    return cmd

def _read_clock_ticks_and_uptime():
    try:
        clk = os.sysconf(os.sysconf_names["SC_CLK_TCK"])
    except Exception:
        clk = 100
    uptime = 0.0
    try:
        with open("/proc/uptime", "r", encoding="utf-8") as fp:
            uptime = float(fp.read().split()[0])
    except Exception:
        pass
    return clk, uptime

def _scan_python_processes():
    pids = set()
    try:
        out = subprocess.check_output(
            ["pgrep", "-f", "python|pip"],
            text=True,
            timeout=4,
            stderr=subprocess.DEVNULL,
        )
        for line in out.splitlines():
            s = line.strip()
            if s.isdigit():
                pids.add(int(s))
    except Exception:
        pass
    clk, uptime = _read_clock_ticks_and_uptime()
    results = []
    # Scan /proc for full metadata and as fallback when pgrep misses entries
    try:
        proc_entries = [e for e in os.listdir("/proc") if e.isdigit()]
    except Exception:
        proc_entries = []
    for entry in proc_entries:
        pid = int(entry)
        try:
            with open(f"/proc/{pid}/cmdline", "rb") as fp:
                cmd_raw = fp.read().replace(b"\\x00", b" ").decode("utf-8", errors="replace").strip()
            with open(f"/proc/{pid}/stat", "r", encoding="utf-8", errors="replace") as fp:
                stat_txt = fp.read()
            rp = stat_txt.rfind(")")
            if rp == -1:
                continue
            comm = stat_txt[stat_txt.find("(") + 1:rp]
            rest = stat_txt[rp + 2:].split()
            state = rest[0] if len(rest) > 0 else "?"
            ppid = int(rest[1]) if len(rest) > 1 and rest[1].lstrip("-").isdigit() else 0
            start_ticks = int(rest[19]) if len(rest) > 19 and rest[19].isdigit() else 0
            elapsed = max(0, int(uptime - (start_ticks / max(1, clk)))) if uptime > 0 and start_ticks > 0 else 0
            lower_cmd = (cmd_raw + " " + comm).lower()
            if pid in pids or "python" in lower_cmd or "pip" in lower_cmd:
                results.append({
                    "pid": pid,
                    "ppid": ppid,
                    "name": (cmd_raw or comm)[:120],
                    "state": state,
                    "elapsedSec": elapsed,
                })
        except Exception:
            continue
    if results:
        return results
    # Fallback via ps if /proc is restricted
    try:
        ps_out = subprocess.check_output(
            ["ps", "-eo", "pid=,ppid=,stat=,etimes=,args="],
            text=True,
            timeout=4,
            stderr=subprocess.DEVNULL,
        )
        for line in ps_out.splitlines():
            parts = line.strip().split(None, 4)
            if len(parts) < 5 or not parts[0].isdigit():
                continue
            pid = int(parts[0])
            cmd = parts[4]
            if pid in pids or "python" in cmd.lower() or "pip" in cmd.lower():
                results.append({
                    "pid": pid,
                    "ppid": int(parts[1]) if parts[1].isdigit() else 0,
                    "name": cmd[:120],
                    "state": parts[2][:1],
                    "elapsedSec": int(parts[3]) if parts[3].isdigit() else 0,
                })
    except Exception:
        pass
    return results

def cleanup_stuck_python_processes(manual=False):
    # Read-only diagnostics only. Process age is not evidence of a hung task.
    procs = _scan_python_processes()
    return {
        "ok": True,
        "checkedAt": int(time.time() * 1000),
        "manual": bool(manual),
        "scannedCount": len(procs),
        "killedCount": 0,
        "killed": [],
        "message": "Read-only process scan; no Python process is terminated based on age.",
    }

def _is_public_probe_address(value):
    try:
        address = ipaddress.ip_address(str(value).split("%", 1)[0])
        if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
            address = address.ipv4_mapped
        if not address.is_global:
            return False
        if isinstance(address, ipaddress.IPv4Address):
            blocked = (
                "192.0.0.0/16",
                "192.88.99.0/24",
                "192.31.196.0/24",
                "192.52.193.0/24",
                "192.175.48.0/24",
            )
            return not any(address in ipaddress.ip_network(network) for network in blocked)
        if isinstance(address, ipaddress.IPv6Address):
            return (
                not address.is_reserved
                and address in ipaddress.ip_network("2000::/3")
                and address not in ipaddress.ip_network("2001::/23")
                and address not in ipaddress.ip_network("2001:20::/28")
            )
        return False
    except ValueError:
        return False


def _resolve_public_probe_address(host, port):
    normalized = str(host).rstrip(".").lower()
    if (
        not normalized
        or normalized == "localhost"
        or normalized.endswith((".localhost", ".local", ".internal", ".test"))
        or "%" in normalized
    ):
        raise ValueError("Local hostnames and scoped IP addresses are not allowed")
    try:
        ascii_host = normalized.encode("idna").decode("ascii")
        records = socket.getaddrinfo(ascii_host, port, type=socket.SOCK_STREAM)
    except Exception as exc:
        raise ValueError("Unable to resolve the target host") from exc
    if not records:
        raise ValueError("Target host did not resolve")
    validated = []
    seen = set()
    for family, socktype, proto, canonname, sockaddr in records:
        address = sockaddr[0]
        if not _is_public_probe_address(address):
            raise ValueError("Target resolves to a non-public IP address")
        key = (family, address)
        if key not in seen:
            seen.add(key)
            validated.append((family, sockaddr))
    if not validated:
        raise ValueError("Target has no public IP address")
    return ascii_host, validated


class _PinnedHTTPConnection(http.client.HTTPConnection):
    def __init__(self, host, port, family, sockaddr, timeout):
        super().__init__(host, port, timeout=timeout)
        self._pinned_family = family
        self._pinned_sockaddr = sockaddr

    def connect(self):
        sock = socket.socket(self._pinned_family, socket.SOCK_STREAM)
        sock.settimeout(self.timeout)
        try:
            sock.connect(self._pinned_sockaddr)
        except Exception:
            sock.close()
            raise
        self.sock = sock


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, host, port, family, sockaddr, timeout, context):
        super().__init__(host, port, timeout=timeout, context=context)
        self._pinned_family = family
        self._pinned_sockaddr = sockaddr

    def connect(self):
        raw = socket.socket(self._pinned_family, socket.SOCK_STREAM)
        raw.settimeout(self.timeout)
        try:
            raw.connect(self._pinned_sockaddr)
            self.sock = self._context.wrap_socket(raw, server_hostname=self.host)
        except Exception:
            raw.close()
            raise


def _probe_origin(parts, port):
    return (parts.scheme.lower(), (parts.hostname or "").lower(), port)


def _probe_url_safely(target_url, request_headers):
    if not target_url or len(target_url) > 4096 or any(ch.isspace() for ch in target_url):
        raise ValueError("Invalid or oversized URL")
    current_url = target_url
    headers = dict(request_headers)
    for redirect_count in range(6):
        try:
            parts = urllib.parse.urlsplit(current_url)
            scheme = parts.scheme.lower()
            if scheme not in ("http", "https") or not parts.hostname:
                raise ValueError("Only absolute HTTP and HTTPS URLs are allowed")
            if parts.username is not None or parts.password is not None:
                raise ValueError("URLs containing credentials are not allowed")
            port = parts.port or (443 if scheme == "https" else 80)
            if port < 1 or port > 65535:
                raise ValueError("Invalid target port")
        except ValueError:
            raise
        except Exception as exc:
            raise ValueError("Invalid target URL") from exc

        host, pinned_addresses = _resolve_public_probe_address(parts.hostname, port)
        request_target = parts.path or "/"
        if parts.query:
            request_target += "?" + parts.query
        response = None
        last_connection_error = None
        for family, sockaddr in pinned_addresses:
            context = ssl.create_default_context()
            if scheme == "https":
                conn = _PinnedHTTPSConnection(host, port, family, sockaddr, 18, context)
            else:
                conn = _PinnedHTTPConnection(host, port, family, sockaddr, 18)
            try:
                conn.request("GET", request_target, headers=headers)
                response = conn.getresponse()
                status_code = response.status
                response_headers = response.getheaders()
                if len(response_headers) > 100 or sum(len(str(k)) + len(str(v)) for k, v in response_headers) > 32768:
                    raise ValueError("HTTP response headers too large")
                transfer_encodings = [v for k, v in response_headers if k.lower() == "transfer-encoding"]
                content_lengths = [v for k, v in response_headers if k.lower() == "content-length"]
                if len(transfer_encodings) > 1 or len(content_lengths) > 1:
                    raise ValueError("Ambiguous HTTP response framing")
                transfer_encoding = transfer_encodings[0].lower().strip() if transfer_encodings else ""
                content_length = content_lengths[0].strip() if content_lengths else ""
                if transfer_encoding and content_length:
                    raise ValueError("Ambiguous HTTP response framing")
                if transfer_encoding and transfer_encoding != "chunked":
                    raise ValueError("Unsupported HTTP transfer encoding")
                if content_length and not content_length.isdigit():
                    raise ValueError("Invalid Content-Length")
                raw_bytes = response.read(24000)
                break
            except (OSError, ssl.SSLError, http.client.HTTPException) as exc:
                response = None
                last_connection_error = exc
                continue
            finally:
                conn.close()
        if response is None:
            raise last_connection_error or OSError("No reachable public address for target")

        location = next((value for key, value in response_headers if key.lower() == "location"), None)
        if status_code in (301, 302, 303, 307, 308) and location and redirect_count < 5:
            next_url = urllib.parse.urljoin(current_url, location)
            next_parts = urllib.parse.urlsplit(next_url)
            try:
                next_port = next_parts.port or (443 if next_parts.scheme.lower() == "https" else 80)
            except ValueError as exc:
                raise ValueError("Invalid redirect target") from exc
            if _probe_origin(parts, port) != _probe_origin(next_parts, next_port):
                headers = {
                    key: value for key, value in headers.items()
                    if key.lower() not in ("cookie", "authorization", "proxy-authorization", "referer")
                }
            current_url = next_url
            continue

        set_cookies = []
        response_headers_out = {}
        for key, value in response_headers:
            if key.lower() == "set-cookie":
                set_cookies.append(value[:4096])
            elif len(response_headers_out) < 80:
                response_headers_out[key] = value[:2048]
        body_text = raw_bytes.decode("utf-8", errors="replace")
        return status_code, current_url, body_text, set_cookies, response_headers_out

    raise ValueError("Too many redirects")


def _build_probe_headers(data):
    user_agent = str(data.get("userAgent", "")).strip()
    if not user_agent:
        user_agent = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36"
    if len(user_agent) > 512 or any(ord(ch) < 32 and ord(ch) != 9 for ch in user_agent) or any(ord(ch) == 127 for ch in user_agent):
        raise ValueError("Invalid User-Agent header")
    headers = {
        "User-Agent": user_agent,
        "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Encoding": "identity",
    }
    cookie_header = str(data.get("cookieHeader", "")).strip()
    if cookie_header:
        if len(cookie_header) > 8192 or any(ord(ch) < 32 and ord(ch) != 9 for ch in cookie_header) or any(ord(ch) == 127 for ch in cookie_header):
            raise ValueError("Invalid Cookie header")
        headers["Cookie"] = cookie_header

    forbidden = {
        "host", "connection", "content-length", "transfer-encoding",
        "proxy-authorization", "proxy-connection", "keep-alive",
        "upgrade", "te", "trailer", "cookie", "accept-encoding",
    }
    extra_headers = data.get("extraHeaders") or {}
    if isinstance(extra_headers, dict):
        if len(extra_headers) > 32:
            raise ValueError("Too many custom headers")
        for raw_name, raw_value in extra_headers.items():
            if raw_name is None or raw_value is None:
                continue
            name = str(raw_name).strip()
            value = str(raw_value)
            if (
                not name
                or len(name) > 128
                or len(value) > 4096
                or not re.fullmatch(r"[A-Za-z0-9!#$%&'*+.^_|~-]+", name)
                or any(ord(ch) < 32 and ord(ch) != 9 for ch in value)
                or any(ord(ch) == 127 for ch in value)
                or name.lower() in forbidden
            ):
                raise ValueError("Invalid or restricted custom header")
            existing_name = next((key for key in headers if key.lower() == name.lower()), None)
            headers[existing_name or name] = value
    return headers



# Central Android package compatibility routes shared by terminal pip and the install API.
# Keep this registry conservative: only route packages with a known native Android solution.
def _compatibility_install_command(package_name, trusted_host=False):
    package = str(package_name).strip().lower().replace("_", "-")
    if package == "parsel":
        pip_cmd = shlex.join(_build_pip_cmd(["w3lib<2.6", "parsel"], trusted_host=trusted_host))
        return "pkg install -y python-lxml && " + pip_cmd
    native_packages = {
        "numpy": "python-numpy",
        "pandas": "python-pandas",
        "pillow": "python-pillow",
        "pil": "python-pillow",
        "lxml": "python-lxml",
        "cryptography": "python-cryptography",
        "matplotlib": "matplotlib",
        "apsw": "python-apsw",
        "bcrypt": "python-bcrypt",
        "brotli": "python-brotli",
        "grpcio": "python-grpcio",
        "msgpack": "python-msgpack",
        "psutil": "python-psutil",
        "pycryptodomex": "python-pycryptodomex",
        "tflite-runtime": "python-tflite-runtime",
        "torch": "python-torch",
        "torchaudio": "python-torchaudio",
        "torchvision": "python-torchvision",
        "yt-dlp": "python-yt-dlp",
    }
    if package in native_packages:
        return "pkg install -y " + shlex.quote(native_packages[package])
    if package == "scipy":
        return "pkg install -y python-scipy"
    if package == "polars":
        return "pkg install -y tur-repo && pkg update -y && pkg install -y python-polars"
    if package in ("scikit-learn", "sklearn"):
        return "echo " + shlex.quote("DroidPy: no verified Termux ARM64 / Python 3.14 prebuilt scikit-learn package is available; on-device source builds are disabled.") + " >&2; exit 1"
    return None



def _normalize_shell_command(command):
    # Rewrite only a single, unambiguous pip install; preserve custom shell commands.
    pip_prefix = r"(?:(?:[^\\s;&|]*/)?python(?:3(?:\\.\\d+)?)?\\s+-m\\s+)?"
    match = re.fullmatch(
        r"\\s*" + pip_prefix + r"pip3?\\s+install\\s+([A-Za-z0-9_.-]+)\\s*",
        command,
        re.IGNORECASE,
    )
    if match:
        compatibility_command = _compatibility_install_command(match.group(1))
        if compatibility_command:
            return compatibility_command

    if not re.match(r"^\\s*pkg\\s+install\\b", command, re.IGNORECASE):
        return command
    if re.search(r"(?:^|\\s)(?:-y|--assume-yes)(?:\\s|$)", command, re.IGNORECASE):
        return command
    return re.sub(r"^(\\s*pkg\\s+install\\b)", r"\\1 -y", command, count=1, flags=re.IGNORECASE)


class DroidPyBridgeHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def setup(self):
        super().setup()
        self.connection.settimeout(15)

    def _origin_allowed(self):
        origin = self.headers.get("Origin")
        return origin is None or origin == ALLOWED_ORIGIN

    def _host_allowed(self):
        host = self.headers.get("Host", "").lower()
        return host in ("127.0.0.1:8765", "localhost:8765")

    def _send_cors(self):
        if self.headers.get("Origin") == ALLOWED_ORIGIN:
            self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-DroidPy-Token")
            if self.headers.get("Access-Control-Request-Private-Network", "").lower() == "true":
                self.send_header("Access-Control-Allow-Private-Network", "true")

    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._send_cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.close_connection = True
        self.end_headers()
        self.wfile.write(body)

    def _begin_ndjson(self):
        self.close_connection = True
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
        return hmac.compare_digest(self.headers.get("X-DroidPy-Token", ""), TOKEN)

    def do_OPTIONS(self):
        self.close_connection = True
        if not self._host_allowed() or not self._origin_allowed():
            return self._send_json(403, {"error": "Untrusted Host or Origin"})
        requested_method = self.headers.get("Access-Control-Request-Method", "").upper()
        if requested_method and requested_method not in ("GET", "POST"):
            return self._send_json(403, {"error": "Requested method is not allowed"})
        requested_headers = {
            item.strip().lower()
            for item in self.headers.get("Access-Control-Request-Headers", "").split(",")
            if item.strip()
        }
        if not requested_headers.issubset({"content-type", "x-droidpy-token"}):
            return self._send_json(403, {"error": "Requested headers are not allowed"})
        self.send_response(204)
        self._send_cors()
        self.send_header("Connection", "close")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        self.close_connection = True
        if not self._host_allowed() or not self._origin_allowed():
            return self._send_json(403, {"error": "Untrusted Host or Origin"})
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

    def _stream_pty_command(self, cmd, shell=False, before_start=None):
        if not _reserve_process_start():
            return self._send_json(409, {"error": "另一個 Termux 工作仍在執行，已拒絕這次操作"})
        master_fd = None
        slave_fd = None
        proc = None
        t0 = time.perf_counter()
        try:
            # Publish stream readiness only after reserving the process slot. A Stop
            # arriving during file staging is remembered and applied after Popen.
            self._begin_ndjson()
            if before_start is not None:
                try:
                    before_start()
                except Exception as exc:
                    self._write_ndjson({
                        "type": "stdout",
                        "data": "[DroidPy] 無法安全寫入工作區檔案：{}: {}\\n".format(type(exc).__name__, exc),
                    })
                    self._write_ndjson({"type": "done", "exitCode": 1, "durationMs": int((time.perf_counter() - t0) * 1000)})
                    return

            master_fd, slave_fd = pty.openpty()
            env = _resolve_certifi_env(os.environ.copy())
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
            slave_fd = None
            stop_requested = _set_active(proc.pid, proc.pid, master_fd)
            if stop_requested:
                try:
                    os.killpg(proc.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass

            decoder = codecs.getincrementaldecoder("utf-8")("replace")
            client_disconnected = False

            def emit_stream_event(event):
                nonlocal client_disconnected
                if client_disconnected:
                    return
                try:
                    self._write_ndjson(event)
                except OSError:
                    # The HTTP client does not own the child process. Keep draining
                    # the PTY so a full output buffer cannot block the user's script.
                    # The authenticated /stop endpoint remains the only stop control.
                    client_disconnected = True

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
                        emit_stream_event({"type": "stdout", "data": text})
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
                            emit_stream_event({"type": "stdout", "data": text})
                    break
            tail = decoder.decode(b"", True)
            if tail:
                emit_stream_event({"type": "stdout", "data": tail})
            code = proc.wait()
            duration_ms = int((time.perf_counter() - t0) * 1000)
            emit_stream_event({"type": "done", "exitCode": code, "durationMs": duration_ms})
        finally:
            _clear_active()
            if master_fd is not None:
                try:
                    os.close(master_fd)
                except OSError:
                    pass
            if slave_fd is not None:
                try:
                    os.close(slave_fd)
                except OSError:
                    pass

    def _read_json_body(self):
        if self.headers.get_all("Transfer-Encoding"):
            raise ValueError("Transfer-Encoding is not supported")
        content_lengths = self.headers.get_all("Content-Length") or []
        if len(content_lengths) > 1:
            raise ValueError("Duplicate Content-Length")
        if not content_lengths:
            return {}
        raw_length = content_lengths[0].strip()
        if not re.fullmatch(r"[0-9]{1,10}", raw_length):
            raise ValueError("Invalid Content-Length")
        length = int(raw_length, 10)
        if length > MAX_REQUEST_BYTES:
            raise OverflowError("Request body exceeds the 8 MiB limit")
        if length == 0:
            return {}
        raw_bytes = self.rfile.read(length)
        if len(raw_bytes) != length:
            raise ValueError("Incomplete request body")
        try:
            data = json.loads(raw_bytes.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ValueError("Invalid JSON request body")
        if not isinstance(data, dict):
            raise ValueError("JSON body must be an object")
        return data

    def do_POST(self):
        self.close_connection = True
        if not self._host_allowed() or not self._origin_allowed():
            return self._send_json(403, {"error": "Untrusted Host or Origin"})
        if not self._check_auth():
            return self._send_json(401, {"error": "Invalid X-DroidPy-Token"})
        try:
            data = self._read_json_body()
        except OverflowError as exc:
            return self._send_json(413, {"error": str(exc)})
        except ValueError as exc:
            return self._send_json(400, {"error": str(exc)})

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

        if self.path in ("/pause", "/resume"):
            with PROC_LOCK:
                pgid = ACTIVE_PROC.get("pgid")
                paused = ACTIVE_PROC.get("paused", False)
            if pgid is None:
                return self._send_json(409, {"ok": False, "error": "目前沒有正在執行的程序"})
            should_pause = self.path == "/pause"
            try:
                os.killpg(pgid, signal.SIGSTOP if should_pause else signal.SIGCONT)
                with PROC_LOCK:
                    if ACTIVE_PROC.get("pgid") == pgid:
                        ACTIVE_PROC["paused"] = should_pause
                return self._send_json(200, {"ok": True, "paused": should_pause})
            except OSError as exc:
                return self._send_json(500, {"ok": False, "paused": paused, "error": str(exc)})

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
                env=_resolve_certifi_env(os.environ.copy()),
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
            trusted_host = bool(data.get("trustedHost", False))
            if not target:
                return self._send_json(400, {"error": "Missing package target"})
            pkgs = shlex.split(target)
            if not pkgs:
                return self._send_json(400, {"error": "Missing package target"})
            compatibility_cmd = _compatibility_install_command(pkgs[0], trusted_host=trusted_host) if len(pkgs) == 1 else None
            if mode == "pkg":
                cmd = ["pkg", "install", "-y"] + pkgs
            elif compatibility_cmd:
                cmd = ["sh", "-c", compatibility_cmd]
            else:
                cmd = _build_pip_cmd(pkgs, trusted_host=trusted_host)
            if self.path == "/install-stream":
                return self._stream_pty_command(cmd, shell=False)

            t0 = time.perf_counter()
            proc = subprocess.run(
                cmd,
                cwd=WORKSPACE,
                env=_resolve_certifi_env(os.environ.copy()),
                capture_output=True,
                text=True,
                timeout=300,
            )
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
            normalized_cmd = _normalize_shell_command(cmd_str)
            if self.path == "/shell-stream":
                return self._stream_pty_command(normalized_cmd, shell=True)

            t0 = time.perf_counter()
            proc = subprocess.run(normalized_cmd, shell=True, cwd=WORKSPACE, capture_output=True, text=True, timeout=180)
            return self._send_json(200, {
                "exitCode": proc.returncode,
                "stdout": proc.stdout,
                "stderr": proc.stderr,
                "durationMs": int((time.perf_counter() - t0) * 1000),
            })

        if self.path == "/probe-url":
            target_url = str(data.get("url", "")).strip()
            try:
                req_headers = _build_probe_headers(data)
                status_code, final_url, body_text, set_cookies, resp_headers = _probe_url_safely(target_url, req_headers)
            except ValueError as exc:
                return self._send_json(400, {"error": str(exc)})
            except Exception:
                return self._send_json(502, {"error": "Unable to safely probe target URL"})

            m = re.search(r"<title[^>]*>(.*?)</title>", body_text, flags=re.IGNORECASE | re.DOTALL)
            title = re.sub(r"\s+", " ", m.group(1)).strip() if m else ""
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

        if self.path == "/maintenance/cleanup-processes":
            res = cleanup_stuck_python_processes(manual=bool(data.get("manual", True)))
            return self._send_json(200, res)

        return self._send_json(404, {"error": "Not found"})

class BoundedThreadingHTTPServer(ThreadingHTTPServer):
    request_queue_size = 16
    daemon_threads = True

    def __init__(self, *args, **kwargs):
        self._request_slots = threading.BoundedSemaphore(8)
        super().__init__(*args, **kwargs)

    def process_request(self, request, client_address):
        if not self._request_slots.acquire(blocking=False):
            try:
                request.sendall(
                    b"HTTP/1.1 503 Service Unavailable\\r\\n"
                    b"Content-Length: 0\\r\\nConnection: close\\r\\n\\r\\n"
                )
            except OSError:
                pass
            finally:
                self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except BaseException:
            self._request_slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self._request_slots.release()


if __name__ == "__main__":
    print(f"[DroidPy Termux PTY Bridge] Listening on http://127.0.0.1:8765 (Workspace: {WORKSPACE})")
    BoundedThreadingHTTPServer(("127.0.0.1", 8765), DroidPyBridgeHandler).serve_forever()
`;
}

export function buildTermuxOneLineCommand(token: string, allowedOrigin: string): string {
  const script = buildTermuxBridgeScript(token, allowedOrigin);
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
      const operation = path === '/run-stream' || path === '/shell-stream' || path === '/install-stream'
        ? '執行工作'
        : `橋接請求（${path}）`;
      throw new Error(`Termux ${operation}逾時；請確認內建橋接仍在運行，並檢查原生診斷日誌`);
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
let activeStreamCompletion: Promise<void> | null = null;
let activeStreamReady: Promise<void> | null = null;

export async function waitForActiveTermuxStreamReady(timeoutMs = 5000): Promise<boolean> {
  const ready = activeStreamReady;
  if (!ready) return true;
  let timer: number | undefined;
  const arrived = await Promise.race([
    ready.then(() => true),
    new Promise<boolean>((resolve) => {
      timer = window.setTimeout(() => resolve(false), timeoutMs);
    }),
  ]);
  if (timer !== undefined) window.clearTimeout(timer);
  return arrived;
}

export async function abortActiveTermuxStream(): Promise<void> {
  // Keep the single-job slot occupied until the aborted reader has completed cleanup.
  const completion = activeStreamCompletion;
  activeStreamController?.abort();
  if (completion) await completion;
}

export async function waitForActiveTermuxStream(timeoutMs = 5000): Promise<void> {
  const completion = activeStreamCompletion;
  if (!completion) return;

  let timer: number | undefined;
  const timedOut = await Promise.race([
    completion.then(() => false),
    new Promise<boolean>((resolve) => {
      timer = window.setTimeout(() => resolve(true), timeoutMs);
    }),
  ]);
  if (timer !== undefined) window.clearTimeout(timer);

  // Normally Android closes the stream after its process-tree cleanup. Abort only
  // as a bounded fallback if a broken bridge leaves the response open.
  if (timedOut && activeStreamCompletion === completion) {
    await abortActiveTermuxStream();
  }
}

async function termuxStreamRequest(
  config: TermuxConfig,
  path: string,
  payload: Record<string, unknown>,
  callbacks: TermuxStreamCallbacks
): Promise<{ exitCode: number; durationMs: number }> {
  const base = config.endpointUrl.replace(/\/+$/, '');
  if (activeStreamController) {
    throw new Error('已有 Termux 工作正在執行；請先停止目前工作後再試。');
  }

  const controller = new AbortController();
  let settleCompletion!: () => void;
  const completion = new Promise<void>((resolve) => {
    settleCompletion = resolve;
  });
  activeStreamController = controller;
  activeStreamCompletion = completion;
  let settleReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    settleReady = resolve;
  });
  activeStreamReady = ready;

  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-DroidPy-Token': config.token,
      },
      body: JSON.stringify(payload),
    });
    settleReady();

    if (!res.ok) {
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
      throw new Error('Termux 串流回應為空，請重新複製新版啟動指令啟動橋接');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let exitCode = 0;
    let durationMs = 0;
    let sawDone = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\\n');
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

    return { exitCode: sawDone ? exitCode : 1, durationMs };
  } catch (err) {
    settleReady();
    if (err instanceof Error && err.name === 'AbortError') {
      return { exitCode: -1, durationMs: 0 };
    }
    if (err instanceof TypeError) {
      throw new Error(`無法連線至 Termux 橋接服務 (${base})，請先在 Termux 啟動新版橋接腳本`);
    }
    throw err;
  } finally {
    if (activeStreamController === controller) {
      activeStreamController = null;
    }
    if (activeStreamCompletion === completion) {
      activeStreamCompletion = null;
    }
    if (activeStreamReady === ready) {
      activeStreamReady = null;
    }
    settleReady();
    settleCompletion();
  }
}

export async function checkTermuxHealth(config: TermuxConfig): Promise<TermuxHealthInfo> {
  const res = await termuxFetch<TermuxHealthInfo & { ok: boolean }>(config, '/health', { method: 'GET' }, 4500);
  const installedPkgPackages = Array.isArray(res.installedPkgPackages) && res.installedPkgPackages.length > 0
    ? res.installedPkgPackages
    : undefined;
  const installedPipPackages = Array.isArray(res.installedPipPackages)
    ? filterTermuxPipPackages(res.installedPipPackages, installedPkgPackages)
    : undefined;
  return {
    pythonVersion: res.pythonVersion,
    arch: res.arch,
    hasClang: res.hasClang,
    hasFfmpeg: res.hasFfmpeg,
    workspaceDir: res.workspaceDir,
    embedded: Boolean(res.embedded),
    hasPython: res.hasPython ?? true,
    installedPipPackages,
    installedPkgPackages,
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

export function buildTermuxRunFiles(
  activeFile: PythonFile,
  allFiles: PythonFile[]
): Array<{ name: string; content: string }> {
  const activeName = activeFile.name.replace(/\\\\/g, '/').split('/').pop()?.trim() ?? '';
  if (!activeName || activeName === '.' || activeName === '..') {
    throw new Error('Python 檔案名稱無效，無法安全執行');
  }

  // The Termux workspace is flat. Resolve basename collisions deterministically
  // and always stage the selected editor buffer last so a stale duplicate cannot
  // overwrite the file that the user actually asked to run.
  const staged = new Map<string, { name: string; content: string }>();
  for (const file of allFiles) {
    const name = file.name.replace(/\\\\/g, '/').split('/').pop()?.trim() ?? '';
    if (!name || name === '.' || name === '..' || name === activeName) continue;
    staged.set(name, { name, content: file.content });
  }
  staged.set(activeName, { name: activeName, content: activeFile.content });
  return [...staged.values()];
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
        files: buildTermuxRunFiles(activeFile, allFiles),
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
      files: buildTermuxRunFiles(activeFile, allFiles),
    },
    callbacks
  );
}

export async function installInTermux(
  config: TermuxConfig,
  mode: 'pip' | 'pkg',
  target: string,
  options?: { trustedHost?: boolean }
): Promise<TermuxExecResult> {
  return termuxFetch<TermuxExecResult>(
    config,
    '/install',
    {
      method: 'POST',
      body: JSON.stringify({ mode, target, trustedHost: Boolean(options?.trustedHost) }),
    },
    305000
  );
}

export async function streamInstallInTermux(
  config: TermuxConfig,
  mode: 'pip' | 'pkg',
  target: string,
  callbacks: TermuxStreamCallbacks,
  options?: { trustedHost?: boolean }
): Promise<{ exitCode: number; durationMs: number }> {
  return termuxStreamRequest(
    config,
    '/install-stream',
    { mode, target, trustedHost: Boolean(options?.trustedHost) },
    callbacks
  );
}

export async function execTermuxShell(
  config: TermuxConfig,
  command: string
): Promise<TermuxExecResult> {
  try {
    return await termuxFetch<TermuxExecResult>(
      config,
      '/shell',
      {
        method: 'POST',
        body: JSON.stringify({ command }),
      },
      185000
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('HTTP 404') || msg.includes('Not found')) {
      let stdout = '';
      const res = await streamShellInTermux(config, command, {
        onChunk: (chunk) => {
          stdout += chunk;
        },
      });
      return {
        exitCode: res.exitCode,
        stdout,
        stderr: '',
        durationMs: res.durationMs,
      };
    }
    throw err;
  }
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

export async function stopTermuxProcess(
  config: TermuxConfig,
  metadata: { source?: string; operation?: string } = {}
): Promise<void> {
  await termuxFetch<{ ok: boolean }>(
    config,
    '/stop',
    {
      method: 'POST',
      body: JSON.stringify({
        source: metadata.source || 'unknown',
        operation: metadata.operation || 'unknown',
      }),
    },
    4000
  );
}

export async function pauseTermuxProcess(config: TermuxConfig): Promise<void> {
  await termuxFetch<{ ok: boolean; paused: boolean }>(
    config,
    '/pause',
    { method: 'POST', body: JSON.stringify({}) },
    4000
  );
}

export async function resumeTermuxProcess(config: TermuxConfig): Promise<void> {
  await termuxFetch<{ ok: boolean; paused: boolean }>(
    config,
    '/resume',
    { method: 'POST', body: JSON.stringify({}) },
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
    30000
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

export async function getAppStorageUsage(
  config: TermuxConfig
): Promise<AppStorageUsageInfo | null> {
  try {
    return await termuxFetch<AppStorageUsageInfo>(config, '/storage/app-usage', { method: 'GET' }, 6000);
  } catch {
    return null;
  }
}

export async function cleanupAppStorage(
  config: TermuxConfig
): Promise<AppStorageCleanupResult | null> {
  try {
    return await termuxFetch<AppStorageCleanupResult>(
      config,
      '/storage/cleanup',
      { method: 'POST', body: '{}' },
      15000
    );
  } catch {
    return null;
  }
}

export async function cleanupTermuxProcesses(
  config: TermuxConfig,
  manual = false
): Promise<ProcessCleanupResult> {
  return termuxFetch<ProcessCleanupResult>(
    config,
    '/maintenance/cleanup-processes',
    { method: 'POST', body: JSON.stringify({ manual }) },
    10000
  );
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

export interface ResolvedTermuxInstallTarget {
  mode: 'pip' | 'pkg';
  target: string;
  routedFromPip: boolean;
  reason?: string;
}

// Curated native Termux builds avoid expensive or unsupported Android source builds.
export const TERMUX_NATIVE_PYTHON_PACKAGES: Record<string, string> = {
  numpy: 'python-numpy',
  scipy: 'python-scipy',
  pandas: 'python-pandas',
  pillow: 'python-pillow',
  pil: 'python-pillow',
  lxml: 'python-lxml',
  cryptography: 'python-cryptography',
  matplotlib: 'matplotlib',
  'apsw': 'python-apsw',
  'bcrypt': 'python-bcrypt',
  'brotli': 'python-brotli',
  'grpcio': 'python-grpcio',
  'msgpack': 'python-msgpack',
  'psutil': 'python-psutil',
  'pycryptodomex': 'python-pycryptodomex',
  'tflite-runtime': 'python-tflite-runtime',
  'torch': 'python-torch',
  'torchaudio': 'python-torchaudio',
  'torchvision': 'python-torchvision',
  'yt-dlp': 'python-yt-dlp',
};

// TUR Polars is native APT too, but its install route must first enable TUR.
const TERMUX_TUR_NATIVE_PYTHON_PACKAGES: Record<string, string> = {
  polars: 'python-polars',
};

export function getTermuxNativePackageName(packageName: string): string | undefined {
  const normalized = normalizeTermuxPkgName(packageName);
  return TERMUX_NATIVE_PYTHON_PACKAGES[normalized] ?? TERMUX_TUR_NATIVE_PYTHON_PACKAGES[normalized];
}

export function isTermuxNativePackageInstalled(packageName: string, installedPkgPackages: string[]): boolean {
  const nativeName = getTermuxNativePackageName(packageName);
  if (!nativeName) return false;
  const installed = new Set(installedPkgPackages.map(normalizeTermuxPkgName));
  return installed.has(normalizeTermuxPkgName(nativeName));
}

export function filterTermuxPipPackages(installedPipPackages: string[], installedPkgPackages?: string[]): string[] {
  return installedPipPackages.filter((name) =>
    installedPkgPackages === undefined
      ? !getTermuxNativePackageName(name)
      : !isTermuxNativePackageInstalled(name, installedPkgPackages)
  );
}

const PYTHON_ARCHIVE_PATTERN = /\.(?:whl|tar\.gz|tgz|tar\.bz2|tbz2|tar\.xz|txz|tar|zip|egg)(?:$|[?#])/i;
const REQUIREMENTS_INPUT_PATTERN = /(?:^|\s)(?:-r|--requirement)(?:\s+|=)/i;
const DEBIAN_PACKAGE_PATTERN = /\.deb(?:$|[?#])/i;
const PIP_SPECIFIER_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*(?:\[[^\]]+\])?(?:===?|~=|!=|<=|>=).+$/;

export function resolveTermuxInstallTarget(
  mode: 'pip' | 'pkg',
  target: string
): ResolvedTermuxInstallTarget {
  const clean = target.trim();
  if (!clean) return { mode, target, routedFromPip: false };

  // Debian archives are system packages; Python archives and requirements belong to pip.
  if (DEBIAN_PACKAGE_PATTERN.test(clean)) {
    return { mode: 'pkg', target: clean, routedFromPip: mode === 'pip', reason: 'Debian system package' };
  }
  if (PYTHON_ARCHIVE_PATTERN.test(clean) || REQUIREMENTS_INPUT_PATTERN.test(clean) || /^-e(?:\s|=)|^--editable(?:\s|=)|^git\+/i.test(clean) || /^https?:\/\//i.test(clean) || (mode === 'pkg' && (PIP_SPECIFIER_PATTERN.test(clean) || /^[a-zA-Z0-9_.-]+\[[^\]]+\]$/.test(clean)))) {
    return mode === 'pkg'
      ? { mode: 'pip', target: clean, routedFromPip: true, reason: 'Python archive/requirements input' }
      : { mode, target: clean, routedFromPip: false };
  }
  // Do not rewrite version pins, extras, URLs, markers, or multi-package commands.
  if (!/^[a-zA-Z0-9_.-]+$/.test(clean)) {
    return { mode, target, routedFromPip: false };
  }

  const normalized = clean.toLowerCase().replace(/[-_.]+/g, '-');
  const nativePackage = TERMUX_NATIVE_PYTHON_PACKAGES[normalized]
    ?? TERMUX_NATIVE_PYTHON_PACKAGES[clean.toLowerCase()];
  if (nativePackage) {
    return { mode: 'pkg', target: nativePackage, routedFromPip: mode === 'pip', reason: 'prebuilt native Termux Python package' };
  }
  return { mode, target, routedFromPip: false };
}

export interface TermuxOutdatedPipItem {
  name: string;
  currentVersion: string;
  latestVersion: string;
}

export function parseOutdatedPipJson(rawOutput: string, installedPkgPackages?: string[]): TermuxOutdatedPipItem[] {
  const cleaned = stripAnsi(rawOutput).trim();
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
      .filter((item) => item.name && item.version && item.latest_version && item.version !== item.latest_version &&
        (installedPkgPackages === undefined
          ? !getTermuxNativePackageName(String(item.name))
          : !isTermuxNativePackageInstalled(String(item.name), installedPkgPackages)))
      .map((item) => ({
        name: String(item.name),
        currentVersion: String(item.version),
        latestVersion: String(item.latest_version),
      }));
  } catch {
    return [];
  }
}

export function buildTermuxUninstallCommand(mode: 'pip' | 'pkg', target: string, installedPkgPackages?: string[]): string {
  const cleaned = target
    .split(/\s+/)
    .map((p) => p.replace(/[^a-zA-Z0-9_.+-]/g, '').trim())
    .filter(Boolean);
  if (cleaned.length === 0) return '';

  // APT-provided Python distributions can appear in pip inventory. Remove them via dpkg
  // only when the native package is confirmed installed.
  if (mode === 'pip' && cleaned.length === 1 && installedPkgPackages !== undefined) {
    const nativeName = getTermuxNativePackageName(cleaned[0]);
    if (nativeName && isTermuxNativePackageInstalled(cleaned[0], installedPkgPackages)) {
      return 'pkg uninstall -y ' + nativeName;
    }
  }

  const safeTargets = cleaned.filter((p) => {
    const lower = p.toLowerCase();
    return mode === 'pkg' ? !CORE_TERMUX_PKG_PACKAGES.has(lower) : !CORE_TERMUX_PIP_PACKAGES.has(lower);
  });
  if (safeTargets.length === 0) return '';
  return mode === 'pkg'
    ? `pkg uninstall -y ${safeTargets.join(' ')}`
    : `pip uninstall -y ${safeTargets.join(' ')}`;
}

export function buildTermuxPipUpgradeCommand(
  installedPipPackages: string[],
  trustedHost = false,
  installedPkgPackages?: string[]
): string {
  const hostFlags = trustedHost
    ? ' --trusted-host pypi.org --trusted-host files.pythonhosted.org'
    : '';
  const safeTargets = installedPipPackages
    .map((p) => p.replace(/[^a-zA-Z0-9_.-]/g, '').trim())
    .filter((p) => p && !CORE_TERMUX_PIP_PACKAGES.has(p.toLowerCase()) &&
      (installedPkgPackages === undefined
        ? !getTermuxNativePackageName(p)
        : !isTermuxNativePackageInstalled(p, installedPkgPackages)));
  if (safeTargets.length === 0) {
    return `pip install --upgrade${hostFlags} pip`;
  }
  return `pip install --upgrade${hostFlags} ${safeTargets.join(' ')}`;
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



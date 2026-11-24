import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';

const [pythonBridge, androidBuilder] = await Promise.all([
  readFile(new URL('../src/services/termuxBridge.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/services/androidApkBuilder.ts', import.meta.url), 'utf8'),
]);

assert.match(pythonBridge, /def _resolve_public_probe_address\(/);
assert.match(pythonBridge, /ipaddress\.ip_address/);
assert.match(pythonBridge, /ipaddress\.ip_network/);
assert.match(pythonBridge, /2001::\/23/);
assert.match(pythonBridge, /socket\.getaddrinfo/);
assert.match(pythonBridge, /sock\.connect\(self\._pinned_sockaddr\)/);
assert.match(pythonBridge, /self\._context\.wrap_socket\(raw, server_hostname=self\.host\)/);
assert.match(pythonBridge, /urllib\.parse\.urljoin/);
assert.match(pythonBridge, /response_headers = response\.getheaders\(\)/);
assert.match(pythonBridge, /len\(response_headers\) > 100/);
assert.match(pythonBridge, /Ambiguous HTTP response framing/);
assert.doesNotMatch(pythonBridge, /urllib\.request\.urlopen/);
assert.match(pythonBridge, /key\.lower\(\) not in \("cookie", "authorization", "proxy-authorization", "referer"\)/);

assert.match(androidBuilder, /private fun isPublicProbeAddress\(/);
assert.match(androidBuilder, /b\[2\] == 0x00 && b\[3\] == 0x20/);
assert.match(androidBuilder, /InetAddress\.getAllByName\(host\)/);
assert.match(androidBuilder, /addresses\.any \{ !isPublicProbeAddress\(it\) \}/);
assert.match(androidBuilder, /rawSocket\.connect\(InetSocketAddress\(pinnedAddress, port\), 15000\)/);
assert.match(androidBuilder, /endpointIdentificationAlgorithm = "HTTPS"/);
assert.match(androidBuilder, /serverNames = listOf\(SNIHostName\(host\)\)/);
assert.match(androidBuilder, /val next = URL\(current, location\)/);
assert.match(androidBuilder, /headers\.keys\.removeAll/);
assert.match(androidBuilder, /private fun buildProbeHeaders\(/);
assert.match(androidBuilder, /transferEncoding\.trim\(\) != \"chunked\"/);
assert.doesNotMatch(androidBuilder, /instanceFollowRedirects\s*=\s*true/);

// Exercise the generated Python helpers without opening any network connection.
const bundle = await build({
  entryPoints: ['src/services/termuxBridge.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  write: false,
});
const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64');
const { buildTermuxBridgeScript } = await import(moduleUrl);
const generated = buildTermuxBridgeScript('a'.repeat(64), 'https://droidpy-ci.example');
const tempDir = await mkdtemp(path.join(os.tmpdir(), 'droidpy-probe-security-'));
try {
  const pythonFile = path.join(tempDir, 'droidpy_bridge.py');
  await writeFile(pythonFile, generated, 'utf8');
  const unitTests = [
    "import runpy, socket, sys",
    "ns = runpy.run_path(sys.argv[1], run_name=\"droidpy_probe_test\")",
    "is_public = ns[\"_is_public_probe_address\"]",
    "for address in (\"127.0.0.1\", \"10.0.0.1\", \"169.254.169.254\", \"192.168.1.1\", \"::1\", \"fc00::1\", \"fe80::1\", \"::ffff:127.0.0.1\", \"192.0.0.9\", \"192.88.99.1\", \"2001:db8::1\", \"2001:20::1\", \"64:ff9b::1\", \"3fff::1\"):",
    "    assert not is_public(address), \"private/reserved address was allowed: \" + address",
    "assert is_public(\"8.8.8.8\")",
    "assert is_public(\"2606:4700:4700::1111\")",
    "",
    "original_getaddrinfo = socket.getaddrinfo",
    "def fake_getaddrinfo(host, port, type=None):",
    "    if host == \"public.example\":",
    "        return [",
    "            (socket.AF_INET6, socket.SOCK_STREAM, 6, \"\", (\"2606:4700:4700::1111\", port, 0, 0)),",
    "            (socket.AF_INET, socket.SOCK_STREAM, 6, \"\", (\"8.8.8.8\", port)),",
    "        ]",
    "    if host == \"other.example\":",
    "        return [(socket.AF_INET, socket.SOCK_STREAM, 6, \"\", (\"8.8.8.8\", port))]",
    "    if host == \"127.0.0.1\":",
    "        return [(socket.AF_INET, socket.SOCK_STREAM, 6, \"\", (\"127.0.0.1\", port))]",
    "    return original_getaddrinfo(host, port, type=type)",
    "",
    "socket.getaddrinfo = fake_getaddrinfo",
    "try:",
    "    try:",
    "        ns[\"_resolve_public_probe_address\"](\"127.0.0.1\", 80)",
    "        raise AssertionError(\"loopback DNS result was accepted\")",
    "    except ValueError:",
    "        pass",
    "",
    "    responses = [",
    "        type(\"Response\", (), {\"status\": 302, \"getheaders\": lambda self: [(\"Location\", \"http://other.example/final\")], \"getheader\": lambda self, name, default=None: next((v for k, v in self.getheaders() if k.lower() == name.lower()), default), \"read\": lambda self, n: b\"\"})(),",
    "        type(\"Response\", (), {\"status\": 200, \"getheaders\": lambda self: [(\"Content-Type\", \"text/plain\")], \"getheader\": lambda self, name, default=None: next((v for k, v in self.getheaders() if k.lower() == name.lower()), default), \"read\": lambda self, n: b\"ok\"})(),",
    "    ]",
    "    requests = []",
    "    probe_globals = ns[\"_probe_url_safely\"].__globals__",
    "    original_http_connection = probe_globals[\"_PinnedHTTPConnection\"]",
    "    class FakeConnection:",
    "        def __init__(self, host, port, family, sockaddr, timeout, *args):",
    "            self.host = host",
    "            self.family = family",
    "        def request(self, method, target, headers):",
    "            if self.family == socket.AF_INET6:",
    "                raise OSError(\"simulated IPv6 route unavailable\")",
    "            requests.append(dict(headers))",
    "        def getresponse(self):",
    "            return responses.pop(0)",
    "        def close(self):",
    "            pass",
    "    probe_globals[\"_PinnedHTTPConnection\"] = FakeConnection",
    "    resolved_host, resolved_addresses = ns[\"_resolve_public_probe_address\"](\"public.example\", 80)",
    "    assert len(resolved_addresses) == 2, \"all validated DNS addresses must be retained for fallback\"",
    "    status, final_url, body, cookies, headers = ns[\"_probe_url_safely\"](",
    "        \"http://public.example/start\",",
    "        {\"Cookie\": \"session=secret\", \"Authorization\": \"Bearer secret\"}",
    "    )",
    "    assert status == 200 and final_url == \"http://other.example/final\"",
    "    assert body == \"ok\"",
    "    assert \"Cookie\" not in requests[1] and \"Authorization\" not in requests[1], \"credentials leaked across redirect origin\"",
    "",
    "    responses[:] = [",
    "        type(\"Response\", (), {\"status\": 302, \"getheaders\": lambda self: [(\"Location\", \"http://127.0.0.1/admin\")], \"getheader\": lambda self, name, default=None: next((v for k, v in self.getheaders() if k.lower() == name.lower()), default), \"read\": lambda self, n: b\"\"})(),",
    "    ]",
    "    requests.clear()",
    "    try:",
    "        ns[\"_probe_url_safely\"](\"http://public.example/start\", {\"Cookie\": \"session=secret\"})",
    "        raise AssertionError(\"redirect to loopback was followed\")",
    "    except ValueError:",
    "        pass",
    "    assert len(requests) == 1, \"request was sent to a private redirect target\"",
    "    responses[:] = [",
    "        type(\"Response\", (), {\"status\": 200, \"getheaders\": lambda self: [(\"X-Test\", \"v\")] * 101, \"read\": lambda self, n: b\"ok\"})(),",
    "    ]",
    "    requests.clear()",
    "    try:",
    "        ns[\"_probe_url_safely\"](\"http://public.example/headers\", {})",
    "        raise AssertionError(\"oversized response headers were accepted\")",
    "    except ValueError:",
    "        pass",
    "",
    "    responses[:] = [",
    "        type(\"Response\", (), {\"status\": 200, \"getheaders\": lambda self: [(\"Content-Length\", \"1\"), (\"Content-Length\", \"2\")], \"read\": lambda self, n: b\"x\"})(),",
    "    ]",
    "    try:",
    "        ns[\"_probe_url_safely\"](\"http://public.example/ambiguous\", {})",
    "        raise AssertionError(\"duplicate Content-Length was accepted\")",
    "    except ValueError:",
    "        pass",
    "",
    "",
    "    try:",
    "        ns[\"_build_probe_headers\"]({\"extraHeaders\": {\"Host\": \"127.0.0.1\"}})",
    "        raise AssertionError(\"custom Host header was accepted\")",
    "    except ValueError:",
    "        pass",
    "",
    "    probe_globals[\"_PinnedHTTPConnection\"] = original_http_connection",
    "    connected = []",
    "    class FakeSocket:",
    "        def settimeout(self, value):",
    "            pass",
    "        def connect(self, address):",
    "            connected.append(address)",
    "        def close(self):",
    "            pass",
    "    original_socket = socket.socket",
    "    socket.socket = lambda family, kind: FakeSocket()",
    "    try:",
    "        conn = ns[\"_PinnedHTTPConnection\"](\"public.example\", 80, socket.AF_INET, (\"8.8.8.8\", 80), 18)",
    "        conn.connect()",
    "        assert connected == [(\"8.8.8.8\", 80)], \"HTTP connection did not use the validated pinned IP\"",
    "    finally:",
    "        socket.socket = original_socket",
    "finally:",
    "    socket.getaddrinfo = original_getaddrinfo",
  ].join('\n');
  const testResult = spawnSync('python3', ['-c', unitTests, pythonFile], { encoding: 'utf8' });
  if (testResult.status !== 0) {
    throw new Error('URL probe security unit tests failed:\\n' + testResult.stdout + '\\n' + testResult.stderr);
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log('URL probe SSRF guards passed: public DNS pinning, TLS hostname validation, safe redirects and header filtering.');


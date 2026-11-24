import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [pythonBridge, androidBuilder] = await Promise.all([
  readFile(new URL('../src/services/termuxBridge.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/services/androidApkBuilder.ts', import.meta.url), 'utf8'),
]);

assert.match(pythonBridge, /def _resolve_public_probe_address\(/);
assert.match(pythonBridge, /ipaddress\.ip_address/);
assert.match(pythonBridge, /socket\.getaddrinfo/);
assert.match(pythonBridge, /sock\.connect\(self\._pinned_sockaddr\)/);
assert.match(pythonBridge, /self\._context\.wrap_socket\(raw, server_hostname=self\.host\)/);
assert.match(pythonBridge, /urllib\.parse\.urljoin/);
assert.match(pythonBridge, /response_headers = response\.getheaders\(\)/);
assert.doesNotMatch(pythonBridge, /urllib\.request\.urlopen/);
assert.match(pythonBridge, /key\.lower\(\) not in \("cookie", "authorization", "proxy-authorization"\)/);

assert.match(androidBuilder, /private fun isPublicProbeAddress\(/);
assert.match(androidBuilder, /InetAddress\.getAllByName\(host\)/);
assert.match(androidBuilder, /addresses\.any \{ !isPublicProbeAddress\(it\) \}/);
assert.match(androidBuilder, /rawSocket\.connect\(InetSocketAddress\(pinnedAddress, port\), 15000\)/);
assert.match(androidBuilder, /endpointIdentificationAlgorithm = "HTTPS"/);
assert.match(androidBuilder, /serverNames = listOf\(SNIHostName\(host\)\)/);
assert.match(androidBuilder, /val next = URL\(current, location\)/);
assert.match(androidBuilder, /headers\.keys\.removeAll/);
assert.match(androidBuilder, /private fun buildProbeHeaders\(/);
assert.doesNotMatch(androidBuilder, /instanceFollowRedirects\s*=\s*true/);

console.log('URL probe SSRF guards passed: public DNS pinning, TLS hostname validation, safe redirects and header filtering.');

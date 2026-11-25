import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/services/androidApkBuilder.ts', import.meta.url), 'utf8');
const aptConfigStart = source.indexOf('val aptConfLines = mutableListOf(');
const aptConfigEnd = source.indexOf('val aptConfFile = File(usrDir, "etc/apt/apt.conf")', aptConfigStart);
assert.notEqual(aptConfigStart, -1, 'APT config generator must exist');
assert.notEqual(aptConfigEnd, -1, 'APT config file writer must exist');
const aptConfig = source.slice(aptConfigStart, aptConfigEnd);

assert.doesNotMatch(
  aptConfig,
  /AllowInsecureRepositories|AllowDowngradeToInsecureRepositories|AllowUnauthenticated|Verify-Peer.*false|Verify-Host.*false/,
  'APT config must not disable repository or TLS verification'
);
assert.match(aptConfig, /Acquire::https::CaInfo/, 'A discovered CA bundle must be used');

const aptOptsLine = source.split('\n').find((line) => line.includes('APT_OPTS='));
assert.ok(aptOptsLine, 'APT wrapper options must exist');
assert.doesNotMatch(
  aptOptsLine,
  /AllowInsecureRepositories|AllowDowngradeToInsecureRepositories|AllowUnauthenticated|Verify-Peer=false|Verify-Host=false/,
  'APT wrapper must not override authentication or TLS verification'
);

assert.doesNotMatch(
  source,
  /mainSources\.writeText\("deb \[trusted=yes\]/,
  'Fallback Termux repository must not be marked trusted=yes'
);
assert.match(
  source,
  /cur = cur\.replace\("\[trusted=yes\] ", ""\)/,
  'Existing trusted=yes entries written by older versions must be removed'
);
assert.match(source, /val caOpt = if \(certFile != null\)/, 'APT must use a verified CA bundle when available');

console.log('APT repository signature and TLS verification checks passed.');

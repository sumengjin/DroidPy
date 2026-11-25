import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

class MemoryStorage {
  values = new Map();
  failWrites = false;

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (this.failWrites) throw new Error('quota exceeded');
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

const storage = new MemoryStorage();
globalThis.localStorage = storage;

const bundle = await build({
  entryPoints: ['src/services/scriptBackup.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  write: false,
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`;
const {
  createScriptBackup,
  deleteScriptBackup,
  listScriptBackups,
  parseScriptBackupJson,
} = await import(moduleUrl);

const key = 'droidpy_script_backups_v1';
const files = [{ id: 'file-1', name: 'main.py', content: 'print("safe")', updatedAt: 100 }];
const first = createScriptBackup(files, 'First');
const second = createScriptBackup([{ ...files[0], content: 'print("second")' }], 'Second');
assert.deepEqual(listScriptBackups().map((item) => item.id), [second.id, first.id]);

// A quota failure must throw and leave the previous complete snapshot string intact.
const beforeQuotaFailure = storage.getItem(key);
storage.failWrites = true;
assert.throws(() => createScriptBackup(files, 'Must not persist'), /DROIDPY_BACKUP_SAVE_FAILED/);
assert.equal(storage.getItem(key), beforeQuotaFailure);
storage.failWrites = false;

// A corrupt store must never be interpreted as empty and overwritten by a new backup.
storage.setItem(key, '{broken json');
assert.throws(() => createScriptBackup(files, 'Must not overwrite corruption'), /DROIDPY_BACKUP_STORE_CORRUPT/);
assert.equal(storage.getItem(key), '{broken json');
assert.deepEqual(listScriptBackups(), []);

// Import creates a new durable snapshot while retaining existing snapshots.
storage.setItem(key, JSON.stringify([first, second]));
const imported = parseScriptBackupJson(JSON.stringify({
  format: 'droidpy-script-backup-v1',
  snapshot: {
    label: 'Imported',
    files: [{ name: 'imported.py', content: 'print(3)' }],
  },
}));
assert.ok(imported);
assert.equal(imported.reason, 'import');
assert.equal(listScriptBackups().length, 3);

// Deleting one snapshot must preserve the other independent recovery points.
const afterDelete = deleteScriptBackup(first.id);
assert.deepEqual(afterDelete.map((item) => item.id), [imported.id, second.id]);

// The restore UI must persist its rollback snapshot before replacing editor state.
const app = await readFile('src/App.tsx', 'utf8');
const restoreStart = app.indexOf('const handleRestoreScriptBackup');
const restoreEnd = app.indexOf('const handleSyncBackupToSdcard', restoreStart);
assert.ok(restoreStart >= 0 && restoreEnd > restoreStart);
const restoreHandler = app.slice(restoreStart, restoreEnd);
assert.ok(restoreHandler.indexOf("createScriptBackup(filesRef.current, undefined, 'pre-restore')") >= 0);
assert.ok(restoreHandler.indexOf('createScriptBackup(') < restoreHandler.indexOf('setFiles(nextFiles)'));
assert.ok(restoreHandler.includes("showToast(t('bak_restore_blocked'))"));
assert.ok(restoreHandler.includes('return;'));

console.log('Script backup quota, corruption, import/delete and pre-restore rollback checks passed.');

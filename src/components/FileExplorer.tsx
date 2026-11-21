import React, { useEffect, useRef, useState } from 'react';
import {
  FileCode2,
  Plus,
  Trash2,
  Edit3,
  Upload,
  Archive,
  Share2,
  Check,
  X,
  BookOpen,
  FolderSync,
  RefreshCw,
  HardDrive,
} from 'lucide-react';
import JSZip from 'jszip';
import { PythonFile } from '../types/ide';
import { SNIPPET_TEMPLATES } from '../data/defaultFiles';
import { useI18n } from '../services/i18n';
import { downloadBlob } from '../utils/downloadBlob';

interface FileExplorerProps {
  files: PythonFile[];
  activeFileId: string;
  linkedDirName: string | null;
  termuxConnected?: boolean;
  termuxEmbedded?: boolean;
  onOpenSdcardManager?: () => void;
  onBackupToSdcard?: () => Promise<void>;
  onPullFromTermux?: () => Promise<void>;
  onLinkDirectory: () => Promise<void>;
  onSaveToDirectory: () => Promise<void>;
  onSelectFile: (id: string) => void;
  onCreateFile: (name: string, content?: string) => void;
  onRenameFile: (id: string, nextName: string) => void;
  onDeleteFile: (id: string) => void;
  onNotify: (msg: string) => void;
}

const MAX_IMPORT_BYTES = 512 * 1024;

function sanitizeFileName(raw: string): string {
  const stripped = raw.replace(/[/\\]/g, '').trim();
  if (!stripped || stripped === '.' || stripped === '..') return '';
  return stripped;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  activeFileId,
  linkedDirName,
  termuxConnected,
  termuxEmbedded,
  onOpenSdcardManager,
  onBackupToSdcard,
  onPullFromTermux,
  onLinkDirectory,
  onSaveToDirectory,
  onSelectFile,
  onCreateFile,
  onRenameFile,
  onDeleteFile,
  onNotify,
}) => {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const isNativeApk = Boolean(termuxEmbedded || window.DroidPyNative?.isNativeApp?.());
  const [nativeStorageGranted, setNativeStorageGranted] = useState<boolean>(() =>
    Boolean(window.DroidPyNative?.hasStoragePermission?.())
  );

  useEffect(() => {
    if (!isNativeApk) return;
    const syncPerm = () => {
      setNativeStorageGranted(Boolean(window.DroidPyNative?.hasStoragePermission?.()));
    };
    syncPerm();
    window.addEventListener('focus', syncPerm);
    document.addEventListener('visibilitychange', syncPerm);
    return () => {
      window.removeEventListener('focus', syncPerm);
      document.removeEventListener('visibilitychange', syncPerm);
    };
  }, [isNativeApk]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let trimmed = sanitizeFileName(newFileName);
    if (!trimmed) return;
    if (!trimmed.includes('.')) {
      trimmed += '.py';
    }
    if (files.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
      onNotify(t('files_exists', { name: trimmed }));
      return;
    }
    const lower = trimmed.toLowerCase();
    const starter = lower.endsWith('.json')
      ? '{\n  "app": "DroidPy"\n}\n'
      : lower.endsWith('.py')
      ? `# ${trimmed}\n\ndef main():\n    print("Hello from ${trimmed}")\n\nif __name__ == "__main__":\n    main()\n`
      : '';
    onCreateFile(trimmed, starter);
    setNewFileName('');
    setIsCreating(false);
  };

  const handleRenameSubmit = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    let trimmed = sanitizeFileName(renameValue);
    if (!trimmed) return;
    if (!trimmed.includes('.')) {
      trimmed += '.py';
    }
    if (files.some((f) => f.id !== id && f.name.toLowerCase() === trimmed.toLowerCase())) {
      onNotify(t('files_dup', { name: trimmed }));
      return;
    }
    onRenameFile(id, trimmed);
    setRenamingId(null);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    try {
      for (const picked of Array.from(fileList)) {
        if (picked.size > MAX_IMPORT_BYTES) {
          onNotify(`${picked.name} (> 512 KB)`);
          continue;
        }
        const text = await picked.text();
        let name = sanitizeFileName(picked.name) || `imported_${Date.now().toString().slice(-4)}.py`;
        if (!name.includes('.')) {
          name = `${name}.py`;
        }
        if (files.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
          name = `imported_${Date.now().toString().slice(-4)}_${name}`;
        }
        onCreateFile(name, text);
        onNotify(t('files_imported', { name }));
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : t('files_clipboard_err'));
    } finally {
      e.target.value = '';
    }
  };

  const handleExportZip = async () => {
    const zip = new JSZip();
    for (const f of files) {
      zip.file(f.name, f.content);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    await downloadBlob(blob, 'droidpy-project.zip');
    onNotify(t('files_zip_ok'));
  };

  const handleShareActive = async () => {
    const active = files.find((f) => f.id === activeFileId);
    if (!active) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: active.name,
          text: active.content,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(active.content);
      onNotify(t('files_copied_code', { name: active.name }));
    } catch {
      onNotify(t('files_clipboard_err'));
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--ide-surface-alt)] text-[var(--ide-text)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ide-border)] bg-[var(--ide-surface)] shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-[var(--ide-text)]">{t('files_title')}</h2>
          <p className="text-xs text-[var(--ide-text-muted)] tabular-nums">
            {t('files_count', { count: files.length })}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {termuxConnected && onPullFromTermux && (
            <button
              type="button"
              onClick={() => void onPullFromTermux()}
              title={t('files_pull_termux')}
              aria-label={t('files_pull_termux')}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-[var(--ide-text-muted)] hover:text-[var(--ide-accent)] hover:border-[var(--ide-accent)] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsCreating((v) => !v)}
            aria-label={t('files_new_btn')}
            title={t('files_new_btn')}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Linked Device Folder Quick Bar (always interactive on Web/PWA via FS Access or webkitdirectory fallback) */}
      {!isNativeApk && (
        <div className="px-3 py-2 border-b border-[var(--ide-border)] bg-[var(--ide-surface)] flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-[var(--ide-text)] truncate">
              {linkedDirName ? t('files_dir_linked', { name: linkedDirName }) : t('files_dir_unlinked')}
            </div>
          </div>
          {linkedDirName ? (
            <button
              type="button"
              onClick={() => void onSaveToDirectory()}
              className="min-h-[32px] px-2.5 rounded-lg bg-[var(--ide-accent-soft)] text-[var(--ide-accent-text)] text-[11px] font-medium whitespace-nowrap shrink-0"
            >
              {t('files_dir_write')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onLinkDirectory()}
              className="min-h-[32px] px-2.5 rounded-lg border border-[var(--ide-border)] text-[11px] font-medium inline-flex items-center gap-1 hover:bg-[var(--ide-accent-soft)] whitespace-nowrap shrink-0"
            >
              <FolderSync className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
              <span>{t('files_dir_auth')}</span>
            </button>
          )}
        </div>
      )}

      {/* Android APK /sdcard Quick Bar */}
      {isNativeApk && (
        <div className="px-3 py-2 border-b border-[var(--ide-border)] bg-[var(--ide-surface)] space-y-1.5 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <HardDrive className="w-3.5 h-3.5 text-[var(--ide-accent)] shrink-0" />
              <span className="text-[11px] font-medium truncate">
                {nativeStorageGranted ? t('sd_quick_granted') : t('sd_quick_denied')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                void onLinkDirectory();
                window.setTimeout(() => {
                  setNativeStorageGranted(Boolean(window.DroidPyNative?.hasStoragePermission?.()));
                }, 800);
              }}
              className={`min-h-[28px] px-2 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                nativeStorageGranted
                  ? 'border border-[var(--ide-border)] bg-[var(--ide-bg)] text-[var(--ide-text)] hover:border-[var(--ide-accent)]'
                  : 'bg-amber-600 text-white'
              }`}
            >
              {nativeStorageGranted ? t('files_dir_auth') : t('sd_grant_btn')}
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            {onOpenSdcardManager && (
              <button
                type="button"
                onClick={onOpenSdcardManager}
                className="flex-1 min-h-[30px] px-2 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-bg)] text-[11px] font-medium hover:border-[var(--ide-accent)] truncate"
              >
                {t('sd_quick_manage')}
              </button>
            )}
            {onBackupToSdcard && (
              <button
                type="button"
                onClick={() => void onBackupToSdcard()}
                className="flex-1 min-h-[30px] px-2 rounded-lg bg-[var(--ide-accent-soft)] text-[var(--ide-accent-text)] text-[11px] font-medium truncate"
              >
                {t('sd_quick_backup')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Inline New File Form */}
      {isCreating && (
        <form
          onSubmit={handleCreateSubmit}
          className="p-3 border-b border-[var(--ide-border)] bg-[var(--ide-surface)] flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            autoFocus
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder={t('files_new_placeholder')}
            className="flex-1 min-w-0 min-h-[40px] px-3 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
          />
          <button
            type="submit"
            aria-label="確認建立檔案"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-[var(--ide-accent)] text-white"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsCreating(false)}
            aria-label="取消建立"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-[var(--ide-surface-alt)] border border-[var(--ide-border)] text-[var(--ide-text-muted)]"
          >
            <X className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* File List */}
      <div className="flex-1 overflow-y-auto ide-scroll divide-y divide-[var(--ide-border)]">
        {files.map((file) => {
          const isActive = file.id === activeFileId;
          const lineCount = file.content.split('\n').length;

          if (renamingId === file.id) {
            return (
              <form
                key={file.id}
                onSubmit={(e) => handleRenameSubmit(e, file.id)}
                className="flex items-center gap-2 px-3 py-2.5 bg-[var(--ide-surface)]"
              >
                <input
                  type="text"
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="flex-1 min-w-0 min-h-[38px] px-2.5 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-accent)] text-sm font-mono focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label="儲存檔名"
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-[var(--ide-accent)] text-white"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRenamingId(null)}
                  aria-label="取消重新命名"
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-[var(--ide-surface-alt)] border border-[var(--ide-border)] text-[var(--ide-text-muted)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            );
          }

          return (
            <div
              key={file.id}
              className={`group flex items-center justify-between gap-2 px-3 py-2.5 transition-colors ${
                isActive
                  ? 'bg-[var(--ide-accent-soft)] text-[var(--ide-accent-text)]'
                  : 'hover:bg-[var(--ide-surface)]'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectFile(file.id)}
                className="flex-1 min-w-0 min-h-[44px] flex items-center gap-3 text-left"
              >
                <FileCode2
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-[var(--ide-accent)]' : 'text-[var(--ide-text-muted)]'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-sm font-medium truncate">{file.name}</div>
                  <div className="text-[11px] text-[var(--ide-text-muted)] tabular-nums">
                    {t('files_meta', { lines: lineCount, kb: (file.content.length / 1024).toFixed(1) })}
                  </div>
                </div>
              </button>

              {confirmDeleteId === file.id ? (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteFile(file.id);
                      setConfirmDeleteId(null);
                    }}
                    className="min-h-[36px] px-2.5 rounded-lg bg-red-600 text-white text-xs font-medium"
                  >
                    {t('files_delete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="min-h-[36px] px-2 rounded-lg bg-[var(--ide-surface)] border border-[var(--ide-border)] text-xs"
                  >
                    {t('files_cancel')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(file.id);
                      setRenameValue(file.name);
                    }}
                    aria-label={`重新命名 ${file.name}`}
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {files.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(file.id)}
                      aria-label={`刪除 ${file.name}`}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[var(--ide-text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Android Code Templates Accordion */}
        <div className="p-3">
          <button
            type="button"
            onClick={() => setShowTemplates((v) => !v)}
            className="w-full min-h-[44px] px-3 flex items-center justify-between rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)] text-xs font-medium text-[var(--ide-text)] hover:border-[var(--ide-accent)] transition-colors"
          >
            <span className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[var(--ide-accent)]" />
              <span>{t('files_templates_btn')}</span>
            </span>
            <span className="text-[var(--ide-text-muted)]">
              {showTemplates ? t('files_collapse') : t('files_expand')}
            </span>
          </button>

          {showTemplates && (
            <div className="mt-2 space-y-2">
              {SNIPPET_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    let targetName = tpl.filename;
                    if (files.some((f) => f.name === targetName)) {
                      targetName = `${tpl.filename.replace('.py', '')}_${Date.now().toString().slice(-3)}.py`;
                    }
                    onCreateFile(targetName, tpl.code);
                    onNotify(t('files_template_added', { name: targetName }));
                  }}
                  className="w-full text-left p-3 rounded-xl border border-[var(--ide-border)] hover:border-[var(--ide-accent)] bg-[var(--ide-surface)] transition-colors"
                >
                  <div className="text-xs font-semibold text-[var(--ide-text)]">{tpl.title}</div>
                  <div className="text-[11px] text-[var(--ide-text-muted)] mt-0.5 leading-snug">
                    {tpl.desc}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom File Actions */}
      <div className="p-3 border-t border-[var(--ide-border)] grid grid-cols-3 gap-2 shrink-0 bg-[var(--ide-surface)]">
        <input
          ref={fileInputRef}
          type="file"
          accept=".py,.txt,.json,.csv,.md,.html,.yaml,.yml,.xml,.ini,.log"
          onChange={handleUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="min-h-[42px] px-2 flex items-center justify-center gap-1.5 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-xs font-medium hover:border-[var(--ide-accent)] transition-colors whitespace-nowrap"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{t('files_import')}</span>
        </button>
        <button
          type="button"
          onClick={handleShareActive}
          className="min-h-[42px] px-2 flex items-center justify-center gap-1.5 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-xs font-medium hover:border-[var(--ide-accent)] transition-colors whitespace-nowrap"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>{t('files_share')}</span>
        </button>
        <button
          type="button"
          onClick={handleExportZip}
          className="min-h-[42px] px-2 flex items-center justify-center gap-1.5 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-xs font-medium hover:border-[var(--ide-accent)] transition-colors whitespace-nowrap"
        >
          <Archive className="w-3.5 h-3.5" />
          <span>{t('files_zip')}</span>
        </button>
      </div>
    </div>
  );
};

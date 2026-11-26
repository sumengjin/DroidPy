import React, { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, FileCode2, Folder, Loader2, RefreshCw, X } from 'lucide-react';
import { listSdcardDirectory, readSdcardFile } from '../services/termuxBridge';
import { SdcardEntry, TermuxConfig } from '../types/ide';

interface SdcardFileBrowserProps {
  config: TermuxConfig;
  onClose: () => void;
  onOpenFile: (file: { name: string; content: string; path: string }) => void;
  onNotify: (message: string) => void;
}

export const SdcardFileBrowser: React.FC<SdcardFileBrowserProps> = ({
  config,
  onClose,
  onOpenFile,
  onNotify,
}) => {
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<SdcardEntry[]>([]);
  const [rootPath, setRootPath] = useState('/storage/emulated/0');
  const [loading, setLoading] = useState(true);
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listSdcardDirectory(config, path);
      if (!result.granted) {
        throw new Error('尚未取得共享儲存空間權限，請先授權 DroidPy 存取檔案');
      }
      setRootPath(result.rootPath || '/storage/emulated/0');
      setCurrentPath(result.currentPath || path);
      setEntries(
        result.entries
          .filter((entry) => entry.isDir || entry.name.toLowerCase().endsWith('.py'))
          .sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDirectory(currentPath);
    // The browser is mounted only while open; path changes are handled by navigation actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parentPath = currentPath.includes('/')
    ? currentPath.slice(0, currentPath.lastIndexOf('/'))
    : '';

  const handleOpenEntry = async (entry: SdcardEntry) => {
    if (entry.isDir) {
      await loadDirectory(entry.relPath);
      return;
    }
    if (!entry.name.toLowerCase().endsWith('.py')) return;
    if (entry.size > 512 * 1024) {
      onNotify(`${entry.name} 超過 512 KB，暫不載入編輯器`);
      return;
    }
    setOpeningPath(entry.relPath);
    try {
      const file = await readSdcardFile(config, entry.relPath);
      onOpenFile({ name: file.name || entry.name, content: file.content, path: file.relPath || entry.relPath });
    } catch (err) {
      onNotify(err instanceof Error ? err.message : '讀取檔案失敗');
    } finally {
      setOpeningPath(null);
    }
  };

  const displayPath = currentPath ? `${rootPath}/${currentPath}` : rootPath;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)]">
      <div className="flex items-center justify-between gap-2 px-3 py-3 border-b border-[var(--ide-border)] bg-[var(--ide-surface)] shrink-0">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">裝置檔案</h3>
          <p className="text-[11px] text-[var(--ide-text-muted)] truncate" title={displayPath}>{displayPath}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="關閉檔案瀏覽器" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[var(--ide-border)]">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--ide-border)] shrink-0">
        <button
          type="button"
          disabled={!currentPath || loading}
          onClick={() => void loadDirectory(parentPath)}
          className="min-h-[40px] px-3 rounded-lg border border-[var(--ide-border)] text-xs font-medium disabled:opacity-40"
        >
          <span className="inline-flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" />上一層</span>
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void loadDirectory(currentPath)}
          aria-label="重新整理"
          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-[var(--ide-border)] disabled:opacity-40"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <span className="ml-auto text-[11px] text-[var(--ide-text-muted)]">資料夾與 .py 檔案</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto ide-scroll">
        {loading ? (
          <div className="h-full flex items-center justify-center gap-2 text-sm text-[var(--ide-text-muted)]">
            <Loader2 className="w-4 h-4 animate-spin" />正在讀取資料夾…
          </div>
        ) : error ? (
          <div className="p-4 space-y-3">
            <p className="text-sm text-red-500">{error}</p>
            <button type="button" onClick={() => void loadDirectory(currentPath)} className="min-h-[44px] px-4 rounded-xl bg-[var(--ide-accent)] text-white text-sm">重試</button>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-6 text-center text-sm text-[var(--ide-text-muted)]">這個資料夾沒有子資料夾或 .py 檔案</div>
        ) : (
          entries.map((entry) => (
            <button
              key={entry.relPath}
              type="button"
              disabled={openingPath !== null}
              onClick={() => void handleOpenEntry(entry)}
              className="w-full min-h-[58px] px-3 py-2 flex items-center gap-3 text-left border-b border-[var(--ide-border)] hover:bg-[var(--ide-surface)] disabled:opacity-50"
            >
              {entry.isDir ? <Folder className="w-5 h-5 text-[var(--ide-accent)] shrink-0" /> : <FileCode2 className="w-5 h-5 text-[var(--ide-text-muted)] shrink-0" />}
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate">{entry.name}</span>
                <span className="block text-[11px] text-[var(--ide-text-muted)]">{entry.isDir ? '資料夾' : `${(entry.size / 1024).toFixed(1)} KB · Python 檔案`}</span>
              </span>
              {openingPath === entry.relPath ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4 text-[var(--ide-text-muted)]" />}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

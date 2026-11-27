import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileText,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  AppExecutionLogEntry,
  AppLogLevel,
  clearAppLogs,
  formatAppLogsAsText,
  subscribeAppLogs,
} from '../services/appLogger';
import {
  TermuxNativeLogsResponse,
  clearTermuxNativeLogs,
  fetchTermuxNativeLogs,
} from '../services/termuxBridge';
import { TermuxConfig, TerminalEntry } from '../types/ide';
import { useI18n } from '../services/i18n';
import { copyTextReliable } from '../utils/clipboard';
import { downloadBlob } from '../utils/downloadBlob';

interface AppExecutionLogModalProps {
  open: boolean;
  onClose: () => void;
  executionEntries: TerminalEntry[];
  termuxConfig: TermuxConfig;
  termuxConnected: boolean;
  onNotify: (msg: string) => void;
}

type LogViewTab = 'execution' | 'app' | 'native';

export const AppExecutionLogModal: React.FC<AppExecutionLogModalProps> = ({
  open,
  onClose,
  executionEntries,
  termuxConfig,
  termuxConnected,
  onNotify,
}) => {
  const { t } = useI18n();
  const [logs, setLogs] = useState<AppExecutionLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<LogViewTab>('execution');
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [nativeLogs, setNativeLogs] = useState<TermuxNativeLogsResponse | null>(null);
  const [loadingNative, setLoadingNative] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    return subscribeAppLogs(setLogs);
  }, [open]);

  const loadNative = async () => {
    if (!termuxConnected) {
      setNativeLogs(null);
      return;
    }
    setLoadingNative(true);
    try {
      const res = await fetchTermuxNativeLogs(termuxConfig);
      setNativeLogs(res);
    } catch {
      setNativeLogs(null);
    } finally {
      setLoadingNative(false);
    }
  };

  useEffect(() => {
    if (open && termuxConnected) {
      void loadNative();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, termuxConnected]);

  const filteredAppLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...logs]
      .reverse()
      .filter((item) => {
        if (onlyErrors && item.level !== 'error' && item.level !== 'warn') return false;
        if (!q) return true;
        return (
          item.message.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.detail && item.detail.toLowerCase().includes(q))
        );
      });
  }, [logs, onlyErrors, searchQuery]);

  const filteredExecutionEntries = useMemo(() => {
    return [...executionEntries].reverse().filter((entry) => {
      if (onlyErrors && entry.type !== 'stderr' && !/\b(error|exception|traceback|failed|failure|fatal)\b/i.test(entry.content)) return false;
      const q = searchQuery.trim().toLowerCase();
      return !q || entry.content.toLowerCase().includes(q) || entry.type.toLowerCase().includes(q);
    });
  }, [executionEntries, onlyErrors, searchQuery]);

  const filteredNativeLines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const combined = [
      ...(nativeLogs?.nativeLines ?? []),
      ...(nativeLogs?.logcatLines?.length
        ? ['--- Logcat ---', ...nativeLogs.logcatLines]
        : []),
    ];
    return combined
      .filter((line) => (!onlyErrors || /\b(error|err|warn|warning|fatal|exception|traceback|[EW])\b/i.test(line)) && (!q || line.toLowerCase().includes(q)))
      .slice(-300);
  }, [nativeLogs, searchQuery, onlyErrors]);

  if (!open) return null;

  const levelColor = (level: AppLogLevel) => {
    switch (level) {
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'warn':
        return 'text-amber-600 dark:text-amber-400';
      default:
        return 'text-[var(--ide-accent-text)]';
    }
  };

  const handleCopyAll = async () => {
    const text = `--- Execution Logs ---\n${executionEntries.map((entry) => `[${entry.timestamp}] [${entry.type}] ${entry.content}`).join('\n')}\n\n${formatAppLogsAsText(logs, nativeLogs)}`;
    const ok = await copyTextReliable(text);
    if (ok) {
      setCopied(true);
      onNotify(t('logs_copied'));
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleExportLogFile = async () => {
    const text = `--- Execution Logs ---\n${executionEntries.map((entry) => `[${entry.timestamp}] [${entry.type}] ${entry.content}`).join('\n')}\n\n${formatAppLogsAsText(logs, nativeLogs)}`;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    await downloadBlob(blob, `droidpy-logs-${stamp}.log`);
  };

  const handleClear = async () => {
    if (activeTab === 'app') {
      clearAppLogs();
    } else if (termuxConnected) {
      try {
        await clearTermuxNativeLogs(termuxConfig);
        await loadNative();
      } catch {
        // ignore
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('logs_modal_title')}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-3xl h-[88vh] sm:h-[82vh] dp-sheet rounded-b-none sm:rounded-b-[1.75rem] text-[var(--ide-text)] flex flex-col overflow-hidden"
      >
        <div className="w-10 h-1 bg-[var(--ide-border)] rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--ide-border)] flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
              <span className="truncate">{t('logs_modal_title')}</span>
            </h3>
            <p className="text-xs text-[var(--ide-text-muted)] truncate mt-0.5">
              {t('logs_modal_desc')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('btn_done')}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs & Action Bar */}
        <div className="px-4 py-2.5 border-b border-[var(--ide-border)] bg-[var(--ide-surface-alt)] space-y-2.5 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1 p-0.5 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)]">
              <button
                type="button"
                onClick={() => setActiveTab('execution')}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'execution' ? 'bg-[var(--ide-accent)] text-white font-semibold' : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
                }`}
              >
                {t('logs_tab_execution')} ({executionEntries.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('app')}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'app'
                    ? 'bg-[var(--ide-accent)] text-white font-semibold'
                    : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
                }`}
              >
                {t('logs_tab_app')} ({logs.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('native')}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'native'
                    ? 'bg-[var(--ide-accent)] text-white font-semibold'
                    : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
                }`}
              >
                {t('logs_tab_native')}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {activeTab === 'native' && (
                <button
                  type="button"
                  onClick={() => void loadNative()}
                  disabled={loadingNative || !termuxConnected}
                  className="min-h-[34px] px-2.5 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingNative ? 'animate-spin' : ''}`} />
                  <span>{t('logs_refresh')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleCopyAll()}
                className="min-h-[34px] px-2.5 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[var(--ide-accent)]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t('term_copied') : t('logs_copy')}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleExportLogFile()}
                className="min-h-[34px] px-2.5 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
                <span>{t('logs_export')}</span>
              </button>
              {activeTab !== 'execution' && <button
                type="button"
                onClick={() => void handleClear()}
                className="min-h-[34px] px-2.5 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] text-xs font-medium text-red-500 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('logs_clear')}</span>
              </button>}
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-[var(--ide-text-muted)]">
            {activeTab === 'execution' ? t('logs_hint_execution') : activeTab === 'app' ? t('logs_hint_app') : t('logs_hint_native')}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-[var(--ide-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('logs_search_ph')}
                className="w-full min-h-[36px] pl-8 pr-3 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
              />
            </div>
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                <button
                  type="button"
                  onClick={() => setOnlyErrors(false)}
                  className={`min-h-[30px] px-2.5 rounded-md text-[11px] font-medium ${
                    !onlyErrors
                      ? 'bg-[var(--ide-surface)] text-[var(--ide-text)] font-semibold'
                      : 'text-[var(--ide-text-muted)]'
                  }`}
                >
                  {t('logs_filter_all')}
                </button>
                <button
                  type="button"
                  onClick={() => setOnlyErrors(true)}
                  className={`min-h-[30px] px-2.5 rounded-md text-[11px] font-medium ${
                    onlyErrors
                      ? 'bg-red-500 text-white font-semibold'
                      : 'text-[var(--ide-text-muted)]'
                  }`}
                >
                  {t('logs_filter_errors')}
                </button>
              </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto ide-scroll p-3 sm:p-4 font-mono text-xs space-y-2 bg-[var(--ide-bg)]">
          {activeTab === 'execution' ? (
            filteredExecutionEntries.length === 0 ? (
              <div className="py-12 text-center text-[var(--ide-text-muted)] font-sans text-xs">{t('logs_empty')}</div>
            ) : (
              filteredExecutionEntries.map((entry) => (
                <div key={entry.id} className="dp-panel px-3 py-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--ide-text-muted)]">
                    <span className={entry.type === 'stderr' ? 'text-red-500 font-semibold' : 'uppercase'}>{entry.type === 'stderr' ? t('logs_error_label') : entry.type}</span>
                    <span className="tabular-nums">{entry.timestamp}</span>
                  </div>
                  <pre className="selectable-text whitespace-pre-wrap break-words text-[var(--ide-text)]">{entry.content}</pre>
                  {entry.imageDataUrl && <img src={entry.imageDataUrl} alt={t('log_plot_output')} className="max-w-full rounded-lg" />}
                </div>
              ))
            )
          ) : activeTab === 'app' ? (
            filteredAppLogs.length === 0 ? (
              <div className="py-12 text-center text-[var(--ide-text-muted)] font-sans text-xs">
                {t('logs_empty')}
              </div>
            ) : (
              filteredAppLogs.map((entry) => (
                <div
                  key={entry.id}
                  className="dp-panel px-3 py-2.5 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`text-[10px] font-semibold uppercase shrink-0 ${levelColor(entry.level)}`}
                      >
                        {entry.level}
                      </span>
                      <span aria-hidden="true" className="text-[var(--ide-text-muted)]">·</span>
                      <span className="text-[var(--ide-text-muted)] uppercase shrink-0">
                        {entry.category}
                      </span>
                    </div>
                    <span className="text-[var(--ide-text-muted)] tabular-nums shrink-0">
                      {entry.timestamp}
                    </span>
                  </div>
                  <div className="selectable-text text-[var(--ide-text)] break-words leading-relaxed">
                    {entry.message}
                  </div>
                  {entry.detail && (
                    <pre className="selectable-text text-[11px] text-[var(--ide-text-muted)] whitespace-pre-wrap break-words bg-[var(--ide-bg)] rounded-xl p-2 border border-[var(--ide-border)]">
                      {entry.detail}
                    </pre>
                  )}
                </div>
              ))
            )
          ) : !termuxConnected ? (
            <div className="py-12 text-center text-[var(--ide-text-muted)] font-sans text-xs">
              {t('logs_native_unavailable')}
            </div>
          ) : filteredNativeLines.length === 0 ? (
            <div className="py-12 text-center text-[var(--ide-text-muted)] font-sans text-xs">
              {t('logs_empty')}
            </div>
          ) : (
            <pre className="selectable-text rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-words">
              {filteredNativeLines.join('\n')}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

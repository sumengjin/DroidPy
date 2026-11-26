import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, Copy, Check, AlertCircle, CornerDownLeft, Download, Maximize2, X, FileText, Pause, Play } from 'lucide-react';
import { ExecutionEngine, PyodideStatus, TerminalEntry } from '../types/ide';
import { renderAnsiText, stripAnsi } from '../utils/ansiParser';
import { useI18n } from '../services/i18n';
import { downloadDataUrl } from '../utils/downloadBlob';
import { formatDurationHMS } from '../utils/formatDuration';
import { copyTextReliable, getSelectedTextWithin } from '../utils/clipboard';

interface TerminalPanelProps {
  entries: TerminalEntry[];
  status: PyodideStatus;
  engine: ExecutionEngine;
  onChangeEngine: (engine: ExecutionEngine) => void;
  termuxConnected: boolean;
  embeddedMissingPython?: boolean;
  onQuickInitEmbedded?: () => void;
  lastDurationMs: number | null;
  runStartedAt?: number | null;
  pendingInputPrompt: string | null;
  onSubmitInput: (value: string) => void;
  onRunRepl: (statement: string) => Promise<void>;
  onSendTermuxStdin?: (text: string) => Promise<void>;
  paused?: boolean;
  canPause?: boolean;
  onTogglePause?: () => void;
  onOpenLogs?: () => void;
  enableSandboxAddon?: boolean;
  isDark?: boolean;
  onClear: () => void;
}

const LiveElapsedTimer: React.FC<{ runStartedAt: number }> = ({ runStartedAt }) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setNowMs(Date.now());
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => window.clearInterval(id);
  }, [runStartedAt]);

  return (
    <span className="font-mono tabular-nums whitespace-nowrap text-[var(--ide-accent-text)] font-semibold">
      {formatDurationHMS(Math.max(0, nowMs - runStartedAt))}
    </span>
  );
};

interface TerminalEntryRowProps {
  entry: TerminalEntry;
  plotTitle: string;
  plotZoomLabel: string;
  errTitle: string;
  isDark?: boolean;
  onExpandPlot: (url: string) => void;
}

const TerminalEntryRow = React.memo<TerminalEntryRowProps>(
  ({ entry, plotTitle, plotZoomLabel, errTitle, isDark, onExpandPlot }) => {
    const renderedAnsi = useMemo(() => {
      if (entry.type === 'plot' || entry.type === 'system' || entry.type === 'repl-in') {
        return null;
      }
      return renderAnsiText(entry.content, false, isDark);
    }, [entry.type, entry.content, isDark]);

    const cleanSystemText = useMemo(() => {
      if (entry.type !== 'system') return '';
      return stripAnsi(entry.content);
    }, [entry.type, entry.content]);

    if (entry.type === 'plot' && entry.imageDataUrl) {
      return (
        <div className="my-2 md-card p-3 font-sans">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-xs font-medium text-[var(--ide-text-muted)]">
              {plotTitle}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onExpandPlot(entry.imageDataUrl!)}
                className="min-h-[44px] px-2 flex items-center gap-1 rounded-md text-xs text-[var(--ide-text-muted)] hover:bg-[var(--ide-accent-soft)]"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>{plotZoomLabel}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadDataUrl(
                    entry.imageDataUrl!,
                    `droidpy-plot-${entry.timestamp.replace(/:/g, '')}.png`,
                    'image/png'
                  )
                }
                className="min-h-[44px] px-2 flex items-center gap-1 rounded-md text-xs text-[var(--ide-accent-text)] hover:bg-[var(--ide-accent-soft)]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PNG</span>
              </button>
            </div>
          </div>
          <img
            src={entry.imageDataUrl}
            alt={plotTitle}
            referrerPolicy="no-referrer"
            className="w-full max-w-md rounded-lg bg-white"
          />
        </div>
      );
    }

    if (entry.type === 'stderr') {
      return (
        <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/80 dark:bg-red-950/30 px-3 py-2 text-red-700 dark:text-red-300">
          <div className="flex items-center gap-1.5 text-xs font-sans font-semibold mb-1 text-red-600 dark:text-red-400">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errTitle}</span>
          </div>
          <pre className="whitespace-pre-wrap break-words text-xs">{renderedAnsi}</pre>
        </div>
      );
    }

    if (entry.type === 'system') {
      return (
        <div className="text-xs text-[var(--ide-text-muted)] font-sans break-words">
          <span className="font-mono tabular-nums mr-2 opacity-75">
            [{entry.timestamp}]
          </span>
          {cleanSystemText}
        </div>
      );
    }

    if (entry.type === 'repl-in') {
      return (
        <div className="text-[var(--ide-accent-text)] whitespace-pre-wrap break-words">
          {entry.content.startsWith('$ ') ? entry.content : `>>> ${entry.content}`}
        </div>
      );
    }

    if (entry.type === 'repl-out') {
      return (
        <div className="text-amber-600 dark:text-amber-300 whitespace-pre-wrap break-words">
          {renderedAnsi}
        </div>
      );
    }

    return (
      <pre className="whitespace-pre-wrap break-words text-[var(--ide-text)]">
        {renderedAnsi}
      </pre>
    );
  }
);

TerminalEntryRow.displayName = 'TerminalEntryRow';

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  entries,
  status,
  engine,
  onChangeEngine,
  termuxConnected,
  embeddedMissingPython,
  onQuickInitEmbedded,
  lastDurationMs,
  runStartedAt,
  pendingInputPrompt,
  onSubmitInput,
  onRunRepl,
  onSendTermuxStdin,
  paused = false,
  canPause = false,
  onTogglePause,
  onOpenLogs,
  enableSandboxAddon = false,
  isDark,
  onClear,
}) => {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const replInputRef = useRef<HTMLInputElement | null>(null);

  const [stdinValue, setStdinValue] = useState('');
  const [replValue, setReplValue] = useState('');
  const [replHistory, setReplHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const [copied, setCopied] = useState(false);
  const [copiedSel, setCopiedSel] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [expandedPlot, setExpandedPlot] = useState<string | null>(null);

  useEffect(() => {
    const syncSelection = () => {
      const sel = getSelectedTextWithin(scrollRef.current);
      setSelectedText(sel);
    };
    document.addEventListener('selectionchange', syncSelection);
    return () => document.removeEventListener('selectionchange', syncSelection);
  }, []);

  useEffect(() => {
    if (scrollRef.current && !getSelectedTextWithin(scrollRef.current)) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, pendingInputPrompt]);

  useEffect(() => {
    if (pendingInputPrompt !== null) {
      inputRef.current?.focus();
    }
  }, [pendingInputPrompt]);

  const handleCopyAll = async () => {
    const text = entries
      .filter((e) => e.type !== 'plot')
      .map((e) => stripAnsi(e.content))
      .join('\n');
    if (!text) return;
    const ok = await copyTextReliable(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleCopySelection = async () => {
    const currentSel = getSelectedTextWithin(scrollRef.current) || selectedText;
    if (!currentSel) return;
    const ok = await copyTextReliable(currentSel);
    if (ok) {
      setCopiedSel(true);
      setTimeout(() => setCopiedSel(false), 1800);
    }
  };

  const handleStdinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitInput(stdinValue);
    setStdinValue('');
  };

  const handleReplSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = replValue.trim();
    if (!trimmed || status === 'running' || (engine === 'pyodide' && status === 'loading')) return;
    setReplHistory((prev) => [trimmed, ...prev.slice(0, 29)]);
    setHistoryIdx(-1);
    setReplValue('');
    await onRunRepl(trimmed);
    replInputRef.current?.focus();
  };

  const handleTermuxStdinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSendTermuxStdin) return;
    const val = stdinValue;
    setStdinValue('');
    await onSendTermuxStdin(val);
  };

  const handleReplKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIdx = Math.min(historyIdx + 1, replHistory.length - 1);
      if (replHistory[nextIdx] !== undefined) {
        setHistoryIdx(nextIdx);
        setReplValue(replHistory[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = historyIdx - 1;
      if (nextIdx < 0) {
        setHistoryIdx(-1);
        setReplValue('');
      } else if (replHistory[nextIdx] !== undefined) {
        setHistoryIdx(nextIdx);
        setReplValue(replHistory[nextIdx]);
      }
    }
  };

  const statusLabel =
    engine === 'termux'
      ? termuxConnected
        ? t('term_status_termux_ok')
        : t('term_status_termux_off')
      : status === 'loading' || status === 'idle'
      ? t('term_status_loading')
      : status === 'running'
      ? t('term_status_running')
      : status === 'error'
      ? t('term_status_error')
      : t('term_status_ready');

  return (
    <div className="flex flex-col h-full bg-[var(--ide-surface-alt)] text-[var(--ide-text)] overflow-hidden">
      {/* Sub-header */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 px-2.5 sm:px-3 py-2 border-b border-[var(--ide-border)] bg-[var(--ide-surface)] shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-[var(--ide-text-muted)] min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--ide-surface-alt)] border border-[var(--ide-border)] shrink-0">
            {(enableSandboxAddon || engine === 'pyodide') && (
              <button
                type="button"
                onClick={() => onChangeEngine('pyodide')}
                className={`min-h-[44px] px-2 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                  engine === 'pyodide'
                    ? 'bg-[var(--ide-surface)] text-[var(--ide-text)] shadow-sm'
                    : 'text-[var(--ide-text-muted)]'
                }`}
              >
                {t('term_sandbox')}
              </button>
            )}
            <button
              type="button"
              onClick={() => onChangeEngine('termux')}
              className={`min-h-[44px] px-2 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                engine === 'termux'
                  ? 'bg-[var(--ide-accent)] text-white shadow-sm'
                  : 'text-[var(--ide-text-muted)]'
              }`}
            >
              {t('tmx_engine_short')}
            </button>
          </div>
          <span className="truncate min-w-0">{statusLabel}</span>
          {status === 'running' && runStartedAt != null ? (
            <>
              <span aria-hidden="true" className="shrink-0">·</span>
              <span className="shrink-0">
                <LiveElapsedTimer runStartedAt={runStartedAt} />
              </span>
            </>
          ) : lastDurationMs !== null ? (
            <>
              <span aria-hidden="true" className="shrink-0">·</span>
              <span className="font-mono tabular-nums whitespace-nowrap shrink-0">
                {formatDurationHMS(lastDurationMs)}
              </span>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1 shrink-0">
          {engine === 'termux' && status === 'running' && canPause && onTogglePause && (
            <button
              type="button"
              onClick={onTogglePause}
              aria-label={paused ? '繼續腳本' : '暫停腳本'}
              title={paused ? '繼續腳本' : '暫停腳本'}
              className="min-h-[44px] px-2.5 flex items-center gap-1 rounded-xl bg-[var(--ide-accent-soft)] text-[var(--ide-accent-text)] text-xs font-semibold transition-colors whitespace-nowrap"
            >
              {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{paused ? '繼續' : '暫停'}</span>
            </button>
          )}
          {selectedText.length > 0 && (
            <button
              type="button"
              onClick={handleCopySelection}
              className="min-h-[44px] px-2.5 flex items-center gap-1 rounded-xl bg-[var(--ide-accent)] text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              {copiedSel ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSel ? t('term_copied_selection') : t('term_copy_selection')}</span>
            </button>
          )}
          {onOpenLogs && (
            <button
              type="button"
              onClick={onOpenLogs}
              className="min-h-[44px] px-2.5 flex items-center gap-1 rounded-xl text-xs font-medium text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-accent-soft)] transition-colors whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
              <span>{t('logs_btn')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCopyAll}
            disabled={entries.length === 0}
            className="min-h-[44px] px-2.5 flex items-center gap-1 rounded-xl text-xs font-medium text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-accent-soft)] disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[var(--ide-accent)]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? t('term_copied') : t('term_copy')}</span>
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={entries.length === 0}
            className="min-h-[44px] px-2.5 flex items-center gap-1 rounded-xl text-xs font-medium text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-accent-soft)] disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('term_clear')}</span>
          </button>
        </div>
      </div>

      {/* Actionable banner when Embedded Termux Python hasn't been initialized yet */}
      {engine === 'termux' && embeddedMissingPython && status !== 'running' && (
        <div className="px-3 py-2.5 border-b border-amber-300/60 dark:border-amber-800/60 bg-amber-50/90 dark:bg-amber-950/40 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-xs text-amber-800 dark:text-amber-200 leading-snug min-w-0 flex-1">
            {t('tmx_need_init_hint')}
          </div>
          {onQuickInitEmbedded && (
            <button
              type="button"
              onClick={onQuickInitEmbedded}
              className="min-h-[44px] px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shrink-0 transition-colors"
            >
              {t('tmx_init_btn_full')}
            </button>
          )}
        </div>
      )}

      {/* Output Scroll Area */}
      <div
        ref={scrollRef}
        className="terminal-selectable flex-1 overflow-y-auto ide-scroll p-3 sm:p-4 font-mono text-[13px] leading-relaxed space-y-2"
      >
        {entries.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-8 text-[var(--ide-text-muted)] font-sans">
            <p className="text-sm font-medium text-[var(--ide-text)]">{t('term_empty_title')}</p>
            <p className="text-xs mt-1 max-w-xs">{t('term_empty_desc')}</p>
          </div>
        ) : (
          entries.map((entry) => (
              <TerminalEntryRow
              key={entry.id}
              entry={entry}
              plotTitle={t('term_plot_title')}
              plotZoomLabel={t('term_plot_zoom')}
              errTitle={t('term_err_title')}
              isDark={isDark}
              onExpandPlot={setExpandedPlot}
            />
          ))
        )}
      </div>

      {/* Inline input() prompt bar when script requests stdin */}
      {pendingInputPrompt !== null ? (
        <form
          onSubmit={handleStdinSubmit}
          className="p-2.5 border-t border-amber-300 dark:border-amber-700/70 bg-amber-50 dark:bg-amber-950/30 flex items-center gap-2 shrink-0"
        >
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap shrink-0">
            {t('term_input_label')}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={stdinValue}
            onChange={(e) => setStdinValue(e.target.value)}
            placeholder={pendingInputPrompt || t('term_input_placeholder')}
            className="flex-1 min-w-0 min-h-[44px] px-3 rounded-lg bg-[var(--ide-surface)] border border-amber-300 dark:border-amber-700 text-sm font-mono text-[var(--ide-text)] focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            type="submit"
            className="min-h-[44px] px-4 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
          >
            <span>{t('term_send')}</span>
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </form>
      ) : engine === 'termux' && status === 'running' ? (
        <form
          onSubmit={handleTermuxStdinSubmit}
          className="p-2 border-t border-[var(--ide-border)] bg-[var(--ide-surface)] flex items-center gap-2 shrink-0"
        >
          <span className="text-xs font-semibold text-[var(--ide-accent-text)] pl-1.5 whitespace-nowrap shrink-0">
            {t('term_stdin_label')}
          </span>
          <input
            type="text"
            value={stdinValue}
            onChange={(e) => setStdinValue(e.target.value)}
            placeholder={t('term_stdin_placeholder')}
            className="flex-1 min-w-0 min-h-[44px] px-3 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)] text-sm font-mono text-[var(--ide-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
          />
          <button
            type="submit"
            className="min-h-[44px] px-3.5 rounded-lg bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-medium whitespace-nowrap shrink-0"
          >
            {t('term_send')}
          </button>
        </form>
      ) : (
        /* Persistent Interactive Python REPL Input */
        <form
          onSubmit={handleReplSubmit}
          className="p-2 border-t border-[var(--ide-border)] bg-[var(--ide-surface)] flex items-center gap-2 shrink-0"
        >
          <span className="font-mono text-xs font-semibold text-[var(--ide-accent-text)] pl-2 shrink-0 select-none">
            {engine === 'termux' ? '$' : '>>>'}
          </span>
          <input
            ref={replInputRef}
            type="text"
            value={replValue}
            onChange={(e) => setReplValue(e.target.value)}
            onKeyDown={handleReplKeyDown}
            disabled={status === 'running' || (engine === 'pyodide' && status === 'loading')}
            placeholder={
              engine === 'termux'
                ? t('term_repl_termux_placeholder')
                : t('term_repl_py_placeholder')
            }
            aria-label="REPL"
            className="flex-1 min-w-0 min-h-[44px] px-2 bg-transparent font-mono text-sm text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={
              !replValue.trim() ||
              status === 'running' ||
              (engine === 'pyodide' && status === 'loading')
            }
            className="min-h-[44px] px-3.5 rounded-lg bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-medium disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
          >
            {t('term_exec_btn')}
          </button>
        </form>
      )}

      {/* Plot Lightbox Modal */}
      {expandedPlot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setExpandedPlot(null)}
        >
          <div
            className="relative max-w-3xl w-full md-sheet p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-[var(--ide-text)]">{t('term_plot_modal_title')}</span>
              <button
                type="button"
                onClick={() => setExpandedPlot(null)}
                aria-label={t('pwa_got_it')}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--ide-text-muted)] hover:bg-[var(--ide-accent-soft)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={expandedPlot}
              alt={t('term_plot_modal_title')}
              referrerPolicy="no-referrer"
              className="w-full rounded-xl bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
};

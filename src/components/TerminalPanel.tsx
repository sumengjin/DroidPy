import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, Copy, Check, AlertCircle, Download, Maximize2, X, FileText, Send } from 'lucide-react';
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
  lastDurationMs: number | null;
  runStartedAt?: number | null;
  pendingInputPrompt: string | null;
  inputSessionActive?: boolean;
  onSubmitInput: (value: string) => void;
  onRunRepl: (statement: string) => Promise<void>;
  onSendTermuxStdin?: (text: string) => Promise<void>;
  executionBusy?: boolean;
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
        <div className="my-2 dp-panel p-3 font-sans">
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
  lastDurationMs,
  runStartedAt,
  pendingInputPrompt,
  inputSessionActive = false,
  onSubmitInput,
  onRunRepl,
  onSendTermuxStdin,
  executionBusy = false,
  onOpenLogs,
  enableSandboxAddon = false,
  isDark,
  onClear,
}) => {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const outputWasAtBottomRef = useRef(true);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // One persistent input field serves Python input(), Termux stdin and the
  // normal shell/Python REPL. The active runtime state selects the destination.
  const [terminalValue, setTerminalValue] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
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
    if (pendingInputPrompt !== null || inputSessionActive) {
      inputRef.current?.focus();
    }
  }, [pendingInputPrompt, inputSessionActive]);

  // Keep the newest output visible when Android's soft keyboard changes the
  // visual viewport, without pulling users away from older output they are reading.
  useEffect(() => {
    const keepLatestOutputVisible = () => {
      if (!outputWasAtBottomRef.current) return;
      window.requestAnimationFrame(() => {
        const output = scrollRef.current;
        if (output) output.scrollTop = output.scrollHeight;
      });
    };
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', keepLatestOutputVisible);
    window.addEventListener('resize', keepLatestOutputVisible);
    return () => {
      viewport?.removeEventListener('resize', keepLatestOutputVisible);
      window.removeEventListener('resize', keepLatestOutputVisible);
    };
  }, []);

  const handleCopyAll = async () => {
    const text = entries
      .filter((e) => e.type !== 'plot')
      .map((e) => stripAnsi(e.content))
      .join('\\n');
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

  const submitTerminalInput = async () => {
    const value = terminalValue;
    const waitingForPythonInput = inputSessionActive || pendingInputPrompt !== null;

    if (waitingForPythonInput) {
      setTerminalValue('');
      onSubmitInput(value);
      window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
      return;
    }

    if (engine === 'termux' && status === 'running') {
      if (!onSendTermuxStdin) return;
      setTerminalValue('');
      await onSendTermuxStdin(value);
      window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
      return;
    }

    const statement = value.trim();
    if (!statement || status === 'running' || (engine === 'pyodide' && status === 'loading')) return;

    setCommandHistory((prev) => [statement, ...prev.slice(0, 29)]);
    setHistoryIdx(-1);
    setTerminalValue('');
    await onRunRepl(statement);
    window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  };

  const handleTerminalSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void submitTerminalInput();
  };

  const handleTerminalKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      // Keep Android WebView's soft keyboard available for consecutive stdin prompts.
      event.preventDefault();
      void submitTerminalInput();
    } else if (!inputSessionActive && pendingInputPrompt === null && !(engine === 'termux' && status === 'running') && event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIdx = Math.min(historyIdx + 1, commandHistory.length - 1);
      if (commandHistory[nextIdx] !== undefined) {
        setHistoryIdx(nextIdx);
        setTerminalValue(commandHistory[nextIdx]);
      }
    } else if (!inputSessionActive && pendingInputPrompt === null && !(engine === 'termux' && status === 'running') && event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIdx = historyIdx - 1;
      if (nextIdx < 0) {
        setHistoryIdx(-1);
        setTerminalValue('');
      } else if (commandHistory[nextIdx] !== undefined) {
        setHistoryIdx(nextIdx);
        setTerminalValue(commandHistory[nextIdx]);
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
    <div className="flex flex-col h-full bg-transparent text-[var(--ide-text)] overflow-hidden">
      {/* Compact terminal controls: preserve output space, avoid decorative framing. */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0 px-2 py-0.5 bg-transparent shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--ide-text-muted)] min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-2 shrink-0">
            {(enableSandboxAddon || engine === 'pyodide') && (
              <button
                type="button"
                onClick={() => onChangeEngine('pyodide')}
                disabled={executionBusy}
                className={`min-h-[32px] px-1 text-[11px] font-medium transition-colors whitespace-nowrap disabled:opacity-40 ${
                  engine === 'pyodide'
                    ? 'text-[var(--ide-accent-text)]'
                    : 'text-[var(--ide-text-muted)]'
                }`}
              >
                {t('term_sandbox')}
              </button>
            )}
            <button
              type="button"
              onClick={() => onChangeEngine('termux')}
              disabled={executionBusy}
              className={`min-h-[44px] px-2 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap disabled:opacity-40 ${
                engine === 'termux'
                  ? 'text-[var(--ide-accent-text)]'
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

        <div className="flex flex-wrap items-center gap-0.5 shrink-0">
          {selectedText.length > 0 && (
            <button
              type="button"
              onClick={handleCopySelection}
              className="min-h-[32px] px-1.5 flex items-center gap-1 text-[11px] font-semibold text-[var(--ide-accent-text)] transition-colors whitespace-nowrap"
            >
              {copiedSel ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSel ? t('term_copied_selection') : t('term_copy_selection')}</span>
            </button>
          )}
          {onOpenLogs && (
            <button
              type="button"
              onClick={onOpenLogs}
              className="min-h-[32px] px-1.5 flex items-center gap-1 text-[11px] font-medium text-[var(--ide-text-muted)] hover:text-[var(--ide-accent-text)] transition-colors whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
              <span>{t('logs_btn')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCopyAll}
            disabled={entries.length === 0}
            className="min-h-[32px] px-1.5 flex items-center gap-1 text-[11px] font-medium text-[var(--ide-text-muted)] hover:text-[var(--ide-accent-text)] disabled:opacity-40 transition-colors whitespace-nowrap"
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

      {/* Python is installed automatically when the user first runs code or installs a package. */}
      {engine === 'termux' && embeddedMissingPython && status !== 'running' && (
        <div className="px-3 py-2.5 border-b border-amber-300/60 dark:border-amber-800/60 bg-amber-50/90 dark:bg-amber-950/40 shrink-0">
          <div className="text-xs text-amber-800 dark:text-amber-200 leading-snug">
            {t('tmx_py_missing')}
          </div>
        </div>
      )}

      {/* Output and command line are one continuous terminal surface. */}
      <div
        className="terminal-console-surface flex-1 min-h-0 flex flex-col overflow-hidden"
        onClick={(event) => {
          // Like Termux, the whole terminal surface is an input target.
          // Keep toolbar/action buttons usable without stealing their clicks.
          if (event.target instanceof Element && event.target.closest('button, a')) return;
          inputRef.current?.focus({ preventScroll: true });
        }}
      >
      <div
        ref={scrollRef}
        onScroll={(event) => {
          const output = event.currentTarget;
          outputWasAtBottomRef.current =
            output.scrollHeight - output.scrollTop - output.clientHeight <= 48;
        }}
        className="terminal-selectable flex-1 min-h-0 overflow-y-auto overscroll-contain ide-scroll p-3 sm:p-4 font-mono text-[13px] leading-relaxed space-y-2"
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

      {/* One shared terminal input: prompt responses, Termux stdin and REPL commands. */}
      <form
        onSubmit={handleTerminalSubmit}
        className="terminal-input-row px-2 py-1 bg-transparent flex items-center gap-2 shrink-0"
      >
        <span className={`text-xs font-semibold whitespace-nowrap shrink-0 ${inputSessionActive || pendingInputPrompt !== null ? 'text-amber-700 dark:text-amber-300' : 'text-[var(--ide-accent-text)]'}`}>
          {inputSessionActive || pendingInputPrompt !== null
            ? t('term_input_label')
            : engine === 'termux' ? '$' : '>>>'}
        </span>
        <input
          ref={inputRef}
          type="text"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={terminalValue}
          onChange={(event) => setTerminalValue(event.target.value)}
          onKeyDown={handleTerminalKeyDown}
          enterKeyHint="send"
          aria-label={inputSessionActive || pendingInputPrompt !== null ? t('term_input_label') : 'Terminal command'}
          placeholder={
            pendingInputPrompt ||
            (inputSessionActive
              ? t('term_input_placeholder')
              : engine === 'termux' && status === 'running'
                ? t('term_stdin_placeholder')
                : engine === 'termux'
                  ? t('term_repl_termux_placeholder')
                  : t('term_repl_py_placeholder'))
          }
          style={{ border: 0, outline: 0, boxShadow: 'none', background: 'transparent', appearance: 'none', WebkitAppearance: 'none' }}
          className="flex-1 min-w-0 min-h-[44px] px-2 bg-transparent !border-0 !shadow-none text-sm font-mono text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus:outline-none focus:ring-0"
        />
        <button
          type="submit"
          disabled={
            (inputSessionActive || pendingInputPrompt !== null)
              ? false
              : engine === 'termux' && status === 'running'
                ? !onSendTermuxStdin || !terminalValue
                : !terminalValue.trim() || status === 'running' || (engine === 'pyodide' && status === 'loading')
          }
          className="terminal-submit-button shrink-0 min-h-[36px] px-2.5 inline-flex items-center justify-center gap-1 text-xs font-semibold text-[var(--ide-accent-text)] bg-transparent disabled:opacity-40"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{inputSessionActive || pendingInputPrompt !== null || (engine === 'termux' && status === 'running') ? '送出' : '執行'}</span>
        </button>
      </form>
      </div>

      {/* Plot Lightbox Modal */}
      {expandedPlot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setExpandedPlot(null)}
        >
          <div
            className="relative max-w-3xl w-full dp-sheet p-4"
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

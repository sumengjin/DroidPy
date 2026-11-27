import { Loader2, Pause, Play, Square } from 'lucide-react';

type WorkspaceExecutionVariant = 'phone' | 'tablet';

interface WorkspaceExecutionControlsProps {
  variant: WorkspaceExecutionVariant;
  showRun: boolean;
  pendingInput: boolean;
  termuxStopping: boolean;
  termuxRunning: boolean;
  termuxScriptRunning: boolean;
  termuxPauseBusy: boolean;
  termuxPaused: boolean;
  isRunning: boolean;
  isCoreLoading: boolean;
  labels: {
    cancelInput: string;
    stopping: string;
    pause: string;
    resume: string;
    stop: string;
    loading: string;
    running: string;
    run: string;
  };
  onCancelInput: () => void;
  onTogglePause: () => void;
  onStop: () => void;
  onRun: () => void;
}

/** One execution state machine, with touch-sized phone and tablet presentations. */
export function WorkspaceExecutionControls({
  variant,
  showRun,
  pendingInput,
  termuxStopping,
  termuxRunning,
  termuxScriptRunning,
  termuxPauseBusy,
  termuxPaused,
  isRunning,
  isCoreLoading,
  labels,
  onCancelInput,
  onTogglePause,
  onStop,
  onRun,
}: WorkspaceExecutionControlsProps) {
  const isPhone = variant === 'phone';
  const buttonSize = isPhone ? 'min-h-[44px] px-3 rounded-full' : 'min-h-[40px] px-3 rounded-xl';
  const compactText = 'text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap';

  return (
    <div className="relative z-30 flex items-center gap-1.5 shrink-0 overflow-visible">
      {pendingInput && (
        <button type="button" onClick={onCancelInput} className={`${buttonSize} border-2 border-red-700 bg-red-600 text-white ${compactText}`}>
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>{labels.cancelInput}</span>
        </button>
      )}

      {termuxStopping ? (
        <button type="button" disabled aria-busy="true" className={`${buttonSize} border-2 border-red-700 bg-red-600/80 text-white ${compactText}`}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>{labels.stopping}</span>
        </button>
      ) : termuxRunning ? (
        <>
          {termuxScriptRunning && (
            <button
              type="button"
              onClick={onTogglePause}
              disabled={termuxPauseBusy}
              aria-label={termuxPaused ? labels.resume : labels.pause}
              aria-pressed={termuxPaused}
              className={`${buttonSize} border-2 border-[var(--ide-accent)] bg-[var(--ide-accent-soft)] text-[var(--ide-accent-text)] disabled:opacity-50 ${compactText}`}
            >
              {termuxPauseBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : termuxPaused ? (
                <Play className="w-3.5 h-3.5" />
              ) : (
                <Pause className="w-3.5 h-3.5" />
              )}
              <span>{termuxPaused ? labels.resume : labels.pause}</span>
            </button>
          )}
          <button type="button" onClick={onStop} className={`${buttonSize} bg-red-600 text-white ${compactText}`}>
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>{labels.stop}</span>
          </button>
        </>
      ) : !pendingInput && showRun ? (
        <button
          type="button"
          onClick={onRun}
          disabled={isRunning || isCoreLoading}
          className={`${buttonSize} border-0 bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-50 text-white ${compactText} transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ide-accent)]`}
        >
          {isRunning || isCoreLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          <span>{isCoreLoading ? labels.loading : isRunning ? labels.running : labels.run}</span>
        </button>
      ) : null}
    </div>
  );
}

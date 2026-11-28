import type { CSSProperties } from 'react';
import { Loader2, Pause, Play, Square } from 'lucide-react';

type WorkspaceExecutionVariant = 'phone' | 'tablet';

const borderlessButtonStyle: CSSProperties = {
  border: 'none',
  borderWidth: 0,
  borderStyle: 'none',
  borderColor: 'transparent',
  borderImage: 'none',
  outline: 'none',
  boxShadow: 'none',
  appearance: 'none',
  WebkitAppearance: 'none',
  backgroundImage: 'none',
  backgroundColor: 'transparent',
  borderRadius: 0,
  WebkitTapHighlightColor: 'transparent',
};

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
  const buttonSize = isPhone ? 'min-h-[44px] px-2' : 'min-h-[40px] px-2';
  const compactText = 'text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap';

  return (
    <div className="relative z-30 flex items-center gap-1.5 shrink-0 overflow-visible">
      {pendingInput && (
        <button style={borderlessButtonStyle} type="button" onClick={onCancelInput} className={`dp-execution-control ${buttonSize} text-red-600 dark:text-red-400 ${compactText}`}>
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>{labels.cancelInput}</span>
        </button>
      )}

      {termuxStopping ? (
        <button style={borderlessButtonStyle} type="button" disabled aria-busy="true" className={`dp-execution-control ${buttonSize} text-red-600 dark:text-red-400 ${compactText}`}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>{labels.stopping}</span>
        </button>
      ) : termuxRunning ? (
        <>
          {termuxScriptRunning && (
            <button style={borderlessButtonStyle}
              type="button"
              onClick={onTogglePause}
              disabled={termuxPauseBusy}
              aria-label={termuxPaused ? labels.resume : labels.pause}
              aria-pressed={termuxPaused}
              className={`dp-execution-control ${buttonSize} text-[var(--ide-accent-text)] disabled:opacity-50 ${compactText}`}
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
          <button style={borderlessButtonStyle} type="button" onClick={onStop} className={`dp-execution-control ${buttonSize} text-red-600 dark:text-red-400 ${compactText}`}>
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>{labels.stop}</span>
          </button>
        </>
      ) : !pendingInput && showRun ? (
        <button style={borderlessButtonStyle}
          type="button"
          onClick={onRun}
          disabled={isRunning || isCoreLoading}
          className={`dp-execution-control ${buttonSize} text-[var(--ide-accent-text)] disabled:opacity-50 ${compactText} transition-colors`}
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

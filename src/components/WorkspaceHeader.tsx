import { Code2, Columns2, FolderOpen, Globe, Maximize2, Settings, Terminal as TerminalIcon } from 'lucide-react';
import type { MobileTab } from '../types/ide';
import { WorkspaceExecutionControls } from './WorkspaceExecutionControls';

type ExecutionLabels = {
  cancelInput: string;
  stopping: string;
  pause: string;
  resume: string;
  stop: string;
  loading: string;
  running: string;
  run: string;
};

interface WorkspaceExecutionState {
  pendingInput: boolean;
  termuxStopping: boolean;
  termuxRunning: boolean;
  termuxScriptRunning: boolean;
  termuxPauseBusy: boolean;
  termuxPaused: boolean;
  isRunning: boolean;
  isCoreLoading: boolean;
  labels: ExecutionLabels;
  onCancelInput: () => void;
  onTogglePause: () => void;
  onStop: () => void;
  onRun: () => void;
}

interface WorkspaceHeaderProps {
  variant: 'phone' | 'tablet';
  activeTab: MobileTab;
  labels: {
    editor: string;
    console: string;
    files: string;
    browser: string;
    settings: string;
    openSettings: string;
    splitView: string;
    focusEditor: string;
  };
  onNavigate?: (destination: 'editor' | 'terminal' | 'files' | 'browser') => void;
  onOpenSettings?: () => void;
  tabletSplit?: boolean;
  onToggleSplit?: () => void;
  execution: WorkspaceExecutionState;
}

/** Form-factor-specific header built from shared file and execution controls. */
export function WorkspaceHeader({
  variant,
  activeTab,
  labels,
  onNavigate,
  onOpenSettings,
  tabletSplit = false,
  onToggleSplit,
  execution,
}: WorkspaceHeaderProps) {
  const isPhone = variant === 'phone';
  const title = activeTab === 'editor'
    ? labels.editor
    : activeTab === 'console'
      ? labels.console
      : activeTab === 'files'
        ? labels.files
        : activeTab === 'packages'
          ? labels.settings
          : labels.browser;

  return (
    <header
      className={`relative z-30 isolate flex h-auto items-center justify-between gap-2 pt-safe pb-1 bg-transparent shrink-0 overflow-visible ${
        isPhone ? 'px-2' : 'px-3 gap-3'
      }`}
      style={{
        minHeight: isPhone
          ? 'calc(44px + max(env(safe-area-inset-top, 0px), var(--droidpy-statusbar-inset, 0px)))'
          : 'calc(48px + max(env(safe-area-inset-top, 0px), var(--droidpy-statusbar-inset, 0px)))',
      }}
    >
      {isPhone ? (
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={labels.openSettings}
            title={labels.settings}
            className="dp-icon-button min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl shrink-0"
          >
            <Settings className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold leading-tight truncate">{title}</span>
        </div>
      ) : (
        <nav aria-label={labels.editor} className="flex items-center gap-1 min-w-0 flex-1 basis-0 overflow-hidden">
          {([
            { id: 'editor', label: labels.editor, Icon: Code2 },
            { id: 'terminal', label: labels.console, Icon: TerminalIcon },
            { id: 'files', label: labels.files, Icon: FolderOpen },
            { id: 'browser', label: labels.browser, Icon: Globe },
          ] as const).map(({ id, label, Icon }) => {
            const active = (activeTab === 'console' ? 'terminal' : activeTab) === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate?.(id)}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                title={label}
                className="dp-nav-item min-h-[38px] min-w-0 px-2 inline-flex items-center justify-center gap-1.5 text-xs font-medium whitespace-nowrap"
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      )}

      <div className="relative z-30 flex items-center gap-1.5 shrink-0 overflow-visible">
        {!isPhone && (
          <button
            type="button"
            onClick={onToggleSplit}
            aria-pressed={tabletSplit}
            className="dp-nav-item min-h-[40px] px-3 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            {tabletSplit ? <Maximize2 className="w-3.5 h-3.5" /> : <Columns2 className="w-3.5 h-3.5" />}
            <span>{tabletSplit ? labels.focusEditor : labels.splitView}</span>
          </button>
        )}
        {!isPhone && onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={labels.openSettings}
            title={labels.settings}
            className="dp-icon-button min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl shrink-0"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
        <WorkspaceExecutionControls
          variant={variant}
          showRun={!isPhone || activeTab === 'editor' || activeTab === 'console'}
          {...execution}
        />
      </div>
    </header>
  );
}

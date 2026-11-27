import { Settings } from 'lucide-react';
import type { MobileTab, PythonFile } from '../types/ide';
import { WorkspaceExecutionControls } from './WorkspaceExecutionControls';
import { WorkspaceFileTabs } from './WorkspaceFileTabs';

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
  activeFile: PythonFile;
  files: PythonFile[];
  activeTab: MobileTab;
  labels: {
    editor: string;
    console: string;
    files: string;
    browser: string;
    settings: string;
    openSettings: string;
    createFile: string;
    filesTitle: string;
    splitView: string;
    focusEditor: string;
  };
  onSelectFile: (id: string) => void;
  onCreateFile: () => void;
  onOpenSettings?: () => void;
  tabletSplit?: boolean;
  onToggleSplit?: () => void;
  execution: WorkspaceExecutionState;
}

/** Form-factor-specific header built from shared file and execution controls. */
export function WorkspaceHeader({
  variant,
  activeFile,
  files,
  activeTab,
  labels,
  onSelectFile,
  onCreateFile,
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
    <header className={`relative z-10 flex items-center justify-between gap-2 pt-safe border-b border-[var(--ide-border)]/50 bg-transparent shrink-0 ${
      isPhone ? 'h-13 px-2.5' : 'h-13 px-3 gap-3'
    }`}>
      {isPhone ? (
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={labels.openSettings}
            title={labels.settings}
            className="dp-icon-button min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl shrink-0"
          >
            <Settings className="w-5 h-5" />
          </button>
          <img src="/icon.svg" alt="DroidPy" className="w-6 h-6 shrink-0" referrerPolicy="no-referrer" />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold leading-tight truncate">{title}</span>
            {activeTab === 'editor' && (
              <span className="font-mono text-[11px] text-[var(--ide-text-muted)] truncate leading-tight">
                {activeFile.name}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <WorkspaceFileTabs
            files={files}
            activeFileId={activeFile.id}
            onSelect={onSelectFile}
            onCreate={onCreateFile}
            createLabel={labels.createFile}
            filesLabel={labels.filesTitle}
            variant="tablet"
          />
        </div>
      )}

      <div className="flex items-center gap-2 shrink-0">
        {!isPhone && (
          <button
            type="button"
            onClick={onToggleSplit}
            aria-pressed={tabletSplit}
            className="dp-nav-item min-h-[40px] px-3 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            {tabletSplit ? <span aria-hidden="true">↗</span> : <span aria-hidden="true">▥</span>}
            <span>{tabletSplit ? labels.focusEditor : labels.splitView}</span>
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

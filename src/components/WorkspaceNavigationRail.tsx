import { Code2, FolderOpen, Globe, Settings, Terminal as TerminalIcon } from 'lucide-react';

export type WorkspaceDestination = 'editor' | 'terminal' | 'files' | 'browser';

interface WorkspaceNavigationRailProps {
  activeDestination: WorkspaceDestination;
  labels: Record<WorkspaceDestination, string>;
  settingsLabel: string;
  onNavigate: (destination: WorkspaceDestination) => void;
  onOpenSettings: () => void;
}

const DESTINATIONS = [
  { id: 'editor', Icon: Code2 },
  { id: 'terminal', Icon: TerminalIcon },
  { id: 'files', Icon: FolderOpen },
  { id: 'browser', Icon: Globe },
] as const;

export function WorkspaceNavigationRail({
  activeDestination,
  labels,
  settingsLabel,
  onNavigate,
  onOpenSettings,
}: WorkspaceNavigationRailProps) {
  return (
    <nav
      aria-label="工作區"
      className="w-[88px] shrink-0 flex flex-col items-center justify-between gap-3 py-4 border-r border-[var(--ide-border)] bg-[var(--md-surface-container-low)]"
    >
      <div className="w-full flex flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-1.5">
          <img
            src="/icon.svg"
            alt="DroidPy"
            className="w-9 h-9 rounded-xl"
            referrerPolicy="no-referrer"
          />
          <span className="text-[10px] font-bold tracking-wide text-[var(--ide-text-muted)]">DROIDPY</span>
        </div>

        <div className="w-10 h-px bg-[var(--ide-border)]" />

        <div className="w-full flex flex-col items-center gap-2 px-2">
          {DESTINATIONS.map(({ id, Icon }) => {
            const active = activeDestination === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                aria-label={labels[id]}
                aria-current={active ? 'page' : undefined}
                title={labels[id]}
                className={`w-full min-h-[68px] rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors ${
                  active
                    ? 'bg-[var(--ide-accent-soft)] text-[var(--ide-accent-text)]'
                    : 'text-[var(--ide-text-muted)] hover:bg-[var(--ide-surface-alt)] hover:text-[var(--ide-text)]'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold leading-tight">{labels[id]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenSettings}
        aria-label={settingsLabel}
        title={settingsLabel}
        className="w-14 min-h-[56px] rounded-2xl flex flex-col items-center justify-center gap-1.5 text-[var(--ide-text-muted)] hover:bg-[var(--ide-surface-alt)] hover:text-[var(--ide-text)] transition-colors"
      >
        <Settings className="w-5 h-5" />
        <span className="text-[10px] font-semibold">{settingsLabel}</span>
      </button>
    </nav>
  );
}
